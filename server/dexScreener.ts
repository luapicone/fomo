import type { LaunchSignal, TokenSignal } from './types.js';

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
  };
  pairCreatedAt?: number;
};

type TokenProfile = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  description?: string;
  links?: Array<{ label?: string; type?: string; url?: string }>;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function scoreToken(pair: DexPair): Pick<TokenSignal, 'score' | 'risk' | 'reasons'> {
  const reasons: string[] = [];
  let score = 0;
  const liquidity = asNumber(pair.liquidity?.usd) ?? 0;
  const volume1h = asNumber(pair.volume?.h1) ?? 0;
  const volume24h = asNumber(pair.volume?.h24) ?? 0;
  const marketCap = asNumber(pair.marketCap ?? pair.fdv) ?? 0;
  const change5m = asNumber(pair.priceChange?.m5) ?? 0;
  const change1h = asNumber(pair.priceChange?.h1) ?? 0;

  if (liquidity >= 50_000) {
    score += 25;
    reasons.push('Liquidez suficiente para entrar/salir');
  } else if (liquidity >= 15_000) {
    score += 12;
    reasons.push('Liquidez media');
  } else {
    score -= 20;
    reasons.push('Liquidez baja');
  }

  if (volume1h >= 100_000 || volume24h >= 750_000) {
    score += 25;
    reasons.push('Volumen fuerte');
  } else if (volume1h >= 20_000 || volume24h >= 150_000) {
    score += 14;
    reasons.push('Volumen creciendo');
  }

  if (change1h > 5 && change1h < 80) {
    score += 20;
    reasons.push('Momentum 1h positivo sin vela extrema');
  } else if (change1h >= 80) {
    score -= 12;
    reasons.push('Movimiento vertical: esperar pullback');
  }

  if (change5m > 0 && change5m < 25) {
    score += 10;
    reasons.push('Impulso corto controlado');
  } else if (change5m >= 25) {
    score -= 8;
    reasons.push('5m demasiado extendido');
  }

  if (marketCap > 0 && marketCap <= 5_000_000) {
    score += 15;
    reasons.push('Market cap temprano');
  } else if (marketCap > 25_000_000) {
    score -= 8;
    reasons.push('Market cap ya elevado');
  }

  const risk = liquidity < 15_000 || change5m >= 40 ? 'high' : liquidity < 50_000 || change1h >= 80 ? 'medium' : 'low';
  return { score: Math.max(0, Math.min(100, score)), risk, reasons };
}

function buildTokenSignal(pair: DexPair): TokenSignal | null {
  const address = pair.baseToken?.address;
  const chainId = pair.chainId;
  if (!address || !chainId) return null;
  const scored = scoreToken(pair);
  return {
    chainId,
    tokenAddress: address,
    symbol: pair.baseToken?.symbol ?? 'UNKNOWN',
    name: pair.baseToken?.name ?? 'Unknown token',
    url: pair.url ?? '',
    priceUsd: asNumber(pair.priceUsd),
    marketCap: asNumber(pair.marketCap ?? pair.fdv),
    liquidityUsd: asNumber(pair.liquidity?.usd),
    volume1h: asNumber(pair.volume?.h1) ?? 0,
    volume24h: asNumber(pair.volume?.h24) ?? 0,
    priceChange5m: asNumber(pair.priceChange?.m5),
    priceChange1h: asNumber(pair.priceChange?.h1),
    priceChange24h: asNumber(pair.priceChange?.h24),
    ...scored
  };
}

