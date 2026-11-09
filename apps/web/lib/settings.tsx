'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MEDIA } from './config';

export interface Settings {
  quickBuy: string[];
  slippageBps: number;
  videoEnabled: boolean;
  videoOnMobile: boolean;
  playbackRate: number;
  reducedTransparency: boolean;
  columns: Record<string, boolean>;
  watchlist: string[];
}

export const DEFAULT_COLUMNS: Record<string, boolean> = {
  fdv: true,
  volume: true,
  holders: true,
  depth: true,
  rewards: true,
  fee: false,
  age: true,
};

export const DEFAULT_SETTINGS: Settings = {
  quickBuy: ['1', '5', '10', '25'],
  slippageBps: 100,
  videoEnabled: true,
  videoOnMobile: true,
  playbackRate: Number.isFinite(MEDIA.playbackRate) && MEDIA.playbackRate > 0 ? MEDIA.playbackRate : 1,
  reducedTransparency: false,
  columns: DEFAULT_COLUMNS,
  watchlist: [],
};

const KEY = 'canopy:settings:v1';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  toggleWatch: (address: string) => void;
  ready: boolean;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed, columns: { ...DEFAULT_COLUMNS, ...(parsed.columns ?? {}) } });
      }
    } catch {
      /* storage unavailable: defaults apply */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.transparency = settings.reducedTransparency ? 'reduced' : 'normal';
  }, [settings.reducedTransparency]);

  const persist = useCallback((next: Settings) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      }),
    [persist],
  );

  const toggleWatch = useCallback(
    (address: string) =>
      setSettings((prev) => {
        const a = address.toLowerCase();
        const watchlist = prev.watchlist.includes(a) ? prev.watchlist.filter((x) => x !== a) : [...prev.watchlist, a];
        const next = { ...prev, watchlist };
        persist(next);
        return next;
      }),
    [persist],
  );

  const value = useMemo(() => ({ settings, update, toggleWatch, ready }), [settings, update, toggleWatch, ready]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}
