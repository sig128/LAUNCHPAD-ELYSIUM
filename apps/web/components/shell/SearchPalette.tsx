'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { fmtPrice } from '@canopy/sdk';
import { useData } from '@/lib/data';
import { MODE, NETWORK } from '@/lib/config';
import { TokenArt } from '@/components/ui/primitives';

/** Finds markets by name, ticker or full contract address, and always shows the chain and full address. */
export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { ds, unavailableReason } = useData();
  const dupes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of ds?.tokens ?? []) counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1);
    return counts;
  }, [ds]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search markets"
      overlayClassName="anim-fade fixed inset-0 z-50 bg-black/55"
      contentClassName="panel panel-dense anim-sheet fixed inset-x-3 top-16 z-50 overflow-hidden p-0 sm:left-1/2 sm:right-auto sm:top-24 sm:w-[620px] sm:-translate-x-1/2"
    >
      <div className="border-b border-white/8 p-3">
        <Command.Input
          autoFocus
          placeholder="Search by name, ticker or full contract address"
          className="field h-12 bg-transparent text-[15px]"
        />
      </div>
      <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-[14px] text-ink-2">
          {ds ? 'No market matches. Paste the full contract address to be sure you have the right one.' : unavailableReason}
        </Command.Empty>
        {ds ? (
          <Command.Group heading="Markets" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12.5px] [&_[cmdk-group-heading]]:text-ink-3">
            {ds.tokens.map((t) => (
              <Command.Item
                key={t.address}
                value={`${t.name} ${t.symbol} ${t.address}`}
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`/token/${t.address}`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <TokenArt symbol={t.symbol} hue={t.hue} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-medium">{t.name}</span>
                    <span className="text-[13px] text-ink-2">{t.symbol}</span>
                    {(dupes.get(t.symbol) ?? 0) > 1 ? (
                      <span className="tag bg-warn/12 text-warn">Ticker shared by {dupes.get(t.symbol)} markets</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[12px] text-ink-3">
                    {NETWORK.name}
                    {MODE === 'demo' ? ' (demo)' : ''} {t.address}
                  </div>
                </div>
                <span className="num text-[13px] text-ink-2">{fmtPrice(t.priceX18)} CANOPY</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
      <div className="border-t border-white/8 px-4 py-2.5 text-[12.5px] text-ink-3">
        Names and tickers can be copied. Check the full contract address before you trade.
      </div>
    </Command.Dialog>
  );
}
