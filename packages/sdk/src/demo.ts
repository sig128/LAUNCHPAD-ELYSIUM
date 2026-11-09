/**
 * Deterministic visual-demo fixtures.
 *
 * Every number is produced by replaying a seeded sequence of trades through the same fee policy,
 * curve model and reward ledger the product uses, so totals reconcile internally:
 *   gross fees = sum(trade fees), each fee splits exactly, pool inventory + held balances = supply,
 *   holder rewards released/claimed come from the RewardLedger reference implementation.
 * None of this is real volume, holders or revenue. The UI always labels it as demo data.
 */
import { addSplits, splitFee, ZERO_SPLIT, type FeeSplit } from './fees.ts';
import {
  depthAt,
  E18,
  initialCurve,
  quoteBuyExactIn,
  quoteSellExactIn,
  realQuoteBalance,
  spotPriceX18,
  type CurveState,
} from './curve.ts';
import { RewardLedger } from './rewards.ts';
import type { Address } from './networks.ts';

export const DEMO_ANCHOR = 1_794_225_600; // 2026-11-09T12:00:00Z, fixed so fixtures never drift
export const TOTAL_SUPPLY = 1_000_000_000n * E18;
export const WINDOWS = { '5m': 300, '1h': 3600, '6h': 21_600, '24h': 86_400, '7d': 604_800, '30d': 2_592_000 } as const;
export type WindowKey = keyof typeof WINDOWS | 'all';
export const WINDOW_KEYS: WindowKey[] = ['5m', '1h', '6h', '24h', '7d', '30d', 'all'];

/** Demo stand-ins for system addresses. Real deployments read these from the manifest. */
export const DEMO_POOL_MANAGER: Address = '0x00000000000000000000000000000000000d3e01';
export const DEMO_BURN: Address = '0x000000000000000000000000000000000000dead';

export interface DemoTrade {
  id: string;
  token: Address;
  txHash: `0x${string}`;
  block: number;
  logIndex: number;
  timestamp: number;
  side: 'buy' | 'sell';
  trader: Address;
  /** Pre-fee quote notional: gross input for buys, gross pool output for sells. */
  quoteNotional: bigint;
  fee: bigint;
  /** What the trader actually paid (buy) or received (sell), in quote. */
  quoteSettled: bigint;
  tokenAmount: bigint;
  priceAfterX18: bigint;
  creatorOrigin: boolean;
  confirmation: 'finalized';
}

export interface DemoClaim {
  kind: 'holder' | 'creator';
  token: Address;
  account: Address;
  amount: bigint;
  timestamp: number;
  txHash: `0x${string}`;
}

export interface WindowStats {
  volume: bigint;
  buyVolume: bigint;
  sellVolume: bigint;
  buys: number;
  sells: number;
  uniqueTraders: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  changePct: number | null;
  fees: FeeSplit;
}

export interface DemoToken {
  address: Address;
  poolId: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  decimals: 18;
  totalSupply: bigint;
  createdAt: number;
  createdBlock: number;
  creator: Address;
  policyVersion: 'v1';
  openingFdv: bigint;
  openingPriceX18: bigint;
  creatorInitialBuyQuote: bigint;
  creatorInitialBuyTokens: bigint;
  creatorSurrenderedAt: number | null;
  curve: CurveState;
  priceX18: bigint;
  fdv: bigint;
  athX18: bigint;
  atlX18: bigint;
  trades: DemoTrade[];
  claims: DemoClaim[];
  fees: FeeSplit;
  creatorClaimed: bigint;
  ledger: RewardLedger;
  holderCount: number;
  stats: Record<WindowKey, WindowStats>;
  matured: boolean;
  hue: number;
}

export interface DemoDataset {
  anchor: number;
  tokens: DemoToken[];
  byAddress: Map<string, DemoToken>;
  demoWallet: Address;
}

