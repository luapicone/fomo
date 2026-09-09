import React from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, BarChart3, ExternalLink, RefreshCw, Rocket, Search, Shield, Signal, Users, Wallet } from 'lucide-react';
import './styles.css';

type Trader = {
  handle: string;
  displayName: string | null;
  followers: number;
  following: number | null;
  trades: number;
  tradesPerDayLifetime: number | null;
  totalVolume: number;
  solanaWallet: string | null;
  evmWallet: string | null;
  score: number;
  status: 'candidate' | 'watch' | 'ignore';
  notes: string[];
};

type TokenSignal = {
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
  score: number;
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
};

type LaunchSignal = TokenSignal & {
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

type ScanResult = {
  generatedAt: string;
  mode: 'public' | 'fomo-auth';
  traders: Trader[];
  tokens: TokenSignal[];
  launches: LaunchSignal[];
  warnings: string[];
  cached?: boolean;
};

const money = (value: number | null | undefined) => {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const compact = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'n/a';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, notation: 'compact' }).format(value);
};

const age = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined) return 'n/a';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

function ScorePill({ score }: { score: number }) {
  return <span className={score >= 75 ? 'pill hot' : score >= 55 ? 'pill warm' : 'pill'}>{score}/100</span>;
}

function App() {
  const [data, setData] = React.useState<ScanResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState({
    minFollowers: 20,
    maxFollowers: 80,
    minTrades: 10,
    maxLaunchAgeHours: 6,
    minLaunchLiquidityUsd: 2500
  });

  const load = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      minFollowers: String(filters.minFollowers),
      maxFollowers: String(filters.maxFollowers),
      minTrades: String(filters.minTrades),
      maxLaunchAgeHours: String(filters.maxLaunchAgeHours),
      minLaunchLiquidityUsd: String(filters.minLaunchLiquidityUsd),
      ...(refresh ? { refresh: '1' } : {})
    });
    try {
      const response = await fetch(`/api/scan?${params}`);
      if (!response.ok) throw new Error(`API ${response.status}`);
      setData(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el scanner');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Signal size={18} /></div>
          <div>
            <strong>Fomo Signal Desk</strong>
            <span>Underfollowed alpha scanner</span>
          </div>
        </div>

        <section className="control-panel">
          <div className="panel-title"><Search size={15} /> Filtros</div>
          <label>
            Min followers
            <input type="number" value={filters.minFollowers} onChange={(event) => setFilters({ ...filters, minFollowers: Number(event.target.value) })} />
          </label>
          <label>
            Max followers
            <input type="number" value={filters.maxFollowers} onChange={(event) => setFilters({ ...filters, maxFollowers: Number(event.target.value) })} />
          </label>
          <label>
            Min trades
            <input type="number" value={filters.minTrades} onChange={(event) => setFilters({ ...filters, minTrades: Number(event.target.value) })} />
          </label>
          <label>
            Lanzamientos ultimas horas
            <input type="number" value={filters.maxLaunchAgeHours} onChange={(event) => setFilters({ ...filters, maxLaunchAgeHours: Number(event.target.value) })} />
          </label>
          <label>
            Liquidez min lanzamiento
            <input type="number" value={filters.minLaunchLiquidityUsd} onChange={(event) => setFilters({ ...filters, minLaunchLiquidityUsd: Number(event.target.value) })} />
          </label>
          <button className="primary" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Escanear
          </button>
        </section>

        <section className="source-box">
          <div><Shield size={15} /> Modo</div>
          <strong>{data?.mode === 'fomo-auth' ? 'Fomo API auth' : 'Public sources'}</strong>
          <p>{data?.cached ? 'Cache activo 5 min.' : 'Datos refrescados en esta consulta.'}</p>
        </section>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>Radar de traders chicos y tokens calientes</h1>
            <p>Señales públicas ahora; preparado para sumar Fomo API autenticada.</p>
          </div>
          <div className="timestamp">
            <Activity size={16} />
            {data ? new Date(data.generatedAt).toLocaleString('es-AR') : 'Sin datos'}
          </div>
        </header>

        {error && <div className="warning"><AlertTriangle size={17} /> {error}</div>}
        {data?.warnings.map((warning) => <div className="warning" key={warning}><AlertTriangle size={17} /> {warning}</div>)}

        <section className="metrics">
          <div><span>Traders</span><strong>{data?.traders.length ?? 0}</strong></div>
          <div><span>Tokens</span><strong>{data?.tokens.length ?? 0}</strong></div>
          <div><span>Lanzamientos</span><strong>{data?.launches.length ?? 0}</strong></div>
          <div><span>Watchlist</span><strong>{data?.traders.filter((trader) => trader.status === 'watch').length ?? 0}</strong></div>
        </section>

        <section className="surface launch-surface">
          <div className="section-head">
            <h2><Rocket size={18} /> Coins de Fomo lanzadas ahora</h2>
            <span>Fomo/Long en DexScreener</span>
          </div>
          <div className="launch-list">
            {(data?.launches ?? []).map((token) => (
              <article className="launch-row" key={`${token.chainId}:${token.pairAddress}`}>
                <div className="token-main">
                  <div>
                    <a href={token.url} target="_blank" rel="noreferrer">{token.symbol}<ExternalLink size={12} /></a>
                    <span>{token.name} · {token.chainId}{token.dexId ? ` / ${token.dexId}` : ''}</span>
                  </div>
                  <ScorePill score={token.score} />
                </div>
                <div className="launch-stats">
                  <span>Edad <strong>{age(token.ageMinutes)}</strong></span>
                  <span>Liq <strong>{money(token.liquidityUsd)}</strong></span>
                  <span>MC <strong>{money(token.marketCap)}</strong></span>
                  <span>Vol 5m <strong>{money(token.volume5m)}</strong></span>
                  <span>Tx 5m <strong>{token.txns5m}</strong></span>
                  <span>B/S 1h <strong>{token.buys1h}/{token.sells1h}</strong></span>
                </div>
                <p>{token.reasons.slice(0, 4).join(' · ')}</p>
                <span className={`risk ${token.risk}`}>Riesgo {token.risk}</span>
              </article>
            ))}
            {!loading && data?.launches.length === 0 && <p className="empty">No aparecieron coins de Fomo/Long con esos filtros.</p>}
          </div>
        </section>

        <section className="grid">
          <div className="surface">
            <div className="section-head">
              <h2><Users size={18} /> Traders 20-80 followers</h2>
              <span>P&L/winrate requiere Fomo auth</span>
            </div>
            <div className="table">
              {(data?.traders ?? []).map((trader) => (
                <article className="trader-row" key={trader.handle}>
                  <div>
                    <a href={`https://fomo.family/profile/${trader.handle}`} target="_blank" rel="noreferrer">@{trader.handle}<ExternalLink size={12} /></a>
                    <span>{trader.displayName ?? 'Sin nombre'}</span>
                  </div>
                  <ScorePill score={trader.score} />
                  <div className="stat"><small>Followers</small><strong>{trader.followers}</strong></div>
                  <div className="stat"><small>Trades</small><strong>{trader.trades}</strong></div>
                  <div className="stat"><small>Trades/dia</small><strong>{trader.tradesPerDayLifetime ?? 'n/a'}</strong></div>
                  <div className="stat"><small>Volumen</small><strong>{money(trader.totalVolume)}</strong></div>
                  <div className="wallet-state"><Wallet size={14} /> {trader.solanaWallet || trader.evmWallet ? 'wallet' : 'sin wallet'}</div>
                </article>
              ))}
              {!loading && data?.traders.length === 0 && <p className="empty">No aparecieron traders con esos filtros.</p>}
            </div>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2><BarChart3 size={18} /> Tokens en tendencia</h2>
              <span>DexScreener momentum</span>
            </div>
            <div className="token-list">
              {(data?.tokens ?? []).map((token) => (
                <article className="token-card" key={`${token.chainId}:${token.tokenAddress}`}>
                  <div className="token-main">
                    <div>
                      <a href={token.url} target="_blank" rel="noreferrer">{token.symbol}<ExternalLink size={12} /></a>
                      <span>{token.name}</span>
                    </div>
                    <ScorePill score={token.score} />
                  </div>
                  <div className="token-stats">
                    <span>MC {money(token.marketCap)}</span>
                    <span>Liq {money(token.liquidityUsd)}</span>
                    <span>Vol 1h {compact(token.volume1h)}</span>
                    <span>1h {token.priceChange1h ?? 0}%</span>
                  </div>
                  <p>{token.reasons.slice(0, 3).join(' · ')}</p>
                  <span className={`risk ${token.risk}`}>Riesgo {token.risk}</span>
                </article>
              ))}
              {!loading && data?.tokens.length === 0 && <p className="empty">No aparecieron tokens con score suficiente.</p>}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
