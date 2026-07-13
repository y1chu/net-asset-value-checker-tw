// Live market indices (加權指數 TAIEX + 櫃買指數 OTC) from TWSE MIS, as a benchmark.
// Also reports the exchange's last trade date, which tells us whether the market
// actually traded today (covers weekends, holidays, and pre-open alike).
import { fetchT } from './http.js';

let cache = null; // { v, at }
const TTL_MS = 20 * 1000;

// Today in Taiwan (UTC+8) as YYYYMMDD, matching MIS's `d` field.
export function todayTWCompact() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function getMarket() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.v;
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw|otc_o00.tw&json=1&delay=0&_=${Date.now()}`;
  let v = { taiex: null, otc: null, marketDate: null, tradingToday: false };
  try {
    const res = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mis.twse.com.tw/stock/index.jsp' } }, 5000);
    const json = await res.json();
    const rows = json.msgArray || [];
    const pick = (ch) => {
      const m = rows.find((x) => x.ch === ch);
      if (!m) return null;
      const z = parseFloat(m.z), y = parseFloat(m.y);
      if (!Number.isFinite(z) || !Number.isFinite(y) || !y) return null;
      return { last: z, prevClose: y, changePct: (z / y - 1) * 100 };
    };
    // MIS `d` is the date of the latest trade session.
    const marketDate = rows.map((r) => r.d).find(Boolean) || null;
    v = {
      taiex: pick('t00.tw'),
      otc: pick('o00.tw'),
      marketDate,
      tradingToday: !!marketDate && marketDate === todayTWCompact(),
    };
  } catch { /* best-effort */ }
  cache = { v, at: Date.now() };
  return v;
}
