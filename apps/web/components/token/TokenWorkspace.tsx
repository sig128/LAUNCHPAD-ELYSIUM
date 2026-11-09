'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { depthAt, fmtAge, fmtAmount, fmtCompact, fmtPrice, rewardView } from '@canopy/sdk';
import { MODE, NETWORK } from '@/lib/config';
import { useData, useToken } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { Address, Change, CopyButton, DemoTag, Pill, Stat, TokenArt, Unavailable } from '@/components/ui/primitives';
import { IconBack, IconClose, IconStar } from '@/components/ui/Icons';
import { PriceChart } from './PriceChart';
import { TradeTicket } from './TradeTicket';
import { TokenTabs } from './TokenTabs';

export function TokenWorkspace({ address }: { address: string }) {
  const { ds, unavailableReason } = useData();
  const token = useToken(address);
  const { settings, toggleWatch } = useSettings();
  const [backHref, setBackHref] = useState('/');
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    try {
      const q = window.sessionStorage.getItem('canopy:lastDiscover');
      if (q) setBackHref(`/?${q}`);
    } catch {
      /* ignore */
    }
  }, []);

  const problem = !ds
    ? { title: 'Market data unavailable', reason: unavailableReason ?? 'Unknown' }
    : !/^0x[0-9a-fA-F]{40}$/.test(address)
      ? { title: 'That is not a contract address', reason: 'Market links use the full 42-character contract address.' }
      : !token
        ? { title: 'No market at this address', reason: `No CANOPY market on ${NETWORK.name} uses ${address}. Check that you copied the full address.` }
        : null;
  if (problem || !ds || !token) {
    return (
      <div className="panel mx-auto mt-6 max-w-2xl space-y-3 p-3">
        <Unavailable title={problem?.title ?? 'Unavailable'} reason={problem?.reason ?? ''} />
        <Link href="/" className="btn btn-glass ml-1">
          Back to Discover
        </Link>
      </div>
    );
  }

  const watched = settings.watchlist.includes(token.address.toLowerCase());
  const s24 = token.stats['24h'];
  const rv = rewardView(token);
  const depth2 = depthAt(token.curve, 200).downQuoteOut;
  const canonical = typeof window !== 'undefined' ? `${window.location.origin}/token/${token.address}` : `/token/${token.address}`;

  return (
    <div className="space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1 rounded-lg px-1 text-[14px] text-ink-2 hover:text-ink">
        <IconBack size={16} /> Discover
      </Link>

      <section className="panel flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <TokenArt symbol={token.symbol} hue={token.hue} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display min-w-0 text-[28px] leading-tight sm:text-[32px]">{token.name}</h1>
              <span className="text-[15px] text-ink-2">{token.symbol}</span>
              {token.matured ? (
                <span title="Status only: this market passed 20,000 CANOPY lifetime volume and 3 days of age. No migration happens.">
                  <Pill tone="lime">Matured</Pill>
                </span>
              ) : null}
              {MODE === 'demo' ? <DemoTag /> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
              <span>
                {NETWORK.name}, chain {NETWORK.chainId}
              </span>
              <Address value={token.address} label="contract address" full />
              <span className="num">{fmtAge(ds.anchor - token.createdAt)} old</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="btn btn-glass" aria-pressed={watched} onClick={() => toggleWatch(token.address)}>
            <IconStar size={16} filled={watched} className={watched ? 'text-lime' : ''} />
            {watched ? 'Watching' : 'Watch'}
          </button>
          <span className="btn btn-glass gap-1 pr-2">
            Share link
            <CopyButton value={canonical} label="market link" />
          </span>
        </div>
      </section>

      <section aria-label="Key figures" className="panel grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3.5 sm:grid-cols-4 xl:grid-cols-8">
        <Stat label="Price" value={`${fmtPrice(token.priceX18)} CANOPY`} />
        <Stat label="FDV" value={`${fmtCompact(token.fdv)} CANOPY`} hint="Price × total supply. Not circulating market cap." />
        <Stat label="24h change" value={<Change value={s24.changePct} />} />
        <Stat label="24h volume" value={`${fmtCompact(s24.volume)} CANOPY`} />
        <Stat label="Holders" value={token.holderCount.toLocaleString('en-US')} hint="Excludes the pool and system contracts" />
        <Stat label="Exit depth −2%" value={`${fmtCompact(depth2)} CANOPY`} hint="CANOPY received selling until the price is 2% lower, after the fee" />
        <Stat label="Holder rewards, 7d" value={`${fmtAmount(rv.funded7d, 18, 3)} CANOPY`} />
        <Stat label="Trading fee" value="1.00%" hint="Hook fee on the CANOPY side. LP fee is 0%." />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <PriceChart token={token} />
          <TokenTabs token={token} />
        </div>
        <aside className="hidden lg:block">
          <div className="panel panel-dense sticky top-[88px] max-h-[calc(100dvh-104px)] overflow-y-auto overscroll-contain p-4">
            <TradeTicket token={token} />
          </div>
        </aside>
      </div>

      <div className="h-16 lg:hidden" aria-hidden />
      <div className="fixed inset-x-2 bottom-[84px] z-30 lg:hidden">
        <button type="button" className="btn btn-primary h-12 w-full text-[15px] shadow-lg" onClick={() => setSheet(true)}>
          Trade {token.symbol}
        </button>
      </div>
      <Dialog.Root open={sheet} onOpenChange={setSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-black/55" />
          <Dialog.Content className="panel panel-dense anim-sheet fixed inset-x-2 bottom-2 z-50 max-h-[90dvh] overflow-y-auto rounded-[24px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-[16px] font-semibold">Trade {token.symbol}</Dialog.Title>
              <Dialog.Close className="btn btn-quiet h-9 w-9 p-0" aria-label="Close">
                <IconClose size={16} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Buy or sell with a 1% fee on the CANOPY side.</Dialog.Description>
            <TradeTicket token={token} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
