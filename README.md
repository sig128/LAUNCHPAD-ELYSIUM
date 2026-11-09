# CANOPY

Native Elysium launchpad: discover markets, launch a token, trade with clear costs, earn a published share of collected fees, and inspect the liquidity trading builds. CANOPY is a configurable working name (`NEXT_PUBLIC_BRAND_NAME`).

The UI is a frosted trading workspace over a full-screen jungle video. The video files are not committed to git (60 MB): place `jungle.webm`, `jungle.mp4` and `jungle-poster.webp` in `apps/web/public/media`, or point the `NEXT_PUBLIC_BG_*` variables elsewhere. Without them the app shows an emerald gradient.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, demo mode
npm test               # SDK: fee math, reward ledger, fixture reconciliation
```

Production: `npm run build && npm start`.

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
