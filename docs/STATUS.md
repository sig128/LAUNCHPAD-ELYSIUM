# Status (9 November 2026)

Not production ready. Not audited. The contracts are written and tested locally; none is deployed on any network.

Every launch pairs with **CANOPY**, the platform's main coin, which will live on Elysium and Solana joined by Wormhole. See [MAIN-COIN.md](MAIN-COIN.md) for the plan and what still needs a go-ahead. Holders get **80% of every fee** (90% if the creator gives up their share).

The web app defaults to **live mode on Elysium mainnet** (`apps/web/.env.production`). With no CANOPY factory deployed, live mode shows the true state: no markets yet, every count zero, launching and trading disabled with the reason. A runtime check confirms the chain ID and the Uniswap v4 contract code through `NEXT_PUBLIC_ELYSIUM_RPC_URL`.

## Working now

- **Web workspace (demo mode)**: all suggested routes (`/`, `/token/[address]`, `/launch`, `/rewards`, `/portfolio`, `/analytics`, `/creator`, `/docs`, `/contracts`, `/settings`), compiled with `next build`, checked at 360, 390, 768, 1440 and 1920 px with no horizontal overflow and no console errors.
- **Jungle background**: fixed muted looping video (WebM, then MP4; a 720p MP4 on phones), poster, emerald gradient fallback, header pause/play control, pause when the tab is hidden, off for reduced motion and data saver, configurable playback rate (default 1×).
- **Discovery**: Trending, New, Most traded, Holder rewards, Strongest liquidity and Watchlist segments; time windows; sortable columns; list and grid; filters, sort and paging persist in the URL; quick-trade side panel (bottom sheet below 1280 px).
- **Search**: `/` or Cmd/Ctrl+K; matches name, ticker or full address; always shows chain and full address and warns when a ticker is shared.
- **Market workspace**: candlestick chart (price or FDV, 5m to 1d, UTC, data-table alternative), trade ticket with fee split, minimum received, price impact, slippage, balance checks and exit quotes, plus Overview, Trades, Holders, Liquidity, Rewards, Creator and Activity tabs.
- **SDK**: fee policy v1 in integer math (dust to holders), the reward ledger the contracts will follow (merged one-hour release, pause at zero eligible supply, O(1) per transfer), metric dictionary, network registry with verification status. 8 tests pass.
- **Wallet**: EIP-6963 injected wallet discovery, wrong-network detection with explicit switch. Reads only.
- **Contracts** (`packages/contracts`, not deployed, not audited): LaunchToken (the reward ledger above, plus one-time bridge mint and burn for the main coin only), FeeVault (per-launch ledgers, ERC-6909 claims), LaunchHook (1% fee on the pair side through v4 hook deltas, exact input only, LP fee 0, no removals or donations), SeedLiquidityLocker (no removal path), LaunchFactory (free atomic launch with optional disclosed creator buy, and the one-time main-coin launch) and LaunchRouter (exact-input paths of one or two hops, such as HYPE → CANOPY → coin, with minimum output and deadline). Compiled with solc 0.8.26 (solc-js). 10 integration tests run on Anvil against Uniswap's published v4 PoolManager bytecode: supply conservation, exact 1% fees both ways, the 80/10/10 split with dust to holders, rewards over the hour, creator claim and surrender, every rejection path, pause, the main coin and its bridge minter, two-hop routing, and vault claims reconciling with ledgers.
- **Pair assets**: launches pair with CANOPY (selected by default on the Launch page, marked as launching soon). The contracts accept any pair the factory owner allowlists, so tokenized stocks stay listed as not on Elysium yet. Fees, holder rewards and creator fees are paid in the pair. Tested with HYPE, a stand-in stock token in both currency orderings, and a CANOPY-paired launch.

## Disabled, with the reason shown in the UI

- All writes (trade, launch, claim, creator claim, surrender) are disabled in demo mode. Our factory, hook and vault are not deployed anywhere.
- WalletConnect needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Fair-auction launches: not built.
- Explorer links: Kinetiq documents the explorer base URL but not its transaction or address URL patterns.
- Stock pairs: no tokenized stock is on Elysium yet (see below).

## Network facts checked on 9 November 2026

- Uniswap's v4 deployment registry lists Elysium (chain 99901) with PoolManager `0xE2e105d3F7209A9DA11f83cCf3E7398a753823F1` and the other addresses in `packages/sdk/src/networks.ts`. They match the brief. Status: published, not RPC-checked.
- Kinetiq's "Connecting to Elysium" page still shows mainnet chain ID, explorer and public RPC as coming soon. Testnet is chain 99801.
- Owner reports mainnet live (9 November 2026). Alchemy's FAQ and Kinetiq's connection page still said otherwise that day, and no public RPC is documented, so the deployed app verifies the chain itself.
- Mainnet WHYPE is not published. Pools use native HYPE, so WHYPE is not required for trading.

## Stock pairs: what has to be true first

- **The token must reach Elysium.** Ondo's tokenized stocks are live on HyperEVM. Elysium's canonical bridge accepts any HyperEVM ERC-20 without approval, but the first deposit permanently sets that token's gateway, and withdrawals back to HyperEVM take about 5.5 days. Coordinate with the issuer before anyone makes that first deposit.
- **Fixed balances only.** Use tokens whose balances don't change on their own. Ondo's tokens keep balances fixed on EVM chains. Rebasing tokens such as xStocks break AMM pool accounting and must not be allowlisted.
- **Transfer restrictions.** If a stock token only moves between permitted addresses, the PoolManager, router, factory and vault all have to be permitted. Test buys, sells and claims with a tiny amount before calling `setPairAllowed`.
- **Legal.** Tokenized stocks are restricted in the US, the UK and other places. Geoblocking and legal advice come before switching a stock pair on.

## Owner powers (factory owner)

- `setPairAllowed(pair, allowed)`: which pair assets new launches may use. Existing markets keep their pair.
- `setLaunchesPaused(paused)`: pauses new launches only. Trading, sells and claims keep working.
- `setHook(hook)`: once, at deployment.
- `launchMainCoin(...)`: once. The owner becomes the main coin's bridge admin and can set its Wormhole NTT manager as minter, once.
- There is no upgrade path, fee change or liquidity removal.

## Next slices

1. CANOPY: the steps in [MAIN-COIN.md](MAIN-COIN.md), starting with confirming Wormhole NTT on Elysium.
2. Local mode: Anvil deploy script (CREATE2 hook-address mining, as in the tests) writing `deployments/local.json`, generated SDK ABIs, wired launch, swap, claim and creator flows. Wallet sends add gas headroom: reward settlement makes gas depend on the block time.
3. Indexer and API (PostgreSQL, reorg-aware), then portfolio and analytics from indexed data.
4. E2E tests, accessibility pass, external audit, Elysium deployment scripts and readiness report.
5. Stock pairs: tiny-amount bridge and transfer test of one Ondo token, allowlist it, geoblock where required.
