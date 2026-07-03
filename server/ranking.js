// Computes the "全部" ranking over the curated fund list, cached briefly so the
// home page is cheap to refresh. Holdings are cached ~6h upstream; only prices
// are re-fetched each recompute.
import { computeMany } from './estimate.js';
import { CURATED_FUNDS } from './curated.js';

const TTL_MS = 90 * 1000;
let cache = null; // { rows, at }
let inflight = null;

export async function getRanking() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    const rows = (await computeMany(CURATED_FUNDS.map((f) => f.code), { withNav: false }))
      .filter((r) => r.estimatedMovePct != null)
      .sort((a, b) => b.estimatedMovePct - a.estimatedMovePct);
    cache = { rows, at: Date.now() };
    return rows;
  })().finally(() => { inflight = null; });
  return inflight;
}
