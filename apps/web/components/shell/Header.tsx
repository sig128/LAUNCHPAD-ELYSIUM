'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BRAND, MODE, NETWORK } from '@/lib/config';
import { DemoTag } from '@/components/ui/primitives';
import { IconChevron, IconLeaf, IconSearch } from '@/components/ui/Icons';
import { useSearch } from './Shell';
import { ConnectButton } from './ConnectButton';
import { BackgroundToggle } from './JungleBackground';
import { healthLabel, useHealth } from '@/lib/health';

const NAV = [
  { href: '/', label: 'Discover' },
  { href: '/launch', label: 'Launch' },
  { href: '/rewards', label: 'Rewards' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/analytics', label: 'Analytics' },
];
const MORE = [
  { href: '/creator', label: 'Creator tools' },
  { href: '/contracts', label: 'Contracts and addresses' },
  { href: '/docs', label: 'How it works' },
  { href: '/settings', label: 'Settings' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/token');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const activeInMore = MORE.some((m) => isActive(pathname, m.href));
  return (
    <div className="relative" ref={ref}>
      <button
        ref={btn}
        type="button"
        className="chip"
        aria-expanded={open}
        aria-haspopup="true"
        aria-current={activeInMore ? 'page' : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        More <IconChevron size={14} />
      </button>
      {open ? (
        <div className="panel panel-dense anim-fade absolute left-0 top-[calc(100%+8px)] z-50 w-60 p-1.5" role="menu">
          {MORE.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              role="menuitem"
              className="block rounded-xl px-3 py-2.5 text-[14px] text-ink-2 hover:bg-white/8 hover:text-ink"
              aria-current={isActive(pathname, m.href) ? 'page' : undefined}
            >
              {m.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NetworkStatus() {
  const health = useHealth();
  const label = healthLabel(health);
  const dot = { up: 'bg-up', warn: 'bg-warn', down: 'bg-down', neutral: 'bg-ink-3' }[label.tone];
  return (
    <Link
      href="/contracts"
      className="hidden items-center gap-2 rounded-xl px-2 py-1 text-[13px] text-ink-2 hover:bg-white/6 md:flex"
      title={`${NETWORK.name}, chain ${NETWORK.chainId}. ${label.detail}`}
    >
      {MODE === 'demo' ? (
        <DemoTag />
      ) : (
        <span className="tag bg-white/6 text-ink ring-1 ring-white/10">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
          {label.text}
        </span>
      )}
      <span className="hidden xl:inline">{NETWORK.name.replace('Kinetiq ', '')}</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { openSearch } = useSearch();
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 lg:px-5">
      <div className="panel mx-auto flex h-[60px] max-w-[1640px] items-center gap-1.5 rounded-[20px] px-2.5 sm:gap-2 sm:px-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 text-ink" aria-label={`${BRAND.name} home`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime/15 text-lime ring-1 ring-lime/25">
            <IconLeaf size={18} />
          </span>
          <span className="display text-[21px] leading-none">{BRAND.name.charAt(0) + BRAND.name.slice(1).toLowerCase()}</span>
        </Link>
        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="chip" aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
          <MoreMenu pathname={pathname} />
        </nav>
        <button
          type="button"
          onClick={openSearch}
          className="ml-auto flex h-10 min-w-0 items-center gap-2 rounded-[13px] border border-line bg-black/20 px-3 text-[14px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:w-64 xl:w-80"
          aria-label="Search markets by name, ticker or contract address"
        >
          <IconSearch size={16} />
          <span className="hidden truncate sm:inline">Search name, ticker or address</span>
          <kbd className="ml-auto hidden rounded-md border border-line px-1.5 font-sans text-[11.5px] text-ink-3 sm:inline">/</kbd>
        </button>
        <NetworkStatus />
        <BackgroundToggle />
        <ConnectButton />
      </div>
    </header>
  );
}
