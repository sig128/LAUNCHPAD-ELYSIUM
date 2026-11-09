# CANOPY, the main coin: plan

Every launch pairs with CANOPY. CANOPY is one token on two chains, Elysium and Solana, joined by Wormhole Native Token Transfers (NTT). This file is the plan and its status. Nothing in it is deployed yet.

## Why one main coin

- **Free launches.** Only CANOPY crosses chains, so the Wormhole setup is paid once, not per launch. A launch costs the launcher Elysium gas and nothing else.
- **One coin under every launch.** Buying any coin buys CANOPY first, and that CANOPY stays in the coin's pool. CANOPY moves with activity across all launches, in both directions.
- **Paying with HYPE still works.** `LaunchRouter.swapExactIn` goes HYPE → CANOPY → coin, or back, in one transaction. Each hop is its own market and charges its own 1%: CANOPY holders earn from the first hop and the coin's holders from the second.

## Supply and price

| | Elysium | Solana |
| --- | --- | --- |
| Starting supply | 500,000,000 CANOPY | 500,000,000 CANOPY |
| Market | Uniswap v4 pool against native HYPE, CANOPY hook, 1% fee | Raydium CLMM pool against SOL |
| Seed | Single-sided, from the opening price upward, locked in `SeedLiquidityLocker` | Single-sided, from the opening price upward, locked with Raydium Burn & Earn |
| Bridge mode | NTT burning: `LaunchToken.mint` / `burn` by the NTT manager only | NTT burning: the NTT program holds the mint authority |

- Total supply is 1,000,000,000 across both chains. Bridging burns on one side and mints on the other, so it never grows.
- Both seeds open at the same price in dollars: `openingFdv / 1,000,000,000`, converted to HYPE and SOL at launch time. Nobody buys supply first.
- Arbitrage keeps one price: when one side is cheaper, traders buy there, bridge and sell on the other side. With equal starting pools, the two halves behave like one 1B curve.

## What is built (Elysium side, tested locally)

- `LaunchFactory.launchMainCoin(name, symbol, openingFdv, supply, surrenderCreatorShare)`: owner only, once. Seeds `supply` (the Elysium half) against HYPE at the global opening price, records `mainCoin` and allowlists it as a pair.
- `LaunchToken` bridge hooks for the main coin only: `setMinter` (once, by the bridge admin, which is the factory owner), then `mint` and `burn` by that minter alone. Regular launches have no bridge admin, so they can never mint or burn. The minter is excluded from rewards.
- `LaunchRouter.swapExactIn(path, …)`: one or two hops across CANOPY markets only, with minimum output and deadline. Intermediate amounts never leave the PoolManager.
- Tests: the main coin launches once with half the supply, opens at the full-supply price, only its minter can mint or burn, bridged-in holders earn; a CANOPY-paired coin trades from HYPE and back in one transaction with 1% per hop; coin holders are paid in CANOPY.

## Still to do, in order

1. **Confirm Wormhole on Elysium.** Wormhole added Elysium in guardian release v2.69.0 (22 October 2026). Before anything goes live, confirm on Wormhole's dashboard that NTT works on Elysium mainnet, then run the full flow on Elysium testnet and Solana devnet.
2. **Deploy the Elysium contracts** (factory, vault, locker, hook at a mined address, router) and call `launchMainCoin` with 500M.
3. **Create CANOPY on Solana:** mint 500M, open the Raydium CLMM pool against SOL at the same dollar price, add the single-sided position, lock it with Burn & Earn (`raydium.clmm.lockPosition`).
4. **Wire Wormhole NTT in burning mode** on both chains: deploy the managers and transceivers, register them as peers, set rate limits, hand the Solana mint authority to NTT and call `setMinter(nttManager)` on Elysium. Solana's NTT program is deployed per token, which costs a few SOL once.
5. **Solana holder payouts:** collect the locked position's fees with the lock NFT and pay 80% to Solana CANOPY holders (snapshot plus claim).
6. **App:** a "Pay with HYPE" option in the trade ticket using the two-hop route, CANOPY's price in HYPE and dollars, and a bridge button.
7. **Audit** of the contracts and the bridge setup.

## Needs an explicit go-ahead from the owner

- Launching CANOPY on either chain (irreversible), the opening FDV, and any change to the 50/50 split.
- Deploying contracts to Elysium mainnet and the Wormhole setup (needs funded deployer wallets on Elysium and Solana).
- Turning off HYPE as a launch pair once CANOPY is live (`setPairAllowed(address(0), false)`).
- Legal advice on a platform coin whose value tracks platform activity, and on where it may be offered.