interface Spec {
  name: string;
  symbol: string;
  ageH: number;
  pop: number;
  trend: number;
  recency: number;
  fdv: number;
  creatorBuy: number;
  surrenderH?: number;
  demoCreator?: boolean;
  creatorSells?: boolean;
  desc: string;
}

const SPECS: Spec[] = [
  { name: 'Kapok Crown', symbol: 'KAPOK', ageH: 624, pop: 0.95, trend: 0.3, recency: 0.7, fdv: 4000, creatorBuy: 40, desc: 'A market named for the tallest tree in the canopy.' },
  { name: 'Mistwater', symbol: 'MIST', ageH: 300, pop: 0.8, trend: 0.1, recency: 0.5, fdv: 3000, creatorBuy: 25, desc: 'Morning fog over the river, as a ticker.' },
  { name: 'Bromeliad', symbol: 'BROME', ageH: 96, pop: 0.9, trend: 0.5, recency: 0.9, fdv: 3500, creatorBuy: 15, desc: 'Small plants that hold whole ecosystems in their leaves.' },
  { name: 'Tapir Signal', symbol: 'TAPIR', ageH: 820, pop: 0.55, trend: -0.2, recency: 0.3, fdv: 5000, creatorBuy: 60, demoCreator: true, desc: 'Slow, steady and hard to spot.' },
  { name: 'Ocelot Run', symbol: 'OCLT', ageH: 50, pop: 0.7, trend: 0.6, recency: 0.95, fdv: 2500, creatorBuy: 10, desc: 'Night hunter. Fast candles.' },
  { name: 'Fernline', symbol: 'FERN', ageH: 410, pop: 0.45, trend: 0, recency: 0.4, fdv: 3000, creatorBuy: 0, desc: 'Launched without a creator buy.' },
  { name: 'Canopy Drift', symbol: 'DRIFT', ageH: 8, pop: 0.6, trend: 0.7, recency: 1, fdv: 2500, creatorBuy: 20, desc: 'Seeds that ride the wind between trees.' },
  { name: 'Howler', symbol: 'HOWL', ageH: 160, pop: 0.65, trend: -0.4, recency: 0.5, fdv: 4000, creatorBuy: 30, creatorSells: true, desc: 'Loud at dawn.' },
  { name: 'Liana Loop', symbol: 'LIANA', ageH: 700, pop: 0.35, trend: 0.1, recency: 0.2, fdv: 3000, creatorBuy: 12, surrenderH: 48, desc: 'Creator gave their fee share to holders on day two.' },
  { name: 'Mossbank', symbol: 'MOSS', ageH: 2.5, pop: 0.3, trend: 0.5, recency: 1, fdv: 2500, creatorBuy: 8, demoCreator: true, desc: 'Soft ground, new market.' },
  { name: 'Orchid Hours', symbol: 'ORCH', ageH: 230, pop: 0.5, trend: 0.2, recency: 0.6, fdv: 3200, creatorBuy: 18, desc: 'Blooms on its own schedule.' },
  { name: 'Riverine', symbol: 'RIVR', ageH: 900, pop: 0.25, trend: -0.1, recency: 0.1, fdv: 6000, creatorBuy: 50, desc: 'Follows the water.' },
  { name: 'Sloth Standard', symbol: 'SLOTH', ageH: 130, pop: 0.4, trend: -0.6, recency: 0.4, fdv: 2800, creatorBuy: 22, creatorSells: true, desc: 'Moves when it wants to.' },
  { name: 'Toucan Ledger', symbol: 'TUCN', ageH: 36, pop: 0.75, trend: 0.4, recency: 0.85, fdv: 3000, creatorBuy: 14, surrenderH: 6, desc: 'Creator share surrendered six hours after launch.' },
  { name: 'Understory', symbol: 'UNDR', ageH: 560, pop: 0.3, trend: 0, recency: 0.3, fdv: 3500, creatorBuy: 0, desc: 'Life beneath the canopy.' },
  { name: 'Vine Index', symbol: 'VINE', ageH: 18, pop: 0.5, trend: 0.3, recency: 0.9, fdv: 2600, creatorBuy: 9, desc: 'Everything is connected.' },
  { name: 'Jaguarundi', symbol: 'JAGR', ageH: 340, pop: 0.6, trend: 0.2, recency: 0.5, fdv: 4200, creatorBuy: 35, desc: 'The cat nobody can name.' },
  { name: 'Rainline', symbol: 'RAIN', ageH: 0.4, pop: 0.15, trend: 0.5, recency: 1, fdv: 2500, creatorBuy: 5, desc: 'Twenty minutes old.' },
  { name: 'Epiphyte', symbol: 'EPIF', ageH: 75, pop: 0.35, trend: -0.3, recency: 0.6, fdv: 3000, creatorBuy: 11, desc: 'Grows on other things.' },
  { name: 'Cloud Forest', symbol: 'CLDF', ageH: 470, pop: 0.55, trend: 0.1, recency: 0.4, fdv: 5000, creatorBuy: 45, desc: 'Where the mountain meets the mist.' },
  { name: 'Leafcutter', symbol: 'LEAF', ageH: 12, pop: 0.45, trend: 0.5, recency: 0.95, fdv: 2500, creatorBuy: 16, desc: 'Carries ten times its weight.' },
  { name: 'Tree Frog Hours', symbol: 'FROG', ageH: 210, pop: 0.4, trend: 0.3, recency: 0.5, fdv: 3100, creatorBuy: 13, desc: 'Sings after the rain.' },
  { name: 'Ancient Strangler Fig Collective of the Upper Basin', symbol: 'FIGS', ageH: 140, pop: 0.2, trend: 0, recency: 0.3, fdv: 3000, creatorBuy: 7, desc: 'A deliberately long name to test layouts.' },
  { name: 'Quiet Clearing', symbol: 'QUIET', ageH: 0.15, pop: 0, trend: 0, recency: 1, fdv: 2500, creatorBuy: 0, desc: 'Just launched. No trades yet.' },
  { name: 'Kapok Crown', symbol: 'KAPOK', ageH: 20, pop: 0.25, trend: -0.2, recency: 0.8, fdv: 2500, creatorBuy: 30, desc: 'Copies the name and ticker of an older market. Compare contract addresses.' },
];

