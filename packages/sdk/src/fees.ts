/**
 * Fee policy v1 — the single standard policy for the first release.
 *
 * Exact integer rules (identical in LaunchHook.sol / FeeVault.sol):
 *  - fee = floor(quoteNotional * feeBps / 10_000)
 *  - Buys (exact input): quoteNotional = the trader's gross quote input. The pool receives gross - fee.
 *  - Sells (exact input): quoteNotional = the pool's gross quote output. The trader receives gross - fee.
 *  - Exact-output swaps are rejected by the hook (ExactOutputUnsupported) and are never quoted.
 *  - Split: creator and protocol are each floor(fee * 1_000 / 10_000), 10% each.
 *    Holders receive fee minus those two (80%), so all rounding dust goes to holders and the parts
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
  creatorBps: bigint;
  protocolBps: bigint;
  lpFeePips: number;
  dustRecipient: 'holders';
}

export const POLICY_V1: FeePolicy = {
  version: 'v1',
  feeBps: 100n,
  holdersBps: 8_000n,
  creatorBps: 1_000n,
  protocolBps: 1_000n,
  lpFeePips: 0,
  dustRecipient: 'holders',
};

export interface FeeSplit {
  fee: bigint;
  holders: bigint;
  creator: bigint;
  protocol: bigint;
}

export function feeOn(quoteNotional: bigint, policy: FeePolicy = POLICY_V1): bigint {
  if (quoteNotional < 0n) throw new RangeError('quoteNotional must be non-negative');
  return (quoteNotional * policy.feeBps) / BPS;
}

export function splitFee(fee: bigint, creatorSurrendered: boolean, policy: FeePolicy = POLICY_V1): FeeSplit {
  if (fee < 0n) throw new RangeError('fee must be non-negative');
  const protocol = (fee * policy.protocolBps) / BPS;
  const creator = creatorSurrendered ? 0n : (fee * policy.creatorBps) / BPS;
  const holders = fee - protocol - creator;
  return { fee, holders, creator, protocol };
}

export function addSplits(a: FeeSplit, b: FeeSplit): FeeSplit {
  return {
    fee: a.fee + b.fee,
    holders: a.holders + b.holders,
    creator: a.creator + b.creator,
    protocol: a.protocol + b.protocol,
  };
}

export const ZERO_SPLIT: FeeSplit = { fee: 0n, holders: 0n, creator: 0n, protocol: 0n };
