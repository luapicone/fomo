export type Trader = {
  handle: string;
  displayName: string | null;
  followers: number;
  following: number | null;
  trades: number;
  tradesPerDayLifetime: number | null;
  totalVolume: number;
  createdAt: string | null;
  solanaWallet: string | null;
  evmWallet: string | null;
  score: number;
  status: 'candidate' | 'watch' | 'ignore';
  notes: string[];
};

export type TokenSignal = {
  chainId: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  url: string;
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume1h: number;
  volume24h: number;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  score: number;
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
};

export type LaunchSignal = TokenSignal & {
  pairAddress: string;
  dexId: string | null;
  pairCreatedAt: string | null;
  ageMinutes: number | null;
  volume5m: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  txns1h: number;
  buys1h: number;
  sells1h: number;
  launchStatus: 'fresh' | 'active' | 'extended' | 'unknown';
};

export type ScanResult = {
  generatedAt: string;
  mode: 'public' | 'fomo-auth';
  traders: Trader[];
  tokens: TokenSignal[];
  launches: LaunchSignal[];
  warnings: string[];
};