/** Fixture HYPE balance for the demo wallet, used only to show balance checks in the ticket. */
export const DEMO_WALLET_QUOTE_BALANCE = 180n * 10n ** 18n;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = '0123456789abcdef';
const randHex = (rng: () => number, len: number) => {
  let s = '';
  for (let i = 0; i < len; i++) s += HEX[Math.floor(rng() * 16)];
  return s;
};
const randAddr = (rng: () => number): Address => `0x${randHex(rng, 40)}`;
const randHash = (rng: () => number): `0x${string}` => `0x${randHex(rng, 64)}`;
const gauss = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
const hype = (x: number) => BigInt(Math.round(x * 1e6)) * 10n ** 12n;
const blockAt = (ts: number) => 52_000_000 + (ts - (DEMO_ANCHOR - 40 * 86_400)) * 10;

export function ratioPct(now: bigint, then: bigint): number {
  if (then === 0n) return 0;
  return (Number((now * 1_000_000n) / then) / 1_000_000 - 1) * 100;
}

function priceAt(t: DemoToken, ts: number): bigint | null {
  if (t.createdAt > ts) return null;
  let p = t.openingPriceX18;
  for (const tr of t.trades) {
    if (tr.timestamp > ts) break;
    p = tr.priceAfterX18;
  }
  return p;
}

