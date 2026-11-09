import { NETWORKS, type NetworkKey } from '@canopy/sdk';

/** All editable product copy and brand values live here. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'CANOPY',
  tagline: 'Elysium launchpad',
};

export const COPY = {
  heroTitle: 'Find your next market.',
  heroSub: 'Launch, trade and earn on Elysium.',
  introSub: 'Launch, trade and earn on Elysium. Holders receive 60% of the trading fees each market collects.',
  demoNotice:
    'You are looking at demo data. Markets, trades, holders and fees are simulated from fixtures, and no transaction can be sent.',
};

/** Background media. Override with env vars; missing files fall back to an emerald gradient. */
export const MEDIA = {
  webm: process.env.NEXT_PUBLIC_BG_WEBM || '/media/jungle.webm',
  mp4: process.env.NEXT_PUBLIC_BG_MP4 || '/media/jungle.mp4',
  poster: process.env.NEXT_PUBLIC_BG_POSTER || '/media/jungle-poster.webp',
  /** Lighter 720p encode used on phones. */
  mobileMp4: process.env.NEXT_PUBLIC_BG_MOBILE_MP4 || '/media/jungle-mobile.mp4',
  /** The footage is already slowed to half speed; the owner asked for slower still, so 0.75x is the default. */
  playbackRate: Number(process.env.NEXT_PUBLIC_BG_PLAYBACK_RATE || '0.75'),
};

export type AppMode = 'demo' | 'local' | 'live';
const rawMode = process.env.NEXT_PUBLIC_CANOPY_MODE || 'demo';
export const MODE: AppMode = rawMode === 'local' || rawMode === 'live' ? rawMode : 'demo';

const rawNet = process.env.NEXT_PUBLIC_CANOPY_NETWORK || (MODE === 'local' ? 'local' : 'elysium');
export const NETWORK_KEY: NetworkKey = (rawNet in NETWORKS ? rawNet : 'elysium') as NetworkKey;
export const NETWORK = NETWORKS[NETWORK_KEY];

export const RPC_URL =
  NETWORK_KEY === 'elysium'
    ? process.env.NEXT_PUBLIC_ELYSIUM_RPC_URL || ''
    : NETWORK_KEY === 'elysium-testnet'
      ? process.env.NEXT_PUBLIC_ELYSIUM_TESTNET_RPC_URL || ''
      : process.env.NEXT_PUBLIC_LOCAL_RPC_URL || 'http://127.0.0.1:8545';

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

/** Why writes are off, in plain words. null means writes may proceed. */
export function writeBlockReason(): string | null {
  if (MODE === 'demo') return 'Demo mode uses simulated fixtures, so nothing can be signed or sent.';
  if (NETWORK.own.length === 0)
    return 'Our factory, hook and vault are not deployed on this network yet, so there is nothing to send transactions to.';
  if (!RPC_URL) return `No RPC endpoint is configured (${NETWORK.rpcEnvVar}).`;
  return null;
}
