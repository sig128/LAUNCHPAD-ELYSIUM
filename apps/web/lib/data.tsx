'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getDemoDataset, type DemoDataset } from '@canopy/sdk';
import { MODE } from './config';

/**
 * Market data source. Demo mode reads deterministic fixtures. Local and live modes read the
 * indexer API; until that service exists the UI shows an explicit unavailable state.
 * A failed live connection never falls back to demo data.
 */
interface DataState {
  ds: DemoDataset | null;
  unavailableReason: string | null;
  asOf: number | null;
}

const DataContext = createContext<DataState>({ ds: null, unavailableReason: 'Loading', asOf: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const value = useMemo<DataState>(() => {
    if (MODE === 'demo') {
      const ds = getDemoDataset();
      return { ds, unavailableReason: null, asOf: ds.anchor };
    }
    return {
      ds: null,
      asOf: null,
      unavailableReason:
        MODE === 'local'
          ? 'The local indexer API is not wired into the web app yet. Contracts run locally, but discovery reads will come from apps/indexer in the next slice.'
          : 'Live Elysium data needs our deployed factory and the indexer. Neither exists yet, so there is nothing real to show.',
    };
  }, []);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

export function useToken(address: string) {
  const { ds } = useData();
  return ds?.byAddress.get(address.toLowerCase()) ?? null;
}