function windowStats(t: DemoToken, key: WindowKey, anchor: number): WindowStats {
  const start = key === 'all' ? -Infinity : anchor - WINDOWS[key];
  const s: WindowStats = {
    volume: 0n,
    buyVolume: 0n,
    sellVolume: 0n,
    buys: 0,
    sells: 0,
    uniqueTraders: 0,
    uniqueBuyers: 0,
    uniqueSellers: 0,
    changePct: null,
    fees: ZERO_SPLIT,
  };
  const all = new Set<string>();
  const buyers = new Set<string>();
  const sellers = new Set<string>();
  const surrenderAt = t.creatorSurrenderedAt ?? Infinity;
  for (const tr of t.trades) {
    if (tr.timestamp <= start) continue;
    s.volume += tr.quoteNotional;
    all.add(tr.trader);
    if (tr.side === 'buy') {
      s.buys++;
      s.buyVolume += tr.quoteNotional;
      buyers.add(tr.trader);
    } else {
      s.sells++;
      s.sellVolume += tr.quoteNotional;
      sellers.add(tr.trader);
    }
    s.fees = addSplits(s.fees, splitFee(tr.fee, tr.timestamp >= surrenderAt));
  }
  s.uniqueTraders = all.size;
  s.uniqueBuyers = buyers.size;
  s.uniqueSellers = sellers.size;
  if (key === 'all') s.changePct = ratioPct(t.priceX18, t.openingPriceX18);
  else {
    const then = priceAt(t, start);
    s.changePct = then === null ? null : ratioPct(t.priceX18, then);
  }
  return s;
}

let cached: DemoDataset | null = null;

