'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { fmtAmount, fmtCompact, rewardView, shortAddr, walletPositions } from '@canopy/sdk';
import { MODE, writeBlockReason } from '@/lib/config';
import { useData } from '@/lib/data';
import { KeyValue, Stat, TokenArt, Unavailable } from '@/components/ui/primitives';

const utc = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ');
const signed = (v: bigint) => (v > 0n ? `+${fmtAmount(v, 18, 4)}` : fmtAmount(v, 18, 4));
const tone = (v: bigint) => (v > 0n ? 'text-up' : v < 0n ? 'text-down' : 'text-ink-2');

function useDemoPositions() {
  const { ds, unavailableReason } = useData();
  const positions = useMemo(() => (ds ? walletPositions(ds, ds.demoWallet) : []), [ds]);
  return { ds, positions, unavailableReason };
}

function WalletNote() {
  return MODE === 'demo' ? (
    <p className="text-[13px] text-ink-2">Showing the demo wallet. Your own wallet’s positions appear in local and live modes.</p>
  ) : (
    <p className="text-[13px] text-ink-2">No CANOPY market has launched yet, so no wallet holds positions, fees or rewards here.</p>
  );
}

export function RewardsView() {
  const { ds, positions, unavailableReason } = useDemoPositions();
  if (!ds) return <Unavailable title="Rewards unavailable" reason={unavailableReason ?? ''} />;
  const withRewards = positions.filter((p) => p.rewardsClaimable > 0n || p.rewardsClaimed > 0n);
  const claimable = positions.reduce((s, p) => s + p.rewardsClaimable, 0n);
  const claimed = positions.reduce((s, p) => s + p.rewardsClaimed, 0n);
  const blocked = writeBlockReason();
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Rewards</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          Holders earn a share of the fees each market actually collects, in CANOPY, in proportion to their balance while fees release.
        </p>
        <WalletNote />
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Claimable now" value={`${fmtAmount(claimable, 18, 6)} CANOPY`} />
          <Stat label="Claimed before" value={`${fmtAmount(claimed, 18, 6)} CANOPY`} />
          <Stat label="Markets with rewards" value={withRewards.length} />
          <Stat label="Claim cost" value={MODE === 'demo' ? 'Not estimated in demo' : 'Estimated per batch'} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary h-11" disabled={Boolean(blocked) || claimable === 0n}>
            Claim all
          </button>
          <span className="max-w-prose text-[12.5px] text-ink-3">
            {blocked ?? ''} Claim all runs in batches of up to 10 markets and reports each batch separately, so a failed batch is never shown as
            complete.
          </span>
        </div>
      </section>
      <section className="panel p-3 sm:p-4">
        {withRewards.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-ink-2">No rewards yet. Hold a market while fees release to earn a share.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {withRewards.map((p) => {
              const rv = rewardView(p.token);
              return (
                <li key={p.token.address} className="flex flex-wrap items-center gap-3 py-3">
                  <TokenArt symbol={p.token.symbol} hue={p.token.hue} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/token/${p.token.address}?tab=rewards`} className="font-medium hover:underline">
                      {p.token.name}
                    </Link>
                    <div className="num text-[12.5px] text-ink-3">
                      Holding {fmtCompact(p.balance)} {p.token.symbol}.{' '}
                      {rv.streamEndsAt > ds.anchor ? `Releasing until ${utc(rv.streamEndsAt)} UTC.` : 'Nothing releasing now.'}
                    </div>
                  </div>
                  <div className="num text-right text-[14px]">
                    <div>{fmtAmount(p.rewardsClaimable, 18, 6)} CANOPY</div>
                    <div className="text-[12.5px] text-ink-3">claimed {fmtAmount(p.rewardsClaimed, 18, 6)}</div>
                  </div>
                  <button type="button" className="btn btn-glass h-9" disabled={Boolean(blocked) || p.rewardsClaimable === 0n}>
                    Claim
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PortfolioView() {
  const { ds, positions, unavailableReason } = useDemoPositions();
  if (!ds) return <Unavailable title="Portfolio unavailable" reason={unavailableReason ?? ''} />;
  const sum = (f: (p: (typeof positions)[number]) => bigint) => positions.reduce((s, p) => s + f(p), 0n);
  const mark = sum((p) => p.markValue);
  const exit = sum((p) => p.exitQuote);
  const unreal = sum((p) => p.unrealized);
  const real = sum((p) => p.realized);
  const fees = sum((p) => p.feesPaid);
  const rewards = sum((p) => p.rewardsClaimed + p.rewardsClaimable);
  const trades = positions.flatMap((p) => p.trades.map((t) => ({ t, token: p.token }))).sort((a, b) => b.t.timestamp - a.t.timestamp);
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Portfolio</h1>
        <WalletNote />
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Marked value" value={`${fmtAmount(mark, 18, 3)} CANOPY`} hint="Balance × spot price" />
          <Stat label="Exit value" value={`${fmtAmount(exit, 18, 3)} CANOPY`} hint="Selling every position now, after fees and price impact" />
          <Stat label="Unrealized" value={<span className={tone(unreal)}>{signed(unreal)}</span>} />
          <Stat label="Realized" value={<span className={tone(real)}>{signed(real)}</span>} />
          <Stat label="Trading fees paid" value={`${fmtAmount(fees, 18, 4)} CANOPY`} />
          <Stat label="Rewards earned" value={`${fmtAmount(rewards, 18, 4)} CANOPY`} hint="Claimed plus claimable" />
        </div>
        <p className="mt-4 text-[12.5px] text-ink-3">
          Cost basis uses FIFO and includes the trading fee. Gas is not included in demo. Tokens received by transfer would show an unknown basis.
        </p>
      </section>
      <section className="panel p-3 sm:p-4">
        <h2 className="px-1 text-[15px] font-semibold">Positions</h2>
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead className="text-left text-[12.5px] text-ink-3">
              <tr>
                <th className="py-2 pr-3 font-normal">Market</th>
                <th className="py-2 pr-3 text-right font-normal">Balance</th>
                <th className="py-2 pr-3 text-right font-normal">Marked</th>
                <th className="py-2 pr-3 text-right font-normal">Exit quote</th>
                <th className="py-2 pr-3 text-right font-normal">Cost basis</th>
                <th className="py-2 pr-3 text-right font-normal">Unrealized</th>
                <th className="py-2 pr-3 text-right font-normal">Realized</th>
                <th className="py-2 text-right font-normal">Rewards</th>
              </tr>
            </thead>
            <tbody className="num">
              {positions.map((p) => (
                <tr key={p.token.address} className="border-t border-white/6">
                  <td className="py-2.5 pr-3">
                    <Link href={`/token/${p.token.address}`} className="flex items-center gap-2 hover:underline">
                      <TokenArt symbol={p.token.symbol} hue={p.token.hue} size={28} />
                      <span className="font-sans">{p.token.symbol}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-right">{fmtCompact(p.balance)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtAmount(p.markValue, 18, 3)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtAmount(p.exitQuote, 18, 3)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtAmount(p.costBasis, 18, 3)}</td>
                  <td className={`py-2.5 pr-3 text-right ${tone(p.unrealized)}`}>{signed(p.unrealized)}</td>
                  <td className={`py-2.5 pr-3 text-right ${tone(p.realized)}`}>{signed(p.realized)}</td>
                  <td className="py-2.5 text-right">{fmtAmount(p.rewardsClaimed + p.rewardsClaimable, 18, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel p-3 sm:p-4">
        <h2 className="px-1 text-[15px] font-semibold">Trade history</h2>
        <ul className="mt-2 divide-y divide-white/6 text-[13.5px]">
          {trades.slice(0, 40).map(({ t, token }) => (
            <li key={t.id} className="num flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>
                {t.side === 'buy' ? 'Bought' : 'Sold'} {fmtCompact(t.tokenAmount)} {token.symbol}
              </span>
              <span className="text-ink-2">
                {fmtAmount(t.quoteSettled, 18, 4)} CANOPY, fee {fmtAmount(t.fee, 18, 5)}
              </span>
              <span className="font-mono text-[12px] text-ink-3">{shortAddr(t.txHash, 8, 4)}</span>
              <span className="text-[12.5px] text-ink-3">{utc(t.timestamp)} UTC</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function CreatorView() {
  const { ds, unavailableReason } = useData();
  if (!ds) return <Unavailable title="Creator tools unavailable" reason={unavailableReason ?? ''} />;
  const mine = ds.tokens.filter((t) => t.creator === ds.demoWallet);
  const blocked = writeBlockReason();
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Creator tools</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          Claim your fee share, or give it to holders for good. Creators can never raise trader fees or lower the holder share.
        </p>
        <WalletNote />
      </section>
      {mine.length === 0 ? (
        <Unavailable title="No markets created" reason="Markets you launch appear here." />
      ) : (
        mine.map((t) => {
          const owed = t.fees.creator - t.creatorClaimed;
          return (
            <section key={t.address} className="panel p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <TokenArt symbol={t.symbol} hue={t.hue} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/token/${t.address}?tab=creator`} className="text-[16px] font-medium hover:underline">
                    {t.name}
                  </Link>
                  <div className="text-[13px] text-ink-3">{t.symbol}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <KeyValue
                  rows={[
                    ['Fees accrued to you', `${fmtAmount(t.fees.creator, 18, 4)} CANOPY`],
                    ['Claimed', `${fmtAmount(t.creatorClaimed, 18, 4)} CANOPY`],
                    ['Owed now', `${fmtAmount(owed, 18, 4)} CANOPY`],
                    ['Fee share', t.creatorSurrenderedAt ? 'Surrendered to holders' : 'Active, 10%'],
                  ]}
                />
                <div className="space-y-3">
                  <button type="button" className="btn btn-primary w-full" disabled={Boolean(blocked) || owed === 0n}>
                    Claim {fmtAmount(owed, 18, 4)} CANOPY
                  </button>
                  <div className="inset p-3.5 text-[13px] text-ink-2">
                    <div className="text-[14px] text-ink">Give your share to holders</div>
                    Future creator fees go to holders, raising their share to 90%. Fees already owed to you stay yours. This is permanent.
                    <button type="button" className="btn btn-glass mt-3 w-full" disabled={Boolean(blocked) || Boolean(t.creatorSurrenderedAt)}>
                      Surrender creator share
                    </button>
                  </div>
                  {blocked ? <p className="text-[12.5px] text-ink-2">{blocked}</p> : null}
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
