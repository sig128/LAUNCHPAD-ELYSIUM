'use client';

import Link from 'next/link';
import { useEffect, useRef, type CSSProperties } from 'react';
import { BRAND, COPY, MODE, NETWORK } from '@/lib/config';
import { healthLabel, useHealth } from '@/lib/health';
import { IconLeaf } from '@/components/ui/Icons';
import { ConnectButton } from './ConnectButton';

export type Stage = 'intro' | 'leaving' | 'entering' | 'app';

const LEAVE_MS = 560;
const ENTER_MS = 1900;

export function readStage(): Stage {
  if (typeof document === 'undefined') return 'app';
  const s = document.documentElement.dataset.stage;
  return s === 'intro' || s === 'leaving' || s === 'entering' ? s : 'app';
}

export function markEntered() {
  try {
    window.sessionStorage.setItem('canopy:entered', '1');
  } catch {
    /* storage blocked: the intro may show again next visit */
  }
}

const vars = (o: Record<string, number>) => o as CSSProperties;

/**
 * Full-screen opening over the jungle footage. "Get started" lifts the intro away, the camera eases
 * back, and the workspace flows in (see the choreography in globals.css). Reduced motion skips straight
 * to the workspace. Links jump straight to their page.
 */
export function IntroOverlay({ stage, setStage }: { stage: Stage; setStage: (s: Stage) => void }) {
  const health = useHealth();
  const hl = healthLabel(health);
  const timers = useRef<number[]>([]);
  const cta = useRef<HTMLAnchorElement>(null);
  const word = BRAND.name.charAt(0) + BRAND.name.slice(1).toLowerCase();
  const dot = { up: 'bg-up', warn: 'bg-warn', down: 'bg-down', neutral: 'bg-ink-3' }[hl.tone];
  const networkName = NETWORK.key === 'elysium' ? 'Elysium mainnet' : NETWORK.name.replace('Kinetiq ', '');
  const statusText = MODE === 'demo' ? 'Demo data' : health.state === 'ok' ? `block ${health.block?.toLocaleString('en-US')}` : hl.text;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    if (stage !== 'intro') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === document.body) cta.current?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  const focusMain = () => document.getElementById('main')?.focus({ preventScroll: true });

  const enter = () => {
    if (stage !== 'intro') return;
    markEntered();
    window.scrollTo(0, 0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('app');
      focusMain();
      return;
    }
    setStage('leaving');
    timers.current.push(window.setTimeout(() => setStage('entering'), LEAVE_MS));
    timers.current.push(
      window.setTimeout(() => {
        setStage('app');
        focusMain();
      }, LEAVE_MS + ENTER_MS),
    );
  };

  const skip = () => {
    markEntered();
    setStage('app');
  };

  return (
    <div className="intro-overlay fixed inset-0 z-[45] flex-col overflow-y-auto" role="region" aria-label={`Welcome to ${word}`}>
      <div
        className="intro-rise mx-auto flex w-full max-w-[1640px] items-center gap-2 px-4 pt-4 sm:px-6"
        style={vars({ '--d': 1150, '--o': 0 })}
      >
        <span className="flex items-center gap-2 text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime/15 text-lime ring-1 ring-lime/25">
            <IconLeaf size={18} />
          </span>
          <span className="display text-[20px] leading-none">{word}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link href="/docs" onClick={skip} className="chip hidden sm:inline-flex">
            How it works
          </Link>
          <span className="tag hidden bg-black/25 text-ink ring-1 ring-white/10 backdrop-blur-md sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
            {networkName}
          </span>
          <ConnectButton variant="glass" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-12 pt-6 text-center">
        <span
          className="intro-rise mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-lime/12 text-lime ring-1 ring-lime/25 backdrop-blur-md"
          style={vars({ '--d': 60, '--o': 1 })}
        >
          <IconLeaf size={30} />
        </span>
        <h1 className="display intro-wordmark select-none leading-[0.92] text-ink" aria-label={word}>
          {word.split('').map((ch, i) => (
            <span key={i} aria-hidden className="intro-letter" style={vars({ '--l': i })}>
              {ch}
            </span>
          ))}
        </h1>
        <p
          className="intro-rise over-video mt-6 text-[clamp(22px,3.1vw,34px)] font-semibold tracking-[-0.02em] text-ink"
          style={vars({ '--d': 760, '--o': 2 })}
        >
          {COPY.heroTitle}
        </p>
        <p className="intro-rise over-video mt-3 max-w-[34rem] text-[15.5px] text-ink-2 sm:text-[16.5px]" style={vars({ '--d': 880, '--o': 3 })}>
          {COPY.introSub}
        </p>
        {/* A real link, so it still opens the markets before scripts load; once loaded it plays the entrance. */}
        <a
          ref={cta}
          href="/?seg=trending"
          onClick={(e) => {
            e.preventDefault();
            enter();
          }}
          className="intro-rise btn btn-primary cta-glow mt-9 h-[56px] min-w-[248px] rounded-[17px] px-8 text-[16.5px]"
          style={vars({ '--d': 1020, '--o': 4 })}
        >
          Get started
        </a>
        <div
          className="intro-rise mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-3.5 pr-1 text-[13px] backdrop-blur-md"
          style={vars({ '--d': 1150, '--o': 5 })}
        >
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
          <span className="text-ink">{networkName}</span>
          <span className="num text-ink-3">chain {NETWORK.chainId}</span>
          <span className="num hidden text-ink-3 sm:inline">{statusText}</span>
          <Link href="/contracts" onClick={skip} className="ml-1 rounded-full bg-white/8 px-3 py-1 text-ink-2 transition-colors hover:bg-white/14 hover:text-ink">
            Contracts
          </Link>
        </div>
      </div>

      <footer className="intro-rise flex justify-center gap-6 pb-7 text-[13px] text-ink-3" style={vars({ '--d': 1300, '--o': 6 })}>
        <Link href="/docs" onClick={skip} className="hover:text-ink-2">
          How it works
        </Link>
        <Link href="/contracts" onClick={skip} className="hover:text-ink-2">
          Contracts
        </Link>
        <Link href="/settings" onClick={skip} className="hover:text-ink-2">
          Settings
        </Link>
      </footer>
    </div>
  );
}