export function getDemoDataset(): DemoDataset {
  if (cached) return cached;
  const rng = mulberry32(0x0ca70b1);
  const traders: Address[] = Array.from({ length: 320 }, () => randAddr(rng));
  const demoWallet = traders[7];
  const tokens: DemoToken[] = [];

  SPECS.forEach((spec, idx) => {
    const address = randAddr(rng);
    const creator = spec.demoCreator ? demoWallet : traders[20 + idx * 9];
    const createdAt = DEMO_ANCHOR - Math.round(spec.ageH * 3600);
    const isExcluded = (a: string) => a === DEMO_POOL_MANAGER || a === DEMO_BURN;
    const ledger = new RewardLedger(isExcluded);
    const openingFdv = hype(spec.fdv);
    let curve = initialCurve(TOTAL_SUPPLY, openingFdv);
    const openingPriceX18 = spotPriceX18(curve);
    const surrenderedAt = spec.surrenderH !== undefined ? createdAt + spec.surrenderH * 3600 : null;
    const trades: DemoTrade[] = [];
    const claims: DemoClaim[] = [];
    let fees = ZERO_SPLIT;
    let creatorClaimed = 0n;
    let ath = openingPriceX18;
    let atl = openingPriceX18;
    let creatorInitialBuyTokens = 0n;

    const execute = (ts: number, side: 'buy' | 'sell', trader: Address, amount: bigint, creatorOrigin: boolean) => {
      const surrendered = surrenderedAt !== null && ts >= surrenderedAt;
      let fee: bigint, tokenAmount: bigint, notional: bigint, settled: bigint;
      if (side === 'buy') {
        const q = quoteBuyExactIn(curve, amount);
        curve = q.next;
        fee = q.fee;
        tokenAmount = q.tokenOut;
        notional = amount;
        settled = amount;
      } else {
        const q = quoteSellExactIn(curve, amount);
        curve = q.next;
        fee = q.fee;
        tokenAmount = amount;
        notional = q.grossQuoteOut;
        settled = q.quoteOut;
      }
      const split = splitFee(fee, surrendered);
      fees = addSplits(fees, split);
      const now = BigInt(ts);
      ledger.fund(split.holders, now);
      if (side === 'buy') ledger.transfer(DEMO_POOL_MANAGER, trader, tokenAmount, now);
      else ledger.transfer(trader, DEMO_POOL_MANAGER, tokenAmount, now);
      const price = spotPriceX18(curve);
      if (price > ath) ath = price;
      if (price < atl) atl = price;
      trades.push({
        id: `${address}-${trades.length}`,
        token: address,
        txHash: randHash(rng),
        block: blockAt(ts),
        logIndex: Math.floor(rng() * 40),
        timestamp: ts,
        side,
        trader,
        quoteNotional: notional,
        fee,
        quoteSettled: settled,
        tokenAmount,
        priceAfterX18: price,
        creatorOrigin,
        confirmation: 'finalized',
      });
      return tokenAmount;
    };

    if (spec.creatorBuy > 0) {
      creatorInitialBuyTokens = execute(createdAt, 'buy', creator, hype(spec.creatorBuy), true);
    }

    const lifetime = DEMO_ANCHOR - createdAt;
    const ageFactor = Math.min(1, Math.sqrt(spec.ageH / 72) + 0.1);
    const n = Math.round(spec.pop * 420 * ageFactor);
    const p = 1 - 0.6 * spec.recency;
    const times = Array.from({ length: n }, () => createdAt + 1 + Math.floor(Math.pow(rng(), p) * Math.max(1, lifetime - 40))).sort(
      (a, b) => a - b,
    );
    const demoTradeSlots = new Set<number>();
    if ([0, 1, 2, 4, 6, 10, 13].includes(idx) && n > 8) {
      for (let k = 0; k < 3; k++) demoTradeSlots.add(Math.floor(rng() * n));
    }
    const localTraders = traders.slice(0, 40 + Math.round(spec.pop * 260));
    const pBuy = Math.min(0.85, Math.max(0.25, 0.56 + spec.trend * 0.22));
    const mu = Math.log(1.5 + 28 * spec.pop) - 0.6;
    let creatorSold = false;

    times.forEach((ts, i) => {
      if (spec.creatorSells && !creatorSold && ts > createdAt + lifetime * 0.45) {
        const bal = ledger.balances.get(creator) ?? 0n;
        if (bal > 0n) execute(ts, 'sell', creator, (bal * 6n) / 10n, true);
        creatorSold = true;
      }
      let trader = demoTradeSlots.has(i) ? demoWallet : localTraders[Math.floor(Math.pow(rng(), 1.3) * localTraders.length)];
      let side: 'buy' | 'sell' = rng() < pBuy ? 'buy' : 'sell';
      let bal = ledger.balances.get(trader) ?? 0n;
      if (side === 'sell' && bal === 0n) {
        for (let tries = 0; tries < 6 && bal === 0n; tries++) {
          const cand = localTraders[Math.floor(rng() * localTraders.length)];
          const b = ledger.balances.get(cand) ?? 0n;
          if (b > 0n && cand !== creator) {
            trader = cand;
            bal = b;
          }
        }
        if (bal === 0n) side = 'buy';
      }
      if (side === 'buy') {
        const x = Math.min(400, Math.max(0.02, Math.exp(mu + 1.1 * gauss(rng))));
        execute(ts, 'buy', trader, hype(x), trader === creator);
      } else {
        const f = rng() < 0.25 ? 1 : 0.15 + 0.85 * Math.pow(rng(), 1.5);
        const amt = f === 1 ? bal : (bal * BigInt(Math.round(f * 1e6))) / 1_000_000n;
        if (amt > 0n) execute(ts, 'sell', trader, amt, trader === creator);
      }
      if (rng() < 0.07) {
        const who = localTraders[Math.floor(rng() * localTraders.length)];
        const amt = ledger.claimable(who, BigInt(ts));
        if (amt > 10n ** 14n) {
          ledger.claim(who, BigInt(ts));
          claims.push({ kind: 'holder', token: address, account: who, amount: amt, timestamp: ts, txHash: randHash(rng) });
        }
      }
      if (rng() < 0.03) {
        const owed = fees.creator - creatorClaimed;
        if (owed > 0n) {
          creatorClaimed += owed;
          claims.push({ kind: 'creator', token: address, account: creator, amount: owed, timestamp: ts, txHash: randHash(rng) });
        }
      }
    });

    let holderCount = 0;
    for (const b of ledger.balances.values()) if (b > 0n) holderCount++;
    const priceX18 = spotPriceX18(curve);
    const token: DemoToken = {
      address,
      poolId: randHash(rng),
      name: spec.name,
      symbol: spec.symbol,
      description: spec.desc,
      decimals: 18,
      totalSupply: TOTAL_SUPPLY,
      createdAt,
      createdBlock: blockAt(createdAt),
      creator,
      policyVersion: 'v1',
      openingFdv,
      openingPriceX18,
      creatorInitialBuyQuote: hype(spec.creatorBuy),
      creatorInitialBuyTokens,
      creatorSurrenderedAt: surrenderedAt,
      curve,
      priceX18,
      fdv: (priceX18 * TOTAL_SUPPLY) / E18,
      athX18: ath,
      atlX18: atl,
      trades,
      claims,
      fees,
      creatorClaimed,
      ledger,
      holderCount,
      stats: {} as Record<WindowKey, WindowStats>,
      matured: false,
      hue: parseInt(address.slice(2, 6), 16) % 360,
    };
    for (const k of WINDOW_KEYS) token.stats[k] = windowStats(token, k, DEMO_ANCHOR);
    token.matured = token.stats.all.volume >= hype(20_000) && spec.ageH >= 72;
    tokens.push(token);
  });

  cached = { anchor: DEMO_ANCHOR, tokens, byAddress: new Map(tokens.map((t) => [t.address.toLowerCase(), t])), demoWallet };
  return cached;
}

