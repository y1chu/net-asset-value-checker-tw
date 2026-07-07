// Chinese-stock-name -> { code, exchange } lookup from the TWSE ISIN listing.
// This map is a dependency of EVERY estimate, so it must not be rebuilt (two big
// fetches) on each serverless cold start. It's prebuilt to disk and bundled;
// runtime loads it instantly and only refetches if the file is missing.
import iconv from 'iconv-lite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { fetchT } from './http.js';

const __dirname = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
const TMP_FILE = path.join(os.tmpdir(), 'nav-stock-map.json');
const READ_PATHS = [
  path.join(__dirname, '..', 'data', 'stock-map.json'),
  path.join(process.cwd(), 'data', 'stock-map.json'),
  TMP_FILE,
];
const WRITE_PATHS = [path.join(__dirname, '..', 'data', 'stock-map.json'), TMP_FILE];
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let mem = null;      // { pairs: [[name,code,exchange]...], builtAt }
let map = null;      // Map name -> { code, exchange }
let building = null;

function indexPairs(pairs) {
  map = new Map();
  for (const [name, code, exchange] of pairs) if (!map.has(name)) map.set(name, { code, exchange });
}

async function loadIsin(strMode, exchange) {
  const res = await fetchT(`https://isin.twse.com.tw/isin/C_public.jsp?strMode=${strMode}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 9000);
  const html = iconv.decode(Buffer.from(await res.arrayBuffer()), 'big5');
  const entries = [];
  const re = /<td[^>]*>\s*(\d{4,6})　([^<]+?)\s*<\/td>/g; // full-width space separates code/name
  let m;
  while ((m = re.exec(html))) { const name = m[2].trim(); if (name) entries.push([name, m[1], exchange]); }
  return entries;
}

async function build() {
  const [tse, otc] = await Promise.all([loadIsin(2, 'tse'), loadIsin(4, 'otc')]);
  // Prefer 上市 on name collision, so add 上櫃 first then 上市 overwrites.
  const pairs = [...otc, ...tse];
  if (!pairs.length) throw new Error('ISIN 名單建立失敗');
  mem = { pairs, builtAt: Date.now() };
  indexPairs(pairs);
  const payload = JSON.stringify(mem);
  for (const t of WRITE_PATHS) { try { await fs.mkdir(path.dirname(t), { recursive: true }); await fs.writeFile(t, payload, 'utf8'); break; } catch {} }
  return mem;
}

async function loadFromDisk() {
  for (const src of READ_PATHS) {
    try { const raw = JSON.parse(await fs.readFile(src, 'utf8')); if (raw?.pairs?.length) { mem = raw; indexPairs(raw.pairs); return; } } catch {}
  }
}

export async function getStockMap() {
  if (map) return map;
  await loadFromDisk();
  if (map) return map;                       // bundled/prebuilt: instant, no fetch
  if (!building) building = build().finally(() => (building = null));
  await building;
  return map;
}

export function warmStockMap() { getStockMap().catch(() => {}); }

export function resolveName(m, name) {
  const hit = m.get(name);
  return hit ? { name, ...hit } : { name, code: null, exchange: null };
}
