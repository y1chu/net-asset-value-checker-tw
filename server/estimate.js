// Shared estimation logic used by the fund detail and the favorites batch.
// Batch mode fetches every fund's prices in one deduped, chunked call.
import { getHoldings } from './holdings.js';
import { getStockMap, resolveName } from './stocks.js';
import { getQuotes } from './prices.js';
import { getNav } from './nav.js';
import { getFundMeta } from './navhistory.js';
import { getMarket } from './market.js';

// Today's date in Taiwan (UTC+8) as "YYYY/MM/DD" to compare against navDate.
function todayTW() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}
const isOfficialToday = (navDate) => !!navDate && navDate === todayTW();

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = null; }
    }
  }));
  return out;
}

// Turn resolved holdings + a quotes map into the estimate + per-holding rows.
function summarize(resolved, quotes) {
  let weightedSum = 0, pricedWeight = 0;
  const disclosedWeight = resolved.reduce((a, h) => a + h.weight, 0);
  const rows = resolved.map((h) => {
    const q = h.code ? quotes.get(h.code) : null;
    let changePct = null, contribution = null;
    if (q && q.last != null && q.prevClose) {
      const chg = (q.last / q.prevClose - 1) * 100;
      // TW stocks have a ±10% daily limit, so a larger move means bad data
      // (name→ticker collision, split, or IPO). Drop it from the estimate.
      if (Math.abs(chg) <= 11) {
        changePct = chg;
        contribution = (h.weight / 100) * changePct;
        weightedSum += h.weight * changePct;
        pricedWeight += h.weight;
      }
    }
    return {
      name: h.name, code: h.code, exchange: h.exchange, weight: h.weight,
      last: q?.last ?? null, prevClose: q?.prevClose ?? null, changePct, contribution,
    };
  });
  rows.sort((a, b) => b.weight - a.weight);
  return {
    estimatedMovePct: pricedWeight > 0 ? weightedSum / pricedWeight : null,
    disclosedWeight,
    pricedWeight,
    coveragePct: disclosedWeight > 0 ? (pricedWeight / disclosedWeight) * 100 : 0,
    rows,
  };
}

// Full single-fund estimate (holdings breakdown + NAV) for the detail view.
export async function computeFund(code) {
  const [fund, stockMap] = await Promise.all([getHoldings(code), getStockMap()]);
  const resolved = fund.holdings.map((h) => ({ ...h, ...resolveName(stockMap, h.name) }));
  const [quotes, nav, fundamentals, market] = await Promise.all([
    getQuotes(resolved),
    getNav(code).catch(() => ({ nav: null, navDate: null, navChange: null, navChangePct: null })),
    getFundMeta(fund.fundName).catch(() => null),
    getMarket().catch(() => null),
  ]);
  const s = summarize(resolved, quotes);
  return {
    fundCode: fund.fundCode,
    fundName: fund.fundName,
    asOf: fund.asOf,
    nav: nav.nav, navDate: nav.navDate, navChange: nav.navChange, navChangePct: nav.navChangePct,
    officialToday: isOfficialToday(nav.navDate),
    estimatedMovePct: s.estimatedMovePct,
    disclosedWeight: s.disclosedWeight,
    pricedWeight: s.pricedWeight,
    coveragePct: s.coveragePct,
    unresolved: s.rows.filter((r) => !r.code).map((r) => r.name),
    holdings: s.rows,
    fundamentals,
    market,
    updatedAt: new Date().toISOString(),
  };
}

// Aggregate stock exposure across a set of funds (your favorites). Effective
// exposure assumes you hold the funds equally: Σ(weight in each fund) / fundCount.
export async function computeOverlap(codes) {
  const stockMap = await getStockMap();
  const funds = await mapLimit(codes, 6, async (code) => {
    const fund = await getHoldings(code);
    return {
      code: fund.fundCode,
      name: fund.fundName,
      resolved: fund.holdings.map((h) => ({ ...h, ...resolveName(stockMap, h.name) })),
    };
  });
  const live = funds.filter(Boolean);
  if (!live.length) return { fundCount: 0, funds: [], stocks: [] };

  const quotes = await getQuotes(live.flatMap((f) => f.resolved));
  const byStock = new Map();
  for (const f of live) {
    for (const h of f.resolved) {
      const key = h.code || h.name;
      let s = byStock.get(key);
      if (!s) { s = { name: h.name, code: h.code, weightSum: 0, funds: new Set() }; byStock.set(key, s); }
      s.weightSum += h.weight;
      s.funds.add(f.code);
    }
  }

  const n = live.length;
  const stocks = [...byStock.values()].map((s) => {
    const q = s.code ? quotes.get(s.code) : null;
    let changePct = null;
    if (q && q.last != null && q.prevClose) {
      const c = (q.last / q.prevClose - 1) * 100;
      if (Math.abs(c) <= 11) changePct = c; // TW ±10% daily limit; beyond = bad data
    }
    return {
      name: s.name, code: s.code,
      exposurePct: s.weightSum / n,   // your effective weight if funds held equally
      fundCount: s.funds.size,
      changePct,
    };
  }).sort((a, b) => b.exposurePct - a.exposurePct);

  return { fundCount: n, funds: live.map((f) => ({ code: f.code, name: f.name })), stocks };
}

// Batch estimate for many funds. Prices are fetched once across all funds.
// Returns a lightweight row per fund (no holdings breakdown). Optionally adds NAV.
export async function computeMany(codes, { withNav = false } = {}) {
  const stockMap = await getStockMap();
  const funds = await mapLimit(codes, 6, async (code) => {
    const fund = await getHoldings(code);
    const resolved = fund.holdings.map((h) => ({ ...h, ...resolveName(stockMap, h.name) }));
    return { code: fund.fundCode, name: fund.fundName, asOf: fund.asOf, resolved };
  });

  const live = funds.filter(Boolean);
  const allStocks = live.flatMap((f) => f.resolved);
  const quotes = await getQuotes(allStocks); // one deduped, chunked call

  const navs = withNav
    ? await mapLimit(live, 6, (f) => getNav(f.code).catch(() => ({})))
    : [];

  return live.map((f, i) => {
    const s = summarize(f.resolved, quotes);
    const nav = navs[i] || {};
    return {
      code: f.code, name: f.name, asOf: f.asOf,
      estimatedMovePct: s.estimatedMovePct,
      disclosedWeight: s.disclosedWeight,
      coveragePct: s.coveragePct,
      nav: nav.nav ?? null, navDate: nav.navDate ?? null,
      navChange: nav.navChange ?? null, navChangePct: nav.navChangePct ?? null,
      officialToday: isOfficialToday(nav.navDate),
    };
  });
}
