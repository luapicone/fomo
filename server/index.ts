import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runScan } from './scanner.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

const config = {
  fomoWalletFinderApi: process.env.FOMO_WALLET_FINDER_API ?? 'https://api-production-9541.up.railway.app',
  dexScreenerApi: process.env.DEXSCREENER_API ?? 'https://api.dexscreener.com',
  fomoAuthToken: process.env.FOMO_AUTH_TOKEN || undefined
};

let cache: { expiresAt: number; data: Awaited<ReturnType<typeof runScan>> } | null = null;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: config.fomoAuthToken ? 'fomo-auth-configured' : 'public' });
});

app.get('/api/scan', async (req, res) => {
  const refresh = req.query.refresh === '1';
  if (!refresh && cache && cache.expiresAt > Date.now()) {
    res.json({ ...cache.data, cached: true });
    return;
  }

  const data = await runScan({
    ...config,
    minFollowers: Number(req.query.minFollowers ?? 20),
    maxFollowers: Number(req.query.maxFollowers ?? 80),
    minTrades: Number(req.query.minTrades ?? 10),
    maxLaunchAgeHours: Number(req.query.maxLaunchAgeHours ?? 6),
    minLaunchLiquidityUsd: Number(req.query.minLaunchLiquidityUsd ?? 2500)
  });
  cache = { data, expiresAt: Date.now() + 5 * 60_000 };
  res.json({ ...data, cached: false });
});

app.listen(port, () => {
  console.log(`Fomo Signal Desk API listening on http://localhost:${port}`);
});