/* ---------- derived views ---------- */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function buildCandles(t: DemoToken, intervalSec: number, metric: 'price' | 'fdv' = 'price'): Candle[] {
  const mult = metric === 'fdv' ? 1_000_000_000 : 1;
  const toNum = (x: bigint) => (Number(x / 1_000_000_000n) / 1e9) * mult;
  const out: Candle[] = [];
  let prevClose = toNum(t.openingPriceX18);
  let cur: Candle | null = null;
  for (const tr of t.trades) {
    const bucket = Math.floor(tr.timestamp / intervalSec) * intervalSec;
    const px = toNum(tr.priceAfterX18);
    const vol = Number(tr.quoteNotional / 10n ** 12n) / 1e6;
    if (!cur || cur.time !== bucket) {
      if (cur) out.push(cur);
      cur = { time: bucket, open: prevClose, high: Math.max(prevClose, px), low: Math.min(prevClose, px), close: px, volume: vol };
    } else {
      cur.high = Math.max(cur.high, px);
      cur.low = Math.min(cur.low, px);
      cur.close = px;
      cur.volume += vol;
    }
    prevClose = px;
  }
  if (cur) out.push(cur);
  return out;
}

export interface HolderRow {
  address: Address;
  balance: bigint;
  shareBps: number;
  kind: 'pool' | 'creator' | 'holder';
  excluded: boolean;
}

export function holderRows(t: DemoToken, limit = 50): HolderRow[] {
  const rows: HolderRow[] = [];
  for (const [address, balance] of t.ledger.balances) {
    if (balance > 0n)
      rows.push({
        address: address as Address,
        balance,
        shareBps: Number((balance * 10_000n) / t.totalSupply),
        kind: address === t.creator ? 'creator' : 'holder',
        excluded: false,
      });
  }
  rows.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  const pool: HolderRow = {
    address: DEMO_POOL_MANAGER,
    balance: t.curve.tokenReserve,
    shareBps: Number((t.curve.tokenReserve * 10_000n) / t.totalSupply),
    kind: 'pool',
    excluded: true,
  };
  return [pool, ...rows.slice(0, limit)];
}

