'use client';

import { useMemo, useState } from 'react';
import {
  DEMO_WALLET_QUOTE_BALANCE,
  fmtAmount,
  fmtBps,
  fmtCompact,
  parseAmount,
  quoteBuyExactIn,
  quoteSellExactIn,
  splitFee,
  walletPositions,
  type DemoToken,
} from '@canopy/sdk';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { MODE, writeBlockReason } from '@/lib/config';

const SELL_PCTS = [10, 25, 50, 100];
const SLIPPAGES = [50, 100, 200];

export function TradeTicket({ token, compact = false }: { token: DemoToken; compact?: boolean }) {
  const { ds } = useData();
  const { settings } = useSettings();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [input, setInput] = useState('');
  const [slippageBps, setSlippageBps] = useState(settings.slippageBps);
  const [showSplit, setShowSplit] = useState(false);

  const position = useMemo(
    () => (ds ? walletPositions(ds, ds.demoWallet).find((p) => p.token.address === token.address) : undefined),
    [ds, token.address],
  );
  const tokenBalance = position?.balance ?? 0n;
  const amount = parseAmount(input);
  const surrendered = token.creatorSurrenderedAt !== null;
  const tooSmallSell = side === 'sell' && amount !== null && amount > 0n && amount < 10n ** 9n;

  const quote = useMemo(() => {
    if (!amount || amount <= 0n || tooSmallSell) return null;
    try {
      return side === 'buy' ? quoteBuyExactIn(token.curve, amount) : quoteSellExactIn(token.curve, amount);
    } catch {
      return null;
    }
  }, [amount, side, token.curve, tooSmallSell]);

  const out = quote ? (quote.side === 'buy' ? quote.tokenOut : quote.quoteOut) : 0n;
  const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
  const split = quote ? splitFee(quote.fee, surrendered) : null;
  const balance = side === 'buy' ? DEMO_WALLET_QUOTE_BALANCE : tokenBalance;
  const insufficient = amount !== null && amount > balance;
  const invalid = input.trim() !== '' && amount === null;
  const blocked = writeBlockReason();
  const inUnit = side === 'buy' ? 'HYPE' : token.symbol;
  const outUnit = side === 'buy' ? token.symbol : 'HYPE';

  let problem: string | null = null;
  if (invalid) problem = 'Enter a number, like 2.5.';
  else if (insufficient) problem = `Not enough ${inUnit}. Balance: ${fmtAmount(balance, 18, 4)} ${inUnit}.`;
  else if (tooSmallSell) problem = 'Amount is too small to quote.';

  const exits = useMemo(
    () =>
      tokenBalance > 0n
        ? SELL_PCTS.map((p) => {
            const amt = (tokenBalance * BigInt(p)) / 100n;
            const q = amt > 0n ? quoteSellExactIn(token.curve, amt) : null;
            return { p, out: q?.quoteOut ?? 0n, impact: q?.priceImpactBps ?? 0 };
          })
        : [],
    [tokenBalance, token.curve],
  );

  return (
    <section aria-label={`Trade ${token.symbol}`} className={compact ? '' : 'space-y-4'}>
      <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-black/25 p-1" role="tablist" aria-label="Order side">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            type="button"
            onClick={() => {
              setSide(s);
              setInput('');
            }}
            className={`h-10 rounded-[11px] text-[14px] font-semibold transition-colors ${
              side === s ? (s === 'buy' ? 'bg-up/20 text-up' : 'bg-down/18 text-down') : 'text-ink-2 hover:text-ink'
            }`}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[12.5px] text-ink-3">
          <label htmlFor={`amt-${token.address}`}>{side === 'buy' ? 'You pay' : 'You sell'}</label>
          <span className="num">
            Balance {fmtAmount(balance, 18, side === 'buy' ? 4 : 0)} {inUnit}
            {MODE === 'demo' ? ' (demo wallet)' : ''}
          </span>
        </div>
        <div className="relative mt-1.5">
          <input
            id={`amt-${token.address}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="field num h-14 pr-20 text-[22px] font-medium"
            aria-invalid={Boolean(problem)}
            aria-describedby={`amt-help-${token.address}`}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-2">{inUnit}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {side === 'buy'
            ? settings.quickBuy.map((q) => (
                <button key={q} type="button" className="chip h-8 border border-line" onClick={() => setInput(q)}>
                  {q} HYPE
                </button>
              ))
            : SELL_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip h-8 border border-line"
                  disabled={tokenBalance === 0n}
                  onClick={() => setInput(fmtAmount((tokenBalance * BigInt(p)) / 100n, 18, 6).replace(/,/g, '').replace(/^</, ''))}
                >
                  {p}%
                </button>
              ))}
        </div>
        <p id={`amt-help-${token.address}`} className={`mt-2 min-h-[20px] text-[13px] ${problem ? 'text-down' : 'text-ink-3'}`} role={problem ? 'alert' : undefined}>
          {problem ?? (side === 'sell' && tokenBalance === 0n ? `The demo wallet holds no ${token.symbol}.` : '')}
        </p>
      </div>

      <div className="inset mt-1 divide-y divide-white/6 px-3.5 text-[13.5px]">
        <Row k="You receive (estimate)" v={quote ? `${fmtCompact(out)} ${outUnit}` : '0'} strong />
        <Row k={`Minimum received at ${fmtBps(slippageBps)} slippage`} v={quote ? `${fmtCompact(minOut)} ${outUnit}` : 'n/a'} />
        <Row
          k="Price impact"
          v={quote ? <span className={quote.priceImpactBps > 500 ? 'text-warn' : ''}>{fmtBps(Math.max(0, quote.priceImpactBps))}</span> : 'n/a'}
        />
        <div className="py-2.5">
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-3 text-left"
            aria-expanded={showSplit}
            onClick={() => setShowSplit((s) => !s)}
          >
            <span className="text-ink-2 underline decoration-white/20 underline-offset-4">Trading fee 1.00%</span>
            <span className="num">{quote ? `${fmtAmount(quote.fee, 18, 6)} HYPE` : 'n/a'}</span>
          </button>
          {showSplit ? (
            <ul className="mt-2 space-y-1 text-[12.5px] text-ink-2">
              <li className="flex justify-between">
                <span>Holder rewards {surrendered ? '70%' : '60%'}</span>
                <span className="num">{split ? fmtAmount(split.holders, 18, 6) : '0'}</span>
              </li>
              <li className="flex justify-between">
                <span>Buy-order reserve 10%</span>
                <span className="num">{split ? fmtAmount(split.reserve, 18, 6) : '0'}</span>
              </li>
              <li className="flex justify-between">
                <span>Creator {surrendered ? '0% (surrendered)' : '10%'}</span>
                <span className="num">{split ? fmtAmount(split.creator, 18, 6) : '0'}</span>
              </li>
              <li className="flex justify-between">
                <span>Liquidity growth 10%</span>
                <span className="num">{split ? fmtAmount(split.liquidity, 18, 6) : '0'}</span>
              </li>
              <li className="flex justify-between">
                <span>Protocol 10%</span>
                <span className="num">{split ? fmtAmount(split.protocol, 18, 6) : '0'}</span>
              </li>
              <li className="pt-1 text-ink-3">
                {side === 'buy' ? 'Taken from your HYPE before it reaches the pool.' : 'Taken from the HYPE the pool pays out.'} No other
                trading fee applies: the pool’s LP fee is 0%.
              </li>
            </ul>
          ) : null}
        </div>
        <Row k="Network fee" v={MODE === 'demo' ? 'Not estimated in demo' : 'Estimated before signing'} />
        {!compact ? (
          <>
            <Row k="Route" v="Uniswap v4 pool, CANOPY hook" />
            {side === 'sell' ? <Row k="Approval" v={MODE === 'demo' ? 'Not needed in demo' : 'Finite approval to router'} /> : null}
            <Row k="Quote" v={MODE === 'demo' ? `Fixture state, block ${(token.trades.at(-1)?.block ?? token.createdBlock).toLocaleString('en-US')}` : 'Refreshes each block'} />
          </>
        ) : null}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <span>Slippage</span>
        {SLIPPAGES.map((s) => (
          <button key={s} type="button" className="chip h-7 px-2.5 text-[12.5px]" aria-pressed={slippageBps === s} onClick={() => setSlippageBps(s)}>
            {fmtBps(s)}
          </button>
        ))}
      </div>

      <div className="sticky -bottom-4 z-10 -mx-4 mt-3 border-t border-white/8 bg-[rgb(8_23_17)] px-4 pb-4 pt-3">
        <button type="button" className="btn btn-primary h-12 w-full text-[15px]" disabled={Boolean(blocked) || !quote || Boolean(problem)}>
          {side === 'buy' ? `Buy ${token.symbol}` : `Sell ${token.symbol}`}
        </button>
        {blocked ? <p className="mt-2 text-center text-[12.5px] text-ink-2">{blocked}</p> : null}
      </div>

      {!compact && exits.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[13.5px] font-medium text-ink">Exit quotes for the demo wallet’s position</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {exits.map((e) => (
              <li key={e.p} className="inset px-3 py-2.5">
                <div className="text-[12.5px] text-ink-3">Sell {e.p}%</div>
                <div className="num text-[14.5px]">{fmtCompact(e.out)} HYPE</div>
                <div className="num text-[12px] text-ink-3">impact {fmtBps(Math.max(0, e.impact))}</div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">Net of the 1% fee, from the same quote model as the ticket. Nothing sells automatically.</p>
        </div>
      ) : null}
    </section>
  );
}

function Row({ k, v, strong = false }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-ink-2">{k}</span>
      <span className={`num text-right ${strong ? 'text-[15px] font-semibold text-ink' : 'text-ink'}`}>{v}</span>
    </div>
  );
}
