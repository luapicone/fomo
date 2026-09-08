import type { Trader } from './types.js';

const DEFAULT_TERMS = [
  'pnl', 'profit', 'gem', 'ape', 'pump', 'moon', 'sol', 'degen', 'alpha', 'sniper',
  'cash', 'bag', 'whale', 'frog', 'pepe', 'bonk', 'token', 'buy'
];

type SearchUser = {
  username: string;
  displayName?: string | null;
  followersCount?: number;
};

type FinderUser = {
  username?: string;
  displayName?: string | null;
  fomoCreatedAt?: string | null;
  wallets?: {
    solana?: { address?: string | null };
    evm?: { address?: string | null };
  };
  social?: {
    followers?: number;
    following?: number | null;
  };
  fomoStats?: {
    numTrades?: number;
    totalVolume?: string;
  };
};

async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function tradesPerDay(createdAt: string | null | undefined, trades: number): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const days = Math.max((Date.now() - created) / 86_400_000, 1);
  return Math.round((trades / days) * 100) / 100;
}

function scoreTrader(trader: Omit<Trader, 'score' | 'status' | 'notes'>): Pick<Trader, 'score' | 'status' | 'notes'> {
  const notes: string[] = [];
  let score = 0;

  if (trader.followers >= 20 && trader.followers <= 80) {
    score += 25;
    notes.push('Followers dentro del rango 20-80');
  }
  if (trader.trades >= 100) {
    score += 30;
    notes.push('Muestra de trades suficiente');
  } else if (trader.trades >= 50) {
    score += 18;
    notes.push('Actividad aceptable, revisar consistencia');
  } else if (trader.trades > 0) {
    score += 6;
    notes.push('Pocos trades: muestra chica');
  }
  if (trader.tradesPerDayLifetime !== null) {
    if (trader.tradesPerDayLifetime >= 0.5 && trader.tradesPerDayLifetime <= 8) {
      score += 20;
      notes.push('Ritmo de trading razonable');
    } else if (trader.tradesPerDayLifetime > 8) {
      score -= 10;
      notes.push('Ritmo alto: riesgo de sobreoperar');
    }
  }
  if (trader.totalVolume > 10_000) {
    score += 15;
    notes.push('Volumen visible en índice externo');
  }
  if (trader.solanaWallet || trader.evmWallet) {
    score += 10;
    notes.push('Wallet verificable on-chain');
  } else {
    notes.push('Sin wallet verificada en el índice externo');
  }

  const status = score >= 70 ? 'watch' : score >= 45 ? 'candidate' : 'ignore';
  return { score, status, notes };
}

export async function discoverPublicTraders(options: {
  apiBase: string;
  minFollowers: number;
  maxFollowers: number;
  minTrades: number;
  limit: number;
  terms?: string[];
}): Promise<Trader[]> {
  const terms = options.terms?.length ? options.terms : DEFAULT_TERMS;
  const found = new Map<string, SearchUser>();

  await Promise.all(terms.map(async (term) => {
    if (term.length < 3) return;
    const url = `${options.apiBase}/search?q=${encodeURIComponent(term)}&limit=10`;
    const payload = await fetchJson<{ results?: SearchUser[] }>(url);
    for (const user of payload?.results ?? []) {
      const followers = user.followersCount;
      if (typeof followers === 'number' && followers >= options.minFollowers && followers <= options.maxFollowers) {
        found.set(user.username.toLowerCase(), user);
      }
    }
  }));

  const details = await Promise.all([...found.values()].slice(0, options.limit * 3).map(async (user) => {
    const url = `${options.apiBase}/get-user/${encodeURIComponent(user.username.toLowerCase())}`;
    const payload = await fetchJson<{ user?: FinderUser }>(url);
    return payload?.user ? { user, details: payload.user } : null;
  }));

  const traders: Trader[] = [];
  for (const result of details) {
    if (!result) continue;
    const { user, details } = result;

    const trades = numberFrom(details.fomoStats?.numTrades);
    if (trades < options.minTrades) continue;

    const base = {
      handle: details.username ?? user.username,
      displayName: details.displayName ?? null,
      followers: numberFrom(details.social?.followers ?? user.followersCount),
      following: details.social?.following ?? null,
      trades,
      tradesPerDayLifetime: tradesPerDay(details.fomoCreatedAt, trades),
      totalVolume: numberFrom(details.fomoStats?.totalVolume),
      createdAt: details.fomoCreatedAt ?? null,
      solanaWallet: details.wallets?.solana?.address ?? null,
      evmWallet: details.wallets?.evm?.address ?? null
    };
    traders.push({ ...base, ...scoreTrader(base) });
  }

  return traders
    .sort((a, b) => b.score - a.score || b.trades - a.trades || a.followers - b.followers)
    .slice(0, options.limit);
}
