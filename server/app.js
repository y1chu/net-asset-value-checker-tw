// The Express app (routes only), shared by the local server (server/index.js)
// and the Netlify serverless function (netlify/functions/api.js).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchFunds } from './fundindex.js';
import { computeFund, computeMany } from './estimate.js';
import { getRanking } from './ranking.js';
import { getNavHistory } from './navhistory.js';
import { getMarket } from './market.js';

// import.meta.url is undefined once a bundler (Netlify's esbuild) emits CommonJS,
// which would crash fileURLToPath. Fall back to cwd so the module always loads.
const __dirname = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
export const app = express();

// Serve the static frontend locally. On Netlify the CDN serves public/ directly,
// so this middleware simply never matches the /api/* routes the function handles.
app.use(express.static(path.join(__dirname, '..', 'public')));

// GET /api/search?q=... -> fund name/code suggestions
app.get('/api/search', async (req, res) => {
  try {
    res.json({ results: await searchFunds(req.query.q, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/fund/:code -> holdings + live prices + estimated move + NAV
app.get('/api/fund/:code', async (req, res) => {
  try {
    res.json(await computeFund(req.params.code));
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// GET /api/estimates?codes=A,B,C -> lightweight estimate + NAV per fund (favorites)
app.get('/api/estimates', async (req, res) => {
  try {
    const codes = String(req.query.codes || '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 30);
    res.json({ results: codes.length ? await computeMany(codes, { withNav: true }) : [] });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// GET /api/navhistory?name=... -> daily NAV series (oldest-first) from cnyes
app.get('/api/navhistory', async (req, res) => {
  try {
    res.json({ series: await getNavHistory(req.query.name) });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/market -> live TAIEX + OTC index
app.get('/api/market', async (req, res) => {
  try {
    res.json(await getMarket());
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/ranking -> curated "全部" board (estimates, sorted, cached) + market
app.get('/api/ranking', async (req, res) => {
  try {
    const [results, market] = await Promise.all([getRanking(), getMarket().catch(() => null)]);
    res.json({ results, market, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});
