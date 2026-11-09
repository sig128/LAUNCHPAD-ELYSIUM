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
///  - Excluded addresses are set at deployment (plus the bridge minter, see below) and never accrue.
///    Everything rounds down (solvent).
///  Regular launches: minted exactly once, bridgeAdmin is zero, so no further mint or burn can ever happen.
///  The main coin (CANOPY) lives on several chains through Wormhole Native Token Transfers in burning
///  mode: its bridgeAdmin may set one minter, once (the NTT manager). That minter alone mints tokens that
///  arrive from another chain and burns tokens that leave, so the supply across chains stays constant.
///  No owner, no blacklist, no pause, no transfer tax.
contract LaunchToken is ERC20 {
    uint256 public constant RELEASE_DURATION = 3600;
    uint256 private constant RATE_SCALE = 1e18;
    uint256 private constant INDEX_SCALE = 1e36;

    /// @notice The fee vault: the only address that can fund rewards or consume an account's earned rewards.
    address public immutable vault;

    /// @notice May set the bridge minter once. Zero for regular launches, which can never be bridged.
    address public immutable bridgeAdmin;
    /// @notice The Wormhole NTT manager for the main coin; zero until set and for regular launches.
    address public minter;

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
    error NotBridgeAdmin();
    error MinterAlreadySet();
    error MinterHoldsTokens();
    error InvalidMinterZeroAddress();
    error CallerNotMinter(address caller);

    event RewardsFunded(uint256 amount, uint256 rate, uint64 periodFinish);
    event NewMinter(address previousMinter, address newMinter);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        address mintTo,
        address vault_,
        address bridgeAdmin_,
        address[] memory excluded
    ) ERC20(name_, symbol_) {
        vault = vault_;
        bridgeAdmin = bridgeAdmin_;
        for (uint256 i; i < excluded.length; ++i) {
            isExcluded[excluded[i]] = true;
        }
        // mintTo must be an excluded system address (the seed locker), so eligible supply starts at zero.
        _mint(mintTo, supply);
    }

    // ---------------------------------------------------------------- bridge (main coin only)

    /// @notice Set the Wormhole NTT manager as the only minter. Once, by the bridge admin, never changed.
    ///         The minter is excluded from rewards; it must hold no tokens when set.
    function setMinter(address newMinter) external {
        if (bridgeAdmin == address(0) || msg.sender != bridgeAdmin) revert NotBridgeAdmin();
        if (minter != address(0)) revert MinterAlreadySet();
        if (newMinter == address(0)) revert InvalidMinterZeroAddress();
        if (balanceOf(newMinter) != 0) revert MinterHoldsTokens();
        isExcluded[newMinter] = true;
        minter = newMinter;
        emit NewMinter(address(0), newMinter);
    }

    /// @notice Mint tokens that arrived from another chain (NTT `INttToken.mint`).
    function mint(address account, uint256 amount) external {
        if (minter == address(0) || msg.sender != minter) revert CallerNotMinter(msg.sender);
        _mint(account, amount);
    }

    /// @notice Burn tokens that are leaving for another chain (NTT `INttToken.burn`, from the minter's balance).
    function burn(uint256 amount) external {
        if (minter == address(0) || msg.sender != minter) revert CallerNotMinter(msg.sender);
        _burn(msg.sender, amount);
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
