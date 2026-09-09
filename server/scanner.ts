import { discoverPublicTraders } from './fomoWalletFinder.js';
import { scanNewLaunches, scanTrendingTokens } from './dexScreener.js';
import { getFomoAuthStatus } from './fomoClient.js';
import type { ScanResult } from './types.js';

export async function runScan(config: {
  fomoWalletFinderApi: string;
  dexScreenerApi: string;
  fomoAuthToken?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minTrades?: number;
  maxLaunchAgeHours?: number;
  minLaunchLiquidityUsd?: number;
}): Promise<ScanResult> {
  const warnings: string[] = [];
  const auth = await getFomoAuthStatus(config.fomoAuthToken).catch((error) => ({
    enabled: Boolean(config.fomoAuthToken),
    ok: false,
    message: error instanceof Error ? error.message : 'No se pudo validar Fomo API.'
  }));

  if (!auth.ok) warnings.push(auth.message);

  const [traders, tokens, launches] = await Promise.all([
    discoverPublicTraders({
      apiBase: config.fomoWalletFinderApi,
      minFollowers: config.minFollowers ?? 20,
      maxFollowers: config.maxFollowers ?? 80,
      minTrades: config.minTrades ?? 10,
      limit: 24
    }).catch((error) => {
      warnings.push(`No se pudo escanear traders publicos: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    scanTrendingTokens(config.dexScreenerApi).catch((error) => {
      warnings.push(`No se pudo escanear DexScreener: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    scanNewLaunches(config.dexScreenerApi, {
      maxAgeHours: config.maxLaunchAgeHours ?? 6,
      minLiquidityUsd: config.minLaunchLiquidityUsd ?? 2_500,
      limit: 30
    }).catch((error) => {
      warnings.push(`No se pudo escanear lanzamientos recientes: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    mode: auth.ok ? 'fomo-auth' : 'public',
    traders,
    tokens,
    launches,
    warnings
  };
}
