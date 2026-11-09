/**
 * Pair assets a launch can trade against. Every launch pairs with the main coin, CANOPY, which itself
 * trades against native HYPE on Elysium and against SOL on Solana, joined by Wormhole. Traders can pay
 * with HYPE: the router goes HYPE -> CANOPY -> coin in one transaction. The contracts also accept any
 * ERC-20 the factory owner allowlists, so tokenized stocks stay listed as future pairs until a verified
 * Elysium address exists. The pair is fixed for the life of a market.
 */
export type PairStatus = 'available' | 'not-launched' | 'not-on-elysium';

export interface PairAsset {
  id: string;
  symbol: string;
  name: string;
  kind: 'main' | 'native' | 'stock';
  issuer?: string;
  address?: `0x${string}`;
  status: PairStatus;
  note: string;
}

const ONDO_NOTE =
  'Live on HyperEVM via Ondo. Pairing opens once it is bridged to Elysium, its address is verified and the factory allows it.';

export const PAIR_ASSETS: PairAsset[] = [
  {
    id: 'canopy',
    symbol: 'CANOPY',
    name: 'Main coin',
    kind: 'main',
    status: 'not-launched',
    note: 'Every launch pairs with CANOPY. Traders can still pay with HYPE: it is routed through CANOPY in the same transaction.',
  },
  { id: 'spy', symbol: 'SPY', name: 'S&P 500 ETF', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'qqq', symbol: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet', kind: 'stock', issuer: 'Ondo', status: 'not-on-elysium', note: ONDO_NOTE },
];

/** The pair every new launch uses. */
export const MAIN_PAIR = PAIR_ASSETS[0];
