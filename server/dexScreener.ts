import type { TokenSignal } from './types.js';

type DexPair = {
  chainId?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
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

export async function scanTrendingTokens(apiBase: string, queries = ['solana', 'pump', 'bonk', 'meme']): Promise<TokenSignal[]> {
  const byAddress = new Map<string, TokenSignal>();

  for (const query of queries) {
    const response = await fetch(`${apiBase}/latest/dex/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) continue;
    const payload = await response.json() as { pairs?: DexPair[] };
    for (const pair of payload.pairs ?? []) {
      const address = pair.baseToken?.address;
      const chainId = pair.chainId;
      if (!address || !chainId) continue;
      const key = `${chainId}:${address}`;
      const scored = scoreToken(pair);
      const signal: TokenSignal = {
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
      const current = byAddress.get(key);
      if (!current || signal.score > current.score) byAddress.set(key, signal);
    }
  }

  return [...byAddress.values()]
    .filter((token) => token.score >= 35)
    .sort((a, b) => b.score - a.score || b.volume1h - a.volume1h)
    .slice(0, 30);
}
