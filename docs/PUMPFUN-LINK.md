# Linking pump.fun and Elysium: research (9 November 2026)

Goal: a coin launched once on pump.fun trades on one curve, and Elysium users can hold and trade the same coin at the same price, with nobody buying supply up front.

## What is live today

| Piece | Status | Source |
| --- | --- | --- |
| Elysium mainnet | Live 9 Nov 2026. EVM chain ID 99901, RPC `https://rpc.elysium.kinetiq.xyz`. Arbitrum Orbit rollup settling to HyperEVM. | Kinetiq token-bridging docs |
| Wormhole core messaging on Elysium | Live. Core Bridge `0xC8aD24fC6063c41cB5C12a8e3851AafC3b3CF027`, Wormhole chain ID 74, guardian support since release v2.69.0 (22 Oct). | Wormhole contract addresses; v2.69.0 release; LI.FI intent PR #143 |
| Wormhole token bridge (Wrapped Token Transfers) on Elysium | **Not deployed.** No Elysium address is published. HyperEVM has it only on testnet. | Wormhole contract addresses |
| Wormhole NTT / Executor on Elysium | NTT needs only the core bridge, so it can be deployed per token. Executor (automatic relaying) on Elysium is not confirmed. | Wormhole NTT and Executor docs |
| Solana to Elysium swap services | **None confirmed.** Relay supports HyperEVM and Solana and adds EVM chains on request. LI.FI's intent system has an Elysium Wormhole-oracle config prepared, not yet broadcast. | Relay docs; LI.FI intent PR #143 |
| Elysium's own bridges | Canonical HyperEVM → Elysium lock-and-mint, Elysium → HyperEVM mirror. No Solana link. Withdrawals wait out a challenge period. | Kinetiq token-bridging docs |
| pump.fun app on Elysium | **Live 9 Nov.** pump.fun and fomo both say Elysium trading is live in their apps. Which tokens they list and how they route is not published. | The Defiant, TokenPost |

## What this means for the one-curve design

1. **Twins of pump.fun coins on Elysium need a bridge that Elysium doesn't have yet.** pump.fun locks each coin's mint, so Solana must lock coins and Elysium must issue the twin. Without Wormhole's token bridge on Elysium, the only working route is NTT per coin, which deploys a separate Solana program for every coin (roughly a few SOL each). That breaks free launches.
2. **Nothing yet carries out a pump.fun trade for someone paying HYPE on Elysium.** Our own relayer would be a server holding SOL and HYPE, with real loss risk, and it still needs step 1 to deliver coins on Elysium.

## Unblocking steps

- Ask Wormhole to deploy and register the token bridge on Elysium. With it, any pump.fun coin gets an Elysium twin through a one-time, permissionless attestation.
- Ask Relay (and LI.FI) to add Elysium, so HYPE on Elysium can buy Solana tokens in one step.
- Meanwhile, launch coins on Elysium itself and get them listed in the pump.fun and fomo apps, which went live on Elysium today. Same coin, one curve, one price, holders paid 80% of fees, and no bridge needed.

## Sources

- Kinetiq, Token bridging on Elysium: https://elysium.kinetiq.xyz/docs/token-bridging-on-elysium
- Wormhole contract addresses: https://wormhole.com/docs/reference/contract-addresses/
- Wormhole v2.69.0 (Elysium support): https://github.com/wormhole-foundation/wormhole/releases/tag/v2.69.0
- LI.FI intents, Elysium Wormhole oracle config: https://github.com/catalystsystem/lifi-intent/pull/143
- Wormhole NTT Executor: https://docs.wormhole.com/protocol/infrastructure-guides/ntt-executor/
- Relay supported chains: https://docs.relay.link/references/api/api_resources/supported-chains
- The Defiant, Elysium mainnet launch: https://thedefiant.io/news/defi/kinetiq-launches-elysium-mainnet-for-hyperliquid
- TokenPost, pump.fun Elysium trading: https://www.tokenpost.com/news/investing/43014
