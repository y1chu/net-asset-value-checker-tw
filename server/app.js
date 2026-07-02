// The Express app (routes only), shared by the local server (server/index.js)
// and the Netlify serverless function (netlify/functions/api.js).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHoldings } from './holdings.js';
import { getStockMap, resolveName } from './stocks.js';
import { getQuotes } from './prices.js';
import { searchFunds } from './fundindex.js';

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

// GET /api/fund/:code -> holdings + live prices + estimated intraday move
app.get('/api/fund/:code', async (req, res) => {
  try {
    const [fund, stockMap] = await Promise.all([
      getHoldings(req.params.code),
      getStockMap(),
    ]);

    const resolved = fund.holdings.map((h) => ({
      ...h,
      ...resolveName(stockMap, h.name),
    }));

    const quotes = await getQuotes(resolved);

    let weightedSum = 0;   // Σ weight * change  (only priced holdings)
    let pricedWeight = 0;  // Σ weight of holdings we could price
    const disclosedWeight = resolved.reduce((a, h) => a + h.weight, 0);

    const rows = resolved.map((h) => {
      const q = h.code ? quotes.get(h.code) : null;
      let changePct = null;
      let contribution = null;
      if (q && q.last != null && q.prevClose) {
        changePct = (q.last / q.prevClose - 1) * 100;
        contribution = (h.weight / 100) * changePct; // pct points of fund move
        weightedSum += h.weight * changePct;
        pricedWeight += h.weight;
      }
      return {
        name: h.name,
        code: h.code,
        exchange: h.exchange,
        weight: h.weight,
        last: q?.last ?? null,
        prevClose: q?.prevClose ?? null,
        changePct,
        contribution,
      };
    });

    // Estimated fund move = weight-average of priced holdings' intraday change.
    const estimatedMovePct = pricedWeight > 0 ? weightedSum / pricedWeight : null;

    rows.sort((a, b) => b.weight - a.weight);

    res.json({
      fundCode: fund.fundCode,
      fundName: fund.fundName,
      asOf: fund.asOf,
      estimatedMovePct,
      disclosedWeight,          // top holdings as % of whole fund
      pricedWeight,             // how much of the fund we actually priced
      coveragePct: disclosedWeight > 0 ? (pricedWeight / disclosedWeight) * 100 : 0,
      unresolved: rows.filter((r) => !r.code).map((r) => r.name),
      holdings: rows,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});
