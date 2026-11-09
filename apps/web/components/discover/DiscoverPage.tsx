'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import {
  buildCandles,
  depthAt,
  fmtAge,
  fmtAmount,
  fmtCompact,
  fmtPrice,
  platformStats,
  trendingScore,
  walletPositions,
  type DemoToken,
  type WindowKey,
} from '@canopy/sdk';
import { COPY, MODE, NETWORK } from '@/lib/config';
import { healthLabel, useHealth } from '@/lib/health';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { Address, Change, DemoTag, Pill, Stat, TokenArt, Unavailable } from '@/components/ui/primitives';
import { IconClose, IconGrid, IconList, IconStar } from '@/components/ui/Icons';
import { TradeTicket } from '@/components/token/TradeTicket';

const SEGMENTS = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'traded', label: 'Most traded' },
  { id: 'rewards', label: 'Holder rewards' },
  { id: 'liquidity', label: 'Strongest liquidity' },
  { id: 'watchlist', label: 'Watchlist' },
] as const;
type Segment = (typeof SEGMENTS)[number]['id'];
const WINDOW_OPTS: WindowKey[] = ['5m', '1h', '6h', '24h', '7d', '30d'];
const SORTS = ['score', 'age', 'price', 'change', 'fdv', 'volume', 'holders', 'depth', 'rewards'] as const;
type SortKey = (typeof SORTS)[number];
const DEFAULT_SORT: Record<Segment, SortKey> = {
  trending: 'score',
  new: 'age',
  traded: 'volume',
  rewards: 'rewards',
  liquidity: 'depth',
  watchlist: 'volume',
};
const PAGE = 12;

/** Entrance choreography hooks (see globals.css): panel order and the first rows' cascade. */
const ix = (i: number) => ({ '--i': i }) as CSSProperties;
const rowEnter = (idx: number) => (idx < 12 ? { 'data-enter-row': '', style: { '--r': idx } as CSSProperties } : {});

interface RowData {
  t: DemoToken;
  score: number;
  volume: bigint;
  change: number | null;
  rewards: bigint;
  depth: bigint;
  age: number;
}

function cmp(a: RowData, b: RowData, key: SortKey): number {
  const big = (x: bigint, y: bigint) => (x > y ? 1 : x < y ? -1 : 0);
  switch (key) {
    case 'score':
      return a.score - b.score;
    case 'age':
      return b.age - a.age;
    case 'price':
      return big(a.t.priceX18, b.t.priceX18);
    case 'change':
      return (a.change ?? -Infinity) - (b.change ?? -Infinity);
    case 'fdv':
      return big(a.t.fdv, b.t.fdv);
    case 'volume':
      return big(a.volume, b.volume);
    case 'holders':
      return a.t.holderCount - b.t.holderCount;
    case 'depth':
      return big(a.depth, b.depth);
    case 'rewards':
      return big(a.rewards, b.rewards);
  }
}

