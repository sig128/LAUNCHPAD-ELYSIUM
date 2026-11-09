import { feeOn, type FeePolicy, POLICY_V1 } from './fees.ts';

/**
 * Demo market adapter math.
 *
 * A launch seeds one single-sided Uniswap v4 position that holds the whole supply from the opening
 * price upward. A concentrated range [P0, Pmax] that holds only the launch token behaves like a
 * constant-product curve with a virtual quote reserve equal to the opening FDV:
 *   tokenReserve * virtualQuoteReserve = k,  tokenReserve0 = totalSupply,  virtualQuote0 = openingFdv.
 * The real quote balance in the pool is virtualQuote - openingFdv. Nothing here is externally funded.
 *
 * This model drives demo-mode quotes only. Local and live quotes must come from the v4 Quoter
 * against the deployed hook, because tick and sqrt-price rounding differ slightly from this model.
 */
export interface CurveState {
  tokenReserve: bigint;
  virtualQuoteReserve: bigint;
  openingFdv: bigint;
}

export const E18 = 10n ** 18n;

export function initialCurve(totalSupply: bigint, openingFdv: bigint): CurveState {
  if (totalSupply <= 0n || openingFdv <= 0n) throw new RangeError('supply and opening FDV must be positive');
  return { tokenReserve: totalSupply, virtualQuoteReserve: openingFdv, openingFdv };
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function sqrtBig(n: bigint): bigint {
  if (n < 0n) throw new RangeError('negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  if (x === 0n) x = 1n;
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) {
      while (x * x > n) x -= 1n;
      while ((x + 1n) * (x + 1n) <= n) x += 1n;
      return x;
    }
    x = y;
  }
}

/** Spot price in quote per token, scaled by 1e18 (both assets use 18 decimals). */
export function spotPriceX18(s: CurveState): bigint {
  return (s.virtualQuoteReserve * E18) / s.tokenReserve;
}

export function realQuoteBalance(s: CurveState): bigint {
  return s.virtualQuoteReserve - s.openingFdv;
}

export interface BuyQuote {
  side: 'buy';
  quoteIn: bigint;
  fee: bigint;
  quoteToPool: bigint;
  tokenOut: bigint;
  priceImpactBps: number;
  next: CurveState;
}

export interface SellQuote {
  side: 'sell';
  tokenIn: bigint;
  grossQuoteOut: bigint;
  fee: bigint;
  quoteOut: bigint;
  priceImpactBps: number;
  next: CurveState;
}

/** Exact-input buy: the fee is taken from the trader's quote input before it reaches the pool. */
export function quoteBuyExactIn(s: CurveState, quoteIn: bigint, policy: FeePolicy = POLICY_V1): BuyQuote {
  if (quoteIn <= 0n) throw new RangeError('quoteIn must be positive');
  const fee = feeOn(quoteIn, policy);
  const quoteToPool = quoteIn - fee;
  const k = s.tokenReserve * s.virtualQuoteReserve;
  const nextQuote = s.virtualQuoteReserve + quoteToPool;
  const nextToken = ceilDiv(k, nextQuote);
  const tokenOut = s.tokenReserve - nextToken;
  // Impact compares the all-in execution price (gross input / tokens) with the pre-trade spot price.
  const spot = spotPriceX18(s);
  const exec = tokenOut > 0n ? (quoteIn * E18) / tokenOut : 0n;
  const priceImpactBps = spot > 0n && exec > 0n ? Number(((exec - spot) * 10_000n) / spot) : 0;
  return {
    side: 'buy',
    quoteIn,
    fee,
    quoteToPool,
    tokenOut,
    priceImpactBps,
    next: { ...s, tokenReserve: nextToken, virtualQuoteReserve: nextQuote },
  };
}

/** Exact-input sell: the fee is taken from the pool's gross quote output. */
export function quoteSellExactIn(s: CurveState, tokenIn: bigint, policy: FeePolicy = POLICY_V1): SellQuote {
  if (tokenIn <= 0n) throw new RangeError('tokenIn must be positive');
  const k = s.tokenReserve * s.virtualQuoteReserve;
  const nextToken = s.tokenReserve + tokenIn;
  const nextQuote = ceilDiv(k, nextToken);
  let grossQuoteOut = s.virtualQuoteReserve - nextQuote;
  const realQuote = realQuoteBalance(s);
  // The pool can never pay out more quote than real buyers put in.
  if (grossQuoteOut > realQuote) grossQuoteOut = realQuote;
  const fee = feeOn(grossQuoteOut, policy);
  const quoteOut = grossQuoteOut - fee;
  const spot = spotPriceX18(s);
  const exec = (quoteOut * E18) / tokenIn;
  const priceImpactBps = spot > 0n ? Number(((spot - exec) * 10_000n) / spot) : 0;
  return {
    side: 'sell',
    tokenIn,
    grossQuoteOut,
    fee,
    quoteOut,
    priceImpactBps,
    next: { ...s, tokenReserve: nextToken, virtualQuoteReserve: s.virtualQuoteReserve - grossQuoteOut },
  };
}

/**
 * Quote needed (gross, fee included) to move the price up by `bps`, and quote received (net of fee)
 * when the price is pushed down by `bps`. Derived from y' = y * sqrt(p'/p) on the constant-product curve.
 */
export function depthAt(s: CurveState, bps: number): { upQuoteIn: bigint; downQuoteOut: bigint } {
  const y = s.virtualQuoteReserve;
  const SCALE = 10n ** 36n;
  const up = sqrtBig((SCALE * BigInt(10_000 + bps)) / 10_000n); // sqrt(1+p) * 1e18
  const down = sqrtBig((SCALE * BigInt(10_000 - bps)) / 10_000n);
  const netUp = (y * (up - E18)) / E18;
  const upQuoteIn = (netUp * 10_000n) / (10_000n - POLICY_V1.feeBps);
  let grossDown = (y * (E18 - down)) / E18;
  const real = realQuoteBalance(s);
  if (grossDown > real) grossDown = real;
  const downQuoteOut = grossDown - feeOn(grossDown);
  return { upQuoteIn, downQuoteOut };
}