export async function scanTrendingTokens(apiBase: string, queries = ['solana', 'pump', 'bonk', 'meme']): Promise<TokenSignal[]> {
  const byAddress = new Map<string, TokenSignal>();

  for (const query of queries) {
    const response = await fetch(`${apiBase}/latest/dex/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) continue;
    const payload = await response.json() as { pairs?: DexPair[] };
    for (const pair of payload.pairs ?? []) {
      const signal = buildTokenSignal(pair);
      if (!signal) continue;
      const key = `${signal.chainId}:${signal.tokenAddress}`;
      const current = byAddress.get(key);
      if (!current || signal.score > current.score) byAddress.set(key, signal);
    }
  }

  return [...byAddress.values()]
    .filter((token) => token.score >= 35)
    .sort((a, b) => b.score - a.score || b.volume1h - a.volume1h)
    .slice(0, 30);
}

function scoreLaunch(pair: DexPair, ageMinutes: number | null): Pick<LaunchSignal, 'score' | 'risk' | 'reasons' | 'launchStatus'> {
  const reasons: string[] = [];
  let score = 0;
  const liquidity = asNumber(pair.liquidity?.usd) ?? 0;
  const volume5m = asNumber(pair.volume?.m5) ?? 0;
  const volume1h = asNumber(pair.volume?.h1) ?? 0;
  const marketCap = asNumber(pair.marketCap ?? pair.fdv) ?? 0;
  const buys5m = asNumber(pair.txns?.m5?.buys) ?? 0;
  const sells5m = asNumber(pair.txns?.m5?.sells) ?? 0;
  const buys1h = asNumber(pair.txns?.h1?.buys) ?? 0;
  const sells1h = asNumber(pair.txns?.h1?.sells) ?? 0;
  const change5m = asNumber(pair.priceChange?.m5) ?? 0;

  let launchStatus: LaunchSignal['launchStatus'] = 'unknown';
  if (ageMinutes !== null && ageMinutes <= 60) {
    score += 28;
    launchStatus = 'fresh';
    reasons.push('Par creado hace menos de 1h');
  } else if (ageMinutes !== null && ageMinutes <= 6 * 60) {
    score += 20;
    launchStatus = 'active';
    reasons.push('Lanzamiento reciente con datos iniciales');
  } else if (ageMinutes !== null) {
    score += 8;
    launchStatus = 'extended';
    reasons.push('Todavia dentro de ventana reciente');
  }

  if (liquidity >= 25_000) {
    score += 24;
    reasons.push('Liquidez fuerte para lanzamiento');
  } else if (liquidity >= 5_000) {
    score += 14;
    reasons.push('Liquidez inicial usable');
  } else {
    score -= 18;
    reasons.push('Liquidez muy baja');
  }

  if (volume5m >= 10_000 || volume1h >= 50_000) {
    score += 20;
    reasons.push('Volumen temprano alto');
  } else if (volume5m >= 2_000 || volume1h >= 10_000) {
    score += 12;
    reasons.push('Volumen temprano creciendo');
  }

  if (buys5m + buys1h >= sells5m + sells1h && buys1h >= 20) {
    score += 14;
    reasons.push('Compras superan o igualan ventas');
  }

  if (marketCap > 0 && marketCap <= 1_500_000) {
    score += 12;
    reasons.push('Market cap temprano');
  } else if (marketCap > 10_000_000) {
    score -= 10;
    reasons.push('Market cap ya extendido');
  }

  if (change5m > 40) {
    score -= 12;
    reasons.push('Vela 5m muy extendida');
  }

  const risk = liquidity < 5_000 || buys1h + sells1h < 10 ? 'high' : liquidity < 25_000 || change5m > 40 ? 'medium' : 'low';
  return { score: Math.max(0, Math.min(100, score)), risk, reasons, launchStatus };
}

async function fetchPairsForProfiles(apiBase: string, profiles: TokenProfile[]): Promise<DexPair[]> {
  const byChain = new Map<string, string[]>();
  for (const profile of profiles) {
    if (!profile.chainId || !profile.tokenAddress) continue;
    const addresses = byChain.get(profile.chainId) ?? [];
    if (!addresses.includes(profile.tokenAddress)) addresses.push(profile.tokenAddress);
    byChain.set(profile.chainId, addresses);
  }

  const pairs: DexPair[] = [];
  for (const [chainId, addresses] of byChain) {
    for (let index = 0; index < addresses.length; index += 30) {
      const chunk = addresses.slice(index, index + 30);
      const response = await fetch(`${apiBase}/tokens/v1/${encodeURIComponent(chainId)}/${chunk.join(',')}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) continue;
      const payload = await response.json() as DexPair[];
      pairs.push(...payload);
    }
  }
  return pairs;
}

function isFomoLaunchProfile(profile: TokenProfile): boolean {
  const text = [
    profile.chainId,
    profile.url,
    profile.description,
    ...(profile.links ?? []).flatMap((link) => [link.label, link.type, link.url])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('fomo') ||
    text.includes('longtraders') ||
    text.includes('long your favorite traders') ||
    text.includes('fomo leaderboard')
  );
}

export async function scanNewLaunches(apiBase: string, options: {
  maxAgeHours?: number;
  minLiquidityUsd?: number;
  fomoOnly?: boolean;
  limit?: number;
} = {}): Promise<LaunchSignal[]> {
  const maxAgeMs = (options.maxAgeHours ?? 6) * 60 * 60 * 1000;
  const minLiquidityUsd = options.minLiquidityUsd ?? 2_500;
  const limit = options.limit ?? 30;
  const fomoOnly = options.fomoOnly ?? true;

  const profileResponse = await fetch(`${apiBase}/token-profiles/latest/v1`, {
    headers: { Accept: 'application/json' }
  });
  if (!profileResponse.ok) return [];

  const profiles = await profileResponse.json() as TokenProfile[];
  const selectedProfiles = fomoOnly ? profiles.filter(isFomoLaunchProfile) : profiles;
  const pairs = await fetchPairsForProfiles(apiBase, selectedProfiles.slice(0, 90));
  const now = Date.now();
  const bestByToken = new Map<string, LaunchSignal>();

  for (const pair of pairs) {
    const base = buildTokenSignal(pair);
    if (!base || !pair.pairAddress) continue;
    const createdAtMs = asNumber(pair.pairCreatedAt);
    const ageMinutes = createdAtMs ? Math.max(0, Math.round((now - createdAtMs) / 60_000)) : null;
    if (ageMinutes !== null && ageMinutes * 60_000 > maxAgeMs) continue;
    if ((base.liquidityUsd ?? 0) < minLiquidityUsd) continue;

    const launchScore = scoreLaunch(pair, ageMinutes);
    const signal: LaunchSignal = {
      ...base,
      ...launchScore,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId ?? null,
      pairCreatedAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
      ageMinutes,
      volume5m: asNumber(pair.volume?.m5) ?? 0,
      txns5m: (asNumber(pair.txns?.m5?.buys) ?? 0) + (asNumber(pair.txns?.m5?.sells) ?? 0),
      buys5m: asNumber(pair.txns?.m5?.buys) ?? 0,
      sells5m: asNumber(pair.txns?.m5?.sells) ?? 0,
      txns1h: (asNumber(pair.txns?.h1?.buys) ?? 0) + (asNumber(pair.txns?.h1?.sells) ?? 0),
      buys1h: asNumber(pair.txns?.h1?.buys) ?? 0,
      sells1h: asNumber(pair.txns?.h1?.sells) ?? 0
    };

    const key = `${signal.chainId}:${signal.tokenAddress}`;
    const current = bestByToken.get(key);
    if (!current || signal.score > current.score) bestByToken.set(key, signal);
  }

  return [...bestByToken.values()]
    .sort((a, b) => b.score - a.score || (a.ageMinutes ?? Number.MAX_SAFE_INTEGER) - (b.ageMinutes ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit);
}
