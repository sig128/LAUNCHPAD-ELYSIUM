/**
 * Fee policy v1 — the single standard policy for the first release.
 *
 * Exact integer rules (identical in LaunchHook.sol / FeeVault.sol):
 *  - fee = floor(quoteNotional * feeBps / 10_000)
 *  - Buys (exact input): quoteNotional = the trader's gross quote input. The pool receives gross - fee.
 *  - Sells (exact input): quoteNotional = the pool's gross quote output. The trader receives gross - fee.
 *  - Exact-output swaps are rejected by the hook (ExactOutputUnsupported) and are never quoted.
 *  - Split: reserve, creator, liquidity-growth and protocol are each floor(fee * bps / 10_000).
 *    Holders receive fee minus those four, so all rounding dust goes to holders and the parts
 *    always sum to the collected fee.
 *  - If the creator irrevocably surrendered their share, creator = 0 and that share is added to holders.
 *  - No ERC-20 transfer tax and no LP fee: the v4 pool is created with an LP fee of 0, so the hook fee
 *    is the only trading fee.
 */
export const BPS = 10_000n;

export interface FeePolicy {
  version: 'v1';
  feeBps: bigint;
  holdersBps: bigint;
  reserveBps: bigint;
  creatorBps: bigint;
  liquidityBps: bigint;
  protocolBps: bigint;
  lpFeePips: number;
  dustRecipient: 'holders';
}

export const POLICY_V1: FeePolicy = {
  version: 'v1',
  feeBps: 100n,
  holdersBps: 6_000n,
  reserveBps: 1_000n,
  creatorBps: 1_000n,
  liquidityBps: 1_000n,
  protocolBps: 1_000n,
  lpFeePips: 0,
  dustRecipient: 'holders',
};

export interface FeeSplit {
  fee: bigint;
  holders: bigint;
  reserve: bigint;
  creator: bigint;
  liquidity: bigint;
  protocol: bigint;
}

export function feeOn(quoteNotional: bigint, policy: FeePolicy = POLICY_V1): bigint {
  if (quoteNotional < 0n) throw new RangeError('quoteNotional must be non-negative');
  return (quoteNotional * policy.feeBps) / BPS;
}

export function splitFee(fee: bigint, creatorSurrendered: boolean, policy: FeePolicy = POLICY_V1): FeeSplit {
  if (fee < 0n) throw new RangeError('fee must be non-negative');
  const reserve = (fee * policy.reserveBps) / BPS;
  const liquidity = (fee * policy.liquidityBps) / BPS;
  const protocol = (fee * policy.protocolBps) / BPS;
  const creator = creatorSurrendered ? 0n : (fee * policy.creatorBps) / BPS;
  const holders = fee - reserve - liquidity - protocol - creator;
  return { fee, holders, reserve, creator, liquidity, protocol };
}

export function addSplits(a: FeeSplit, b: FeeSplit): FeeSplit {
  return {
    fee: a.fee + b.fee,
    holders: a.holders + b.holders,
    reserve: a.reserve + b.reserve,
    creator: a.creator + b.creator,
    liquidity: a.liquidity + b.liquidity,
    protocol: a.protocol + b.protocol,
  };
}

export const ZERO_SPLIT: FeeSplit = { fee: 0n, holders: 0n, reserve: 0n, creator: 0n, liquidity: 0n, protocol: 0n };
