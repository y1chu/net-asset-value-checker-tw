// fetch with a hard timeout. Without this, a slow/unresponsive upstream (the
// Taiwan sites can be slow from a US datacenter) hangs the whole serverless
// function until its 30s limit. Abort fast and let callers degrade gracefully.
export async function fetchT(url, opts = {}, ms = 7000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}
