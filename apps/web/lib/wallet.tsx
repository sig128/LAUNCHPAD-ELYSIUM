'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NETWORK, RPC_URL } from './config';

/** Injected wallets via EIP-6963 discovery, with window.ethereum as a fallback. Reads only. */
interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export interface WalletOption {
  id: string;
  name: string;
  icon?: string;
  provider: Eip1193;
}

type Status = 'disconnected' | 'connecting' | 'connected';

interface WalletState {
  options: WalletOption[];
  status: Status;
  address: `0x${string}` | null;
  chainId: number | null;
  walletName: string | null;
  error: string | null;
  wrongNetwork: boolean;
  connect: (opt: WalletOption) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  switchUnavailableReason: string | null;
}

const WalletContext = createContext<WalletState | null>(null);

function describeError(e: unknown): string {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return 'You rejected the request in your wallet. Nothing changed.';
  if (err?.code === -32002) return 'Your wallet already has a pending request. Open the wallet to finish it.';
  return err?.message ? `Wallet error: ${err.message}` : 'The wallet returned an unknown error.';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [status, setStatus] = useState<Status>('disconnected');
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<Eip1193 | null>(null);

  useEffect(() => {
    const found = new Map<string, WalletOption>();
    const onAnnounce = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { info: { uuid: string; name: string; icon?: string }; provider: Eip1193 };
      if (!d?.info?.uuid) return;
      found.set(d.info.uuid, { id: d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider });
      setOptions([...found.values()]);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const t = window.setTimeout(() => {
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
      if (found.size === 0 && eth) setOptions([{ id: 'injected', name: 'Browser wallet', provider: eth }]);
    }, 400);
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      window.clearTimeout(t);
    };
  }, []);

  const onAccounts = useCallback((...args: unknown[]) => {
    const accts = args[0] as string[];
    if (!accts?.length) {
      setStatus('disconnected');
      setAddress(null);
    } else setAddress(accts[0] as `0x${string}`);
  }, []);
  const onChain = useCallback((...args: unknown[]) => setChainId(Number.parseInt(String(args[0]), 16)), []);

  const connect = useCallback(
    async (opt: WalletOption) => {
      setError(null);
      setStatus('connecting');
      try {
        const accts = (await opt.provider.request({ method: 'eth_requestAccounts' })) as string[];
        const cid = (await opt.provider.request({ method: 'eth_chainId' })) as string;
        active.current = opt.provider;
        opt.provider.on?.('accountsChanged', onAccounts);
        opt.provider.on?.('chainChanged', onChain);
        setAddress((accts[0] ?? null) as `0x${string}` | null);
        setChainId(Number.parseInt(cid, 16));
        setWalletName(opt.name);
        setStatus(accts[0] ? 'connected' : 'disconnected');
      } catch (e) {
        setError(describeError(e));
        setStatus('disconnected');
      }
    },
    [onAccounts, onChain],
  );

  const disconnect = useCallback(() => {
    active.current?.removeListener?.('accountsChanged', onAccounts);
    active.current?.removeListener?.('chainChanged', onChain);
    active.current = null;
    setStatus('disconnected');
    setAddress(null);
    setChainId(null);
    setWalletName(null);
  }, [onAccounts, onChain]);

  const switchUnavailableReason = RPC_URL
    ? null
    : `Switching needs an RPC endpoint for ${NETWORK.name}. Set ${NETWORK.rpcEnvVar} to enable it.`;

  const switchNetwork = useCallback(async () => {
    const p = active.current;
    if (!p) return;
    setError(null);
    const hex = `0x${NETWORK.chainId.toString(16)}`;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 4902 && RPC_URL) {
        try {
          await p.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hex,
                chainName: NETWORK.name,
                nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
                rpcUrls: [RPC_URL],
              },
            ],
          });
        } catch (e2) {
          setError(describeError(e2));
        }
      } else setError(describeError(e));
    }
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      options,
      status,
      address,
      chainId,
      walletName,
      error,
      wrongNetwork: status === 'connected' && chainId !== null && chainId !== NETWORK.chainId,
      connect,
      disconnect,
      switchNetwork,
      switchUnavailableReason,
    }),
    [options, status, address, chainId, walletName, error, connect, disconnect, switchNetwork, switchUnavailableReason],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}
