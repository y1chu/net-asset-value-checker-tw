// Builds a searchable index of domestic funds { code, name, company } by crawling
// MoneyDJ's company list -> per-company fund lists, then caches it to disk.
import iconv from 'iconv-lite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// import.meta.url is undefined once bundled to CommonJS (Netlify esbuild); fall back to cwd.
const __dirname = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
// Read the prebuilt/committed index from wherever it landed (source tree or the
// function's bundle root), then the writable runtime cache. Writes go to data/
// locally, falling back to the OS temp dir when the bundle is read-only.
const TMP_FILE = path.join(os.tmpdir(), 'nav-fund-index.json');
const READ_PATHS = [
  path.join(__dirname, '..', 'data', 'fund-index.json'),
  path.join(process.cwd(), 'data', 'fund-index.json'),
  TMP_FILE,
];
const WRITE_PATHS = [path.join(__dirname, '..', 'data', 'fund-index.json'), TMP_FILE];
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // funds change slowly; rebuild weekly
const COMPANY_LIST = 'https://www.moneydj.com/funddj/ya/YP081000List.djhtm?a=1';

let mem = null;        // { funds, builtAt }
let building = null;   // in-flight build promise (dedupe concurrent triggers)

async function fetchBig5(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.moneydj.com/funddj/' },
  });
  return iconv.decode(Buffer.from(await res.arrayBuffer()), 'big5');
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

async function crawl() {
  const listHtml = await fetchBig5(COMPANY_LIST);
  const companies = [];
  const seen = new Set();
  for (const m of listHtml.matchAll(/yp082000\.djhtm\?a=([A-Za-z0-9]+)\s*>\s*([^<]+?)\s*</gi)) {
    const id = m[1];
    if (!seen.has(id)) { seen.add(id); companies.push({ id, name: m[2].trim() }); }
  }

  const perCompany = await mapLimit(companies, 6, async (c) => {
    const html = await fetchBig5(`https://www.moneydj.com/funddj/ya/yp082000.djhtm?a=${c.id}`);
    const funds = [];
    // <a href=/funddj/ya/yp010000.djhtm?a=ACDD04 class="product_name_fund">安聯台灣科技基金</a>
    for (const m of html.matchAll(
      /yp010000\.djhtm\?a=([A-Za-z0-9]+)\s+class="product_name_fund"[^>]*>\s*([^<]+?)\s*</gi)) {
      funds.push({ code: m[1].toUpperCase(), name: m[2].trim(), company: c.name });
    }
    return funds;
  });

  const byCode = new Map();
  for (const list of perCompany) {
    if (!list) continue;
    for (const f of list) if (!byCode.has(f.code)) byCode.set(f.code, f);
  }
  return [...byCode.values()];
}

async function build() {
  const funds = await crawl();
  if (funds.length === 0) throw new Error('基金清單建立失敗（來源無資料）');
  mem = { funds, builtAt: Date.now() };
  const payload = JSON.stringify(mem);
  for (const target of WRITE_PATHS) {  // first writable location wins
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, payload, 'utf8');
      break;
    } catch { /* try next / disk cache is best-effort */ }
  }
  return mem;
}

async function loadFromDisk() {
  for (const source of READ_PATHS) {
    try {
      const raw = JSON.parse(await fs.readFile(source, 'utf8'));
      if (raw?.funds?.length) { mem = raw; return; }
    } catch { /* try next */ }
  }
}

// Returns the index, building/refreshing as needed. If a stale cache exists,
// serve it immediately and refresh in the background.
export async function getFundIndex() {
  if (!mem) await loadFromDisk();
  const fresh = mem && Date.now() - mem.builtAt < TTL_MS;
  if (mem && fresh) return mem.funds;
  if (mem && !fresh) {
    if (!building) building = build().catch(() => null).finally(() => (building = null));
    return mem.funds; // stale-while-revalidate
  }
  if (!building) building = build().finally(() => (building = null));
  const built = await building;
  return built.funds;
}

// Warm the cache at startup without blocking.
export function warmFundIndex() {
  getFundIndex().catch(() => {});
}

export async function searchFunds(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const funds = await getFundIndex();
  const scored = [];
  for (const f of funds) {
    const name = f.name.toLowerCase();
    const code = f.code.toLowerCase();
    let score = -1;
    if (code === q) score = 100;
    else if (name === q) score = 90;
    else if (code.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 70;
    else if (name.includes(q)) score = 50 - name.indexOf(q); // earlier match ranks higher
    else if (code.includes(q)) score = 30;
    if (score >= 0) scored.push({ ...f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored.slice(0, limit).map(({ score, ...f }) => f);
}
