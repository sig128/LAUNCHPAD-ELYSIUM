/** Display formatting. Financial values stay bigint until this final, bounded conversion. */

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

export function toDecimalString(raw: bigint, decimals = 18): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int.toString()}${frac ? `.${frac}` : ''}`;
}

function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Truncating fixed formatter with digit grouping. */
export function fmtAmount(raw: bigint, decimals = 18, maxFrac = 4): string {
  if (raw === 0n) return '0';
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  const fracFull = (abs % base).toString().padStart(decimals, '0');
  const frac = fracFull.slice(0, maxFrac).replace(/0+$/, '');
  if (int === 0n && !frac) return `${neg ? '>-' : '<'}0.${'0'.repeat(Math.max(0, maxFrac - 1))}1`;
  return `${neg ? '-' : ''}${group(int.toString())}${frac ? `.${frac}` : ''}`;
}

const UNITS: [bigint, string][] = [
  [10n ** 12n, 'T'],
  [10n ** 9n, 'B'],
  [10n ** 6n, 'M'],
  [10n ** 3n, 'K'],
];

/** Compact formatter (1.25K, 3.4M). Keeps two significant decimals, truncating. */
export function fmtCompact(raw: bigint, decimals = 18): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const whole = abs / 10n ** BigInt(decimals);
  for (const [unit, suffix] of UNITS) {
    if (whole >= unit) {
      const scaled = (abs * 100n) / (unit * 10n ** BigInt(decimals));
      const s = (Number(scaled) / 100).toFixed(2).replace(/\.?0+$/, '');
      return `${neg ? '-' : ''}${s}${suffix}`;
    }
  }
  return fmtAmount(raw, decimals, whole >= 100n ? 1 : whole >= 1n ? 2 : 4);
}

/** Prices below 0.001 use subscript-zero notation: 0.0₅32 means 0.0000032. */
export function fmtPrice(priceX18: bigint): string {
  if (priceX18 <= 0n) return '0';
  const s = toDecimalString(priceX18, 18);
  const [int, frac = ''] = s.split('.');
  if (int !== '0') return fmtAmount(priceX18, 18, Number(int) >= 100 ? 2 : 4);
  const zeros = frac.match(/^0*/)?.[0].length ?? 0;
  const digits = frac.slice(zeros, zeros + 4).replace(/0+$/, '') || '0';
  if (zeros < 3) return `0.${frac.slice(0, zeros + 4).replace(/0+$/, '')}`;
  const sub = String(zeros).split('').map((d) => SUB[Number(d)]).join('');
  return `0.0${sub}${digits}`;
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortAddr(addr: string, lead = 6, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function fmtAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/** Bounded conversion for charts only. */
export function toChartNumber(raw: bigint, decimals = 18): number {
  return Number(toDecimalString(raw, decimals));
}

/** Parse a user-entered decimal string into raw units. Returns null on invalid input. */
export function parseAmount(input: string, decimals = 18): bigint | null {
  const v = input.trim().replace(/,/g, '');
  if (!/^\d*(\.\d*)?$/.test(v) || v === '' || v === '.') return null;
  const [int, frac = ''] = v.split('.');
  if (frac.length > decimals) return null;
  return BigInt(int || '0') * 10n ** BigInt(decimals) + BigInt((frac || '').padEnd(decimals, '0') || '0');
}