export function concentration(t: DemoToken): { top10ExclPoolBps: number; top10InclPoolBps: number } {
  const bals = [...t.ledger.balances.values()].filter((b) => b > 0n).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
  const top10 = bals.slice(0, 10).reduce((s, b) => s + b, 0n);
  const held = t.ledger.eligibleSupply;
  const withPool = [...bals, t.curve.tokenReserve].sort((a, b) => (b > a ? 1 : b < a ? -1 : 0)).slice(0, 10).reduce((s, b) => s + b, 0n);
  return {
    top10ExclPoolBps: held > 0n ? Number((top10 * 10_000n) / held) : 0,
    top10InclPoolBps: Number((withPool * 10_000n) / t.totalSupply),
  };
}

export function liquidityView(t: DemoToken) {
  const depth = [100, 200, 500].map((bps) => ({ bps, ...depthAt(t.curve, bps) }));
  const impact = ['1', '10', '100'].map((h) => {
    const q = quoteBuyExactIn(t.curve, hype(Number(h)));
    return { quoteIn: hype(Number(h)), tokenOut: q.tokenOut, priceImpactBps: q.priceImpactBps };
  });
  return { poolToken: t.curve.tokenReserve, poolQuote: realQuoteBalance(t.curve), depth, impact };
}

export function rewardView(t: DemoToken, anchor = DEMO_ANCHOR) {
  const now = BigInt(anchor);
  const released = t.ledger.releasedAt(now);
  return {
    funded: t.ledger.fundedTotal,
    released,
    pendingRelease: t.ledger.fundedTotal - released,
    claimed: t.ledger.claimedTotal,
    releasedUnclaimed: released - t.ledger.claimedTotal,
    eligibleSupply: t.ledger.eligibleSupply,
    streamEndsAt: Number(t.ledger.periodFinish),
    funded24h: t.stats['24h'].fees.holders,
    funded7d: t.stats['7d'].fees.holders,
  };
}

export function trendingScore(t: DemoToken): number {
  const s = t.stats['24h'];
  const vol = Number(s.volume / E18);
  const net = Number((s.buyVolume - s.sellVolume) / E18);
  const flow = vol > 0 ? Math.max(-1, Math.min(1, net / vol)) : 0;
  return 0.5 * Math.log10(1 + vol) + 0.3 * Math.log10(1 + s.uniqueTraders) + 0.2 * flow;
}

export interface Position {
  token: DemoToken;
  balance: bigint;
  costBasis: bigint;
  realized: bigint;
  feesPaid: bigint;
  markValue: bigint;
  exitQuote: bigint;
  unrealized: bigint;
  rewardsClaimed: bigint;
  rewardsClaimable: bigint;
  trades: DemoTrade[];
}

/** FIFO cost basis. Cost includes the trading fee; sale proceeds are net of fee. */
export function walletPositions(ds: DemoDataset, wallet: Address): Position[] {
  const out: Position[] = [];
  for (const t of ds.tokens) {
    const mine = t.trades.filter((tr) => tr.trader === wallet);
    const claimed = t.ledger.claimedBy.get(wallet) ?? 0n;
    const claimable = t.ledger.claimable(wallet, BigInt(ds.anchor));
    if (mine.length === 0 && claimed === 0n && claimable === 0n) continue;
    const lots: { qty: bigint; cost: bigint }[] = [];
    let realized = 0n;
    let feesPaid = 0n;
    for (const tr of mine) {
      feesPaid += tr.fee;
      if (tr.side === 'buy') lots.push({ qty: tr.tokenAmount, cost: tr.quoteSettled });
      else {
        let remaining = tr.tokenAmount;
        let costOut = 0n;
        while (remaining > 0n && lots.length) {
          const lot = lots[0];
          if (lot.qty <= remaining) {
            costOut += lot.cost;
            remaining -= lot.qty;
            lots.shift();
          } else {
            const part = (lot.cost * remaining) / lot.qty;
            costOut += part;
            lot.cost -= part;
            lot.qty -= remaining;
            remaining = 0n;
          }
        }
        realized += tr.quoteSettled - costOut;
      }
    }
    const balance = t.ledger.balances.get(wallet) ?? 0n;
    const costBasis = lots.reduce((s, l) => s + l.cost, 0n);
    const markValue = (balance * t.priceX18) / E18;
    const exitQuote = balance > 0n ? quoteSellExactIn(t.curve, balance).quoteOut : 0n;
    out.push({
      token: t,
      balance,
      costBasis,
      realized,
      feesPaid,
      markValue,
      exitQuote,
      unrealized: markValue - costBasis,
      rewardsClaimed: claimed,
      rewardsClaimable: claimable,
      trades: mine,
    });
  }
  return out;
}

