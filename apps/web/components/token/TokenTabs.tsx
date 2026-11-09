'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  concentration,
  DEMO_POOL_MANAGER,
  fmtAmount,
  fmtBps,
  fmtCompact,
  fmtPrice,
  holderRows,
  liquidityView,
  rewardView,
  shortAddr,
  walletPositions,
  type DemoToken,
} from '@canopy/sdk';
import { MODE, writeBlockReason } from '@/lib/config';
import { useData } from '@/lib/data';
import { Address, CopyButton, KeyValue, Pill } from '@/components/ui/primitives';

const TABS = ['overview', 'trades', 'holders', 'liquidity', 'rewards', 'creator', 'activity'] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = {
  overview: 'Overview',
  trades: 'Trades',
  holders: 'Holders',
  liquidity: 'Liquidity',
  rewards: 'Rewards',
  creator: 'Creator',
  activity: 'Activity',
};

const utc = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ');

export function TokenTabs({ token }: { token: DemoToken }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (t: Tab, focus = false) => {
    const next = new URLSearchParams(params.toString());
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    if (focus) refs.current[TABS.indexOf(t)]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    if (e.key === 'ArrowRight') select(TABS[(i + 1) % TABS.length], true);
    else if (e.key === 'ArrowLeft') select(TABS[(i - 1 + TABS.length) % TABS.length], true);
    else return;
    e.preventDefault();
  };

  return (
    <section className="panel p-3 sm:p-4">
      <div role="tablist" aria-label="Market details" className="scroll-x -mx-1 flex gap-1 px-1" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className="chip shrink-0"
            onClick={() => select(t)}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4" tabIndex={0}>
        {tab === 'overview' ? <Overview token={token} /> : null}
        {tab === 'trades' ? <Trades token={token} /> : null}
        {tab === 'holders' ? <Holders token={token} /> : null}
        {tab === 'liquidity' ? <Liquidity token={token} /> : null}
        {tab === 'rewards' ? <Rewards token={token} /> : null}
        {tab === 'creator' ? <Creator token={token} /> : null}
        {tab === 'activity' ? <Activity token={token} /> : null}
      </div>
    </section>
  );
}

function Facts({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((it) => (
        <li key={it.title} className="inset p-3.5">
          <h3 className="text-[14px] font-medium text-ink">{it.title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{it.body}</p>
        </li>
      ))}
    </ul>
  );
}

