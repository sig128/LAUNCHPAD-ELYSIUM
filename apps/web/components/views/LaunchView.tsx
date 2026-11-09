'use client';

import { useMemo, useState } from 'react';
import { E18, fmtAmount, fmtBps, fmtCompact, fmtPrice, initialCurve, PAIR_ASSETS, parseAmount, quoteBuyExactIn, splitFee, spotPriceX18, TOTAL_SUPPLY } from '@canopy/sdk';
import { writeBlockReason } from '@/lib/config';
import { KeyValue, TokenArt } from '@/components/ui/primitives';
import { IconLeaf } from '@/components/ui/Icons';

function safeHttpsUrl(v: string): string | null {
  if (!v.trim()) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:') return 'Use an https:// link.';
    if (u.username || u.password) return 'Links cannot contain credentials.';
    return null;
  } catch {
    return 'This is not a valid URL.';
  }
}

export function LaunchView() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState('');
  const [site, setSite] = useState('');
  const [fdvInput, setFdvInput] = useState('3000');
  const [buyInput, setBuyInput] = useState('');
  const [surrender, setSurrender] = useState(false);
  const [pairId, setPairId] = useState('canopy');
  const pair = PAIR_ASSETS.find((a) => a.id === pairId) ?? PAIR_ASSETS[0];

  const fdv = parseAmount(fdvInput);
  const buy = buyInput.trim() ? parseAmount(buyInput) : 0n;
  const errors = {
    name: name.trim().length === 0 ? null : name.trim().length > 40 ? 'Use 40 characters or fewer.' : null,
    symbol: symbol && !/^[A-Z0-9]{2,10}$/.test(symbol) ? 'Use 2 to 10 capital letters or digits.' : null,
    image: safeHttpsUrl(image),
    site: safeHttpsUrl(site),
    fdv: fdv === null ? 'Enter a number.' : fdv < 500n * E18 ? `Opening FDV must be at least 500 ${pair.symbol}.` : fdv > 1_000_000n * E18 ? `Opening FDV must be at most 1,000,000 ${pair.symbol}.` : null,
    buy: buy === null ? 'Enter a number, or leave it empty.' : null,
  };
  const preview = useMemo(() => {
    if (!fdv || errors.fdv) return null;
    const c = initialCurve(TOTAL_SUPPLY, fdv);
    const q = buy && buy > 0n ? quoteBuyExactIn(c, buy) : null;
    return { price: spotPriceX18(c), q, example: splitFee(10n ** 16n, surrender) };
  }, [fdv, buy, surrender, errors.fdv]);

  const complete = name.trim() && symbol && !Object.values(errors).some(Boolean);
  const blocked = writeBlockReason();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Launch a market</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          One transaction creates the token, its Uniswap v4 pool, the locked seed position and your optional first buy. If any step fails, nothing
          is created.
        </p>

        <fieldset className="mt-6 grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Token details</legend>
          <Field label="Name" error={errors.name} hint="Shown everywhere. Up to 40 characters.">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Ticker" error={errors.symbol} hint="2 to 10 capital letters or digits.">
            <input className="field font-mono uppercase" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={12} />
          </Field>
          <Field label="Description" hint="Plain text, up to 280 characters. Scripts and HTML are never rendered." className="sm:col-span-2">
            <textarea className="field min-h-[88px] py-2.5" value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 280))} />
          </Field>
          <Field label="Image URL (optional)" error={errors.image} hint="https only. Images are fetched through a size- and type-limited proxy, never directly.">
            <input className="field" value={image} onChange={(e) => setImage(e.target.value)} inputMode="url" />
          </Field>
          <Field label="Website (optional)" error={errors.site} hint="https only.">
            <input className="field" value={site} onChange={(e) => setSite(e.target.value)} inputMode="url" />
          </Field>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-1 text-[15px] font-semibold">Pair with</legend>
          <p className="mb-3 max-w-prose text-[13.5px] text-ink-2">
            Every coin trades against CANOPY, the platform’s main coin, and its 1% fee, holder rewards and creator fees are paid in CANOPY.
            Traders can still pay with HYPE: it is swapped through CANOPY in the same transaction. Launching is free apart from gas.
          </p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Pair asset">
            {PAIR_ASSETS.map((a) => {
              const available = a.status !== 'not-on-elysium';
              const selected = pairId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={!available}
                  onClick={() => available && setPairId(a.id)}
                  title={a.note}
                  className={`inset flex items-center gap-3 p-3 text-left transition-colors ${
                    selected ? 'ring-1 ring-lime/50' : available ? 'hover:bg-white/6' : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-semibold ${
                      a.kind === 'main' ? 'bg-lime/15 text-lime' : 'bg-white/8 text-ink'
                    }`}
                  >
                    {a.kind === 'main' ? <IconLeaf size={17} /> : a.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-ink">
                      {a.symbol}
                      {a.issuer ? <span className="text-ink-3"> by {a.issuer}</span> : null}
                    </span>
                    <span className={`block text-[12px] ${available ? 'text-ink-3' : 'text-warn'}`}>
                      {a.status === 'not-on-elysium' ? 'Not on Elysium yet' : a.status === 'not-launched' ? `${a.name}, launching soon` : a.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">
            Buying with HYPE goes through two markets (HYPE to CANOPY, then CANOPY to your coin), so it pays the 1% fee twice: once to CANOPY holders,
            once to your holders. Stock pairs are restricted in some countries, including the US and UK, and open once a stock token is live on Elysium.

          </p>
        </fieldset>

        <fieldset className="mt-6 grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-[15px] font-semibold">Opening market</legend>
          <Field label={`Opening FDV (${pair.symbol})`} error={errors.fdv} hint={`Sets the starting price: FDV ÷ 1,000,000,000 tokens. It is not ${pair.symbol} you deposit.`}>
            <input className="field num" value={fdvInput} onChange={(e) => setFdvInput(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label={`Your first buy (${pair.symbol}, optional)`} error={errors.buy} hint="Bought in the launch transaction at the opening price, with the same 1% fee. Shown publicly as a creator buy.">
            <input className="field num" value={buyInput} onChange={(e) => setBuyInput(e.target.value)} inputMode="decimal" placeholder="0" />
          </Field>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-2 text-[15px] font-semibold">Your fee share</legend>
          <label className="inset flex cursor-pointer items-start gap-3 p-3.5">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#c8f580]" checked={surrender} onChange={(e) => setSurrender(e.target.checked)} />
            <span>
              <span className="block text-[14.5px] text-ink">Give my 10% creator share to holders permanently</span>
              <span className="block text-[13px] text-ink-2">
                Holders then receive 90% of every fee. This cannot be undone. You can also do it later from Creator tools.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-2 text-[15px] font-semibold">Launch mode</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="inset flex items-start gap-3 p-3.5 ring-1 ring-lime/30">
              <input type="radio" name="mode" defaultChecked className="mt-1 accent-[#c8f580]" />
              <span>
                <span className="block text-[14.5px]">Instant launch</span>
                <span className="block text-[13px] text-ink-2">Trading opens in the launch transaction.</span>
              </span>
            </label>
            <label className="inset flex items-start gap-3 p-3.5 opacity-60">
              <input type="radio" name="mode" disabled className="mt-1" />
              <span>
                <span className="block text-[14.5px]">Fair auction</span>
                <span className="block text-[13px] text-ink-2">Unavailable: subscription, clearing, refunds and settlement are not built yet.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </section>

      <aside>
        <div className="panel panel-dense sticky top-[88px] space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <TokenArt symbol={symbol || '?'} hue={(name.length * 37) % 360} size={44} />
            <div className="min-w-0">
              <div className="truncate text-[16px] font-medium">{name || 'Your market'}</div>
              <div className="font-mono text-[13px] text-ink-2">{symbol || 'TICKER'}</div>
            </div>
          </div>
          <KeyValue
            rows={[
              ['Supply', '1,000,000,000, minted once'],
              ['Pair', pair.symbol],
              ['Fee policy', `v1: 1.00% on the ${pair.symbol} side`],
              ['Opening price', preview ? `${fmtPrice(preview.price)} ${pair.symbol}` : 'n/a'],
              [
                'Your first buy',
                preview?.q
                  ? `${fmtCompact(preview.q.tokenOut)} tokens (${fmtBps(Number((preview.q.tokenOut * 10_000n) / TOTAL_SUPPLY))})`
                  : 'None',
              ],
              ['Seed liquidity', 'Whole supply, locked forever'],
              ['Holder share of fees', surrender ? '90%' : '80%'],
              ['Creator share of fees', surrender ? '0%' : '10%'],
            ]}
          />
          {preview ? (
            <div className="inset p-3.5 text-[13px] text-ink-2">
              <div className="mb-1 text-ink">On a 1 {pair.symbol} trade the fee is 0.01 {pair.symbol}:</div>
              holders {fmtAmount(preview.example.holders, 18, 4)}, creator {fmtAmount(preview.example.creator, 18, 4)}, protocol{' '}
              {fmtAmount(preview.example.protocol, 18, 4)}.
            </div>
          ) : null}
          <p className="text-[12.5px] text-ink-3">
            Liquidity starts as token inventory only. No {pair.symbol} backs the opening price, and there is no guaranteed floor or return.
          </p>
          <button type="button" className="btn btn-primary h-12 w-full text-[15px]" disabled={!complete || Boolean(blocked)}>
            Launch market
          </button>
          <p className="text-center text-[12.5px] text-ink-2">{blocked ?? (complete ? '' : 'Add a name and ticker to continue.')}</p>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13.5px] text-ink">{label}</span>
      {children}
      <span className={`mt-1.5 block text-[12.5px] ${error ? 'text-down' : 'text-ink-3'}`}>{error ?? hint}</span>
    </label>
  );
}
