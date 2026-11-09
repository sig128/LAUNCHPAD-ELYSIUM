// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {LaunchHook} from "./LaunchHook.sol";

/// @title LaunchRouter
/// @notice Exact-input swaps across CANOPY markets only, with a minimum output and a deadline.
///         A path has one or two hops, so a trader can pay native HYPE for a coin paired with the main
///         coin (HYPE -> CANOPY -> coin) or sell it straight back to HYPE (coin -> CANOPY -> HYPE) in one
///         transaction. The intermediate amount never leaves the PoolManager. Every hop pays its market's
///         1% fee. Holds no funds between transactions and never accepts an arbitrary target.
contract LaunchRouter is IUnlockCallback, ReentrancyGuardTransient {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_HOPS = 2;

    IPoolManager public immutable poolManager;
    LaunchHook public immutable hook;

    error NotPoolManager();
    error NotCanopyPool();
    error Expired();
    error Slippage();
    error BadValue();
    error BadPath();
    error RefundFailed();

    /// @notice One swap step: `zeroForOne` is true when paying currency0 for currency1.
    struct Hop {
        PoolKey key;
        bool zeroForOne;
    }

    struct Job {
        Hop[] path;
        uint256 amountIn;
        uint256 minOut;
        address payer;
        address recipient;
    }

    constructor(IPoolManager poolManager_, LaunchHook hook_) {
        poolManager = poolManager_;
        hook = hook_;
    }

    /// @notice Spend exactly `amountIn` of the market's pair asset (1% fee included) for at least `minOut` tokens.
    function buy(PoolKey calldata key, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        Hop[] memory path = new Hop[](1);
        path[0] = Hop(key, _pairIs0(key));
        return _swap(path, amountIn, minOut, recipient, deadline);
    }

    /// @notice Sell exactly `amountIn` tokens for at least `minOut` of the pair asset after the 1% fee.
    function sell(PoolKey calldata key, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external
        nonReentrant
        returns (uint256)
    {
        Hop[] memory path = new Hop[](1);
        path[0] = Hop(key, !_pairIs0(key));
        return _swap(path, amountIn, minOut, recipient, deadline);
    }

    /// @notice Spend exactly `amountIn` of the first hop's input for at least `minOut` of the last hop's output.
    ///         Each hop's output currency must be the next hop's input currency.
    function swapExactIn(Hop[] calldata path, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        return _swap(path, amountIn, minOut, recipient, deadline);
    }

    function _swap(Hop[] memory path, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        private
        returns (uint256)
    {
        if (block.timestamp > deadline) revert Expired();
        uint256 n = path.length;
        if (n == 0 || n > MAX_HOPS) revert BadPath();
        for (uint256 i; i < n; ++i) {
            _pairIs0(path[i].key);
            if (i != 0 && Currency.unwrap(_out(path[i - 1])) != Currency.unwrap(_in(path[i]))) revert BadPath();
        }
        bool payNative = _in(path[0]).isAddressZero();
        if (payNative ? msg.value != amountIn : msg.value != 0) revert BadValue();
        Job memory job = Job(path, amountIn, minOut, msg.sender, recipient);
        return abi.decode(poolManager.unlock(abi.encode(job)), (uint256));
    }

    /// @dev Reverts unless the pool belongs to a CANOPY market; returns whether its pair asset is currency0.
    function _pairIs0(PoolKey memory key) private view returns (bool pairIs0) {
        if (address(key.hooks) != address(hook)) revert NotCanopyPool();
        bool registered;
        (, pairIs0, registered) = hook.pools(key.toId());
        if (!registered) revert NotCanopyPool();
    }

    function _in(Hop memory h) private pure returns (Currency) {
        return h.zeroForOne ? h.key.currency0 : h.key.currency1;
    }

    function _out(Hop memory h) private pure returns (Currency) {
        return h.zeroForOne ? h.key.currency1 : h.key.currency0;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        Job memory job = abi.decode(data, (Job));

        uint256 amount = job.amountIn;
        uint256 paid;
        uint256 n = job.path.length;
        for (uint256 i; i < n; ++i) {
            Hop memory h = job.path[i];
            BalanceDelta d = poolManager.swap(
                h.key,
                SwapParams({
                    zeroForOne: h.zeroForOne,
                    amountSpecified: -int256(amount),
                    sqrtPriceLimitX96: h.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                ""
            );
            uint256 consumed = uint256(uint128(-(h.zeroForOne ? d.amount0() : d.amount1())));
            if (i == 0) {
                paid = consumed;
            } else if (consumed < amount) {
                // The pool ran out before using the whole intermediate amount: hand the rest to the recipient.
                poolManager.take(_in(h), job.recipient, amount - consumed);
            }
            amount = uint256(uint128(h.zeroForOne ? d.amount1() : d.amount0()));
        }
        if (amount < job.minOut) revert Slippage();

        Currency inCur = _in(job.path[0]);
        if (inCur.isAddressZero()) {
            poolManager.settle{value: paid}();
            if (paid < job.amountIn) {
                (bool ok,) = job.payer.call{value: job.amountIn - paid}("");
                if (!ok) revert RefundFailed();
            }
        } else {
            poolManager.sync(inCur);
            IERC20(Currency.unwrap(inCur)).safeTransferFrom(job.payer, address(poolManager), paid);
            poolManager.settle();
        }
        poolManager.take(_out(job.path[n - 1]), job.recipient, amount);
        return abi.encode(amount);
    }
}
