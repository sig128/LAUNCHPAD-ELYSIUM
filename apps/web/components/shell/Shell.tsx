'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { SettingsProvider } from '@/lib/settings';
import { DataProvider } from '@/lib/data';
import { WalletProvider } from '@/lib/wallet';
import { HealthProvider } from '@/lib/health';
import { BackgroundProvider, JungleBackground } from './JungleBackground';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { SearchPalette } from './SearchPalette';
import { IntroOverlay, markEntered, readStage, type Stage } from './Intro';

const SearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => undefined });
export const useSearch = () => useContext(SearchContext);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [stage, setStageState] = useState<Stage>('app');

  const setStage = useCallback((s: Stage) => {
    document.documentElement.dataset.stage = s;
    setStageState(s);
  }, []);

  useEffect(() => setStageState(readStage()), []);

  // Leaving "/" (search result, link) always lands in the workspace.
  useEffect(() => {
    if (pathname !== '/' && readStage() !== 'app') {
      markEntered();
      setStage('app');
    }
  }, [pathname, setStage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const introUp = stage === 'intro' || stage === 'leaving';

  return (
    <SettingsProvider>
      <HealthProvider>
        <DataProvider>
          <WalletProvider>
            <SearchContext.Provider value={{ openSearch: () => setSearchOpen(true) }}>
              <BackgroundProvider>
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-lime focus:px-4 focus:py-2 focus:text-on-lime"
                >
                  Skip to content
                </a>
                <JungleBackground />
                {pathname === '/' ? <IntroOverlay stage={stage} setStage={setStage} /> : null}
                <div inert={introUp}>
                  <Header />
                  <main
                    id="main"
                    tabIndex={-1}
                    className="relative mx-auto w-full max-w-[1640px] px-3 pb-32 pt-4 outline-none sm:px-4 md:pb-20 lg:px-5"
                  >
                    {children}
                  </main>
                  <BottomNav />
                </div>
              </BackgroundProvider>
              <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
            </SearchContext.Provider>
          </WalletProvider>
        </DataProvider>
      </HealthProvider>
    </SettingsProvider>
  );
}
