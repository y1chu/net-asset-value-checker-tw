// Builds and caches a Chinese-stock-name -> { code, exchange } lookup
// from the TWSE public ISIN listing (上市 = tse, 上櫃 = otc).
import iconv from 'iconv-lite';

let cache = null;          // { map, builtAt }
const TTL_MS = 12 * 60 * 60 * 1000; // rebuild twice a day

async function loadIsin(strMode, exchange) {
  const res = await fetch(`https://isin.twse.com.tw/isin/C_public.jsp?strMode=${strMode}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, 'big5');
  const entries = [];
  // cells look like: <td ...>2330　台積電</td>  (full-width space U+3000 separates code and name)
  const re = /<td[^>]*>\s*(\d{4,6})　([^<]+?)\s*<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const code = m[1];
    const name = m[2].trim();
    if (name) entries.push({ name, code, exchange });
  }
  return entries;
}

export async function getStockMap() {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return cache.map;
  const [tse, otc] = await Promise.all([
    loadIsin(2, 'tse'), // 上市
    loadIsin(4, 'otc'), // 上櫃
  ]);
  const map = new Map();
  // Prefer 上市 on name collision, then 上櫃.
  for (const e of [...otc, ...tse]) map.set(e.name, { code: e.code, exchange: e.exchange });
  cache = { map, builtAt: Date.now() };
  return map;
}

export function resolveName(map, name) {
  const hit = map.get(name);
  if (hit) return { name, ...hit };
  return { name, code: null, exchange: null };
}
