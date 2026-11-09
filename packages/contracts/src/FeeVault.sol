// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {LaunchToken} from "./LaunchToken.sol";

/// @title FeeVault
/// @notice Holds collected fees as ERC-6909 claims on the PoolManager and keeps a separate ledger per launch.
///         Every launch is paid only from its own ledger, in its own pair asset (native HYPE or an
///         allowlisted ERC-20 such as a bridged stock token).
/// @dev Split of each fee (policy v1): reserve, creator, liquidity growth and protocol each get
///      floor(fee * 1000 / 10000); holders get the remainder, so dust goes to holders and parts sum to fee.
///      If the creator surrendered their share, creator = 0 and that share goes to holders.
contract FeeVault is IUnlockCallback, ReentrancyGuardTransient {
    using CurrencyLibrary for Currency;

    uint256 public constant BPS = 10_000;
    uint256 public constant RESERVE_BPS = 1_000;
    uint256 public constant CREATOR_BPS = 1_000;
    uint256 public constant LIQUIDITY_BPS = 1_000;
    uint256 public constant PROTOCOL_BPS = 1_000;

    struct Ledger {
        Currency pair;
        address creator;
        bool registered;
        bool creatorSurrendered;
        uint256 feesTotal;
        uint256 holderFunded;
        uint256 holderPaid;
        uint256 creatorOwed;
        uint256 creatorPaid;
        uint256 reserve;
        uint256 liquidityBudget;
        uint256 protocolOwed;
        uint256 protocolPaid;
    }

    IPoolManager public immutable poolManager;
    address public immutable treasury;
    address private immutable deployer;

    address public hook;
    address public factory;

    mapping(address token => Ledger) public ledgers;

    error AlreadyInitialized();
    error NotAuthorized();
    error UnknownLaunch();
    error AlreadySurrendered();
    error LedgerExceeded();

    event FeeRecorded(
        address indexed token, uint256 fee, uint256 holders, uint256 reserve, uint256 creator, uint256 liquidity, uint256 protocol
    );
    event LaunchRegistered(address indexed token, Currency pair, address indexed creator, bool creatorSurrendered);
    event HolderRewardsClaimed(address indexed token, address indexed account, address recipient, uint256 amount);
    event CreatorFeesClaimed(address indexed token, address recipient, uint256 amount);
    event CreatorShareSurrendered(address indexed token);
    event ProtocolFeesClaimed(address indexed token, address recipient, uint256 amount);

    constructor(IPoolManager poolManager_, address treasury_) {
        poolManager = poolManager_;
        treasury = treasury_;
        deployer = msg.sender;
    }

    /// @notice One-time wiring by the deployer. Cannot be changed afterwards.
    function initialize(address hook_, address factory_) external {
        if (msg.sender != deployer) revert NotAuthorized();
        if (hook != address(0)) revert AlreadyInitialized();
        hook = hook_;
        factory = factory_;
    }

    // ---------------------------------------------------------------- system

    function registerLaunch(address token, Currency pair, address creator, bool surrendered) external {
        if (msg.sender != factory) revert NotAuthorized();
        Ledger storage l = ledgers[token];
        l.pair = pair;
        l.creator = creator;
        l.registered = true;
        l.creatorSurrendered = surrendered;
        emit LaunchRegistered(token, pair, creator, surrendered);
    }

    /// @notice Called by the hook after it minted `fee` claims of the pair asset to this vault.
    function recordFee(address token, uint256 fee) external {
        if (msg.sender != hook) revert NotAuthorized();
        Ledger storage l = ledgers[token];
        if (!l.registered) revert UnknownLaunch();
        uint256 reserve = (fee * RESERVE_BPS) / BPS;
        uint256 liquidity = (fee * LIQUIDITY_BPS) / BPS;
        uint256 protocol = (fee * PROTOCOL_BPS) / BPS;
        uint256 creator = l.creatorSurrendered ? 0 : (fee * CREATOR_BPS) / BPS;
        uint256 holders = fee - reserve - liquidity - protocol - creator;
        l.feesTotal += fee;
        l.reserve += reserve;
        l.liquidityBudget += liquidity;
        l.protocolOwed += protocol;
        l.creatorOwed += creator;
        l.holderFunded += holders;
        if (holders != 0) LaunchToken(token).fundRewards(holders);
        emit FeeRecorded(token, fee, holders, reserve, creator, liquidity, protocol);
    }

    // ---------------------------------------------------------------- claims

    /// @notice Claim your released holder rewards for `token`, paid in that market's pair asset.
    function claimHolderRewards(address token, address recipient) external nonReentrant returns (uint256 amount) {
        Ledger storage l = ledgers[token];
        if (!l.registered) revert UnknownLaunch();
        amount = LaunchToken(token).consumeRewards(msg.sender);
        if (l.holderPaid + amount > l.holderFunded) revert LedgerExceeded();
        l.holderPaid += amount;
        emit HolderRewardsClaimed(token, msg.sender, recipient, amount);
        _payout(l.pair, recipient, amount);
    }

    function claimCreatorFees(address token, address recipient) external nonReentrant returns (uint256 amount) {
        Ledger storage l = ledgers[token];
        if (msg.sender != l.creator) revert NotAuthorized();
        amount = l.creatorOwed - l.creatorPaid;
        l.creatorPaid += amount;
        emit CreatorFeesClaimed(token, recipient, amount);
        _payout(l.pair, recipient, amount);
    }

    /// @notice Permanently give the creator's future 10% share to holders. Fees already owed stay claimable.
    function surrenderCreatorShare(address token) external {
        Ledger storage l = ledgers[token];
        if (msg.sender != l.creator) revert NotAuthorized();
        if (l.creatorSurrendered) revert AlreadySurrendered();
        l.creatorSurrendered = true;
        emit CreatorShareSurrendered(token);
    }

    function claimProtocolFees(address token, address recipient) external nonReentrant returns (uint256 amount) {
        if (msg.sender != treasury) revert NotAuthorized();
        Ledger storage l = ledgers[token];
        amount = l.protocolOwed - l.protocolPaid;
        l.protocolPaid += amount;
        emit ProtocolFeesClaimed(token, recipient, amount);
        _payout(l.pair, recipient, amount);
    }

    // Reserve and liquidity-growth balances accrue per launch and have no withdrawal path in this
    // version: execution is unavailable until a bounded executor module passes its strategy tests.

    // ---------------------------------------------------------------- payout

    function _payout(Currency currency, address to, uint256 amount) private {
        if (amount == 0) return;
        poolManager.unlock(abi.encode(currency, to, amount));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotAuthorized();
        (Currency currency, address to, uint256 amount) = abi.decode(data, (Currency, address, uint256));
        poolManager.burn(address(this), currency.toId(), amount);
        poolManager.take(currency, to, amount);
        return "";
    }
}
