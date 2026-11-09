// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {FeeVault} from "./FeeVault.sol";

/// @title LaunchHook
/// @notice Charges the single 1% fee on the pair-asset side of every CANOPY swap and sends it to the FeeVault.
///  - Buys (exact input of the pair asset): fee = floor(gross input * 100 / 10_000), taken before the pool swaps.
///  - Sells (exact input of the launch token): fee = floor(gross pair output * 100 / 10_000), taken after.
///  - Exact-output swaps are rejected; they are never quoted.
///  - Only pools registered by the factory can be initialized with this hook, with an LP fee of 0.
///  - Only the seed locker can add liquidity; nobody can remove it; donations are disabled.
contract LaunchHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    uint256 public constant FEE_BPS = 100;

    struct PoolInfo {
        address token;
        bool pairIs0;
        bool registered;
    }

    IPoolManager public immutable poolManager;
    address public immutable factory;
    FeeVault public immutable vault;
    address public immutable locker;

    mapping(PoolId => PoolInfo) public pools;

    error NotPoolManager();
    error NotFactory();
    error UnknownPool();
    error LpFeeMustBeZero();
    error LiquidityLocked();
    error DonationsDisabled();
    error ExactOutputUnsupported();
    error HookNotImplemented();

    event FeeTaken(PoolId indexed poolId, address indexed token, bool isBuy, uint256 grossPairAmount, uint256 fee);

    constructor(IPoolManager poolManager_, address factory_, FeeVault vault_, address locker_) {
        poolManager = poolManager_;
        factory = factory_;
        vault = vault_;
        locker = locker_;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: true,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /// @notice The factory registers a pool right before initializing it.
    function registerPool(PoolKey calldata key, address token, bool pairIs0) external {
        if (msg.sender != factory) revert NotFactory();
        pools[key.toId()] = PoolInfo({token: token, pairIs0: pairIs0, registered: true});
    }

    // ---------------------------------------------------------------- lifecycle

    function beforeInitialize(address sender, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (sender != factory) revert NotFactory();
        if (!pools[key.toId()].registered) revert UnknownPool();
        if (key.fee != 0) revert LpFeeMustBeZero();
        return IHooks.beforeInitialize.selector;
    }

    function beforeAddLiquidity(address sender, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != locker) revert LiquidityLocked();
        return IHooks.beforeAddLiquidity.selector;
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        revert LiquidityLocked();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external view onlyPoolManager returns (bytes4) {
        revert DonationsDisabled();
    }

    // ---------------------------------------------------------------- swaps

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        PoolInfo memory p = pools[id];
        if (!p.registered) revert UnknownPool();
        if (params.amountSpecified >= 0) revert ExactOutputUnsupported();
        bool isBuy = params.zeroForOne == p.pairIs0;
        if (!isBuy) return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);

        uint256 gross = uint256(-params.amountSpecified);
        uint256 fee = (gross * FEE_BPS) / 10_000;
        if (fee == 0) return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);

        Currency pair = p.pairIs0 ? key.currency0 : key.currency1;
        poolManager.mint(address(vault), pair.toId(), fee);
        vault.recordFee(p.token, fee);
        emit FeeTaken(id, p.token, true, gross, fee);
        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(int128(int256(fee)), 0), 0);
    }

    function afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, int128)
    {
        PoolId id = key.toId();
        PoolInfo memory p = pools[id];
        bool isBuy = params.zeroForOne == p.pairIs0;
        if (isBuy) return (IHooks.afterSwap.selector, 0);

        int128 pairOut = p.pairIs0 ? delta.amount0() : delta.amount1();
        if (pairOut <= 0) return (IHooks.afterSwap.selector, 0);
        uint256 gross = uint256(uint128(pairOut));
        uint256 fee = (gross * FEE_BPS) / 10_000;
        if (fee == 0) return (IHooks.afterSwap.selector, 0);

        Currency pair = p.pairIs0 ? key.currency0 : key.currency1;
        poolManager.mint(address(vault), pair.toId(), fee);
        vault.recordFee(p.token, fee);
        emit FeeTaken(id, p.token, false, gross, fee);
        return (IHooks.afterSwap.selector, int128(int256(fee)));
    }

    // ---------------------------------------------------------------- unused callbacks

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, BalanceDelta)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, BalanceDelta)
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }
}
