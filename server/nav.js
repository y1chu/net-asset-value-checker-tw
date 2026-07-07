// Scrapes a fund's latest official NAV (淨值) from MoneyDJ's yp010000 page.
// The NAV is published once per trading day, so a short in-memory cache is plenty.
import iconv from 'iconv-lite';
import { fetchT } from './http.js';

const cache = new Map(); // code -> { data, at }
const TTL_MS = 60 * 60 * 1000; // 1h

function stripTags(s) { return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(); }

export async function getNav(fundCode) {
  const code = String(fundCode).trim().toLowerCase();
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const url = `https://www.moneydj.com/funddj/yp/yp010000.djhtm?a=${code}`;
  const res = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.moneydj.com/funddj/' } }, 7000);
  if (!res.ok) throw new Error(`MoneyDJ 淨值回應 ${res.status}`);
  const html = iconv.decode(Buffer.from(await res.arrayBuffer()), 'big5');

  // Header row: 淨值日期 | 最新淨值 | 每日變化 | ...  then a data row follows.
  const start = html.indexOf('最新淨值');
  let data = { nav: null, navDate: null, navChange: null, navChangePct: null };
  if (start !== -1) {
    const slice = html.slice(start, start + 1200);
    const cells = [];
    for (const m of slice.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) cells.push(stripTags(m[1]));
    // Find the date cell; NAV is the next numeric cell, "每日變化" (absolute) the one after.
    const di = cells.findIndex((c) => /^20\d\d\/\d\d\/\d\d$/.test(c));
    if (di !== -1) {
      data.navDate = cells[di];
      const nav = parseFloat((cells[di + 1] || '').replace(/,/g, ''));
      if (Number.isFinite(nav)) data.nav = nav;
      const chg = parseFloat((cells[di + 2] || '').replace(/[,%+]/g, ''));
      if (Number.isFinite(chg)) {
        data.navChange = chg;                       // absolute change in NAV points
        const prev = nav - chg;                     // yesterday's NAV
        if (prev > 0) data.navChangePct = (chg / prev) * 100;
      }
    }
  }

  cache.set(code, { data, at: Date.now() });
  return data;
}
