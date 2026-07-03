// Fetches a fund's NAV history + fundamentals from cnyes (one endpoint returns
// both), resolving the cnyes id by name. Cached per id (values update daily).
import { resolveCnyesId } from './cnyesindex.js';

const cache = new Map(); // cnyesId -> { data, at }
const TTL_MS = 6 * 60 * 60 * 1000;

async function fetchCnyes(id) {
  const url = `https://api.cnyes.com/fund/api/v1/funds/${id}/nav?period=6M`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://fund.cnyes.com', Referer: 'https://fund.cnyes.com/' } });
  if (!res.ok) throw new Error(`cnyes nav ${res.status}`);
  const it = (await res.json()).items || {};

  // NAV series (cnyes returns newest-first; reverse to oldest-first for charting).
  let series = null;
  if (Array.isArray(it.nav) && Array.isArray(it.tradeDate) && it.nav.length) {
    const t = [], v = [];
    for (let i = it.tradeDate.length - 1; i >= 0; i--) {
      const val = Number(it.nav[i]);
      if (Number.isFinite(val)) { t.push(it.tradeDate[i]); v.push(val); }
    }
    series = { t, v };
  }

  const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  const meta = {
    returns: {
      m1: num(it.return1Month), m3: num(it.return3Month), m6: num(it.return6Month),
      y1: num(it.return1Year), y3: num(it.return3Year), y5: num(it.return5Year), ytd: num(it.returnYTD),
    },
    starRating: num(it.starRating),
    managementFee: num(it.managementFee),
    riskLevel: num(it.riskLevel),
    category: it.categoryLocal || it.globalCategory || null,
    totalNetAsset: num(it.totalNetAsset),   // TWD
    inceptionDate: num(it.inceptionDate),    // unix seconds
    currency: it.classCurrencyName || null,
  };
  return { series, meta };
}

async function getCnyesData(name) {
  const id = await resolveCnyesId(name);
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fetchCnyes(id).catch(() => null);
  cache.set(id, { data, at: Date.now() });
  return data;
}

export async function getNavHistory(name) { return (await getCnyesData(name))?.series || null; }
export async function getFundMeta(name) { return (await getCnyesData(name))?.meta || null; }
