// Live intraday quotes from the TWSE MIS endpoint (covers 上市 tse_ and 上櫃 otc_).
// MIS caps how many channels one request can carry, so large sets are chunked.
const CHUNK = 40;

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchChunk(valid, byCode) {
  const channels = valid.map((s) => `${s.exchange}_${s.code}.tw`).join('|');
  const url =
    `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${channels}&json=1&delay=0&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mis.twse.com.tw/stock/index.jsp' },
  });
  if (!res.ok) throw new Error(`TWSE 報價回應 ${res.status}`);
  const json = await res.json();
  for (const r of json.msgArray || []) {
    // z = latest trade price (may be '-' pre-open); y = prev close; o = open; h/l = high/low
    let last = num(r.z);
    if (last === null) last = num((r.b || '').split('_')[0]) ?? num(r.o); // best bid, then open
    byCode.set(r.c, {
      last, prevClose: num(r.y), open: num(r.o), high: num(r.h), low: num(r.l), name: r.n, time: r.t,
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
