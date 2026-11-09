// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LaunchToken
/// @notice Fixed-supply ERC-20 with balance-based holder rewards paid in the market's pair asset.
/// @dev Reward rules (mirrored by packages/sdk/src/rewards.ts):
///  - Each funding merges with the unreleased balance and the total releases linearly over RELEASE_DURATION.
///  - While no eligible balance exists the release pauses; the remaining duration is preserved.
///  - index += rate * dt * 1e18 / eligibleSupply (rate carries 1e18 scale, index 1e36 per raw unit).
///  - Before any balance change: earned += balance * (index - paid) / 1e36. O(1), no loops, no external calls.
///  - Excluded addresses are fixed at deployment and never accrue. Everything rounds down (solvent).
///  Minted exactly once. No owner, no further mint, no blacklist, no pause, no transfer tax.
contract LaunchToken is ERC20 {
    uint256 public constant RELEASE_DURATION = 3600;
    uint256 private constant RATE_SCALE = 1e18;
    uint256 private constant INDEX_SCALE = 1e36;

    /// @notice The fee vault: the only address that can fund rewards or consume an account's earned rewards.
    address public immutable vault;

    mapping(address => bool) public isExcluded;

    uint256 public rate;
    uint64 public periodFinish;
    uint64 public lastUpdate;
    uint256 public rewardIndex;
    uint256 public rateDust;
    uint256 public eligibleSupply;
    uint256 public fundedTotal;
    uint256 public releasedScaled;

    mapping(address => uint256) public paidIndex;
    mapping(address => uint256) public earned;

    error OnlyVault();

    event RewardsFunded(uint256 amount, uint256 rate, uint64 periodFinish);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        address mintTo,
        address vault_,
        address[] memory excluded
    ) ERC20(name_, symbol_) {
        vault = vault_;
        for (uint256 i; i < excluded.length; ++i) {
            isExcluded[excluded[i]] = true;
        }
        // mintTo must be an excluded system address (the seed locker), so eligible supply starts at zero.
        _mint(mintTo, supply);
    }

    // ---------------------------------------------------------------- views

    function claimable(address account) external view returns (uint256) {
        uint64 now_ = uint64(block.timestamp);
        uint64 t = now_ < periodFinish ? now_ : periodFinish;
        uint256 index = rewardIndex;
        if (t > lastUpdate && eligibleSupply != 0) {
            index += (rate * (t - lastUpdate) * RATE_SCALE) / eligibleSupply;
        }
        if (isExcluded[account]) return earned[account];
        return earned[account] + (balanceOf(account) * (index - paidIndex[account])) / INDEX_SCALE;
    }

    function releasedTotal() external view returns (uint256) {
        uint64 now_ = uint64(block.timestamp);
        uint64 t = now_ < periodFinish ? now_ : periodFinish;
        uint256 scaled = releasedScaled;
        if (t > lastUpdate && eligibleSupply != 0) scaled += rate * (t - lastUpdate);
        return scaled / RATE_SCALE;
    }

    // ---------------------------------------------------------------- vault hooks

    function fundRewards(uint256 amount) external {
        if (msg.sender != vault) revert OnlyVault();
        _updateGlobal();
        uint64 now_ = uint64(block.timestamp);
        uint256 leftover = now_ < periodFinish ? rate * (periodFinish - now_) : 0;
        uint256 total = amount * RATE_SCALE + leftover + rateDust;
        rate = total / RELEASE_DURATION;
        rateDust = total % RELEASE_DURATION;
        periodFinish = now_ + uint64(RELEASE_DURATION);
        lastUpdate = now_;
        fundedTotal += amount;
        emit RewardsFunded(amount, rate, periodFinish);
    }

    /// @notice Settles and zeroes `account`'s earned rewards; the vault pays them out.
    function consumeRewards(address account) external returns (uint256 amount) {
        if (msg.sender != vault) revert OnlyVault();
        _updateGlobal();
        if (!isExcluded[account]) _settle(account);
        amount = earned[account];
        earned[account] = 0;
    }

    // ---------------------------------------------------------------- internals

    function _update(address from, address to, uint256 value) internal override {
        _updateGlobal();
        bool fromEligible = from != address(0) && !isExcluded[from];
        bool toEligible = to != address(0) && !isExcluded[to];
        if (fromEligible) _settle(from);
        if (toEligible && to != from) _settle(to);
        super._update(from, to, value);
        if (fromEligible && !toEligible) eligibleSupply -= value;
        else if (!fromEligible && toEligible) eligibleSupply += value;
    }

    function _updateGlobal() private {
        uint64 now_ = uint64(block.timestamp);
        uint64 last = lastUpdate;
        uint64 finish = periodFinish;
        uint64 t = now_ < finish ? now_ : finish;
        if (t > last) {
            if (eligibleSupply == 0) {
                // Pause: keep the unreleased duration and resume it from now.
                periodFinish = now_ + (finish - last);
            } else {
                uint256 released = rate * (t - last);
                rewardIndex += (released * RATE_SCALE) / eligibleSupply;
                releasedScaled += released;
            }
        }
        lastUpdate = now_;
    }

    function _settle(address account) private {
        uint256 index = rewardIndex;
        uint256 paid = paidIndex[account];
        if (index != paid) {
            uint256 bal = balanceOf(account);
            if (bal != 0) earned[account] += (bal * (index - paid)) / INDEX_SCALE;
            paidIndex[account] = index;
        }
    }
}
