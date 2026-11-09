'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { IconCompass, IconDrop, IconLayers, IconSprout, IconStar } from '@/components/ui/Icons';

function Items() {
  const pathname = usePathname();
  const params = useSearchParams();
  const watch = pathname === '/' && params.get('seg') === 'watchlist';
  const items = [
    { href: '/', label: 'Discover', icon: IconCompass, active: (pathname === '/' && !watch) || pathname.startsWith('/token') },
    { href: '/?seg=watchlist', label: 'Watchlist', icon: IconStar, active: watch },
    { href: '/launch', label: 'Launch', icon: IconSprout, active: pathname.startsWith('/launch') },
    { href: '/rewards', label: 'Rewards', icon: IconDrop, active: pathname.startsWith('/rewards') },
    { href: '/portfolio', label: 'Portfolio', icon: IconLayers, active: pathname.startsWith('/portfolio') },
  ];
  return (
    <ul className="grid grid-cols-5">
      {items.map(({ href, label, icon: Icon, active }) => (
        <li key={label}>
          <Link
            href={href}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[11.5px] ${
              active ? 'text-lime' : 'text-ink-2 hover:text-ink'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      data-enter="up"
      style={{ '--i': 4 } as React.CSSProperties}
      className="panel panel-chrome fixed inset-x-2 bottom-2 z-40 rounded-[22px] px-1 pb-[max(env(safe-area-inset-bottom),0px)] md:hidden"
    >
      <Suspense fallback={<div className="h-14" />}>
        <Items />
      </Suspense>
    </nav>
  );
}