export function platformStats(ds: DemoDataset) {
  const a = ds.anchor;
  const traders24 = new Set<string>();
  const tradersAll = new Set<string>();
  const firstSeen = new Map<string, number>();
  let volume = Object.fromEntries(WINDOW_KEYS.map((k) => [k, 0n])) as Record<WindowKey, bigint>;
  let fees = ZERO_SPLIT;
  let released = 0n;
  let claimed = 0n;
  let creatorClaimed = 0n;
  let swaps = 0;
  let activeMarkets = 0;
  const rewarded = new Set<string>();
  for (const t of ds.tokens) {
    for (const k of WINDOW_KEYS) volume[k] += t.stats[k].volume;
    fees = addSplits(fees, t.fees);
    released += t.ledger.releasedAt(BigInt(a));
    claimed += t.ledger.claimedTotal;
    creatorClaimed += t.creatorClaimed;
    swaps += t.trades.length;
    if (t.stats['24h'].buys + t.stats['24h'].sells > 0) activeMarkets++;
    for (const tr of t.trades) {
      tradersAll.add(tr.trader);
      if (tr.timestamp > a - 86_400) traders24.add(tr.trader);
      const f = firstSeen.get(tr.trader);
      if (f === undefined || tr.timestamp < f) firstSeen.set(tr.trader, tr.timestamp);
    }
    for (const [acct] of t.ledger.balances) if (t.ledger.claimable(acct, BigInt(a)) > 0n || (t.ledger.claimedBy.get(acct) ?? 0n) > 0n) rewarded.add(acct);
  }
  let newTraders24 = 0;
  for (const ts of firstSeen.values()) if (ts > a - 86_400) newTraders24++;
  return {
    launches: ds.tokens.length,
    launches24h: ds.tokens.filter((t) => t.createdAt > a - 86_400).length,
    launches7d: ds.tokens.filter((t) => t.createdAt > a - 604_800).length,
    activeMarkets24h: activeMarkets,
    activeTraders24h: traders24.size,
    newTraders24h: newTraders24,
    uniqueTraders: tradersAll.size,
    swaps,
    volume,
    fees,
    rewardsReleased: released,
    rewardsClaimed: claimed,
    holderLiabilityOutstanding: fees.holders - claimed,
    creatorClaimed,
    rewardedWallets: rewarded.size,
  };
}

export function dailySeries(ds: DemoDataset, days = 30) {
  const start = Math.floor(ds.anchor / 86_400) * 86_400 - (days - 1) * 86_400;
  const vol = new Array<number>(days).fill(0);
  const launches = new Array<number>(days).fill(0);
  const fees = new Array<number>(days).fill(0);
  for (const t of ds.tokens) {
    const li = Math.floor((t.createdAt - start) / 86_400);
    if (li >= 0 && li < days) launches[li]++;
    for (const tr of t.trades) {
      const i = Math.floor((tr.timestamp - start) / 86_400);
      if (i >= 0 && i < days) {
        vol[i] += Number(tr.quoteNotional / 10n ** 12n) / 1e6;
        fees[i] += Number(tr.fee / 10n ** 12n) / 1e6;
      }
    }
  }
  return Array.from({ length: days }, (_, i) => ({ time: start + i * 86_400, volume: vol[i], launches: launches[i], fees: fees[i] }));
}
