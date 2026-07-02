// Prebuilds the fund search index into data/fund-index.json at deploy time so
// search is instant on the first serverless cold start. Never fails the build:
// if the crawl can't run, the function falls back to crawling on demand.
import { getFundIndex } from '../server/fundindex.js';

try {
  const funds = await getFundIndex();
  console.log(`Prebuilt fund index: ${funds.length} funds.`);
} catch (err) {
  console.warn(`Fund index prebuild skipped: ${err.message}. Runtime will build on demand.`);
}
