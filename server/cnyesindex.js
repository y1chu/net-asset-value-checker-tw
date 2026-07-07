// Maps a fund's Chinese name -> cnyes fund id, parsed from cnyes's fund sitemap.
// The id is needed to pull NAV history from cnyes. Cached to disk like fundindex.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { fetchT } from './http.js';

const __dirname = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
const TMP_FILE = path.join(os.tmpdir(), 'nav-cnyes-index.json');
const READ_PATHS = [
  path.join(__dirname, '..', 'data', 'cnyes-index.json'),
  path.join(process.cwd(), 'data', 'cnyes-index.json'),
  TMP_FILE,
];
const WRITE_PATHS = [path.join(__dirname, '..', 'data', 'cnyes-index.json'), TMP_FILE];
const SITEMAP = 'https://fund.cnyes.com/cnyes-sitemap/fund/desktop-funds.xml.gz';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let mem = null;      // { pairs: [[name,id]...], builtAt }
let byName = null;   // Map exact name -> id
let byNorm = null;   // Map normalized name -> id
let building = null;

const norm = (s) => s.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
const base = (s) => { const i = s.indexOf('基金'); return i >= 0 ? s.slice(0, i + 2) : s.replace(/[-(（].*$/, ''); };

function indexPairs(pairs) {
  byName = new Map(); byNorm = new Map();
  for (const [name, id] of pairs) {
    if (!byName.has(name)) byName.set(name, id);
    const n = norm(name);
    if (!byNorm.has(n)) byNorm.set(n, id);
  }
}

async function crawl() {
  const res = await fetchT(SITEMAP, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12000);
  if (!res.ok) throw new Error(`cnyes sitemap ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let xml;
  try { xml = zlib.gunzipSync(buf).toString('utf8'); } catch { xml = buf.toString('utf8'); }
  const pairs = [];
  const seen = new Set();
  for (const m of xml.matchAll(/\/detail\/([^\/<]+)\/([A-Za-z0-9]+)(?:\/)?<\/loc>/g)) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    pairs.push([decodeURIComponent(m[1]), id]);
  }
  return pairs;
}

async function build() {
  const pairs = await crawl();
  if (!pairs.length) throw new Error('cnyes 基金清單建立失敗');
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

async function ready() {
  if (byName) return;
  if (!mem) await loadFromDisk();
  if (byName && mem && Date.now() - mem.builtAt < TTL_MS) return;
  if (byName) return; // stale but usable
  if (!building) building = build().finally(() => (building = null));
  await building;
}

export function warmCnyesIndex() { ready().catch(() => {}); }

// Resolve a fund name to a cnyes id: exact, then normalized, then base-name prefix.
export async function resolveCnyesId(name) {
  if (!name) return null;
  await ready().catch(() => {});
  if (!byName) return null;
  if (byName.has(name)) return byName.get(name);
  const n = norm(name);
  if (byNorm.has(n)) return byNorm.get(n);
  const b = norm(base(name));
  for (const [k, id] of byNorm) if (k.startsWith(b) && b.length >= 4) return id;
  return null;
}

export async function getCnyesIndex() { await ready(); return mem?.pairs || []; }
