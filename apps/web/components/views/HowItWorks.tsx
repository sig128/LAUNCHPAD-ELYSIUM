'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { METRICS, TRENDING_FORMULA, type MetricScope } from '@canopy/sdk';
import { IconCheck, IconClose, IconDrop, IconLayers, IconLeaf, IconLock, IconSearch, IconSprout, IconSwap } from '@/components/ui/Icons';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'canopy', label: 'CANOPY, the main coin' },
  { id: 'fees', label: 'Where the 1% goes' },
  { id: 'rewards', label: 'Holder rewards' },
  { id: 'launch', label: 'What a launch creates' },
  { id: 'permissions', label: 'Who can do what' },
  { id: 'ranking', label: 'How Trending works' },
  { id: 'metrics', label: 'Every number, defined' },
  { id: 'faq', label: 'Questions' },
];

const SPLIT_COLORS = { holders: '#c8f580', creator: '#e9c17b', protocol: '#8fa596' };

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-18% 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="panel scroll-mt-24 p-5 sm:p-8">
      <h2 id={`${id}-title`} className="display text-[30px] leading-[1.1] text-ink sm:text-[38px]">
        {title}
      </h2>
      {lead ? <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2 sm:text-[16.5px]">{lead}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Builders({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-6 rounded-2xl border border-white/8 bg-black/20">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-[14px] text-ink-2 hover:text-ink">
        For builders: the exact rules
        <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="border-t border-white/8 px-4 py-4 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-lg bg-black/35 px-2 py-1 font-mono text-[12.5px] text-ink">{children}</code>;
}

/* ---------------- Overview ---------------- */

function Overview() {
  const steps = [
    { icon: IconSprout, title: 'Launch', body: 'Free apart from gas. One transaction creates the token, its pool against CANOPY, and a liquidity position locked for good.' },
    { icon: IconSwap, title: 'Trade', body: 'Every buy and sell pays a single 1% fee on the CANOPY side. Pay with HYPE and it routes through CANOPY for you.' },
    { icon: IconDrop, title: 'Earn', body: '80% of every fee flows to holders over the next hour. Claim whenever you like.' },
  ];
  return (
    <section id="overview" aria-labelledby="overview-title" className="panel relative scroll-mt-24 overflow-hidden p-6 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(200 245 128 / 0.35), transparent 70%)' }}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-lime/12 text-lime ring-1 ring-lime/25">
        <IconLeaf size={24} />
      </span>
      <h1 id="overview-title" className="display mt-6 text-[44px] leading-[1.02] sm:text-[64px]">
        How Canopy works
      </h1>
      <p className="mt-4 max-w-[58ch] text-[16.5px] leading-relaxed text-ink-2 sm:text-[18px]">
        Launch a market, trade with costs you can see, and earn a published share of the fees trading actually collects. No promised
        returns, no price floor, no hidden levers.
      </p>
      <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
        <span aria-hidden className="absolute left-[16%] right-[16%] top-[30px] hidden h-px bg-gradient-to-r from-lime/40 via-white/15 to-lime/40 md:block" />
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="inset relative p-5">
            <div className="flex items-center gap-3">
              <span className="relative flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[rgb(10_30_22)] text-lime ring-1 ring-lime/30">
                <Icon size={20} />
              </span>
              <span className="num text-[13px] text-ink-3">Step {i + 1}</span>
            </div>
            <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] text-ink-3">The launch contracts are in development and not audited yet. Nothing here is financial advice.</p>
    </section>
  );
}

/* ---------------- Main coin ---------------- */

