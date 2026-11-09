# CANOPY

Native Elysium launchpad: discover markets, launch a token, trade with clear costs, earn a published share of collected fees, and inspect the liquidity trading builds. CANOPY is a configurable working name (`NEXT_PUBLIC_BRAND_NAME`).

The UI is a frosted trading workspace over a full-screen jungle video. The videos live in `apps/web/public/media` (`jungle.webm` and `jungle.mp4` for desktop, a lighter 720p `jungle-mobile.mp4` for phones, `jungle-poster.webp`). Point the `NEXT_PUBLIC_BG_*` variables elsewhere to host them on a CDN. Without them the app shows an emerald gradient.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, demo mode
npm test               # SDK: fee math, reward ledger, fixture reconciliation
```

Production: `npm run build && npm start`.

## Deploy on Vercel

1. Import this GitHub repo in Vercel.
2. Set **Root Directory** to `apps/web` (Framework: Next.js is detected).
3. Add the environment variable `NEXT_PUBLIC_ELYSIUM_RPC_URL` with your Alchemy or Chainstack Elysium mainnet endpoint. Restrict that key to your site's domain in the provider dashboard, because it is visible in the browser.
4. Deploy.

Production defaults come from `apps/web/.env.production`: live mode on Elysium mainnet. On load the site reads `eth_chainId` and checks for contract code at every Uniswap v4 address, and shows the result in the header and on `/contracts`. To show the labelled demo instead, set `NEXT_PUBLIC_CANOPY_MODE=demo` in Vercel.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 app: discovery, market workspace, launch, rewards, portfolio, analytics, creator tools, contracts, docs, settings |
| `packages/sdk` | Network registry, fee policy v1 math, reward ledger reference implementation, metric dictionary, deterministic demo fixtures |
| `packages/contracts` | Foundry project (contracts in progress, see status) |

## Modes

- **demo**: deterministic fixtures, always labelled "Demo data", no wallet writes. Every figure is produced by replaying trades through the real fee and reward math, so totals reconcile.
- **local** and **live**: show explicit "unavailable" states until the contracts and indexer exist. A failed live connection never falls back to demo data.

See [docs/STATUS.md](docs/STATUS.md) for exactly what works and what does not yet.
