'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { dailySeries, fmtAmount, fmtCompact, METRICS, NETWORKS, platformStats, STATUS_LABEL, TRENDING_FORMULA } from '@canopy/sdk';
import { MODE, NETWORK, RPC_URL } from '@/lib/config';
import { useData } from '@/lib/data';
import { DEFAULT_COLUMNS, useSettings } from '@/lib/settings';
import { healthLabel, useHealth } from '@/lib/health';
import { Address, KeyValue, Pill, Stat, Unavailable } from '@/components/ui/primitives';
import { FeeBar } from '@/components/discover/DiscoverPage';

export function AnalyticsView() {
  const { ds, unavailableReason } = useData();
  const s = useMemo(() => (ds ? platformStats(ds) : null), [ds]);
  const days = useMemo(() => (ds ? dailySeries(ds, 30) : []), [ds]);
  if (!ds || !s) return <Unavailable title="Analytics unavailable" reason={unavailableReason ?? ''} />;
  const max = Math.max(1, ...days.map((d) => d.volume));
  const top = [...ds.tokens].sort((a, b) => (b.stats['7d'].volume > a.stats['7d'].volume ? 1 : -1)).slice(0, 8);
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Analytics</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          Every figure comes from swap and fee events and reconciles to them. Definitions are in{' '}
          <Link href="/docs#metrics" className="text-lime hover:underline">
            the metric dictionary
          </Link>
          .
        </p>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Successful launches" value={s.launches} />
          <Stat label="Launches, 24h" value={s.launches24h} />
          <Stat label="Active markets, 24h" value={s.activeMarkets24h} />
          <Stat label="Swaps, lifetime" value={s.swaps.toLocaleString('en-US')} />
          <Stat label="Trader addresses, 24h" value={s.activeTraders24h} hint="Unique addresses, not people" />
          <Stat label="New trader addresses, 24h" value={s.newTraders24h} />
          <Stat label="Volume, 7d" value={`${fmtCompact(s.volume['7d'])} HYPE`} />
          <Stat label="Volume, lifetime" value={`${fmtCompact(s.volume.all)} HYPE`} />
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-[15px] font-semibold">Daily volume, last 30 days (HYPE)</h2>
          <svg viewBox="0 0 300 120" className="mt-3 h-40 w-full" role="img" aria-label="Daily volume bar chart; table below">
            {days.map((d, i) => {
              const h = (d.volume / max) * 110;
              return <rect key={d.time} x={i * 10 + 1} y={115 - h} width={8} height={Math.max(h, 0.5)} rx={1.5} fill="rgba(200,245,128,0.7)" />;
            })}
          </svg>
          <details className="mt-2 text-[13px] text-ink-2">
            <summary className="cursor-pointer text-ink-3">Show as a table</summary>
            <table className="num mt-2 w-full text-[12.5px]">
              <tbody>
                {days.map((d) => (
                  <tr key={d.time} className="border-t border-white/6">
                    <td className="py-1">{new Date(d.time * 1000).toISOString().slice(0, 10)}</td>
                    <td className="py-1 text-right">{d.volume.toFixed(2)} HYPE</td>
                    <td className="py-1 text-right">{d.launches} launches</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
        <section className="panel p-4">
          <h2 className="text-[15px] font-semibold">Fees by destination, lifetime</h2>
          <KeyValue
            rows={[
              ['Gross fees collected', `${fmtAmount(s.fees.fee, 18, 3)} HYPE`],
              ['Holder allocation', `${fmtAmount(s.fees.holders, 18, 3)} HYPE`],
              ['Released to holders', `${fmtAmount(s.rewardsReleased, 18, 3)} HYPE`],
              ['Claimed by holders', `${fmtAmount(s.rewardsClaimed, 18, 3)} HYPE`],
              ['Outstanding holder liability', `${fmtAmount(s.holderLiabilityOutstanding, 18, 3)} HYPE`],
              ['Creator fees', `${fmtAmount(s.fees.creator, 18, 3)} HYPE`],
              ['Buy-order reserves funded', `${fmtAmount(s.fees.reserve, 18, 3)} HYPE`],
              ['Liquidity-growth budgets funded', `${fmtAmount(s.fees.liquidity, 18, 3)} HYPE`],
              ['Protocol operating income', `${fmtAmount(s.fees.protocol, 18, 3)} HYPE`],
              ['Wallets with rewards', s.rewardedWallets],
            ]}
          />
          <p className="mt-2 text-[12.5px] text-ink-3">Only the protocol line is protocol revenue. Reserve and liquidity-growth funds are held per token.</p>
        </section>
      </div>
      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Most traded, 7 days</h2>
        <ul className="mt-2 divide-y divide-white/6">
          {top.map((t) => (
            <li key={t.address} className="num flex items-center justify-between gap-3 py-2.5 text-[14px]">
              <Link href={`/token/${t.address}`} className="min-w-0 truncate font-sans hover:underline">
                {t.name}
              </Link>
              <span className="text-ink-2">{fmtCompact(t.stats['7d'].volume)} HYPE</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ContractsView() {
  const health = useHealth();
  const hl = healthLabel(health);
  const entryStatus = (netKey: string, address: string, fallback: keyof typeof STATUS_LABEL) => {
    if (netKey === NETWORK.key && health.state === 'ok') {
      const c = health.code[address];
      if (c === 'present') return <Pill tone="up">Code present on chain {health.chainId}</Pill>;
      if (c === 'missing') return <Pill tone="down">No contract code here</Pill>;
    }
    return <Pill tone={fallback === 'rpc-verified' || fallback === 'own-verified' ? 'up' : 'neutral'}>{STATUS_LABEL[fallback]}</Pill>;
  };
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Contracts and addresses</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          Every address the app uses, where it came from, and how far it has been verified. Live writes stay off until critical infrastructure is
          verified over RPC.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone={MODE === 'demo' ? 'warn' : 'neutral'}>Mode: {MODE}</Pill>
          <Pill>
            Target: {NETWORK.name}, chain {NETWORK.chainId} ({STATUS_LABEL[NETWORK.chainIdStatus]})
          </Pill>
          <Pill tone={RPC_URL ? 'neutral' : 'warn'}>{RPC_URL ? 'RPC configured' : `RPC not configured (${NETWORK.rpcEnvVar})`}</Pill>
          <Pill tone={hl.tone === 'up' ? 'up' : hl.tone === 'down' ? 'down' : 'warn'}>Startup check: {hl.text}</Pill>
        </div>
        <p className="mt-3 text-[13px] text-ink-2">{hl.detail}</p>
      </section>
      {Object.values(NETWORKS).map((net) => (
        <section key={net.key} className="panel p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold">
            {net.name} <span className="font-normal text-ink-3">chain {net.chainId}</span>
          </h2>
          {net.notes.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
              {net.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <h3 className="mt-4 text-[14px] font-medium">Infrastructure</h3>
          {net.infrastructure.length === 0 ? (
            <p className="mt-1 text-[13.5px] text-ink-2">None recorded.</p>
          ) : (
            <div className="scroll-x mt-1">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <tbody>
                  {[...net.infrastructure, ...(net.wrappedNative ? [net.wrappedNative] : [])].map((e) => (
                    <tr key={e.name} className="border-t border-white/6">
                      <td className="py-2 pr-3">{e.name}</td>
                      <td className="py-2 pr-3">
                        <Address value={e.address} label={`${e.name} address`} full />
                      </td>
                      <td className="py-2 pr-3">{entryStatus(net.key, e.address, e.status)}</td>
                      <td className="py-2 text-[12.5px]">
                        <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-ink-2 underline decoration-white/20 underline-offset-4 hover:text-ink">
                          Source, checked {e.checkedAt}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mt-4 text-[14px] font-medium">Our contracts</h3>
          <p className="mt-1 text-[13.5px] text-ink-2">
            {net.own.length === 0
              ? 'Not deployed. Factory, hook, vault, locker and router addresses appear here only after deployment scripts record real receipts.'
              : `${net.own.length} recorded.`}
          </p>
        </section>
      ))}
    </div>
  );
}

const PERMISSIONS: [string, string, string][] = [
  ['Creator', 'Claim their 10% fee share; permanently surrender it to holders', 'Mint, freeze, blacklist, tax transfers, change fees, touch liquidity'],
  ['Holder', 'Claim earned rewards at any time, including after selling', 'Nothing beyond their own balance'],
  ['Protocol treasury', 'Claim the 10% protocol share; pause new launches', 'Seize funds, rewrite balances, change existing splits, withdraw locked seed liquidity, block sells or claims'],
  ['Keeper (future)', 'Trigger eligible reserve actions within published limits', 'Choose recipients or routes, exceed per-period spend'],
  ['Anyone', 'Trade, launch, read every value', 'Initialize pools with the CANOPY hook outside the factory'],
];

export function DocsView() {
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">How it works</h1>
        <p className="mt-2 max-w-prose text-[15px] text-ink-2">
          Launch a market, trade with clear execution costs, earn a published share of collected fees, and inspect the liquidity trading builds.
          Nothing here promises returns, income or a price floor.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold">Fees</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            One fee of 1.00% on the HYPE side of each trade, charged by the pool’s hook. Buys pay it from the HYPE you send; sells pay it from the
            HYPE the pool returns. The pool’s LP fee is 0%, so no second fee is stacked on top, and there is no tax on token transfers. Fees round
            down; the leftover wei goes to holders so the parts always sum exactly.
          </p>
          <FeeBar />
          <p className="mt-3 text-[13px] text-ink-3">
            Example only, not live revenue: 1,000,000 HYPE of daily volume would collect 10,000 HYPE in fees, 6,000 of it for holders. Real amounts
            depend on fees actually collected.
          </p>
        </section>
        <section className="panel p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold">Holder reward accounting</h2>
          <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink-2">
            <li>Each fee arrival is merged with the unreleased balance, and the total releases evenly over the next 3,600 seconds.</li>
            <li>index += rate × elapsed × 10¹⁸ ÷ eligible supply. Before any balance change: earned += balance × (index − paid) ÷ 10³⁶. Constant cost per transfer, no loops, no external calls.</li>
            <li>Release pauses while eligible supply is zero. Divisions round down, so total claims never exceed the amount released.</li>
            <li>Excluded: pool inventory, seed locker, fee vault, reserve sink, burn address. Contracts and smart wallets earn normally.</li>
          </ul>
        </section>
        <section className="panel p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold">Launch and liquidity</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Supply is fixed at 1,000,000,000 with 18 decimals, minted once. The launch transaction creates the token, initializes a native HYPE pool
            at the opening price, and places the whole supply in one single-sided position from that price upward. The position is owned by a locker
            with no withdrawal function. Liquidity starts as token inventory only; no HYPE backs it until people buy. There is no migration and no
            graduation transaction. Matured is a status label.
          </p>
        </section>
        <section className="panel p-4 sm:p-5">
          <h2 className="text-[16px] font-semibold">Discovery ranking</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{TRENDING_FORMULA}</p>
        </section>
      </div>
      <section className="panel p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Permissions</h2>
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead className="text-left text-[12.5px] text-ink-3">
              <tr>
                <th className="py-2 pr-3 font-normal">Role</th>
                <th className="py-2 pr-3 font-normal">Can</th>
                <th className="py-2 font-normal">Cannot</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([r, c, n]) => (
                <tr key={r} className="border-t border-white/6 align-top">
                  <td className="py-2.5 pr-3 font-medium">{r}</td>
                  <td className="py-2.5 pr-3 text-ink-2">{c}</td>
                  <td className="py-2.5 text-ink-2">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="metrics" className="panel scroll-mt-24 p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Metric dictionary</h2>
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="text-left text-[12.5px] text-ink-3">
              <tr>
                <th className="py-2 pr-3 font-normal">Metric</th>
                <th className="py-2 pr-3 font-normal">Scope</th>
                <th className="py-2 pr-3 font-normal">Unit</th>
                <th className="py-2 pr-3 font-normal">Formula</th>
                <th className="py-2 pr-3 font-normal">Exclusions</th>
                <th className="py-2 font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.id} className="border-t border-white/6 align-top">
                  <td className="py-2 pr-3 font-medium">{m.label}</td>
                  <td className="py-2 pr-3 text-ink-2">{m.scope}</td>
                  <td className="py-2 pr-3 text-ink-2">{m.unit}</td>
                  <td className="py-2 pr-3 text-ink-2">{m.formula}</td>
                  <td className="py-2 pr-3 text-ink-3">{m.exclusions ?? ''}</td>
                  <td className="py-2 text-ink-3">{m.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SettingsView() {
  const { settings, update } = useSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="panel p-4 sm:p-6">
        <h1 className="display text-[34px] leading-tight sm:text-[40px]">Settings</h1>
        <p className="mt-2 text-[14px] text-ink-2">Saved in this browser only.</p>
      </section>
      <section className="panel space-y-4 p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Trading</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13.5px]">Quick buy amounts (HYPE, comma separated)</span>
          <input
            className="field num"
            defaultValue={settings.quickBuy.join(', ')}
            onBlur={(e) => {
              const vals = e.target.value
                .split(',')
                .map((v) => v.trim())
                .filter((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0)
                .slice(0, 6);
              if (vals.length) update({ quickBuy: vals });
            }}
          />
          <span className="mt-1 block text-[12.5px] text-ink-3">These fill the amount field. Nothing trades until you confirm.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13.5px]">Default slippage</span>
          <select className="field" value={settings.slippageBps} onChange={(e) => update({ slippageBps: Number(e.target.value) })}>
            {[25, 50, 100, 200, 300, 500].map((b) => (
              <option key={b} value={b}>
                {(b / 100).toFixed(2)}%
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel space-y-3 p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Background and display</h2>
        <Toggle label="Play the jungle background video" checked={settings.videoEnabled} onChange={(v) => update({ videoEnabled: v })} />
        <Toggle label="Play it on phones too (uses more data)" checked={settings.videoOnMobile} onChange={(v) => update({ videoOnMobile: v })} />
        <label className="block">
          <span className="mb-1.5 flex justify-between text-[13.5px]">
            <span>Playback speed</span>
            <span className="num text-ink-2">{settings.playbackRate.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={settings.playbackRate}
            onChange={(e) => update({ playbackRate: Number(e.target.value) })}
            className="w-full accent-[#c8f580]"
          />
          <span className="mt-1 block text-[12.5px] text-ink-3">Default 0.75×. The footage is already slowed to half speed, so much lower values can look less smooth.</span>
        </label>
        <Toggle label="Reduce transparency (solid panels, no blur)" checked={settings.reducedTransparency} onChange={(v) => update({ reducedTransparency: v })} />
        <p className="text-[12.5px] text-ink-3">The video also stays off when your system asks for reduced motion or data saving.</p>
      </section>
      <section className="panel space-y-3 p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Discovery columns</h2>
        {Object.keys(DEFAULT_COLUMNS).map((k) => (
          <Toggle
            key={k}
            label={{ fdv: 'FDV', volume: 'Volume', holders: 'Holders', depth: 'Exit depth', rewards: 'Holder rewards', fee: 'Fee details', age: 'Age' }[k] ?? k}
            checked={settings.columns[k] ?? false}
            onChange={(v) => update({ columns: { ...settings.columns, [k]: v } })}
          />
        ))}
      </section>
      <section className="panel p-4 sm:p-5">
        <h2 className="text-[16px] font-semibold">Watchlist</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">{settings.watchlist.length} markets starred.</p>
        <button type="button" className="btn btn-glass mt-3" disabled={settings.watchlist.length === 0} onClick={() => update({ watchlist: [] })}>
          Clear watchlist
        </button>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-[14px]">{label}</span>
      <input type="checkbox" role="switch" className="h-5 w-5 accent-[#c8f580]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
