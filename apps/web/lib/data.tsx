'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getDemoDataset, type DemoDataset } from '@canopy/sdk';
import { MODE, NETWORK } from './config';

/**
 * Market data source.
 * - demo: deterministic, labelled fixtures.
 * - live: the real state of CANOPY on the target network. Until our factory is deployed there are
 *   provably no CANOPY markets, so the dataset is empty and every count is a true zero.
 * - local: needs the local chain and indexer, which this build does not run yet.
 * A failed live connection never falls back to demo data.
 */
interface DataState {
  ds: DemoDataset | null;
  unavailableReason: string | null;
  asOf: number | null;
  live: boolean;
}

const DataContext = createContext<DataState>({ ds: null, unavailableReason: 'Loading', asOf: null, live: false });

export function DataProvider({ children }: { children: ReactNode }) {
  const value = useMemo<DataState>(() => {
    if (MODE === 'demo') {
      const ds = getDemoDataset();
      return { ds, unavailableReason: null, asOf: ds.anchor, live: false };
    }
    if (MODE === 'live' && NETWORK.own.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      return {
        ds: { anchor: now, tokens: [], byAddress: new Map(), demoWallet: '0x0000000000000000000000000000000000000000' },
        unavailableReason: null,
        asOf: now,
        live: true,
      };
    }
    return {
      ds: null,
      asOf: null,
      live: MODE === 'live',
      unavailableReason:
        MODE === 'local'
          ? 'Local mode needs the Anvil chain and indexer, which are not wired into this build yet.'
          : 'Market reads need the CANOPY indexer, which is not deployed yet.',
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
