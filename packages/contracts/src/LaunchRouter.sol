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
/// @notice Exact-input buys and sells for CANOPY markets only, with a minimum output and a deadline.
///         Pays and receives the market's pair asset (native HYPE or an allowlisted ERC-20). Holds no funds
///         between transactions and never accepts an arbitrary target.
contract LaunchRouter is IUnlockCallback, ReentrancyGuardTransient {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    LaunchHook public immutable hook;

    error NotPoolManager();
    error NotCanopyPool();
    error Expired();
    error Slippage();
    error BadValue();
    error RefundFailed();

    struct Job {
        PoolKey key;
        bool zeroForOne;
        bool payNative;
        uint256 amountIn;
        uint256 minOut;
        address payer;
        address recipient;
    }

    constructor(IPoolManager poolManager_, LaunchHook hook_) {
        poolManager = poolManager_;
        hook = hook_;
    }

    /// @notice Spend exactly `amountIn` of the pair asset (1% fee included) for at least `minOut` tokens.
    function buy(PoolKey calldata key, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 out)
    {
        bool pairIs0 = _check(key, deadline);
        bool native = key.currency0.isAddressZero() && pairIs0;
        if (native ? msg.value != amountIn : msg.value != 0) revert BadValue();
        out = _run(Job(key, pairIs0, native, amountIn, minOut, msg.sender, recipient));
    }

    /// @notice Sell exactly `amountIn` tokens for at least `minOut` of the pair asset after the 1% fee.
    function sell(PoolKey calldata key, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external
        nonReentrant
        returns (uint256 out)
    {
        bool pairIs0 = _check(key, deadline);
        out = _run(Job(key, !pairIs0, false, amountIn, minOut, msg.sender, recipient));
    }

    function _check(PoolKey calldata key, uint256 deadline) private view returns (bool pairIs0) {
        if (block.timestamp > deadline) revert Expired();
        if (address(key.hooks) != address(hook)) revert NotCanopyPool();
        bool registered;
        (, pairIs0, registered) = hook.pools(key.toId());
        if (!registered) revert NotCanopyPool();
    }

    function _run(Job memory job) private returns (uint256) {
        return abi.decode(poolManager.unlock(abi.encode(job)), (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        Job memory job = abi.decode(data, (Job));
        BalanceDelta d = poolManager.swap(
            job.key,
            SwapParams({
                zeroForOne: job.zeroForOne,
                amountSpecified: -int256(job.amountIn),
                sqrtPriceLimitX96: job.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        (Currency inCur, Currency outCur) = job.zeroForOne ? (job.key.currency0, job.key.currency1) : (job.key.currency1, job.key.currency0);
        uint256 pay = uint256(uint128(-(job.zeroForOne ? d.amount0() : d.amount1())));
        uint256 out = uint256(uint128(job.zeroForOne ? d.amount1() : d.amount0()));
        if (out < job.minOut) revert Slippage();

        if (job.payNative) {
            poolManager.settle{value: pay}();
            if (pay < job.amountIn) {
                (bool ok,) = job.payer.call{value: job.amountIn - pay}("");
                if (!ok) revert RefundFailed();
            }
        } else {
            poolManager.sync(inCur);
            IERC20(Currency.unwrap(inCur)).safeTransferFrom(job.payer, address(poolManager), pay);
            poolManager.settle();
        }
        poolManager.take(outCur, job.recipient, out);
        return abi.encode(out);
    }
}
