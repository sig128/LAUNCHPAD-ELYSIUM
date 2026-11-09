'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPublicClient, http } from 'viem';
import { MODE, NETWORK, RPC_URL } from './config';

/**
 * Startup checks against the configured RPC: eth_chainId must match the target network, and every
 * infrastructure address must hold contract code. Bytecode alone does not prove authenticity, so
 * entries become "code present on chain", never "audited" or "trusted". Re-runs every 30 seconds.
 * Never falls back to another chain.
 */
export type HealthState = 'demo' | 'no-rpc' | 'checking' | 'ok' | 'wrong-chain' | 'unreachable';

export interface Health {
  state: HealthState;
  chainId?: number;
  block?: bigint;
  checkedAt?: number;
  code: Record<string, 'present' | 'missing' | 'unknown'>;
  error?: string;
}

const HealthContext = createContext<Health>({ state: 'checking', code: {} });

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health>(() =>
    MODE === 'demo' ? { state: 'demo', code: {} } : RPC_URL ? { state: 'checking', code: {} } : { state: 'no-rpc', code: {} },
  );

  useEffect(() => {
    if (MODE === 'demo' || !RPC_URL) return;
    const client = createPublicClient({ transport: http(RPC_URL, { timeout: 8_000, retryCount: 1 }) });
    let stopped = false;
    const run = async () => {
      try {
        const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
        if (stopped) return;
        if (chainId !== NETWORK.chainId) {
          setHealth({ state: 'wrong-chain', chainId, block, checkedAt: Date.now(), code: {} });
          return;
        }
        const entries = await Promise.all(
          NETWORK.infrastructure.map(async (e) => {
            try {
              const code = await client.getCode({ address: e.address });
              return [e.address, code && code !== '0x' ? 'present' : 'missing'] as const;
            } catch {
              return [e.address, 'unknown'] as const;
            }
          }),
        );
        if (!stopped) setHealth({ state: 'ok', chainId, block, checkedAt: Date.now(), code: Object.fromEntries(entries) });
      } catch (err) {
        if (!stopped)
          setHealth((h) => ({ ...h, state: 'unreachable', error: err instanceof Error ? err.message.split('\n')[0] : 'RPC request failed' }));
      }
    };
    void run();
    const id = window.setInterval(run, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  return <HealthContext.Provider value={health}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  return useContext(HealthContext);
}

export function healthLabel(h: Health): { text: string; tone: 'up' | 'warn' | 'down' | 'neutral'; detail: string } {
  switch (h.state) {
    case 'demo':
      return { text: 'Demo data', tone: 'warn', detail: 'Simulated fixtures. No network is contacted.' };
    case 'no-rpc':
      return { text: 'RPC not set', tone: 'warn', detail: `Set ${NETWORK.rpcEnvVar} to connect to ${NETWORK.name}.` };
    case 'checking':
      return { text: 'Connecting', tone: 'neutral', detail: `Checking ${NETWORK.name}…` };
    case 'ok':
      return {
        text: 'Mainnet live',
        tone: 'up',
        detail: `Chain ${h.chainId} confirmed over RPC, block ${h.block?.toLocaleString('en-US')}.`,
      };
    case 'wrong-chain':
      return { text: 'Wrong chain', tone: 'down', detail: `The RPC reports chain ${h.chainId}, not ${NETWORK.chainId}. Nothing will be sent.` };
    case 'unreachable':
      return { text: 'RPC unreachable', tone: 'down', detail: h.error ?? 'The RPC did not respond.' };
  }
}
