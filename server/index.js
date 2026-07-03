// Local dev / self-hosted entrypoint. Starts a normal Express server.
// (Netlify uses netlify/functions/api.js instead, which reuses the same app.)
import { app } from './app.js';
import { warmFundIndex } from './fundindex.js';
import { warmCnyesIndex } from './cnyesindex.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`NAV checker running: http://localhost:${PORT}`);
  warmFundIndex();  // fund search index
  warmCnyesIndex(); // cnyes name->id index for NAV history
});
