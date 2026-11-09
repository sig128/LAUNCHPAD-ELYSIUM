/**
 * Pair assets a launch can trade against. The contracts accept native HYPE plus any ERC-20 the factory
 * owner allowlists; the pair is fixed for the life of a market. Stock tokens appear here only as
 * candidates until a verified Elysium address exists and the factory allows it.
 */
export type PairStatus = 'available' | 'not-on-elysium';

export interface PairAsset {
  id: string;
  symbol: string;
  name: string;
  kind: 'native' | 'stock';
  issuer?: string;
  address?: `0x${string}`;
  status: PairStatus;
  note: string;
}

const ONDO_NOTE =
  'Live on HyperEVM via Ondo. Pairing opens once it is bridged to Elysium, its address is verified and the factory allows it.';

export const PAIR_ASSETS: PairAsset[] = [
  { id: 'hype', symbol: 'HYPE', name: 'Native token', kind: 'native', status: 'available', note: 'Elysium’s native token. The default pair.' },
  { id: 'spy', symbol: 'SPY', name: 'S&P 500 ETF', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'qqq', symbol: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
];