function Overview({ token }: { token: DemoToken }) {
  const surrendered = token.creatorSurrenderedAt !== null;
  return (
    <div className="space-y-5">
      {token.description ? <p className="max-w-prose text-[14.5px] text-ink-2">{token.description}</p> : null}
      <Facts
        items={[
          {
            title: 'Creator permissions',
            body: 'The creator cannot mint, freeze, blacklist, add a transfer tax or change fees. They can claim their fee share, or give it to holders permanently.',
          },
          {
            title: 'Who owns the liquidity',
            body: 'The launch position holds the whole supply from the opening price upward. It belongs to the seed locker contract, which has no function that removes liquidity.',
          },
          {
            title: 'Fee policy v1',
            body: `1.00% of the HYPE side of every trade. ${surrendered ? '70%' : '60%'} to holders, 10% buy-order reserve, ${surrendered ? '0% creator (surrendered)' : '10% creator'}, 10% liquidity growth, 10% protocol. The pool’s LP fee is 0%.`,
          },
          {
            title: 'Outside liquidity',
            body: 'Only the seed locker and the liquidity-growth manager can add positions to this pool, so there are no outside LPs and no LP fee to share.',
          },
          {
            title: 'Reserve and liquidity growth',
            body: 'Both are funded from fees and held per token. Automatic execution is not enabled yet, so these funds are held, not deployed as bids or positions.',
          },
          {
            title: 'Audit status',
            body: 'Not audited. The contracts have local tests against real Uniswap v4 core only. Treat every market as high risk.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Token</h3>
          <KeyValue
            rows={[
              ['Total supply', `${fmtAmount(token.totalSupply, 18, 0)} ${token.symbol}`],
              ['Decimals', '18'],
              ['Minting', 'Once, at launch. No later mint.'],
              ['Created', `${utc(token.createdAt)} UTC`],
              ['Creation block', token.createdBlock.toLocaleString('en-US')],
              ['Opening FDV', `${fmtCompact(token.openingFdv)} HYPE`],
              ['All-time high', `${fmtPrice(token.athX18)} HYPE`],
              ['All-time low', `${fmtPrice(token.atlX18)} HYPE`],
            ]}
          />
          <p className="mt-1 text-[12px] text-ink-3">High and low cover indexed history from the creation block.</p>
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Fees collected, lifetime</h3>
          <KeyValue
            rows={[
              ['Gross fees', `${fmtAmount(token.fees.fee, 18, 4)} HYPE`],
              ['Holder rewards', `${fmtAmount(token.fees.holders, 18, 4)} HYPE`],
              ['Buy-order reserve', `${fmtAmount(token.fees.reserve, 18, 4)} HYPE`],
              ['Creator', `${fmtAmount(token.fees.creator, 18, 4)} HYPE`],
              ['Liquidity growth', `${fmtAmount(token.fees.liquidity, 18, 4)} HYPE`],
              ['Protocol', `${fmtAmount(token.fees.protocol, 18, 4)} HYPE`],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Trades({ token }: { token: DemoToken }) {
  const [n, setN] = useState(25);
  const list = useMemo(() => [...token.trades].reverse(), [token.trades]);
  if (list.length === 0) return <p className="py-8 text-center text-[14px] text-ink-2">No trades yet.</p>;
  return (
    <div>
      <div className="scroll-x">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <caption className="sr-only">Latest trades, newest first</caption>
          <thead className="text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-normal">Time (UTC)</th>
              <th className="py-2 pr-3 font-normal">Side</th>
              <th className="py-2 pr-3 text-right font-normal">Amount ({token.symbol})</th>
              <th className="py-2 pr-3 text-right font-normal">Notional (HYPE)</th>
              <th className="py-2 pr-3 text-right font-normal">Price after</th>
              <th className="py-2 pr-3 font-normal">Trader</th>
              <th className="py-2 pr-3 font-normal">Status</th>
              <th className="py-2 font-normal">Transaction</th>
            </tr>
          </thead>
          <tbody className="num">
            {list.slice(0, n).map((tr) => (
              <tr key={tr.id} className="border-t border-white/6">
                <td className="py-2 pr-3 text-ink-2">{utc(tr.timestamp)}</td>
                <td className={`py-2 pr-3 font-medium ${tr.side === 'buy' ? 'text-up' : 'text-down'}`}>
                  {tr.side === 'buy' ? 'Buy' : 'Sell'}
                  {tr.creatorOrigin ? <span className="ml-1.5 text-[11.5px] font-normal text-warn">creator</span> : null}
                </td>
                <td className="py-2 pr-3 text-right">{fmtCompact(tr.tokenAmount)}</td>
                <td className="py-2 pr-3 text-right">{fmtAmount(tr.quoteNotional, 18, 3)}</td>
                <td className="py-2 pr-3 text-right">{fmtPrice(tr.priceAfterX18)}</td>
                <td className="py-2 pr-3 font-mono text-[12.5px] text-ink-2">{shortAddr(tr.trader)}</td>
                <td className="py-2 pr-3 text-ink-2">Finalized</td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-3" title={MODE === 'demo' ? 'Demo transaction: no explorer record exists' : tr.txHash}>
                    {shortAddr(tr.txHash, 8, 4)}
                    <CopyButton value={tr.txHash} label="transaction hash" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px] text-ink-3">
        <span>
          {MODE === 'demo' ? 'Demo transactions have no explorer record.' : 'Explorer links appear once the explorer URL pattern is verified.'} Notional is the pre-fee HYPE side.
        </span>
        {list.length > n ? (
          <button type="button" className="btn btn-glass h-9" onClick={() => setN(n + 25)}>
            Load older trades
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Holders({ token }: { token: DemoToken }) {
  const { ds } = useData();
  const rows = useMemo(() => holderRows(token, 40), [token]);
  const c = concentration(token);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="inset p-3.5">
          <div className="text-[12.5px] text-ink-3">Holders</div>
          <div className="num text-[18px]">{token.holderCount.toLocaleString('en-US')}</div>
          <div className="text-[12px] text-ink-3">Balance above zero, excluding the pool and system contracts</div>
        </div>
        <div className="inset p-3.5">
          <div className="text-[12.5px] text-ink-3">Top 10, share of held supply</div>
          <div className="num text-[18px]">{fmtBps(c.top10ExclPoolBps)}</div>
        </div>
        <div className="inset p-3.5">
          <div className="text-[12.5px] text-ink-3">Top 10 including pool inventory</div>
          <div className="num text-[18px]">{fmtBps(c.top10InclPoolBps)}</div>
          <div className="text-[12px] text-ink-3">Share of total supply</div>
        </div>
      </div>
      <div className="scroll-x">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead className="text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-normal">#</th>
              <th className="py-2 pr-3 font-normal">Address</th>
              <th className="py-2 pr-3 text-right font-normal">Balance</th>
              <th className="py-2 text-right font-normal">Share of supply</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r, i) => (
              <tr key={r.address} className="border-t border-white/6">
                <td className="py-2 pr-3 text-ink-3">{r.kind === 'pool' ? '' : i}</td>
                <td className="py-2 pr-3">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Address value={r.address} label="holder address" />
                    {r.kind === 'pool' ? <Pill>Pool inventory, excluded</Pill> : null}
                    {r.kind === 'creator' ? <Pill tone="warn">Creator</Pill> : null}
                    {ds && r.address === ds.demoWallet ? <Pill tone="lime">Demo wallet</Pill> : null}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">{fmtCompact(r.balance)}</td>
                <td className="py-2 text-right">{fmtBps(r.shareBps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-ink-3">
        Addresses are not people. Pool inventory is unsold supply held by the Uniswap v4 PoolManager ({shortAddr(DEMO_POOL_MANAGER)} in demo).
      </p>
    </div>
  );
}

function Liquidity({ token }: { token: DemoToken }) {
  const lv = liquidityView(token);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Pool balances</h3>
          <KeyValue
            rows={[
              ['Token inventory', `${fmtCompact(lv.poolToken)} ${token.symbol}`],
              ['HYPE paid in by traders', `${fmtAmount(lv.poolQuote, 18, 3)} HYPE`],
              ['Opening FDV (virtual)', `${fmtCompact(token.openingFdv)} HYPE`],
              ['LP fee', '0%'],
              ['Seed position', 'Locked in SeedLiquidityLocker'],
            ]}
          />
          <p className="mt-1 text-[12px] text-ink-3">
            The opening FDV sets the starting price. It is not HYPE sitting in the pool. All HYPE in the pool came from buyers.
          </p>
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Executable depth, after the 1% fee</h3>
          <div className="scroll-x">
            <table className="w-full text-[13.5px]">
              <thead className="text-left text-[12.5px] text-ink-3">
                <tr>
                  <th className="py-2 pr-3 font-normal">Move</th>
                  <th className="py-2 pr-3 text-right font-normal">HYPE to push up</th>
                  <th className="py-2 text-right font-normal">HYPE out pushing down</th>
                </tr>
              </thead>
              <tbody className="num">
                {lv.depth.map((d) => (
                  <tr key={d.bps} className="border-t border-white/6">
                    <td className="py-2 pr-3">±{d.bps / 100}%</td>
                    <td className="py-2 pr-3 text-right">{fmtAmount(d.upQuoteIn, 18, 3)}</td>
                    <td className="py-2 text-right">{fmtAmount(d.downQuoteOut, 18, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-[14px] font-medium">Price impact by buy size</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {lv.impact.map((im) => (
            <div key={String(im.quoteIn)} className="inset p-3.5">
              <div className="text-[12.5px] text-ink-3">Buy {fmtAmount(im.quoteIn, 18, 0)} HYPE</div>
              <div className="num text-[16px]">{fmtBps(Math.max(0, im.priceImpactBps))} impact</div>
              <div className="num text-[12.5px] text-ink-2">
                ≈ {fmtCompact(im.tokenOut)} {token.symbol}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="inset p-3.5">
          <h3 className="text-[14px] font-medium">Buy-order reserve</h3>
          <KeyValue
            rows={[
              ['Funded', `${fmtAmount(token.fees.reserve, 18, 4)} HYPE`],
              ['Committed to orders', '0 HYPE'],
              ['Spent on purchases', '0 HYPE'],
              ['Status', 'Funded, execution unavailable'],
            ]}
          />
        </div>
        <div className="inset p-3.5">
          <h3 className="text-[14px] font-medium">Liquidity-growth budget</h3>
          <KeyValue
            rows={[
              ['Funded', `${fmtAmount(token.fees.liquidity, 18, 4)} HYPE`],
              ['Deployed into positions', '0 HYPE'],
              ['Status', 'Funded, execution unavailable'],
            ]}
          />
        </div>
      </div>
      <p className="text-[12.5px] text-ink-3">
        Reserves are finite capital, not insurance or a price floor. Execution stays off until its manipulation tests pass.
      </p>
    </div>
  );
}

function Rewards({ token }: { token: DemoToken }) {
  const { ds } = useData();
  const rv = rewardView(token);
  const mine = ds ? walletPositions(ds, ds.demoWallet).find((p) => p.token.address === token.address) : undefined;
  const per1m = rv.eligibleSupply > 0n ? (rv.funded7d * 1_000_000n * 10n ** 18n) / rv.eligibleSupply : 0n;
  const blocked = writeBlockReason();
  const streaming = rv.streamEndsAt > (ds?.anchor ?? 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Holder rewards</h3>
          <KeyValue
            rows={[
              ['Funded from fees', `${fmtAmount(rv.funded, 18, 4)} HYPE`],
              ['Released', `${fmtAmount(rv.released, 18, 4)} HYPE`],
              ['Still releasing', `${fmtAmount(rv.pendingRelease, 18, 4)} HYPE`],
              ['Claimed', `${fmtAmount(rv.claimed, 18, 4)} HYPE`],
              ['Released, not yet claimed', `${fmtAmount(rv.releasedUnclaimed, 18, 4)} HYPE`],
              ['Eligible supply', `${fmtCompact(rv.eligibleSupply)} ${token.symbol}`],
              ['Release window', streaming ? `Ends ${utc(rv.streamEndsAt)} UTC` : 'Nothing releasing now'],
            ]}
          />
        </div>
        <div className="space-y-3">
          <div className="inset p-3.5">
            <div className="text-[12.5px] text-ink-3">Funded per 1M tokens held, last 7 days (historical)</div>
            <div className="num text-[18px]">{fmtAmount(per1m, 18, 5)} HYPE</div>
            <div className="text-[12px] text-ink-3">7-day holder allocation ÷ current eligible supply. Not a forecast or an APY.</div>
          </div>
          <div className="inset p-3.5">
            <div className="text-[12.5px] text-ink-3">Demo wallet</div>
            <div className="num text-[18px]">{fmtAmount(mine?.rewardsClaimable ?? 0n, 18, 6)} HYPE claimable</div>
            <div className="num text-[12.5px] text-ink-2">{fmtAmount(mine?.rewardsClaimed ?? 0n, 18, 6)} HYPE claimed before</div>
            <button type="button" className="btn btn-primary mt-3 w-full" disabled={Boolean(blocked) || !mine?.rewardsClaimable}>
              Claim rewards
            </button>
            {blocked ? <p className="mt-2 text-[12.5px] text-ink-2">{blocked}</p> : null}
          </div>
        </div>
      </div>
      <div className="inset p-3.5 text-[13.5px] leading-relaxed text-ink-2">
        <h3 className="mb-1 text-[14px] font-medium text-ink">How release works</h3>
        Each fee arrival is added to whatever has not been released yet, and that total releases evenly over the next hour. This is one merged
        stream, not separate one-hour streams. Rewards follow balances held during release, so buying just before a fee arrives does not earn
        what was released earlier, and buying and selling in the same block earns nothing. Earned rewards stay claimable after you sell. While no
        eligible holder exists, release pauses. Excluded from rewards: the pool inventory, the seed locker, the fee vault, the reserve sink and the
        burn address. Contracts and smart wallets earn like any other address. This reduces snapshot sniping. It does not make the market bot-proof.
      </div>
    </div>
  );
}

function Creator({ token }: { token: DemoToken }) {
  const creatorTrades = token.trades.filter((t) => t.creatorOrigin);
  const holding = token.ledger.balances.get(token.creator) ?? 0n;
  const owed = token.fees.creator - token.creatorClaimed;
  const pct = Number((token.creatorInitialBuyTokens * 10_000n) / token.totalSupply);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Creator</h3>
          <KeyValue
            rows={[
              ['Address', <Address key="a" value={token.creator} label="creator address" />],
              [
                'Initial buy',
                token.creatorInitialBuyTokens > 0n
                  ? `${fmtCompact(token.creatorInitialBuyTokens)} ${token.symbol} (${fmtBps(pct)}) for ${fmtAmount(token.creatorInitialBuyQuote, 18, 2)} HYPE`
                  : 'None',
              ],
              ['Holding now', `${fmtCompact(holding)} ${token.symbol}`],
              ['Vesting', 'None. Creator tokens come only from the disclosed launch buy.'],
              [
                'Fee share',
                token.creatorSurrenderedAt ? `Surrendered to holders on ${utc(token.creatorSurrenderedAt)} UTC` : '10% of fees, claimable by the creator',
              ],
              ['Creator fees accrued', `${fmtAmount(token.fees.creator, 18, 4)} HYPE`],
              ['Claimed by creator', `${fmtAmount(token.creatorClaimed, 18, 4)} HYPE`],
              ['Owed to creator', `${fmtAmount(owed, 18, 4)} HYPE`],
            ]}
          />
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-medium">Creator-origin trades</h3>
          {creatorTrades.length === 0 ? (
            <p className="text-[13.5px] text-ink-2">The creator has not traded this market.</p>
          ) : (
            <ul className="divide-y divide-white/6 text-[13.5px]">
              {creatorTrades.map((t) => (
                <li key={t.id} className="num flex justify-between gap-3 py-2.5">
                  <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>
                    {t.side === 'buy' ? 'Bought' : 'Sold'} {fmtCompact(t.tokenAmount)}
                  </span>
                  <span className="text-ink-2">{fmtAmount(t.quoteNotional, 18, 2)} HYPE</span>
                  <span className="text-ink-3">{utc(t.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Activity({ token }: { token: DemoToken }) {
  const events = useMemo(() => {
    const ev: { ts: number; text: string; amount?: bigint }[] = [{ ts: token.createdAt, text: 'Market launched, seed liquidity locked' }];
    for (const c of token.claims)
      ev.push({ ts: c.timestamp, text: c.kind === 'holder' ? `Holder ${shortAddr(c.account)} claimed rewards` : 'Creator claimed fees', amount: c.amount });
    if (token.creatorSurrenderedAt) ev.push({ ts: token.creatorSurrenderedAt, text: 'Creator surrendered their fee share to holders' });
    return ev.sort((a, b) => b.ts - a.ts).slice(0, 60);
  }, [token]);
  return (
    <ul className="divide-y divide-white/6 text-[13.5px]">
      {events.map((e, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
          <span className="text-ink">{e.text}</span>
          <span className="num text-ink-2">{e.amount !== undefined ? `${fmtAmount(e.amount, 18, 5)} HYPE` : ''}</span>
          <span className="num w-full text-[12.5px] text-ink-3 sm:w-auto">{utc(e.ts)} UTC</span>
        </li>
      ))}
    </ul>
  );
}
