/**
 * Metric dictionary. Every number the UI shows maps to one entry. "Unknown" and zero are distinct:
 * a metric without coverage renders "unavailable" with the reason, never 0.
 * Convention for swaps: one quote-side notional per swap, pre-fee (gross input for buys, gross pool
 * output for sells). Token and quote notionals are never added together; router and pool events
 * for the same swap are deduplicated on (chainId, blockHash, txHash, logIndex) of the PoolManager Swap log.
 */
export type MetricScope = 'platform' | 'token' | 'wallet';
export type MetricUnit = 'CANOPY' | 'tokens' | 'count' | 'addresses' | 'bps' | 'percent' | 'USD' | 'seconds';

export interface MetricDef {
  id: string;
  label: string;
  scope: MetricScope;
  unit: MetricUnit;
  formula: string;
  exclusions?: string;
  window?: string;
  source: string;
  confirmation: string;
}

const IDX = 'Indexer from PoolManager Swap logs and LaunchHook FeeTaken events';
const FINAL = 'Included blocks; finalized view once the chain reports finality';

export const METRICS: MetricDef[] = [
  { id: 'launches', label: 'Successful launches', scope: 'platform', unit: 'count', formula: 'count(LaunchFactory.Launched events with successful receipts)', window: 'lifetime, 24h, 7d', source: 'LaunchFactory events', confirmation: FINAL },
  { id: 'active_markets', label: 'Active markets', scope: 'platform', unit: 'count', formula: 'count(tokens with ≥1 swap in window)', window: '24h', source: IDX, confirmation: FINAL },
  { id: 'active_traders', label: 'Active trader addresses', scope: 'platform', unit: 'addresses', formula: 'count(distinct swap senders in window)', exclusions: 'Addresses are not people. Router contracts are resolved to the hookData trader where provided.', window: '24h', source: IDX, confirmation: FINAL },
  { id: 'new_traders', label: 'New trader addresses', scope: 'platform', unit: 'addresses', formula: 'count(addresses whose first swap on the platform falls in window)', window: '24h', source: IDX, confirmation: FINAL },
  { id: 'volume', label: 'Quote volume', scope: 'platform', unit: 'CANOPY', formula: 'sum(pre-fee quote notional per swap)', window: '5m, 1h, 6h, 24h, 7d, 30d, lifetime', source: IDX, confirmation: FINAL },
  { id: 'fees_gross', label: 'Gross fees collected', scope: 'platform', unit: 'CANOPY', formula: 'sum(FeeTaken.amount)', source: 'LaunchHook FeeTaken', confirmation: FINAL },
  { id: 'fees_holders', label: 'Holder allocation', scope: 'platform', unit: 'CANOPY', formula: 'sum(FeeSplit.holders); includes all rounding dust and surrendered creator shares', source: 'FeeVault FeeRecorded', confirmation: FINAL },
  { id: 'rewards_released', label: 'Rewards released', scope: 'platform', unit: 'CANOPY', formula: 'sum over tokens of rate × eligible time, per the one-hour merged release rule', exclusions: 'Paused while eligible supply is zero', source: 'LaunchToken reward state', confirmation: FINAL },
  { id: 'rewards_claimed', label: 'Rewards claimed', scope: 'platform', unit: 'CANOPY', formula: 'sum(FeeVault.HolderRewardsClaimed.amount)', source: 'FeeVault events', confirmation: FINAL },
  { id: 'holder_liability', label: 'Outstanding holder liability', scope: 'platform', unit: 'CANOPY', formula: 'holder allocation − rewards claimed (released-but-unclaimed plus not-yet-released)', source: 'FeeVault ledger, reconciled to ERC-6909 balance', confirmation: FINAL },
  { id: 'protocol_income', label: 'Protocol operating income', scope: 'platform', unit: 'CANOPY', formula: 'sum(FeeSplit.protocol)', exclusions: 'Holder and creator allocations are not protocol revenue', source: 'FeeVault FeeRecorded', confirmation: FINAL },
  { id: 'price', label: 'Price', scope: 'token', unit: 'CANOPY', formula: 'pool sqrtPriceX96 converted to quote per token', source: 'StateView / Swap.sqrtPriceX96', confirmation: 'Latest included block' },
  { id: 'fdv', label: 'FDV', scope: 'token', unit: 'CANOPY', formula: 'price × totalSupply', exclusions: 'Not circulating market cap. Unsold pool inventory is shown separately.', source: 'Derived', confirmation: 'Latest included block' },
  { id: 'change', label: 'Price change', scope: 'token', unit: 'percent', formula: 'price now ÷ last price at or before window start − 1', exclusions: 'n/a when the token is younger than the window', window: '5m–30d', source: IDX, confirmation: FINAL },
  { id: 'ath_atl', label: 'ATH / ATL', scope: 'token', unit: 'CANOPY', formula: 'max/min post-swap price over indexed coverage', exclusions: 'Coverage starts at the creation block', source: IDX, confirmation: FINAL },
  { id: 'net_flow', label: 'Net quote buy flow', scope: 'token', unit: 'CANOPY', formula: 'buy notional − sell notional', window: 'selected', source: IDX, confirmation: FINAL },
  { id: 'holders', label: 'Holder count', scope: 'token', unit: 'addresses', formula: 'count(balance > 0)', exclusions: 'PoolManager, seed locker, fee vault and burn address', source: 'Transfer events, reconciled to balanceOf', confirmation: FINAL },
  { id: 'top10', label: 'Top-10 concentration', scope: 'token', unit: 'bps', formula: 'sum(top 10 balances) ÷ eligible supply; also shown including pool inventory ÷ total supply', source: 'Holder balances', confirmation: FINAL },
  { id: 'pool_balances', label: 'Pool balances', scope: 'token', unit: 'CANOPY', formula: 'actual token inventory and actual quote paid in (opening FDV is virtual, not funded)', source: 'PoolManager position math', confirmation: 'Latest included block' },
  { id: 'depth', label: 'Executable depth ±1/2/5%', scope: 'token', unit: 'CANOPY', formula: 'quote that moves price to the target, integrated over active ranges and net of the 1% fee', exclusions: 'Raw balances are not depth', source: 'Quoter simulation over current ranges', confirmation: 'Latest included block' },
  { id: 'rewards_token', label: 'Rewards funded / released / claimed', scope: 'token', unit: 'CANOPY', formula: 'holder allocation by token; released per merged one-hour rule; claimed from events', source: 'LaunchToken + FeeVault', confirmation: FINAL },
  { id: 'eligible_supply', label: 'Eligible supply', scope: 'token', unit: 'tokens', formula: 'totalSupply − excluded balances', source: 'LaunchToken.eligibleSupply()', confirmation: 'Latest included block' },
  { id: 'creator_buy', label: 'Creator initial buy', scope: 'token', unit: 'tokens', formula: 'tokens received by the creator in the atomic launch transaction', source: 'LaunchFactory.Launched', confirmation: FINAL },
  { id: 'cost_basis', label: 'Cost basis', scope: 'wallet', unit: 'CANOPY', formula: 'FIFO lots; buy cost includes the trading fee', exclusions: 'Tokens received by transfer have unknown basis and are marked partial', source: IDX, confirmation: FINAL },
  { id: 'realized', label: 'Realized PnL', scope: 'wallet', unit: 'CANOPY', formula: 'net sale proceeds − FIFO cost of tokens sold', exclusions: 'Transfers out are not sales', source: IDX, confirmation: FINAL },
  { id: 'unrealized', label: 'Unrealized PnL', scope: 'wallet', unit: 'CANOPY', formula: 'balance × spot price − remaining cost basis', source: 'Derived', confirmation: 'Latest included block' },
  { id: 'exit_quote', label: 'Exit quote', scope: 'wallet', unit: 'CANOPY', formula: 'quote received selling the position now through the market adapter, after the 1% fee', source: 'Market adapter quote', confirmation: 'Quote time shown' },
  { id: 'rewards_wallet', label: 'Rewards claimed / claimable', scope: 'wallet', unit: 'CANOPY', formula: 'claimed from events; claimable = earned + balance × (index − paid)', source: 'LaunchToken.claimable()', confirmation: 'Latest included block' },
];

export const TRENDING_FORMULA =
  'score = 0.5 × log10(1 + 24h quote volume) + 0.3 × log10(1 + 24h unique trader addresses) + 0.2 × clamp(net buy flow ÷ volume, −1, 1). No paid placement exists in this release.';
