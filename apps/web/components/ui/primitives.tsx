'use client';

import { useCallback, useId, useState, type ReactNode } from 'react';
import { fmtPct, shortAddr } from '@canopy/sdk';
import { IconCheck, IconCopy, IconInfo } from './Icons';

export function TokenArt({ symbol, hue, size = 36 }: { symbol: string; hue: number; size?: number }) {
  const id = `art${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0 rounded-[12px]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 42% 34%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 50) % 360} 46% 18%)`} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id})`} />
      <path d="M6 34C12 20 22 12 36 8c-2 13-10 22-24 26" fill="rgb(255 255 255 / 0.07)" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontSize="17"
        fill="#f1f5ef"
        style={{ fontFamily: 'var(--font-display)', fontVariationSettings: '"opsz" 30, "SOFT" 60' }}
      >
        {symbol.slice(0, 1)}
      </text>
    </svg>
  );
}

export function Change({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) {
    return (
      <span className={`num text-ink-3 ${className}`} title="The market is younger than this window">
        n/a
      </span>
    );
  }
  const tone = value > 0.005 ? 'text-up' : value < -0.005 ? 'text-down' : 'text-ink-2';
  return <span className={`num ${tone} ${className}`}>{fmtPct(value)}</span>;
}

export function CopyButton({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    } catch {
      setDone(false);
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onCopy();
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-white/10 hover:text-ink ${className}`}
      aria-label={done ? `${label} copied` : `Copy ${label}`}
      title={done ? 'Copied' : `Copy ${label}`}
    >
      {done ? <IconCheck size={15} /> : <IconCopy size={15} />}
      <span className="sr-only" aria-live="polite">
        {done ? 'Copied' : ''}
      </span>
    </button>
  );
}

export function Address({ value, label = 'address', full = false }: { value: string; label?: string; full?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-[12.5px] text-ink-2" title={value}>
        {full ? value : shortAddr(value)}
      </span>
      <CopyButton value={value} label={label} />
    </span>
  );
}

export function Stat({ label, value, hint, className = '' }: { label: string; value: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1 text-[12.5px] text-ink-3">
        <span className="truncate">{label}</span>
        {hint ? (
          <span title={hint} className="inline-flex" aria-label={hint}>
            <IconInfo size={13} />
          </span>
        ) : null}
      </div>
      <div className="num mt-0.5 truncate text-[15.5px] font-medium text-ink">{value}</div>
    </div>
  );
}

export function Unavailable({ title, reason, className = '' }: { title: string; reason: string; className?: string }) {
  return (
    <div className={`inset px-4 py-3.5 ${className}`} role="status">
      <div className="text-[14px] font-medium text-ink">{title}</div>
      <p className="mt-1 max-w-prose text-[13.5px] text-ink-2">{reason}</p>
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="tag bg-warn/15 text-warn ring-1 ring-warn/30" title="Simulated fixture data">
      <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
      Demo data
    </span>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'lime' | 'up' | 'down' | 'warn' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/8 text-ink-2 ring-1 ring-white/10',
    lime: 'bg-lime/15 text-lime ring-1 ring-lime/25',
    up: 'bg-up/12 text-up ring-1 ring-up/25',
    down: 'bg-down/12 text-down ring-1 ring-down/25',
    warn: 'bg-warn/12 text-warn ring-1 ring-warn/30',
  };
  return <span className={`tag ${tones[tone]}`}>{children}</span>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      {aside}
    </div>
  );
}

export function KeyValue({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-white/6">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
          <dt className="text-ink-2">{k}</dt>
          <dd className="num text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
