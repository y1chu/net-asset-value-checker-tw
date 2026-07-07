// Scrapes a Taiwan fund's disclosed holdings (top holdings + weights) from
// MoneyDJ, which serves the 嘉實資訊 data and keys off just the fund code.
import iconv from 'iconv-lite';
import { fetchT } from './http.js';

const cache = new Map(); // code -> { data, builtAt }
const TTL_MS = 6 * 60 * 60 * 1000; // holdings are monthly; refresh a few times a day is plenty

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export async function getHoldings(fundCode) {
  const code = String(fundCode).trim().toLowerCase();
  if (!/^[a-z0-9]{4,10}$/.test(code)) throw new Error('無效的基金代碼');

  const hit = cache.get(code);
  if (hit && Date.now() - hit.builtAt < TTL_MS) return hit.data;

  const url = `https://www.moneydj.com/funddj/yp/yp013000.djhtm?a=${code}`;
  const res = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
  if (!res.ok) throw new Error(`MoneyDJ 回應 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, 'big5');

  // Title looks like "統一大滿貫基金-A類型-統一投信-持股-基金-MoneyDJ理財網".
  // Drop the "-持股-基金-MoneyDJ" tail and the trailing "-XX投信/投顧" company segment.
  const titleM = html.match(/<title>([^<|]+)/);
  let fundName = titleM ? titleM[1].trim() : code.toUpperCase();
  fundName = fundName.split('-持股')[0].replace(/-[^-]*(投信|投顧)[^-]*$/, '').trim() || code.toUpperCase();

  // MoneyDJ serves the 嘉實 "投資明細" (holdings detail) table. Its column header
  // "投資名稱" is unique to that table, so anchor there to skip sector-distribution tables.
  const start = html.indexOf('投資名稱');
  if (start === -1) throw new Error('找不到持股明細，該基金可能未揭露個股或代碼有誤');
  // The table ends at the regulatory footnote, or at the closing tag as a fallback.
  let end = html.indexOf('(1)股票型', start);
  if (end === -1) end = html.indexOf('(1)基金', start);
  if (end === -1) end = start + 8000;
  const slice = html.slice(start, end);

  // Data month sits just above the table (e.g. 資料月份：2026/05/31).
  const asOfM = html.slice(0, start).match(/資料月份[：:]\s*([\d/]+)(?![\s\S]*資料月份)/);
  const asOf = asOfM ? asOfM[1] : (html.match(/資料月份[：:]\s*([\d/]+)/)?.[1] ?? null);

  // Name cells use class t3t1* (left); numeric cells use t3n1* (shares, weight, change).
  const cellRe = /<td[^>]*class=["']?(t3t1|t3n1)[\w]*[^>]*>([\s\S]*?)<\/td>/g;
  const cells = [];
  let m;
  while ((m = cellRe.exec(slice))) cells.push({ kind: m[1], text: stripTags(m[2]) });

  const holdings = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.kind !== 't3t1') continue; // name cell
    const name = c.text;
    if (!name || !/[一-鿿]/.test(name)) continue;
    if (/名稱|持股|比例|增減|合計|明細/.test(name)) continue;
    // next up-to-3 numeric cells: shares, weight, change
    const nums = [];
    for (let j = i + 1; j < cells.length && nums.length < 3; j++) {
      if (cells[j].kind === 't3t1') break;
      nums.push(cells[j].text);
    }
    const weight = parseFloat((nums[1] || '').replace(/,/g, ''));
    if (Number.isFinite(weight) && weight > 0 && weight <= 100) {
      holdings.push({ name, weight });
    }
  }

  if (holdings.length === 0) throw new Error('未能解析出個股持股（該基金本月可能只揭露類股分布）');

  const data = { fundCode: code.toUpperCase(), fundName, asOf, holdings };
  cache.set(code, { data, builtAt: Date.now() });
  return data;
}
