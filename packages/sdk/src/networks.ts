export type Address = `0x${string}`;

/**
 * candidate      – value taken from a brief or third-party page, not yet matched to an official registry
 * published      – listed in the publisher's official registry or docs; code and interfaces not yet checked over RPC
 * rpc-verified   – chainId, runtime bytecode and interfaces checked against a live RPC by the startup check
 * own-verified   – our own deployment, created by our scripts, with receipt and code hash recorded in a manifest
 */
export type RegistryStatus = 'candidate' | 'published' | 'rpc-verified' | 'own-verified';

export interface RegistryEntry {
  name: string;
  address: Address;
  status: RegistryStatus;
  sourceUrl: string;
  checkedAt: string;
  note?: string;
  deploymentTx?: string;
  block?: number;
  runtimeCodeHash?: string;
  abiVersion?: string;
}

export interface NetworkConfig {
  key: 'elysium' | 'elysium-testnet' | 'local';
  chainId: number;
  chainIdStatus: RegistryStatus;
  name: string;
  nativeSymbol: 'HYPE';
  nativeDecimals: 18;
  rpcEnvVar: string;
  wsEnvVar?: string;
  rpcTemplate?: string;
  publicRpc?: string;
  explorer?: {
    baseUrl: string;
    /** Path patterns are only set once confirmed from official docs. Links are not built without them. */
    txPath?: string;
    addressPath?: string;
    status: 'base-url-documented' | 'patterns-verified';
    sourceUrl: string;
  };
  docsUrl: string;
  notes: string[];
  infrastructure: RegistryEntry[];
  wrappedNative?: RegistryEntry;
  /** Our contracts. Empty until deployment scripts write a manifest with real receipts. */
  own: RegistryEntry[];
}

const UNISWAP_DEPLOYMENTS = 'https://developers.uniswap.org/docs/protocols/v4/deployments';
const CHECKED = '2026-11-09';

const uni = (name: string, address: Address): RegistryEntry => ({
  name,
  address,
  status: 'published',
  sourceUrl: UNISWAP_DEPLOYMENTS,
  checkedAt: CHECKED,
});

export const ELYSIUM: NetworkConfig = {
  key: 'elysium',
  chainId: 99901,
  chainIdStatus: 'published',
  name: 'Kinetiq Elysium',
  nativeSymbol: 'HYPE',
  nativeDecimals: 18,
  rpcEnvVar: 'NEXT_PUBLIC_ELYSIUM_RPC_URL',
  wsEnvVar: 'NEXT_PUBLIC_ELYSIUM_WS_URL',
  rpcTemplate: 'https://elysium-mainnet.g.alchemy.com/v2/<api-key>',
  explorer: {
    baseUrl: 'https://elysium.kinetiq.xyz/explorer',
    status: 'base-url-documented',
    sourceUrl: 'https://elysium.kinetiq.xyz/docs',
  },
  docsUrl: 'https://elysium.kinetiq.xyz/docs',
  notes: [
    'Mainnet is reported live by the project owner (2026-11-09). Chain ID 99901 comes from Uniswap\'s deployment registry and Chainstack. On the same day Kinetiq\'s connection page and Alchemy\'s FAQ still described mainnet as not launched and no public RPC was documented, so the app confirms the chain itself: on load it reads eth_chainId and checks for contract code at every infrastructure address through the configured RPC.',
    'Mainnet WHYPE is not yet published by Kinetiq (only a testnet address is). Pools use native HYPE as the quote currency, so WHYPE is not required for trading.',
    'Explorer transaction and address URL patterns are not documented yet, so the app shows hashes with copy actions instead of building links.',
  ],
  infrastructure: [
    uni('PoolManager', '0xE2e105d3F7209A9DA11f83cCf3E7398a753823F1'),
    uni('PositionManager', '0x1d1C51b9d07fD27d36412A2b66CC23D19Eb3E518'),
    uni('PositionDescriptor', '0x9f92C5297EB3b39E6804b5e03899bC66B6b77348'),
    uni('V4Quoter', '0x379F556c5a748BD7Cc9baF0F7A344094Ac1814f5'),
    uni('StateView', '0x27eD73aE0652fdCf71d6793412A7525f32bE9dfE'),
    uni('Universal Router 2.2.0', '0x1B341FDD55d56F8E08409A2C25DDFad93Eb03C1a'),
    uni('Permit2', '0x000000000022D473030F116dDEE9F6B43aC78BA3'),
  ],
  own: [],
};

