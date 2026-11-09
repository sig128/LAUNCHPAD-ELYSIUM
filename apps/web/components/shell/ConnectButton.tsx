'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { shortAddr } from '@canopy/sdk';
import { MODE, NETWORK, WALLETCONNECT_PROJECT_ID } from '@/lib/config';
import { useWallet } from '@/lib/wallet';
import { IconClose, IconWallet } from '@/components/ui/Icons';

export function ConnectButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const connected = w.status === 'connected' && w.address;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={`btn ${connected ? 'btn-glass' : 'btn-primary'} h-10 px-3 sm:px-4`}>
          <IconWallet size={16} />
          {connected ? (
            <span className="num font-mono text-[13px]">
              {shortAddr(w.address!, 5, 4)}
              {w.wrongNetwork ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-warn align-middle" aria-label="wrong network" /> : null}
            </span>
          ) : (
            <span className="hidden sm:inline">{w.status === 'connecting' ? 'Connecting' : 'Connect wallet'}</span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-black/55" />
        <Dialog.Content className="panel panel-dense anim-sheet fixed inset-x-3 bottom-3 z-50 max-h-[85dvh] overflow-y-auto p-5 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-24 sm:w-[440px] sm:-translate-x-1/2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[18px] font-semibold">{connected ? 'Wallet' : 'Connect a wallet'}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13.5px] text-ink-2">
                {MODE === 'demo'
                  ? 'Demo mode: your wallet can connect, but balances and positions shown are the demo wallet’s, and nothing can be signed.'
                  : `Connect an EVM wallet on ${NETWORK.name} (chain ${NETWORK.chainId}).`}
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-quiet h-9 w-9 p-0" aria-label="Close">
              <IconClose size={16} />
            </Dialog.Close>
          </div>

          {connected ? (
            <div className="mt-5 space-y-3">
              <div className="inset p-3.5">
                <div className="text-[12.5px] text-ink-3">{w.walletName}</div>
                <div className="mt-1 break-all font-mono text-[13px]">{w.address}</div>
                <div className="mt-2 text-[13px] text-ink-2">
                  Wallet chain {w.chainId ?? 'unknown'}; this app targets {NETWORK.chainId}.
                </div>
              </div>
              {w.wrongNetwork ? (
                <div className="rounded-2xl border border-warn/30 bg-warn/10 p-3.5 text-[13.5px] text-warn">
                  Your wallet is on another network. Transactions are never sent on the wrong chain.
                  <button type="button" className="btn btn-glass mt-3 w-full" onClick={() => void w.switchNetwork()}>
                    Switch to {NETWORK.name}
                  </button>
                  {w.switchUnavailableReason ? <p className="mt-2 text-[12.5px] text-ink-2">{w.switchUnavailableReason}</p> : null}
                </div>
              ) : null}
              <button type="button" className="btn btn-glass w-full" onClick={() => w.disconnect()}>
                Disconnect
              </button>
            </div>
          ) : (
            <ul className="mt-5 space-y-2">
              {w.options.length === 0 ? (
                <li className="inset p-3.5 text-[13.5px] text-ink-2">
                  No browser wallet found. Install an EVM wallet extension, then reload this page.
                </li>
              ) : (
                w.options.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="btn btn-glass h-12 w-full justify-start"
                      onClick={async () => {
                        await w.connect(o);
                      }}
                    >
                      {o.icon ? <img src={o.icon} alt="" width={22} height={22} className="rounded-md" /> : <IconWallet size={18} />}
                      {o.name}
                    </button>
                  </li>
                ))
              )}
              <li>
                <button type="button" className="btn btn-glass h-12 w-full justify-start" disabled={!WALLETCONNECT_PROJECT_ID}>
                  WalletConnect
                </button>
                {!WALLETCONNECT_PROJECT_ID ? (
                  <p className="mt-1.5 px-1 text-[12.5px] text-ink-3">
                    Unavailable: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set.
                  </p>
                ) : null}
              </li>
            </ul>
          )}
          {w.error ? (
            <p className="mt-3 text-[13.5px] text-down" role="alert">
              {w.error}
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
