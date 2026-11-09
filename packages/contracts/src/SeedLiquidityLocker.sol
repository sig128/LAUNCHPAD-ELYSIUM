// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SeedLiquidityLocker
/// @notice Owns every launch's seed position inside the PoolManager. It has no function that removes
///         liquidity, collects fees or moves tokens out, and it is not upgradeable, so seed liquidity is
///         locked permanently. The hook also rejects every liquidity removal.
contract SeedLiquidityLocker is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    address private immutable deployer;
    address public factory;

    error NotAuthorized();
    error AlreadyInitialized();
    error NotSingleSided();

    event SeedLocked(PoolId indexed poolId, address indexed token, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 tokensDeposited);

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
        deployer = msg.sender;
    }

    function initialize(address factory_) external {
        if (msg.sender != deployer) revert NotAuthorized();
        if (factory != address(0)) revert AlreadyInitialized();
        factory = factory_;
    }

    function lockSeed(PoolKey calldata key, int24 tickLower, int24 tickUpper, uint128 liquidity, address token) external {
        if (msg.sender != factory) revert NotAuthorized();
        poolManager.unlock(abi.encode(key, tickLower, tickUpper, liquidity, token));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotAuthorized();
        (PoolKey memory key, int24 tickLower, int24 tickUpper, uint128 liquidity, address token) =
            abi.decode(data, (PoolKey, int24, int24, uint128, address));
        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: int256(uint256(liquidity)), salt: bytes32(0)}),
            ""
        );
        bool tokenIs0 = Currency.unwrap(key.currency0) == token;
        int128 tokenDelta = tokenIs0 ? delta.amount0() : delta.amount1();
        int128 otherDelta = tokenIs0 ? delta.amount1() : delta.amount0();
        if (otherDelta != 0 || tokenDelta > 0) revert NotSingleSided();
        uint256 owed = uint256(uint128(-tokenDelta));
        poolManager.sync(Currency.wrap(token));
        IERC20(token).safeTransfer(address(poolManager), owed);
        poolManager.settle();
        emit SeedLocked(key.toId(), token, tickLower, tickUpper, liquidity, owed);
        return "";
    }
}
