// Live intraday quotes from the TWSE MIS endpoint (covers 上市 tse_ and 上櫃 otc_).
// MIS caps how many channels one request can carry, so large sets are chunked.
import { fetchT } from './http.js';
const CHUNK = 40;

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Parse a MIS bid/ask string ("p1_p2_p3_..") into positive prices. Limit-up/down
// quotes prepend a "0.0000" placeholder, so filter zeros/blanks out.
function levels(s) {
  return (s || '').split('_').map(parseFloat).filter((v) => Number.isFinite(v) && v > 0);
}

// Best available current price: last trade if present, else mid of best bid/ask.
// At 漲停 only bids exist (→ ceiling); at 跌停 only asks (→ floor).
function currentPrice(r) {
  const z = num(r.z);
  if (z && z > 0) return z;
  const bids = levels(r.b), asks = levels(r.a);
  const bestBid = bids.length ? Math.max(...bids) : null;
  const bestAsk = asks.length ? Math.min(...asks) : null;
  if (bestBid && bestAsk) return (bestBid + bestAsk) / 2;
  return bestBid ?? bestAsk ?? num(r.o) ?? num(r.h) ?? num(r.l);
}

async function fetchChunk(valid, byCode) {
  const channels = valid.map((s) => `${s.exchange}_${s.code}.tw`).join('|');
  const url =
    `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${channels}&json=1&delay=0&_=${Date.now()}`;
  const res = await fetchT(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mis.twse.com.tw/stock/index.jsp' },
  }, 7000);
  if (!res.ok) throw new Error(`TWSE 報價回應 ${res.status}`);
  const json = await res.json();
  for (const r of json.msgArray || []) {
    // y = prev close; o = open; h/l = high/low; u/w = limit up/down
    byCode.set(r.c, {
      last: currentPrice(r), prevClose: num(r.y), open: num(r.o),
      high: num(r.h), low: num(r.l), name: r.n, time: r.t,
    });
  }
}

export async function getQuotes(stocks) {
  // Dedupe by code so shared holdings across funds are fetched once.
  const seen = new Map();
  for (const s of stocks) if (s.code && s.exchange && !seen.has(s.code)) seen.set(s.code, s);
  const valid = [...seen.values()];
  const byCode = new Map();
  if (valid.length === 0) return byCode;

  const chunks = [];
  for (let i = 0; i < valid.length; i += CHUNK) chunks.push(valid.slice(i, i + CHUNK));
  await Promise.all(chunks.map((c) => fetchChunk(c, byCode).catch(() => {})));
  return byCode;
}
