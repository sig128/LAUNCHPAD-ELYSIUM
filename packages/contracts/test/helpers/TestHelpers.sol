// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @notice Stand-in for a bridged tokenized stock (plain 18-decimal ERC-20). Test use only.
contract MockStock is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Attempts operations the hook must reject. Test use only.
contract Attacker is IUnlockCallback {
    IPoolManager public immutable pm;

    constructor(IPoolManager pm_) {
        pm = pm_;
    }

    function tryExactOutput(PoolKey calldata key, bool zeroForOne, int256 amountOut) external {
        pm.unlock(abi.encode(uint8(1), abi.encode(key, zeroForOne, amountOut)));
    }

    function tryAddLiquidity(PoolKey calldata key, int24 tickLower, int24 tickUpper) external {
        pm.unlock(abi.encode(uint8(2), abi.encode(key, tickLower, tickUpper)));
    }

    function tryRemoveLiquidity(PoolKey calldata key, int24 tickLower, int24 tickUpper) external {
        pm.unlock(abi.encode(uint8(3), abi.encode(key, tickLower, tickUpper)));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        (uint8 kind, bytes memory inner) = abi.decode(data, (uint8, bytes));
        if (kind == 1) {
            (PoolKey memory key, bool zeroForOne, int256 amountOut) = abi.decode(inner, (PoolKey, bool, int256));
            pm.swap(
                key,
                SwapParams({
                    zeroForOne: zeroForOne,
                    amountSpecified: amountOut,
                    sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                ""
            );
        } else {
            (PoolKey memory key, int24 lo, int24 hi) = abi.decode(inner, (PoolKey, int24, int24));
            pm.modifyLiquidity(
                key, ModifyLiquidityParams({tickLower: lo, tickUpper: hi, liquidityDelta: kind == 2 ? int256(1e18) : -int256(1e18), salt: 0}), ""
            );
        }
        return "";
    }
}
