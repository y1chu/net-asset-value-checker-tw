// Wraps the shared Express app as a single Netlify Function.
// A redirect (see netlify.toml) sends /api/* here.
import serverless from 'serverless-http';
import { app } from '../../server/app.js';

const wrapped = serverless(app);

export const handler = async (event, context) => {
  // Normalize the path so Express always sees "/api/..." regardless of whether
  // Netlify hands us the original path or the "/.netlify/functions/api/..." form.
  let p = event.path || '';
  p = p.replace(/^\/\.netlify\/functions\/api/, '');
  if (!p.startsWith('/api')) p = '/api' + p;
  event.path = p;
  return wrapped(event, context);
};
