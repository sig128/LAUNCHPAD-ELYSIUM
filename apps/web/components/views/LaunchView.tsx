'use client';

import { useMemo, useState } from 'react';
import { E18, fmtAmount, fmtBps, fmtCompact, fmtPrice, initialCurve, parseAmount, quoteBuyExactIn, splitFee, spotPriceX18, TOTAL_SUPPLY } from '@canopy/sdk';
import { writeBlockReason } from '@/lib/config';
import { KeyValue, TokenArt } from '@/components/ui/primitives';

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

  const fdv = parseAmount(fdvInput);
  const buy = buyInput.trim() ? parseAmount(buyInput) : 0n;
  const errors = {
    name: name.trim().length === 0 ? null : name.trim().length > 40 ? 'Use 40 characters or fewer.' : null,
    symbol: symbol && !/^[A-Z0-9]{2,10}$/.test(symbol) ? 'Use 2 to 10 capital letters or digits.' : null,
    image: safeHttpsUrl(image),
    site: safeHttpsUrl(site),
    fdv: fdv === null ? 'Enter a number.' : fdv < 500n * E18 ? 'Opening FDV must be at least 500 HYPE.' : fdv > 1_000_000n * E18 ? 'Opening FDV must be at most 1,000,000 HYPE.' : null,
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

        <fieldset className="mt-6 grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-[15px] font-semibold">Opening market</legend>
          <Field label="Opening FDV (HYPE)" error={errors.fdv} hint="Sets the starting price: FDV ÷ 1,000,000,000 tokens. It is not HYPE you deposit.">
            <input className="field num" value={fdvInput} onChange={(e) => setFdvInput(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Your first buy (HYPE, optional)" error={errors.buy} hint="Bought in the launch transaction at the opening price, with the same 1% fee. Shown publicly as a creator buy.">
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
                Holders then receive 70% of every fee. This cannot be undone. You can also do it later from Creator tools.
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
              ['Fee policy', 'v1: 1.00% on HYPE side'],
              ['Opening price', preview ? `${fmtPrice(preview.price)} HYPE` : 'n/a'],
              [
                'Your first buy',
                preview?.q
                  ? `${fmtCompact(preview.q.tokenOut)} tokens (${fmtBps(Number((preview.q.tokenOut * 10_000n) / TOTAL_SUPPLY))})`
                  : 'None',
              ],
              ['Seed liquidity', 'Whole supply, locked forever'],
              ['Holder share of fees', surrender ? '70%' : '60%'],
              ['Creator share of fees', surrender ? '0%' : '10%'],
            ]}
          />
          {preview ? (
            <div className="inset p-3.5 text-[13px] text-ink-2">
              <div className="mb-1 text-ink">On a 1 HYPE trade the fee is 0.01 HYPE:</div>
              holders {fmtAmount(preview.example.holders, 18, 4)}, reserve {fmtAmount(preview.example.reserve, 18, 4)}, creator{' '}
              {fmtAmount(preview.example.creator, 18, 4)}, liquidity growth {fmtAmount(preview.example.liquidity, 18, 4)}, protocol{' '}
              {fmtAmount(preview.example.protocol, 18, 4)}.
            </div>
          ) : null}
          <p className="text-[12.5px] text-ink-3">
            Liquidity starts as token inventory only. No HYPE backs the opening price, and there is no guaranteed floor or return.
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
