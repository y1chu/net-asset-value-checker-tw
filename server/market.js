// Live market indices (加權指數 TAIEX + 櫃買指數 OTC) from TWSE MIS, as a benchmark.
let cache = null; // { v, at }
const TTL_MS = 20 * 1000;

export async function getMarket() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.v;
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw|otc_o00.tw&json=1&delay=0&_=${Date.now()}`;
  let v = { taiex: null, otc: null };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mis.twse.com.tw/stock/index.jsp' } });
    const json = await res.json();
    const pick = (ch) => {
      const m = (json.msgArray || []).find((x) => x.ch === ch);
      if (!m) return null;
      const z = parseFloat(m.z), y = parseFloat(m.y);
      if (!Number.isFinite(z) || !Number.isFinite(y) || !y) return null;
      return { last: z, prevClose: y, changePct: (z / y - 1) * 100 };
    };
    v = { taiex: pick('t00.tw'), otc: pick('o00.tw') };
  } catch { /* best-effort */ }
  cache = { v, at: Date.now() };
  return v;
}
