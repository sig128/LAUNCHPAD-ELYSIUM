# Status (9 November 2026)

Not production ready. Not audited. No CANOPY contract is deployed on any network.

The web app defaults to **live mode on Elysium mainnet** (`apps/web/.env.production`). With no CANOPY factory deployed, live mode shows the true state: no markets yet, every count zero, launching and trading disabled with the reason. A runtime check confirms the chain ID and the Uniswap v4 contract code through `NEXT_PUBLIC_ELYSIUM_RPC_URL`.

## Working now

- **Web workspace (demo mode)**: all suggested routes (`/`, `/token/[address]`, `/launch`, `/rewards`, `/portfolio`, `/analytics`, `/creator`, `/docs`, `/contracts`, `/settings`), compiled with `next build`, checked at 360, 390, 768, 1440 and 1920 px with no horizontal overflow and no console errors.
- **Jungle background**: fixed muted looping video (WebM, then MP4; a 720p MP4 on phones), poster, emerald gradient fallback, header pause/play control, pause when the tab is hidden, off for reduced motion and data saver, configurable playback rate (default 1×).
- **Discovery**: Trending, New, Most traded, Holder rewards, Strongest liquidity and Watchlist segments; time windows; sortable columns; list and grid; filters, sort and paging persist in the URL; quick-trade side panel (bottom sheet below 1280 px).
- **Search**: `/` or Cmd/Ctrl+K; matches name, ticker or full address; always shows chain and full address and warns when a ticker is shared.
- **Market workspace**: candlestick chart (price or FDV, 5m to 1d, UTC, data-table alternative), trade ticket with fee split, minimum received, price impact, slippage, balance checks and exit quotes, plus Overview, Trades, Holders, Liquidity, Rewards, Creator and Activity tabs.
- **SDK**: fee policy v1 in integer math (dust to holders), the reward ledger the contracts will follow (merged one-hour release, pause at zero eligible supply, O(1) per transfer), metric dictionary, network registry with verification status. 8 tests pass.
- **Wallet**: EIP-6963 injected wallet discovery, wrong-network detection with explicit switch. Reads only.

## Disabled, with the reason shown in the UI

- All writes (trade, launch, claim, creator claim, surrender) are disabled in demo mode. Our factory, hook and vault are not deployed anywhere.
- WalletConnect needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Buy-order reserve and liquidity-growth execution: funded, execution unavailable until strategy tests exist.
- Fair-auction launches: not built.
- Explorer links: Kinetiq documents the explorer base URL but not its transaction or address URL patterns.

## Network facts checked on 9 November 2026

- Uniswap's v4 deployment registry lists Elysium (chain 99901) with PoolManager `0xE2e105d3F7209A9DA11f83cCf3E7398a753823F1` and the other addresses in `packages/sdk/src/networks.ts`. They match the brief. Status: published, not RPC-checked.
- Kinetiq's "Connecting to Elysium" page still shows mainnet chain ID, explorer and public RPC as coming soon. Testnet is chain 99801.
- Owner reports mainnet live (9 November 2026). Alchemy's FAQ and Kinetiq's connection page still said otherwise that day, and no public RPC is documented, so the deployed app verifies the chain itself.
- Mainnet WHYPE is not published. Pools use native HYPE, so WHYPE is not required for trading.

## Next slices

1. Contracts: LaunchToken (reward ledger above), FeeVault, LaunchHook (1% quote fee via v4 hook deltas, exact-input only, LP fee 0), SeedLiquidityLocker, LaunchFactory, LaunchRouter, with Foundry tests against real v4-core.
2. Local mode: Anvil deploy script writing `deployments/local.json`, generated SDK ABIs, wired launch, swap, claim and creator flows.
3. Indexer and API (PostgreSQL, reorg-aware), then portfolio and analytics from indexed data.
4. E2E tests, accessibility pass, Elysium deployment scripts and readiness report.
