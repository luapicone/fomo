# Fomo Signal Desk

Scanner para detectar traders chicos de Fomo y tokens cripto con momentum. El MVP corre con fuentes publicas y queda preparado para sumar la API autenticada de Fomo cuando tengamos un token valido.

## Que hace

- Busca traders con bajo follower count, por defecto entre 20 y 80 followers.
- Enriquecer perfiles con trades totales, volumen, wallets verificadas y ritmo lifetime de trades/dia.
- Escanea tokens en DexScreener y calcula un score de tendencia por liquidez, volumen, momentum y market cap.
- Muestra todo en un dashboard local con refresh manual.
- Expone una API local para automatizar alertas o integraciones.

## Fuentes

- `Fomo Wallet Finder`: busqueda publica de usuarios, followers, wallets y estadisticas basicas.
- `DexScreener`: pares/tokens con precio, liquidez, volumen y cambios.
- `Fomo API`: opcional. Requiere `FOMO_AUTH_TOKEN` de una sesion propia.

## Limitacion actual

Sin sesion autenticada de Fomo, el P&L, winrate, leaderboard interno y feed completo no son publicos. El scanner marca ese modo como `public` y no inventa esos datos.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

URLs locales:

- Dashboard: `http://localhost:5173`
- API: `http://localhost:8787/api/scan`

## Variables

```bash
PORT=8787
FOMO_AUTH_TOKEN=
FOMO_WALLET_FINDER_API=https://api-production-9541.up.railway.app
DEXSCREENER_API=https://api.dexscreener.com
```

## API

```bash
curl "http://localhost:8787/api/scan?minFollowers=20&maxFollowers=80&minTrades=10"
```

Parametros:

- `minFollowers`: minimo de followers.
- `maxFollowers`: maximo de followers.
- `minTrades`: minimo de trades totales.
- `refresh=1`: ignora cache local de 5 minutos.

## Siguiente capa

Para convertirlo en un scanner mas fuerte:

- Agregar token de Fomo para leer feed, leaderboard, P&L y winrate.
- Persistir snapshots en SQLite/Postgres.
- Calcular deltas: nuevos followers, nuevos trades, tokens repetidos por varios traders.
- Enviar alertas a Discord cuando un token supere el score configurado.
