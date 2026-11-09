'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MEDIA } from '@/lib/config';
import { useSettings } from '@/lib/settings';
import { IconPause, IconPlay } from '@/components/ui/Icons';

/**
 * Fixed full-viewport jungle layer: muted, looping, playsInline video over an emerald gradient.
 * The gradient is always underneath, so missing media never shows a broken asset.
 * Video is skipped for reduced motion, data saver, or small screens unless enabled in settings,
 * and pauses whenever the document is hidden.
 */
interface BgState {
  allowed: boolean;
  blockedReason: string | null;
  failed: boolean;
  mobile: boolean;
  setFailed: (f: boolean) => void;
}

const BgContext = createContext<BgState>({ allowed: false, blockedReason: null, failed: false, mobile: false, setFailed: () => undefined });

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { settings, ready } = useSettings();
  const [failed, setFailed] = useState(false);
  const [env, setEnv] = useState({ reduced: false, saveData: false, mobile: false, known: false });

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 639px)');
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const read = () => setEnv({ reduced: reduced.matches, saveData: Boolean(conn?.saveData), mobile: mobile.matches, known: true });
    read();
    reduced.addEventListener('change', read);
    mobile.addEventListener('change', read);
    return () => {
      reduced.removeEventListener('change', read);
      mobile.removeEventListener('change', read);
    };
  }, []);

  const blockedReason = env.reduced
    ? 'your reduced-motion setting'
    : env.saveData
      ? 'data saver'
      : env.mobile && !settings.videoOnMobile
        ? 'small screens (turn it on in Settings)'
        : null;
  const allowed = ready && env.known && !failed && blockedReason === null;
  return <BgContext.Provider value={{ allowed, blockedReason, failed, mobile: env.mobile, setFailed }}>{children}</BgContext.Provider>;
}

export function JungleBackground() {
  const { settings } = useSettings();
  const { allowed, setFailed, mobile } = useContext(BgContext);
  const video = useRef<HTMLVideoElement>(null);
  const playing = allowed && settings.videoEnabled;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const wanted = settings.playbackRate ?? MEDIA.playbackRate;
    const rate = Number.isFinite(wanted) && wanted > 0 ? Math.min(2, Math.max(0.25, wanted)) : 1;
    v.playbackRate = rate;
    v.defaultPlaybackRate = rate;
  }, [settings.playbackRate, playing]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing && document.visibilityState === 'visible') void v.play().catch(() => undefined);
    else v.pause();
    const onVis = () => {
      if (document.visibilityState === 'hidden') v.pause();
      else if (playing) void v.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-forest">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 80% at 18% 8%, #1b5a3e 0%, transparent 58%), radial-gradient(90% 70% at 88% 28%, #134631 0%, transparent 55%), radial-gradient(120% 90% at 50% 115%, #0d3524 0%, transparent 62%), #06110d',
        }}
      />
      <div className="bg-video absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${MEDIA.poster})` }} />
      {allowed ? (
        <video
          key={mobile ? 'mobile' : 'desktop'}
          ref={video}
          className="bg-video absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay={settings.videoEnabled}
          preload="auto"
          poster={MEDIA.poster}
          disablePictureInPicture
          onError={() => setFailed(true)}
        >
          {mobile ? <source src={MEDIA.mobileMp4} type="video/mp4" /> : <source src={MEDIA.webm} type="video/webm" />}
          <source src={MEDIA.mp4} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      ) : null}
      {/* Dark emerald scrim: light on the intro so the footage leads, deeper once the workspace is up. */}
      <div className="absolute inset-0" style={{ background: 'rgb(4 16 11 / 0.14)' }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 130% 100% at 50% 42%, transparent 48%, rgb(2 9 6 / 0.42) 100%)' }}
      />
      <div
        className="bg-dim absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgb(3 11 8 / 0.42), transparent 24%, transparent 78%, rgb(3 11 8 / 0.38)), rgb(4 16 11 / 0.18)',
        }}
      />
      <div
        className="bg-glow absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 44% 38% at 50% 52%, rgb(2 10 7 / 0.5), transparent 72%), linear-gradient(to bottom, rgb(3 11 8 / 0.32), transparent 18%)',
        }}
      />
    </div>
  );
}

export function BackgroundToggle() {
  const { settings, update } = useSettings();
  const { allowed, blockedReason, failed } = useContext(BgContext);
  const label = !allowed
    ? failed
      ? 'Background video unavailable: media did not load'
      : `Background video is off for ${blockedReason ?? 'now'}`
    : settings.videoEnabled
      ? 'Pause background video'
      : 'Play background video';
  return (
    <button
      type="button"
      onClick={() => update({ videoEnabled: !settings.videoEnabled })}
      disabled={!allowed}
      className={`btn btn-quiet h-10 w-10 shrink-0 p-0 ${allowed ? '' : 'hidden sm:inline-flex'}`}
      aria-label={label}
      aria-pressed={allowed ? !settings.videoEnabled : undefined}
      title={label}
    >
      {allowed && settings.videoEnabled ? <IconPause size={17} /> : <IconPlay size={17} />}
    </button>
  );
}