export const ELYSIUM_TESTNET: NetworkConfig = {
  key: 'elysium-testnet',
  chainId: 99801,
  chainIdStatus: 'published',
  name: 'Kinetiq Elysium Testnet',
  nativeSymbol: 'HYPE',
  nativeDecimals: 18,
  rpcEnvVar: 'NEXT_PUBLIC_ELYSIUM_TESTNET_RPC_URL',
  rpcTemplate: 'https://elysium-testnet.g.alchemy.com/v2/<api-key>',
  publicRpc: 'https://testnet-rpc.elysium.kinetiq.xyz',
  explorer: {
    baseUrl: 'https://elysium.kinetiq.xyz/testnet-explorer',
    status: 'base-url-documented',
    sourceUrl: 'https://elysium.kinetiq.xyz/docs/connecting-to-elysium',
  },
  docsUrl: 'https://elysium.kinetiq.xyz/docs/connecting-to-elysium',
  notes: [
    'Uniswap does not list v4 deployments for the testnet. Testing there requires deploying v4-core ourselves and recording it as our own deployment.',
  ],
  infrastructure: [
    {
      name: 'Multicall3',
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      status: 'published',
      sourceUrl: 'https://elysium.kinetiq.xyz/docs/contract-addresses',
      checkedAt: CHECKED,
    },
  ],
  wrappedNative: {
    name: 'WHYPE (testnet)',
    address: '0xCD57F65c2B0e5881CFC2E609F7CD53b746E1F234',
    status: 'published',
    sourceUrl: 'https://elysium.kinetiq.xyz/docs/contract-addresses',
    checkedAt: CHECKED,
    note: 'Kinetiq warns that look-alike tokens exist. Testnet only.',
  },
  own: [],
};

export const LOCAL: NetworkConfig = {
  key: 'local',
  chainId: 31337,
  chainIdStatus: 'own-verified',
  name: 'Local Anvil',
  nativeSymbol: 'HYPE',
  nativeDecimals: 18,
  rpcEnvVar: 'NEXT_PUBLIC_LOCAL_RPC_URL',
  publicRpc: 'http://127.0.0.1:8545',
  docsUrl: 'docs/SETUP.md',
  notes: ['Addresses come only from packages/contracts/deployments/local.json written by the deploy script.'],
  infrastructure: [],
  own: [],
};

export const NETWORKS = { elysium: ELYSIUM, 'elysium-testnet': ELYSIUM_TESTNET, local: LOCAL } as const;
export type NetworkKey = keyof typeof NETWORKS;

export function explorerTxUrl(net: NetworkConfig, hash: string): string | null {
  if (!net.explorer || net.explorer.status !== 'patterns-verified' || !net.explorer.txPath) return null;
  return `${net.explorer.baseUrl}${net.explorer.txPath.replace('{hash}', hash)}`;
}

export function explorerAddressUrl(net: NetworkConfig, address: string): string | null {
  if (!net.explorer || net.explorer.status !== 'patterns-verified' || !net.explorer.addressPath) return null;
  return `${net.explorer.baseUrl}${net.explorer.addressPath.replace('{address}', address)}`;
}

export const STATUS_LABEL: Record<RegistryStatus, string> = {
  candidate: 'Candidate',
  published: 'Published, not RPC-checked',
  'rpc-verified': 'RPC-verified',
  'own-verified': 'Own deployment verified',
};