export function DiscoverPage() {
  const { ds, unavailableReason, asOf } = useData();
  const { settings, toggleWatch } = useSettings();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const seg = (SEGMENTS.find((s) => s.id === params.get('seg'))?.id ?? 'trending') as Segment;
  const win = (WINDOW_OPTS.includes(params.get('win') as WindowKey) ? params.get('win') : '24h') as WindowKey;
  const sort = (SORTS.includes(params.get('sort') as SortKey) ? params.get('sort') : DEFAULT_SORT[seg]) as SortKey;
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const view = params.get('view') === 'grid' ? 'grid' : 'list';
  const q = params.get('q') ?? '';
  const shown = Math.max(PAGE, Number(params.get('n')) || PAGE);
  const selected = params.get('m');

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem('canopy:lastDiscover', params.toString());
    } catch {
      /* ignore */
    }
  }, [params]);

  const rows = useMemo<RowData[]>(() => {
    if (!ds) return [];
    let list = ds.tokens.map((t) => ({
      t,
      score: trendingScore(t),
      volume: t.stats[win].volume,
      change: t.stats[win].changePct,
      rewards: t.stats[win].fees.holders,
      depth: depthAt(t.curve, 200).downQuoteOut,
      age: ds.anchor - t.createdAt,
    }));
    if (seg === 'watchlist') list = list.filter((r) => settings.watchlist.includes(r.t.address.toLowerCase()));
    const needle = q.trim().toLowerCase();
    if (needle)
      list = list.filter(
        (r) => r.t.name.toLowerCase().includes(needle) || r.t.symbol.toLowerCase().includes(needle) || r.t.address.toLowerCase() === needle,
      );
    list.sort((a, b) => (dir === 'desc' ? -cmp(a, b, sort) : cmp(a, b, sort)));
    return list;
  }, [ds, win, seg, q, sort, dir, settings.watchlist]);

  const selectedToken = selected ? ds?.byAddress.get(selected.toLowerCase()) ?? null : null;

  if (!ds) {
    return (
      <div className="space-y-4">
        <Intro />
        <Unavailable title="Market data unavailable" reason={unavailableReason ?? 'Unknown'} />
      </div>
    );
  }

  const maxDepth = rows.reduce((m, r) => (r.depth > m ? r.depth : m), 1n);
  const visible = rows.slice(0, shown);
  const sortBy = (key: SortKey) =>
    setParams({ sort: key === DEFAULT_SORT[seg] && dir === 'desc' ? null : key, dir: sort === key && dir === 'desc' ? 'asc' : null });
  const th = (key: SortKey, label: string, className = '') => (
    <th scope="col" className={`px-3 py-2.5 font-normal ${className}`} aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => sortBy(key)} className={`inline-flex items-center gap-1 hover:text-ink ${sort === key ? 'text-ink' : ''}`}>
        {label}
        {sort === key ? <span aria-hidden>{dir === 'asc' ? '▴' : '▾'}</span> : null}
      </button>
    </th>
  );
  const col = settings.columns;

  return (
    <div className="space-y-4">
      <Intro asOf={asOf} />
      <PlatformStrip />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section data-enter style={ix(3)} aria-label="Discover markets" className="panel min-w-0 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="scroll-x -mx-1 flex max-w-full gap-1 px-1" role="tablist" aria-label="Market segment">
              {SEGMENTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={seg === s.id}
                  className="chip shrink-0"
                  onClick={() => setParams({ seg: s.id === 'trending' ? null : s.id, sort: null, dir: null, n: null })}
                >
                  {s.id === 'watchlist' ? <IconStar size={14} /> : null}
                  {s.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <label className="sr-only" htmlFor="win">
                Time window
              </label>
              <select
                id="win"
                value={win}
                onChange={(e) => setParams({ win: e.target.value === '24h' ? null : e.target.value })}
                className="field h-9 w-auto min-h-0 cursor-pointer px-2.5 text-[13.5px]"
              >
                {WINDOW_OPTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <div className="flex rounded-[12px] bg-black/25 p-0.5">
                <button type="button" className="chip h-8 w-9 justify-center px-0" aria-pressed={view === 'list'} aria-label="List view" onClick={() => setParams({ view: null })}>
                  <IconList size={16} />
                </button>
                <button type="button" className="chip h-8 w-9 justify-center px-0" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setParams({ view: 'grid' })}>
                  <IconGrid size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="sr-only" htmlFor="filter">
              Filter markets
            </label>
            <input
              id="filter"
              className="field h-10 text-[14px]"
              placeholder="Filter by name or ticker, or paste a full address"
              value={q}
              onChange={(e) => setParams({ q: e.target.value || null, n: null })}
            />
          </div>

          {visible.length === 0 && ds.tokens.length === 0 ? (
            <div className="py-16 text-center">
              <p className="display text-[26px] text-ink">No markets yet</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-2">
                Nothing has launched on CANOPY yet. Markets appear here the moment the first one launches.
              </p>
              <Link href="/launch" className="btn btn-glass mt-5">
                See how launching works
              </Link>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[15px] text-ink">{seg === 'watchlist' && !q ? 'Your watchlist is empty.' : 'No market matches this filter.'}</p>
              <p className="mt-1 text-[13.5px] text-ink-2">
                {seg === 'watchlist' && !q ? 'Star a market to keep it here. Stars stay in this browser.' : 'Try a different name, or paste the full contract address.'}
              </p>
            </div>
          ) : view === 'grid' ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((r) => (
                <li key={r.t.address}>
                  <MarketCard r={r} win={win} watched={settings.watchlist.includes(r.t.address.toLowerCase())} onWatch={() => toggleWatch(r.t.address)} anchor={ds.anchor} />
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="mt-3 hidden md:block">
                <table className="w-full table-fixed border-separate border-spacing-0 text-[14px]">
                  <caption className="sr-only">Markets sorted by {sort}, {win} window</caption>
                  <thead className="text-left text-[12.5px] text-ink-3">
                    <tr>
                      <th scope="col" className="w-[30%] px-3 py-2.5 font-normal">
                        Market
                      </th>
                      {th('price', 'Price (CANOPY)', 'text-right')}
                      {th('change', `${win} change`, 'text-right')}
                      {col.fdv ? th('fdv', 'FDV', 'text-right hidden lg:table-cell') : null}
                      {col.volume ? th('volume', `${win} volume`, 'text-right') : null}
                      {col.holders ? th('holders', 'Holders', 'text-right hidden lg:table-cell') : null}
                      {col.depth ? th('depth', 'Depth −2%', 'hidden w-[150px] xl:table-cell') : null}
                      {col.rewards ? th('rewards', 'Holder rewards', 'text-right hidden 2xl:table-cell') : null}
                      <th scope="col" className="w-[92px] px-2 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, idx) => {
                      const watched = settings.watchlist.includes(r.t.address.toLowerCase());
                      return (
                        <tr
                          key={r.t.address}
                          {...rowEnter(idx)}
                          className="row-link cursor-pointer [&>td]:border-t [&>td]:border-white/6"
                          onClick={() => router.push(`/token/${r.t.address}`)}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <TokenArt symbol={r.t.symbol} hue={r.t.hue} />
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Link
                                    href={`/token/${r.t.address}`}
                                    className="truncate font-medium text-ink hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {r.t.name}
                                  </Link>
                                  {r.t.matured ? <Pill tone="lime">Matured</Pill> : null}
                                </div>
                                <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
                                  <span className="text-ink-2">{r.t.symbol}</span>
                                  {col.age ? <span className="num whitespace-nowrap">{fmtAge(r.age)} old</span> : null}
                                  <span className="hidden lg:inline-flex">
                                    <Address value={r.t.address} label={`${r.t.symbol} contract address`} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="num px-3 text-right">{fmtPrice(r.t.priceX18)}</td>
                          <td className="px-3 text-right">
                            <Change value={r.change} />
                          </td>
                          {col.fdv ? <td className="num hidden px-3 text-right lg:table-cell">{fmtCompact(r.t.fdv)}</td> : null}
                          {col.volume ? <td className="num px-3 text-right">{fmtCompact(r.volume)}</td> : null}
                          {col.holders ? <td className="num hidden px-3 text-right lg:table-cell">{r.t.holderCount.toLocaleString('en-US')}</td> : null}
                          {col.depth ? (
                            <td className="hidden px-3 xl:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8" aria-hidden>
                                  <div className="h-full rounded-full bg-up/70" style={{ width: `${Number((r.depth * 100n) / maxDepth)}%` }} />
                                </div>
                                <span className="num w-14 text-right text-[13px] text-ink-2">{fmtCompact(r.depth)}</span>
                              </div>
                            </td>
                          ) : null}
                          {col.rewards ? <td className="num hidden px-3 text-right 2xl:table-cell">{fmtAmount(r.rewards, 18, 2)}</td> : null}
                          <td className="px-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-quiet h-8 w-8 p-0"
                                aria-label={watched ? `Remove ${r.t.symbol} from watchlist` : `Add ${r.t.symbol} to watchlist`}
                                aria-pressed={watched}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWatch(r.t.address);
                                }}
                              >
                                <IconStar size={16} filled={watched} className={watched ? 'text-lime' : ''} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-glass h-8 px-2.5 text-[13px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setParams({ m: r.t.address });
                                }}
                              >
                                Trade
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 divide-y divide-white/6 md:hidden">
                {visible.map((r, idx) => (
                  <li key={r.t.address} {...rowEnter(idx)}>
                    <Link href={`/token/${r.t.address}`} className="row-link -mx-1 flex items-center gap-3 rounded-xl px-1 py-3">
                      <TokenArt symbol={r.t.symbol} hue={r.t.hue} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{r.t.name}</span>
                          <span className="num shrink-0 text-[14px]">{fmtPrice(r.t.priceX18)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 text-[12.5px] text-ink-3">
                          <span className="truncate">
                            {r.t.symbol}, {fmtAge(r.age)} old
                          </span>
                          <Change value={r.change} className="shrink-0 text-[13px]" />
                        </div>
                        <div className="num mt-1 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
                          <span>FDV {fmtCompact(r.t.fdv)}</span>
                          <span>Vol {fmtCompact(r.volume)}</span>
                          <span>{r.t.holderCount} holders</span>
                          <span>Rewards {fmtAmount(r.rewards, 18, 2)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-[13px] text-ink-3">
            <span className="num">
              Showing {visible.length} of {rows.length}. Values in CANOPY.
            </span>
            {rows.length > visible.length ? (
              <button type="button" className="btn btn-glass h-9" onClick={() => setParams({ n: String(shown + PAGE) })}>
                Show {Math.min(PAGE, rows.length - visible.length)} more
              </button>
            ) : null}
          </div>
        </section>

        <aside data-enter style={ix(4)} className="hidden xl:block">
          <div className="sticky top-[88px] space-y-4">
            {selectedToken ? (
              <div className="panel panel-dense p-4">
                <div className="mb-3 flex items-center gap-3">
                  <TokenArt symbol={selectedToken.symbol} hue={selectedToken.hue} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{selectedToken.name}</div>
                    <Link href={`/token/${selectedToken.address}`} className="text-[13px] text-lime hover:underline">
                      Open full market
                    </Link>
                  </div>
                  <button type="button" className="btn btn-quiet h-9 w-9 p-0" aria-label="Close trade panel" onClick={() => setParams({ m: null })}>
                    <IconClose size={16} />
                  </button>
                </div>
                <TradeTicket token={selectedToken} compact />
              </div>
            ) : (
              <SideSummary />
            )}
          </div>
        </aside>
      </div>

      <Dialog.Root open={Boolean(selectedToken)} onOpenChange={(o) => (!o ? setParams({ m: null }) : undefined)}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-black/55 xl:hidden" />
          <Dialog.Content className="panel panel-dense anim-sheet fixed inset-x-2 bottom-2 z-50 max-h-[88dvh] overflow-y-auto rounded-[24px] p-4 xl:hidden">
            {selectedToken ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <TokenArt symbol={selectedToken.symbol} hue={selectedToken.hue} />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="truncate font-medium">Trade {selectedToken.name}</Dialog.Title>
                    <Dialog.Description className="text-[12.5px] text-ink-3">1.00% fee on the CANOPY side.</Dialog.Description>
                  </div>
                  <Dialog.Close className="btn btn-quiet h-9 w-9 p-0" aria-label="Close">
                    <IconClose size={16} />
                  </Dialog.Close>
                </div>
                <TradeTicket token={selectedToken} compact />
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Intro({ asOf }: { asOf?: number | null }) {
  return (
    <section data-enter style={ix(1)} className="flex flex-col gap-3 px-1 pt-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="over-video">
        <h1 className="display text-[38px] leading-[1.05] text-ink sm:text-[50px]">{COPY.heroTitle}</h1>
        <p className="mt-2 text-[16px] text-ink-2 sm:text-[17px]">{COPY.heroSub}</p>
      </div>
      {MODE === 'demo' ? (
        <div className="panel max-w-md px-4 py-3 text-[13px] text-ink-2">
          <div className="mb-1">
            <DemoTag />
          </div>
          {COPY.demoNotice}
          {asOf ? <span className="num block text-ink-3">Fixture snapshot: {new Date(asOf * 1000).toUTCString().replace(' GMT', ' UTC')}</span> : null}
        </div>
      ) : (
        <LiveNetworkCard />
      )}
    </section>
  );
}

function LiveNetworkCard() {
  const health = useHealth();
  const label = healthLabel(health);
  const dot = { up: 'bg-up', warn: 'bg-warn', down: 'bg-down', neutral: 'bg-ink-3' }[label.tone];
  return (
    <div className="panel max-w-md px-4 py-3 text-[13px] text-ink-2">
      <div className="mb-1 flex items-center gap-2 text-[13.5px] text-ink">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {NETWORK.name}: {label.text}
      </div>
      <p>{label.detail}</p>
      <p className="mt-1 text-ink-3">Launching opens when the CANOPY launch factory is deployed on Elysium.</p>
    </div>
  );
}

function PlatformStrip() {
  const { ds } = useData();
  const s = useMemo(() => (ds ? platformStats(ds) : null), [ds]);
  if (!s) return null;
  return (
    <section data-enter style={ix(2)} aria-label="Platform statistics" className="panel grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="24h volume" value={`${fmtCompact(s.volume['24h'])} CANOPY`} />
      <Stat label="Active markets, 24h" value={`${s.activeMarkets24h} of ${s.launches}`} />
      <Stat label="Launches, 7d" value={s.launches7d} />
      <Stat label="Trader addresses, 24h" value={s.activeTraders24h} hint="Unique addresses, not unique people" />
      <Stat label="Holder rewards released" value={`${fmtCompact(s.rewardsReleased)} CANOPY`} hint="Released from collected fees under the one-hour release rule" />
      <Stat label="Rewards claimed" value={`${fmtCompact(s.rewardsClaimed)} CANOPY`} />
    </section>
  );
}

function SideSummary() {
  const { ds } = useData();
  const positions = useMemo(() => (ds ? walletPositions(ds, ds.demoWallet) : []), [ds]);
  if (!ds) return null;
  const claimable = positions.reduce((s, p) => s + p.rewardsClaimable, 0n);
  const newest = [...ds.tokens].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  return (
    <>
      <div className="panel p-4">
        <h2 className="text-[15px] font-semibold">Your rewards</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{MODE === 'demo' ? 'Demo wallet' : 'Rewards start with the first market'}</p>
        <div className="num mt-3 text-[26px] font-medium tracking-[-0.01em]">{fmtAmount(claimable, 18, 4)} CANOPY</div>
        <p className="text-[13px] text-ink-2">claimable across {positions.filter((p) => p.rewardsClaimable > 0n).length} markets</p>
        <Link href="/rewards" className="btn btn-glass mt-3 w-full">
          Review rewards
        </Link>
      </div>
      <div className="panel p-4">
        <h2 className="text-[15px] font-semibold">Where each 1% fee goes</h2>
        <FeeBar />
      </div>
      <div className="panel p-4">
        <h2 className="text-[15px] font-semibold">Newest launches</h2>
        {newest.length === 0 ? <p className="mt-2 text-[13.5px] text-ink-2">No launches yet.</p> : null}
        <ul className="mt-2 divide-y divide-white/6">
          {newest.map((t) => (
            <li key={t.address}>
              <Link href={`/token/${t.address}`} className="row-link -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5">
                <TokenArt symbol={t.symbol} hue={t.hue} size={30} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{t.name}</span>
                <span className="num text-[12.5px] text-ink-3">{fmtAge(ds.anchor - t.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function FeeBar() {
  const parts = [
    { label: 'Holders', pct: 80, color: 'bg-lime' },
    { label: 'Creator', pct: 10, color: 'bg-warn/80' },
    { label: 'Protocol', pct: 10, color: 'bg-ink-3' },
  ];
  return (
    <div className="mt-3">
      <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => (
          <div key={p.label} className={p.color} style={{ width: `${p.pct}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-ink-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${p.color}`} aria-hidden />
            <span className="flex-1">{p.label}</span>
            <span className="num text-ink">{p.pct}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-ink-3">Paid from fees actually collected. If a creator gives up their share, holders get 90%.</p>
    </div>
  );
}

function MarketCard({ r, win, watched, onWatch, anchor }: { r: RowData; win: WindowKey; watched: boolean; onWatch: () => void; anchor: number }) {
  const spark = useMemo(() => buildCandles(r.t, 3600).slice(-36).map((c) => c.close), [r.t]);
  return (
    <div className="inset relative p-3.5 transition-colors hover:bg-white/6">
      <div className="flex items-center gap-3">
        <TokenArt symbol={r.t.symbol} hue={r.t.hue} />
        <div className="min-w-0 flex-1">
          <Link href={`/token/${r.t.address}`} className="block truncate font-medium after:absolute after:inset-0">
            {r.t.name}
          </Link>
          <div className="text-[12.5px] text-ink-3">
            {r.t.symbol}, {fmtAge(anchor - r.t.createdAt)} old
          </div>
        </div>
        <button
          type="button"
          className="btn btn-quiet relative z-10 h-8 w-8 p-0"
          aria-label={watched ? `Remove ${r.t.symbol} from watchlist` : `Add ${r.t.symbol} to watchlist`}
          aria-pressed={watched}
          onClick={onWatch}
        >
          <IconStar size={16} filled={watched} className={watched ? 'text-lime' : ''} />
        </button>
      </div>
      <Sparkline values={spark} />
      <div className="mt-2 flex items-baseline justify-between">
        <span className="num text-[15px]">{fmtPrice(r.t.priceX18)} CANOPY</span>
        <Change value={r.change} className="text-[13.5px]" />
      </div>
      <div className="num mt-1 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
        <span>FDV {fmtCompact(r.t.fdv)}</span>
        <span>
          {win} vol {fmtCompact(r.volume)}
        </span>
        <span>{r.t.holderCount} holders</span>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="mt-3 h-10 rounded-lg bg-white/3" aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-3 h-10 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? '#95d9aa' : '#ee929a'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
