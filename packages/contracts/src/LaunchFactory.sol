// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {LaunchHook} from "./LaunchHook.sol";
import {FeeVault} from "./FeeVault.sol";
import {SeedLiquidityLocker} from "./SeedLiquidityLocker.sol";

/// @title LaunchFactory
/// @notice Atomic launch: token, pool with the CANOPY hook, locked single-sided seed position and an
///         optional disclosed creator buy, in one transaction. Each launch picks its pair asset: native
///         HYPE (address(0)) or an allowlisted ERC-20 such as a bridged stock token. The pair is fixed
///         for the life of the market; allowlist changes only affect future launches.
contract LaunchFactory is IUnlockCallback, ReentrancyGuardTransient {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    int24 public constant TICK_SPACING = 200;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant MIN_OPENING_FDV = 1e9;
    uint256 public constant MAX_OPENING_FDV = 1e36;

    IPoolManager public immutable poolManager;
    FeeVault public immutable vault;
    SeedLiquidityLocker public immutable locker;
    address public immutable owner;
    LaunchHook public hook;

    bool public launchesPaused;
    mapping(address pair => bool) public pairAllowed;

    struct LaunchParams {
        string name;
        string symbol;
        address pair;
        uint256 openingFdv;
        bool surrenderCreatorShare;
        bytes32 salt;
        uint256 creatorBuy;
        uint256 minCreatorTokens;
    }

    struct LaunchInfo {
        PoolKey key;
        address creator;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    mapping(address token => LaunchInfo) private _launches;
    address[] public allTokens;

    error NotOwner();
    error NotPoolManager();
    error HookAlreadySet();
    error NotReady();
    error LaunchesArePaused();
    error PairNotAllowed();
    error BadOpeningFdv();
    error BadValue();
    error Slippage();
    error RefundFailed();

    /// @notice A market went live. Name and symbol are read from the token itself.
    event Launched(
        address indexed token,
        address indexed pair,
        PoolId indexed poolId,
        address creator,
        uint256 openingFdv,
        uint256 creatorBuy,
        uint256 creatorTokens,
        bool creatorShareSurrendered
    );
    /// @notice The locked seed position created for a launch.
    event SeedRange(address indexed token, uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper, uint128 liquidity);
    event PairAllowed(address indexed pair, bool allowed);
    event LaunchesPaused(bool paused);

    constructor(IPoolManager poolManager_, FeeVault vault_, SeedLiquidityLocker locker_, address owner_) {
        poolManager = poolManager_;
        vault = vault_;
        locker = locker_;
        owner = owner_;
        pairAllowed[address(0)] = true;
        emit PairAllowed(address(0), true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setHook(LaunchHook hook_) external onlyOwner {
        if (address(hook) != address(0)) revert HookAlreadySet();
        hook = hook_;
    }

    /// @notice Allow or disallow a pair asset for future launches. Existing markets are unaffected.
    function setPairAllowed(address pair, bool allowed) external onlyOwner {
        pairAllowed[pair] = allowed;
        emit PairAllowed(pair, allowed);
    }

    /// @notice Pause new launches only. Trading, sells and claims are never affected.
    function setLaunchesPaused(bool paused) external onlyOwner {
        launchesPaused = paused;
        emit LaunchesPaused(paused);
    }

    function launchInfo(address token) external view returns (LaunchInfo memory) {
        return _launches[token];
    }

    function launchCount() external view returns (uint256) {
        return allTokens.length;
    }

    // ---------------------------------------------------------------- launch

    function launch(LaunchParams calldata p) external payable nonReentrant returns (address token) {
        if (address(hook) == address(0)) revert NotReady();
        if (launchesPaused) revert LaunchesArePaused();
        if (!pairAllowed[p.pair]) revert PairNotAllowed();
        if (p.openingFdv < MIN_OPENING_FDV || p.openingFdv > MAX_OPENING_FDV) revert BadOpeningFdv();
        if (p.pair == address(0) ? msg.value != p.creatorBuy : msg.value != 0) revert BadValue();

        token = _deployToken(p);
        (PoolKey memory key, bool pairIs0) = _createPool(p, token);
        vault.registerLaunch(token, Currency.wrap(p.pair), msg.sender, p.surrenderCreatorShare);
        allTokens.push(token);

        uint256 creatorTokens;
        if (p.creatorBuy != 0) {
            if (p.pair != address(0)) IERC20(p.pair).safeTransferFrom(msg.sender, address(this), p.creatorBuy);
            creatorTokens = abi.decode(poolManager.unlock(abi.encode(key, pairIs0, p.creatorBuy, msg.sender)), (uint256));
            if (creatorTokens < p.minCreatorTokens) revert Slippage();
        }
        emit Launched(token, p.pair, key.toId(), msg.sender, p.openingFdv, p.creatorBuy, creatorTokens, p.surrenderCreatorShare);
    }

    function _createPool(LaunchParams calldata p, address token) private returns (PoolKey memory key, bool pairIs0) {
        pairIs0 = p.pair < token;
        key = PoolKey({
            currency0: Currency.wrap(pairIs0 ? p.pair : token),
            currency1: Currency.wrap(pairIs0 ? token : p.pair),
            fee: 0,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        (int24 tickLower, int24 tickUpper, uint160 sqrtStart, uint128 liquidity) = seedRange(pairIs0, p.openingFdv);
        hook.registerPool(key, token, pairIs0);
        poolManager.initialize(key, sqrtStart);
        locker.lockSeed(key, tickLower, tickUpper, liquidity, token);
        _launches[token] = LaunchInfo({key: key, creator: msg.sender, tickLower: tickLower, tickUpper: tickUpper, liquidity: liquidity});
        emit SeedRange(token, sqrtStart, tickLower, tickUpper, liquidity);
    }

    function _deployToken(LaunchParams calldata p) private returns (address) {
        address[] memory excluded = new address[](6);
        excluded[0] = address(poolManager);
        excluded[1] = address(locker);
        excluded[2] = address(this);
        excluded[3] = address(vault);
        excluded[4] = address(hook);
        excluded[5] = BURN;
        return address(
            new LaunchToken{salt: keccak256(abi.encode(msg.sender, p.salt))}(
                p.name, p.symbol, TOTAL_SUPPLY, address(locker), address(vault), excluded
            )
        );
    }

    /// @notice Seed range for a single-sided position holding the whole supply from the opening price upward.
    /// @dev Opening price in pair units per token = openingFdv / TOTAL_SUPPLY (raw units). The tick is
    ///      rounded down to the tick spacing, so the effective opening FDV can differ by under 2%.
    function seedRange(bool pairIs0, uint256 openingFdv)
        public
        pure
        returns (int24 tickLower, int24 tickUpper, uint160 sqrtStart, uint128 liquidity)
    {
        // Pool price is currency1 per currency0.
        uint256 num = pairIs0 ? TOTAL_SUPPLY : openingFdv;
        uint256 den = pairIs0 ? openingFdv : TOTAL_SUPPLY;
        uint160 sqrtP = uint160(Math.sqrt(FullMath.mulDiv(num, 1 << 192, den)));
        int24 aligned = _floorToSpacing(TickMath.getTickAtSqrtPrice(sqrtP));
        uint256 amount = TOTAL_SUPPLY - 1;
        if (pairIs0) {
            // Token is currency1: position sits below the start tick and is all token1.
            tickLower = TickMath.minUsableTick(TICK_SPACING);
            tickUpper = aligned;
            sqrtStart = TickMath.getSqrtPriceAtTick(tickUpper);
            liquidity = LiquidityAmounts.getLiquidityForAmount1(TickMath.getSqrtPriceAtTick(tickLower), sqrtStart, amount);
        } else {
            // Token is currency0: position sits above the start tick and is all token0.
            tickLower = aligned;
            tickUpper = TickMath.maxUsableTick(TICK_SPACING);
            sqrtStart = TickMath.getSqrtPriceAtTick(tickLower);
            liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtStart, TickMath.getSqrtPriceAtTick(tickUpper), amount);
        }
    }

    function _floorToSpacing(int24 tick) private pure returns (int24) {
        int24 compressed = tick / TICK_SPACING;
        if (tick < 0 && tick % TICK_SPACING != 0) compressed--;
        return compressed * TICK_SPACING;
    }

    // ---------------------------------------------------------------- creator buy

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, bool pairIs0, uint256 amountIn, address recipient) = abi.decode(data, (PoolKey, bool, uint256, address));
        BalanceDelta d = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: pairIs0,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: pairIs0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        uint256 pay = uint256(uint128(-(pairIs0 ? d.amount0() : d.amount1())));
        uint256 out = uint256(uint128(pairIs0 ? d.amount1() : d.amount0()));
        Currency pair = pairIs0 ? key.currency0 : key.currency1;
        Currency tok = pairIs0 ? key.currency1 : key.currency0;
        _settle(pair, pay);
        poolManager.take(tok, recipient, out);
        if (pay < amountIn) _refund(pair, recipient, amountIn - pay);
        return abi.encode(out);
    }

    function _settle(Currency currency, uint256 amount) private {
        if (currency.isAddressZero()) {
            poolManager.settle{value: amount}();
        } else {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
            poolManager.settle();
        }
    }

    function _refund(Currency currency, address to, uint256 amount) private {
        if (currency.isAddressZero()) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert RefundFailed();
        } else {
            IERC20(Currency.unwrap(currency)).safeTransfer(to, amount);
        }
    }
}
