'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCandles, type DemoToken } from '@canopy/sdk';

const INTERVALS = [
  { id: '5m', sec: 300 },
  { id: '15m', sec: 900 },
  { id: '1h', sec: 3600 },
  { id: '4h', sec: 14_400 },
  { id: '1d', sec: 86_400 },
] as const;

function fmtAxis(v: number): string {
  if (v === 0) return '0';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  const zeros = Math.max(0, -Math.floor(Math.log10(v)) - 1);
  return v.toFixed(Math.min(14, zeros + 3));
}

export function PriceChart({ token }: { token: DemoToken }) {
  const box = useRef<HTMLDivElement>(null);
  const [metric, setMetric] = useState<'price' | 'fdv'>('price');
  const [interval, setInterval] = useState<number>(token.trades.length > 300 ? 3600 : 900);
  const candles = useMemo(() => buildCandles(token, interval, metric), [token, interval, metric]);

  useEffect(() => {
    if (!box.current || candles.length === 0) return;
    let disposed = false;
    let cleanup = () => undefined as void;
    void import('lightweight-charts').then(({ createChart, CandlestickSeries, HistogramSeries, ColorType }) => {
      if (disposed || !box.current) return;
      const chart = createChart(box.current, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#b2c2b6',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          fontSize: 12,
          attributionLogo: true,
        },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
        crosshair: { horzLine: { color: 'rgba(200,245,128,0.4)' }, vertLine: { color: 'rgba(200,245,128,0.4)' } },
        localization: { priceFormatter: fmtAxis },
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#95d9aa',
        downColor: '#ee929a',
        borderVisible: false,
        wickUpColor: '#95d9aa',
        wickDownColor: '#ee929a',
        priceFormat: { type: 'custom', formatter: fmtAxis, minMove: metric === 'fdv' ? 0.01 : 1e-12 },
      });
      series.setData(candles.map((c) => ({ time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close })));
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: 'rgba(200,245,128,0.28)' });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(candles.map((c) => ({ time: c.time as never, value: c.volume })));
      chart.timeScale().fitContent();
      cleanup = () => chart.remove();
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, metric]);

  const first = candles[0];
  const last = candles.at(-1);
  const hi = candles.reduce((m, c) => Math.max(m, c.high), 0);
  const lo = candles.reduce((m, c) => Math.min(m, c.low), Number.POSITIVE_INFINITY);
  const unit = metric === 'fdv' ? 'HYPE FDV' : 'HYPE per token';

  return (
    <section aria-label={`${token.symbol} chart`} className="panel p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[12px] bg-black/25 p-0.5" role="group" aria-label="Chart metric">
          <button type="button" className="chip h-8" aria-pressed={metric === 'price'} onClick={() => setMetric('price')}>
            Price
          </button>
          <button type="button" className="chip h-8" aria-pressed={metric === 'fdv'} onClick={() => setMetric('fdv')}>
            FDV
          </button>
        </div>
        <div className="flex rounded-[12px] bg-black/25 p-0.5" role="group" aria-label="Candle interval">
          {INTERVALS.map((i) => (
            <button key={i.id} type="button" className="chip h-8 px-2.5" aria-pressed={interval === i.sec} onClick={() => setInterval(i.sec)}>
              {i.id}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.5px] text-ink-3">Times in UTC, {unit}</span>
      </div>
      {candles.length === 0 ? (
        <div className="mt-3 flex h-[340px] items-center justify-center rounded-2xl bg-black/15 text-center text-[14px] text-ink-2">
          No trades yet. The chart starts with the first swap after launch.
        </div>
      ) : (
        <>
          <div ref={box} className="mt-3 h-[300px] w-full sm:h-[380px]" role="img" aria-label={`${token.name} ${metric} candles`} />
          <p className="sr-only">
            {token.name} {metric}: first candle opened at {first ? fmtAxis(first.open) : 'n/a'}, latest close {last ? fmtAxis(last.close) : 'n/a'}, high{' '}
            {fmtAxis(hi)}, low {fmtAxis(lo)}, {candles.length} candles. {unit}.
          </p>
          <details className="mt-2 text-[13px] text-ink-2">
            <summary className="cursor-pointer select-none text-ink-3 hover:text-ink-2">Show recent candles as a table</summary>
            <div className="scroll-x mt-2">
              <table className="w-full text-left text-[12.5px]">
                <thead className="text-ink-3">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Time (UTC)</th>
                    <th className="py-1 pr-3 text-right font-normal">Open</th>
                    <th className="py-1 pr-3 text-right font-normal">High</th>
                    <th className="py-1 pr-3 text-right font-normal">Low</th>
                    <th className="py-1 pr-3 text-right font-normal">Close</th>
                    <th className="py-1 text-right font-normal">Volume (HYPE)</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {candles
                    .slice(-12)
                    .reverse()
                    .map((c) => (
                      <tr key={c.time} className="border-t border-white/6">
                        <td className="py-1 pr-3">{new Date(c.time * 1000).toISOString().slice(0, 16).replace('T', ' ')}</td>
                        <td className="py-1 pr-3 text-right">{fmtAxis(c.open)}</td>
                        <td className="py-1 pr-3 text-right">{fmtAxis(c.high)}</td>
                        <td className="py-1 pr-3 text-right">{fmtAxis(c.low)}</td>
                        <td className="py-1 pr-3 text-right">{fmtAxis(c.close)}</td>
                        <td className="py-1 text-right">{c.volume.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