function Hop({ label, sub, strong = false }: { label: string; sub: string; strong?: boolean }) {
  return (
    <div className={`inset flex min-w-0 flex-1 flex-col items-center px-3 py-4 text-center ${strong ? 'ring-1 ring-lime/40' : ''}`}>
      <span className={`num text-[15px] font-semibold ${strong ? 'text-lime' : 'text-ink'}`}>{label}</span>
      <span className="mt-0.5 text-[12px] text-ink-3">{sub}</span>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1 text-ink-3" aria-hidden>
      <span className="text-[11px]">{label}</span>
      <svg width="28" height="10" viewBox="0 0 28 10" className="mt-0.5">
        <path d="M0 5h24M20 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

function MainCoin() {
  const points = [
    { icon: IconSprout, title: 'Free to launch', body: 'No bridge or setup cost per coin. The launcher pays gas and nothing else.' },
    { icon: IconLayers, title: 'One coin under every launch', body: 'Buying any coin buys CANOPY first, and that CANOPY stays in the coin’s pool.' },
    { icon: IconDrop, title: 'Holders paid twice over', body: 'A coin’s holders earn 80% of its fees in CANOPY. CANOPY holders earn 80% of CANOPY’s own market.' },
  ];
  return (
    <Section
      id="canopy"
      title="CANOPY, the main coin"
      lead="Every coin launched here trades against CANOPY. You can still pay with HYPE: the app swaps it through CANOPY in the same transaction."
    >
      <div className="flex items-stretch gap-1" role="img" aria-label="Paying with HYPE: HYPE to CANOPY to the coin, each step charging 1%">
        <Hop label="HYPE" sub="what you pay with" />
        <Arrow label="1% fee" />
        <Hop label="CANOPY" sub="main coin" strong />
        <Arrow label="1% fee" />
        <Hop label="Coin" sub="any launch" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="inset flex gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime ring-1 ring-lime/20">
              <Icon size={18} />
            </span>
            <div>
              <h3 className="text-[15.5px] font-semibold">{title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="inset mt-5 p-5">
        <h3 className="text-[15.5px] font-semibold">One token on two chains</h3>
        <div className="mt-4 flex items-stretch gap-1" role="img" aria-label="Elysium and Solana each hold half of CANOPY's supply, joined by Wormhole">
          <Hop label="Elysium" sub="500M CANOPY vs HYPE" />
          <div className="flex shrink-0 flex-col items-center justify-center px-2 text-lime" aria-hidden>
            <span className="text-[11px] text-ink-3">Wormhole</span>
            <svg width="40" height="12" viewBox="0 0 40 12" className="mt-0.5">
              <path d="M4 3h32M32 0l4 3-4 3M36 9H4M8 6l-4 3 4 3" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <Hop label="Solana" sub="500M CANOPY vs SOL" />
        </div>
        <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-2">
          1 billion CANOPY in total. Half starts in a locked pool on Elysium and half in a locked pool on Solana, both opening at the same price,
          so nobody has to buy supply first. Moving CANOPY across burns it on one chain and mints it on the other, so the total never changes.
          Traders who buy where it is cheaper and sell where it is dearer keep one price, and together the two pools behave like a single curve.
        </p>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Status: the Elysium contracts are written and tested locally. CANOPY is not launched yet, and the Solana side and Wormhole link are next.
        </p>
      </div>
    </Section>
  );
}

/* ---------------- Fees ---------------- */

const VOLUMES = [1_000, 5_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 2 : 0 });

function Fees() {
  const [surrendered, setSurrendered] = useState(false);
  const [vi, setVi] = useState(4);
  const [barRef, inView] = useInView<HTMLDivElement>(0.4);
  const parts = [
    { key: 'holders', label: 'Holders', pct: surrendered ? 90 : 80, body: 'Flows to everyone holding the token, in proportion to their balance.' },
    {
      key: 'creator',
      label: 'Creator',
      pct: surrendered ? 0 : 10,
      body: surrendered ? 'Given to holders permanently.' : 'The launcher’s share. They can hand it to holders for good.',
    },
    { key: 'protocol', label: 'Protocol', pct: 10, body: 'Keeps the platform running.' },
  ] as const;
  const vol = VOLUMES[vi];
  const fees = vol * 0.01;
  const holders = fees * (surrendered ? 0.9 : 0.8);

  return (
    <Section
      id="fees"
      title="Where the 1% goes"
      lead="Every buy and sell pays one fee: 1% of the CANOPY side of the trade. Apart from network gas, that is the whole cost."
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div>
          <div className="display text-[112px] leading-[0.9] text-ink sm:text-[148px]" aria-label="One percent">
            1%
          </div>
          <p className="mt-2 text-[15px] text-ink-2">of the CANOPY side, on every trade</p>
          <ul className="mt-6 space-y-3 text-[14.5px] text-ink-2">
            {[
              'Buys pay it from the CANOPY you send.',
              'Sells pay it from the CANOPY the pool returns.',
              'Paying with HYPE adds one hop through CANOPY’s own market, which charges its own 1%.',
              'The pool’s own LP fee is 0%, so nothing stacks on top.',
              'No tax on token transfers. Rounding leftovers go to holders.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 text-lime">
                  <IconCheck size={15} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div ref={barRef}>
          <div
            className="flex h-5 gap-[3px] overflow-hidden rounded-full"
            role="img"
            aria-label={parts.map((p) => `${p.label} ${p.pct}%`).join(', ')}
          >
            {parts.map((p, i) => (
              <div
                key={p.key}
                className="h-full rounded-[3px] first:rounded-l-full last:rounded-r-full"
                style={{
                  width: inView ? `${p.pct}%` : '0%',
                  background: SPLIT_COLORS[p.key],
                  transition: `width 1000ms var(--ease-expo) ${i * 110}ms`,
                }}
              />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-white/6">
            {parts.map((p) => (
              <li key={p.key} className="flex gap-4 py-3.5">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SPLIT_COLORS[p.key] }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15.5px] font-medium">{p.label}</span>
                    <span className="num text-[19px] font-medium tabular-nums transition-all">{p.pct}%</span>
                  </div>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <span className="text-[14px] text-ink-2">Show a market whose creator gave their share to holders</span>
            <input
              type="checkbox"
              role="switch"
              className="h-5 w-5 accent-[#c8f580]"
              checked={surrendered}
              onChange={(e) => setSurrendered(e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="mt-10 rounded-[20px] border border-white/8 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[17px] font-semibold">Try a day of trading</h3>
          <span className="text-[12.5px] text-ink-3">Illustration only, not a forecast or live revenue</span>
        </div>
        <label className="mt-4 block">
          <span className="flex items-baseline justify-between text-[14px] text-ink-2">
            <span>Daily trading volume in one market</span>
            <span className="num text-[16px] text-ink">{n0(vol)} CANOPY</span>
          </span>
          <input
            type="range"
            min={0}
            max={VOLUMES.length - 1}
            step={1}
            value={vi}
            onChange={(e) => setVi(Number(e.target.value))}
            className="mt-3 w-full accent-[#c8f580]"
            aria-valuetext={`${n0(vol)} CANOPY`}
          />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Fees collected', value: fees },
            { label: `To holders (${surrendered ? 90 : 80}%)`, value: holders },
            { label: 'Share for 1% of eligible supply', value: holders * 0.01 },
          ].map((s) => (
            <div key={s.label} className="inset p-4">
              <div className="text-[12.5px] text-ink-3">{s.label}</div>
              <div className="num mt-1 text-[22px] font-medium tracking-[-0.01em]">{n0(s.value)} CANOPY</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
          Real amounts depend on the fees a market actually collects and on your share of eligible supply while they release.
        </p>
      </div>

      <Builders>
        <p>
          fee = floor(quote notional × 100 ÷ 10,000). Buys use the gross pair input, sells the gross pair output. Creator and protocol each get
          floor(fee × 1,000 ÷ 10,000); holders get the remainder, so all rounding dust goes to holders and the parts always
          sum to the fee. Exact-output swaps are rejected rather than quoted.
        </p>
      </Builders>
    </Section>
  );
}

/* ---------------- Rewards ---------------- */

function StreamDiagram() {
  const [ref, inView] = useInView<HTMLDivElement>(0.45);
  // 0–90 minutes across x = 40…580 (6px per minute). Fee 1 at 0 min, fee 2 at 30 min (merged, restarts the hour).
  const x = (m: number) => 40 + m * 6;
  const base = 170;
  const h1 = 46;
  const h2 = 70;
  return (
    <div ref={ref} className="overflow-hidden rounded-[20px] border border-white/8 bg-black/25 p-4 sm:p-6">
      <svg viewBox="0 0 620 220" className="h-auto w-full" role="img" aria-label="Release rate over time: a fee releases evenly over an hour; a second fee merges with what is left and restarts the hour.">
        <defs>
          <linearGradient id="stream-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8f580" stopOpacity="0.55" />
            <stop offset="1" stopColor="#c8f580" stopOpacity="0.06" />
          </linearGradient>
          <clipPath id="stream-clip">
            <rect x="0" y="0" height="220" width={inView ? 620 : 40} style={{ transition: 'width 2400ms cubic-bezier(0.45, 0, 0.25, 1)' }} />
          </clipPath>
        </defs>
        {[0, 30, 60, 90].map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={40} y2={base} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" />
            <text x={x(m)} y={base + 22} textAnchor="middle" fontSize="12" fill="#8fa596">
              {m} min
            </text>
          </g>
        ))}
        <line x1={x(0)} x2={x(90)} y1={base} y2={base} stroke="rgba(255,255,255,0.18)" />
        <g clipPath="url(#stream-clip)">
          <path
            d={`M${x(0)},${base} V${base - h1} H${x(30)} V${base - h2} H${x(90)} V${base} Z`}
            fill="url(#stream-fill)"
          />
          <path d={`M${x(0)},${base - h1} H${x(30)} V${base - h2} H${x(90)}`} fill="none" stroke="#c8f580" strokeWidth="2" />
        </g>
        {[
          { m: 0, label: 'Fee arrives', dy: 0 },
          { m: 30, label: 'Next fee merges, the hour restarts', dy: -24 },
        ].map((f) => (
          <g key={f.m}>
            <circle cx={x(f.m)} cy={base - (f.m === 0 ? h1 : h2)} r="5" fill="#c8f580" />
            <text x={x(f.m) + 10} y={base - (f.m === 0 ? h1 : h2) - 12 + f.dy} fontSize="13" fill="#f1f5ef">
              {f.label}
            </text>
          </g>
        ))}
        <text x={x(90)} y={30} textAnchor="end" fontSize="12" fill="#8fa596">
          release rate
        </text>
      </svg>
      <p className="mt-3 text-[13px] text-ink-2">
        Each fee is released evenly over the next hour. When another fee lands, it joins whatever is still waiting and the hour starts again.
      </p>
    </div>
  );
}

function Rewards() {
  const principles = [
    { title: 'Hold to earn', body: 'Rewards follow your balance while fees release. No staking and no lockups.' },
    { title: 'Late snipes get nothing extra', body: 'Buying just before a fee lands earns nothing already released, and a same-block buy and sell earns zero.' },
    { title: 'Keep what you earned', body: 'Rewards you earned stay claimable after you sell. Claim whenever you like.' },
  ];
  return (
    <Section
      id="rewards"
      title="How holder rewards flow"
      lead="Holder rewards are paid in CANOPY from the fees each market actually collects. They release gradually, so they go to the people holding while trading happens."
    >
      <StreamDiagram />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {principles.map((p) => (
          <div key={p.title} className="inset p-5">
            <h3 className="text-[16px] font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <h3 className="text-[14px] text-ink-2">Never earns rewards</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {['Unsold pool inventory', 'Seed liquidity locker', 'Fee vault', 'Burn address'].map((t) => (
            <span key={t} className="tag bg-white/6 px-3 py-1 text-[13px] text-ink-2 ring-1 ring-white/10">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] text-ink-3">Contracts and smart wallets earn like any other holder. This reduces sniping; it does not stop every bot.</p>
      </div>
      <Builders>
        <p>
          On funding: <Code>rate = (amount × 10¹⁸ + still unreleased) ÷ 3,600</Code>, and the release window restarts at 3,600 seconds.
        </p>
        <p className="mt-2">
          Global: <Code>index += rate × elapsed × 10¹⁸ ÷ eligible supply</Code>. Before any balance change:{' '}
          <Code>earned += balance × (index − paid) ÷ 10³⁶</Code>. Constant cost per transfer, no loops, no external calls.
        </p>
        <p className="mt-2">Release pauses while eligible supply is zero. Every division rounds down, so total claims can never exceed what was released.</p>
      </Builders>
    </Section>
  );
}

/* ---------------- Launch ---------------- */

function RangeDiagram() {
  const [ref, inView] = useInView<HTMLDivElement>(0.45);
  return (
    <div ref={ref} className="overflow-hidden rounded-[20px] border border-white/8 bg-black/25 p-4 sm:p-6">
      <svg viewBox="0 0 620 200" className="h-auto w-full" role="img" aria-label="The whole supply sits in one position from the opening price upward. Nothing sits below the opening price.">
        <defs>
          <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c8f580" stopOpacity="0.5" />
            <stop offset="1" stopColor="#c8f580" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <line x1="30" x2="600" y1="150" y2="150" stroke="rgba(255,255,255,0.2)" />
        <path d="M594,145 L600,150 L594,155" fill="none" stroke="rgba(255,255,255,0.35)" />
        <text x="600" y="176" textAnchor="end" fontSize="12" fill="#8fa596">
          higher price
        </text>
        <rect x="40" y="70" width="140" height="80" fill="none" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" rx="6" />
        <text x="110" y="114" textAnchor="middle" fontSize="12" fill="#8fa596">
          nothing below
        </text>
        <rect
          x="190"
          y="70"
          height="80"
          rx="8"
          fill="url(#band)"
          width={inView ? 400 : 0}
          style={{ transition: 'width 1600ms var(--ease-expo)' }}
        />
        <text x="208" y="102" fontSize="14" fill="#f1f5ef">
          Whole 1,000,000,000 supply
        </text>
        <text x="208" y="124" fontSize="12.5" fill="#b2c2b6">
          locked in one position, forever
        </text>
        <line x1="190" x2="190" y1="48" y2="158" stroke="#c8f580" strokeWidth="2" />
        <circle cx="190" cy="150" r="5" fill="#c8f580" />
        <text x="190" y="38" textAnchor="middle" fontSize="12.5" fill="#c8f580">
          opening price
        </text>
      </svg>
      <p className="mt-3 text-[13px] text-ink-2">
        Buyers move the price up through the band. CANOPY enters the pool only when people buy; nothing backs the opening price.
      </p>
    </div>
  );
}

function Launch() {
  const facts = [
    { icon: IconLayers, title: '1,000,000,000 supply', body: 'Minted once at launch. No later minting.' },
    { icon: IconLock, title: 'Liquidity locked forever', body: 'The launch position belongs to a locker with no withdraw function.' },
    { icon: IconCheck, title: 'Plain token', body: 'No transfer tax, blacklist or freeze switch.' },
    { icon: IconSprout, title: 'You set the opening price', body: 'It comes from the opening FDV you choose, in CANOPY.' },
    { icon: IconSwap, title: 'Creator buys are public', body: 'Any creator buy happens in the launch transaction and shows on the market page.' },
    { icon: IconLeaf, title: 'No migration', body: 'A market lives in one pool from day one. "Matured" is only a status label.' },
  ];
  return (
    <Section
      id="launch"
      title="What a launch creates"
      lead="One transaction creates the token, opens its Uniswap v4 pool against CANOPY on Elysium and locks the liquidity. If any step fails, nothing is created."
    >
      <RangeDiagram />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {facts.map(({ icon: Icon, title, body }) => (
          <div key={title} className="inset flex gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime ring-1 ring-lime/20">
              <Icon size={18} />
            </span>
            <div>
              <h3 className="text-[15.5px] font-semibold">{title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Permissions ---------------- */

const ROLES = [
  {
    role: 'Creator',
    can: ['Claim their 10% fee share', 'Give that share to holders for good'],
    cannot: ['Mint more tokens', 'Freeze, blacklist or tax transfers', 'Change fees', 'Touch the locked liquidity'],
  },
  { role: 'Holder', can: ['Claim earned rewards any time', 'Keep earned rewards after selling'], cannot: ['Move anything but their own balance'] },
  {
    role: 'Protocol treasury',
    can: ['Claim the 10% protocol share', 'Pause new launches'],
    cannot: ['Seize funds or rewrite balances', 'Change splits on existing markets', 'Withdraw locked liquidity', 'Block sells or claims'],
  },
  { role: 'Anyone', can: ['Trade, launch and read every value'], cannot: ['Create pools with the Canopy hook outside the factory'] },
];

function Permissions() {
  return (
    <Section id="permissions" title="Who can do what" lead="Powers are narrow and written down. Nobody, including us, can take what is yours.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.role} className="inset p-5">
            <h3 className="text-[17px] font-semibold">{r.role}</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              {r.can.map((c) => (
                <li key={c} className="flex gap-2.5 text-ink">
                  <span className="mt-0.5 text-up">
                    <IconCheck size={15} />
                  </span>
                  {c}
                </li>
              ))}
              {r.cannot.map((c) => (
                <li key={c} className="flex gap-2.5 text-ink-2">
                  <span className="mt-0.5 text-down/80">
                    <IconClose size={15} />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Ranking ---------------- */

function Ranking() {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const weights = [
    { label: '24h trading volume', pct: 50, note: 'log-scaled, so one whale cannot dominate' },
    { label: 'Unique trader addresses, 24h', pct: 30, note: 'log-scaled' },
    { label: 'Net buying versus selling', pct: 20, note: 'capped between −1 and 1' },
  ];
  return (
    <Section id="ranking" title="How Trending works" lead="Trending is a published formula. There is no paid placement in this release.">
      <div ref={ref} className="space-y-4">
        {weights.map((w, i) => (
          <div key={w.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px]">{w.label}</span>
              <span className="num text-[15px] text-ink-2">{w.pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-lime/80"
                style={{ width: inView ? `${w.pct * 2}%` : '0%', transition: `width 1100ms var(--ease-expo) ${i * 120}ms` }}
              />
            </div>
            <p className="mt-1 text-[12.5px] text-ink-3">{w.note}</p>
          </div>
        ))}
      </div>
      <Builders>
        <p>{TRENDING_FORMULA}</p>
      </Builders>
    </Section>
  );
}

/* ---------------- Metrics ---------------- */

const SCOPES: { id: 'all' | MetricScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'platform', label: 'Platform' },
  { id: 'token', label: 'Market' },
  { id: 'wallet', label: 'Wallet' },
];

function Metrics() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | MetricScope>('all');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return METRICS.filter((m) => (scope === 'all' || m.scope === scope) && (!needle || `${m.label} ${m.formula} ${m.exclusions ?? ''}`.toLowerCase().includes(needle)));
  }, [q, scope]);
  return (
    <Section
      id="metrics"
      title="Every number, defined"
      lead="Each figure in the app has one definition: what it counts, what it leaves out, and where it comes from. Unknown is never shown as zero."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search metrics</span>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
            <IconSearch size={16} />
          </span>
          <input className="field h-11 pl-10" placeholder="Search, for example volume or holders" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex rounded-[13px] bg-black/25 p-1" role="group" aria-label="Scope">
          {SCOPES.map((s) => (
            <button key={s.id} type="button" className="chip h-9" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-white/6 rounded-[18px] border border-white/8 bg-black/15">
        {list.length === 0 ? <li className="px-4 py-6 text-center text-[14px] text-ink-2">No metric matches that search.</li> : null}
        {list.map((m) => (
          <li key={m.id}>
            <details className="group">
              <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03]">
                <span className="flex-1 text-[15px]">{m.label}</span>
                <span className="tag hidden bg-white/6 text-ink-3 ring-1 ring-white/8 sm:inline-flex">{m.scope === 'token' ? 'market' : m.scope}</span>
                <span className="tag bg-white/6 text-ink-2 ring-1 ring-white/8">{m.unit}</span>
                <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <dl className="grid gap-x-6 gap-y-2 px-4 pb-4 text-[13.5px] sm:grid-cols-[120px_minmax(0,1fr)]">
                <dt className="text-ink-3">Formula</dt>
                <dd className="text-ink">{m.formula}</dd>
                {m.exclusions ? (
                  <>
                    <dt className="text-ink-3">Leaves out</dt>
                    <dd className="text-ink-2">{m.exclusions}</dd>
                  </>
                ) : null}
                {m.window ? (
                  <>
                    <dt className="text-ink-3">Windows</dt>
                    <dd className="text-ink-2">{m.window}</dd>
                  </>
                ) : null}
                <dt className="text-ink-3">Source</dt>
                <dd className="text-ink-2">{m.source}</dd>
                <dt className="text-ink-3">Confirmed at</dt>
                <dd className="text-ink-2">{m.confirmation}</dd>
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------- FAQ ---------------- */

const FAQ = [
  {
    q: 'Is there a price floor or a guaranteed return?',
    a: 'No. Rewards come only from fees that trading actually collects. Prices can fall to near zero.',
  },
  {
    q: 'Can a creator pull the liquidity?',
    a: 'No. The launch liquidity is held by a locker contract that has no function to withdraw it. A creator can still sell tokens they bought, and those sales are labelled on the market page.',
  },
  { q: 'What does a trade cost?', a: 'The 1% fee on the pair side plus Elysium network gas. Nothing else is taken.' },
  {
    q: 'Can I pair my launch with a stock?',
    a: 'The contracts support it: a market can trade against an approved stock token instead of CANOPY, and its fee, holder rewards and creator fees are then paid in that stock. Stock pairs open once tokens such as Ondo’s are live on Elysium and approved, and only where local rules allow tokenized stocks.',
  },
  {
    q: 'Why does every coin trade against CANOPY?',
    a: 'So launching stays free and every launch builds on one shared coin. Buying any coin buys CANOPY first, and that CANOPY stays in the coin’s pool, so CANOPY moves with activity across all launches. It also falls when launches are sold, so it is not a safe asset.',
  },
  {
    q: 'Can I pay with HYPE?',
    a: 'Yes. The app swaps HYPE to CANOPY and CANOPY to the coin in one transaction, and back again when you sell. Each step is its own market, so the 1% fee applies at each step.',
  },
  {
    q: 'Is CANOPY on Solana too?',
    a: 'That is the plan: 1 billion CANOPY in total, half starting on Elysium against HYPE and half on Solana against SOL, joined by Wormhole. Moving CANOPY between chains burns it on one side and mints it on the other, so the total never changes. It is not live yet.',
  },
  { q: 'When can I claim rewards?', a: 'Any time, including after you sell. Rewards that have finished releasing are claimable straight away.' },
  { q: 'Are the contracts audited?', a: 'Not yet. They are tested against real Uniswap v4 contracts locally, which is not an audit. Treat every market as high risk.' },
  { q: 'Why do I see “No markets yet”?', a: 'The Canopy launch contracts are not deployed on Elysium mainnet yet. Markets appear as soon as the first one launches.' },
];

function Faq() {
  return (
    <Section id="faq" title="Questions">
      <ul className="divide-y divide-white/6 rounded-[18px] border border-white/8 bg-black/15">
        {FAQ.map((f) => (
          <li key={f.q}>
            <details className="group">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-[15.5px] hover:bg-white/[0.03]">
                {f.q}
                <span className="text-[18px] text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="max-w-[68ch] px-5 pb-5 text-[14.5px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------- Page ---------------- */

export function HowItWorks() {
  const active = useActiveSection();
  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="panel sticky top-[92px] space-y-0.5 p-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? 'true' : undefined}
                className={`relative block rounded-xl px-3 py-2 text-[14px] transition-colors ${
                  active === s.id ? 'bg-white/10 text-ink' : 'text-ink-2 hover:bg-white/5 hover:text-ink'
                }`}
              >
                {active === s.id ? <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-lime" aria-hidden /> : null}
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-5">
        <nav aria-label="On this page" className="scroll-x -mx-1 flex gap-1.5 px-1 lg:hidden">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="chip shrink-0 border border-white/10 bg-black/25 backdrop-blur-md" aria-current={active === s.id ? 'true' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <Overview />
        <MainCoin />
        <Fees />
        <Rewards />
        <Launch />
        <Permissions />
        <Ranking />
        <Metrics />
        <Faq />
      </div>
    </div>
  );
}
