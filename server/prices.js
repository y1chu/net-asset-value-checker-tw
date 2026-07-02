// Live intraday quotes from the TWSE MIS endpoint (covers 上市 tse_ and 上櫃 otc_).
export async function getQuotes(stocks) {
  const valid = stocks.filter((s) => s.code && s.exchange);
  if (valid.length === 0) return new Map();

  const channels = valid.map((s) => `${s.exchange}_${s.code}.tw`).join('|');
  const url =
    `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${channels}&json=1&delay=0&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://mis.twse.com.tw/stock/index.jsp',
    },
  });
  if (!res.ok) throw new Error(`TWSE 報價回應 ${res.status}`);
  const json = await res.json();

  const byCode = new Map();
  for (const r of json.msgArray || []) {
    // z = latest trade price (may be '-' pre-open); y = prev close; o = open; h/l = high/low
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    let last = num(r.z);
    // Fall back to best bid/last-known if no trade has printed yet.
    if (last === null) last = num((r.b || '').split('_')[0]) ?? num(r.o);
    byCode.set(r.c, {
      last,
      prevClose: num(r.y),
      open: num(r.o),
      high: num(r.h),
      low: num(r.l),
      name: r.n,
      time: r.t,
    });
  }
  return byCode;
}
