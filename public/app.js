const $ = (id) => document.getElementById(id);
const main = $('main');
const form = $('fundForm');
const input = $('codeInput');
const suggest = $('suggest');
const menuBtn = $('menuBtn');
const drawer = $('drawer');
const favList = $('favList');
const detailView = $('detailView');
const hero = detailView.querySelector('.hero');
const DETAIL_MS = 30000;
const HOME_MS = 60000;

let detailTimer = null, homeTimer = null;
let currentCode = null, currentName = null, hasData = false;
let favorites = loadFavorites();
let sugList = [], sugActive = -1;
let allRows = null, favRows = null;
const boardDir = { all: 'up', fav: 'up' };
const favEstimates = new Map(); // code -> { estimatedMovePct, nav, navDate, navChangePct }

const fmtPct = (v, s = true) => (v == null ? '—' : `${s && v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const fmtPrice = (v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const cls = (v) => (v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const dirCls = (v) => (v == null ? 'dir-flat' : v > 0 ? 'dir-up' : v < 0 ? 'dir-down' : 'dir-flat');
const arrow = (v) => (v == null ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '—');
const mmdd = (d) => (d ? d.replace(/^20\d\d\//, '').replace('/', '/') : '');
const getJSON = async (url) => { const r = await fetch(url); const j = await r.json(); if (!r.ok) throw new Error(j.error || '載入失敗'); return j; };
const fmtDate = (ts) => { const d = new Date(ts * 1000); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };

/* ---------------------------- NAV line chart (self-contained SVG) ---------------------------- */
function lineChartSVG(v) {
  const W = 600, H = 170, pad = 8, n = v.length;
  const min = Math.min(...v), max = Math.max(...v), span = (max - min) || 1;
  const x = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (val) => H - pad - ((val - min) / span) * (H - 2 * pad);
  const d = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(val).toFixed(1)}`).join(' ');
  const area = `${d} L ${x(n - 1).toFixed(1)} ${(H - pad).toFixed(1)} L ${x(0).toFixed(1)} ${(H - pad).toFixed(1)} Z`;
  const rising = v[n - 1] >= v[0];
  const c = rising ? 'var(--color-up)' : 'var(--color-down)';
  const g = rising ? 'cgu' : 'cgd';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="淨值走勢圖">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.18"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${g})"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ---------------------------- Theme ---------------------------- */
function effectiveTheme() {
  return document.documentElement.getAttribute('data-theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
$('themeBtn').addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch {}
});

/* ---------------------------- Navigation ---------------------------- */
function showHome() {
  main.dataset.view = 'home';
  clearInterval(detailTimer); detailTimer = null;
  loadHome();
  clearInterval(homeTimer);
  homeTimer = setInterval(loadHome, HOME_MS);
  window.scrollTo(0, 0);
}
function showDetail(code, name) {
  main.dataset.view = 'detail';
  clearInterval(homeTimer); homeTimer = null;
  start(code, name);
  window.scrollTo(0, 0);
}
$('homeBtn').addEventListener('click', showHome);
$('backBtn').addEventListener('click', showHome);

/* ---------------------------- Home: ranking boards ---------------------------- */
async function loadHome() {
  loadRanking();
  if (favorites.length) { $('favBoard').classList.remove('hidden'); loadFavEstimates(); }
  else { $('favBoard').classList.add('hidden'); }
}
async function loadRanking() {
  if (!allRows) $('allBoardList').innerHTML = '<li class="board-loading">載入中…</li>';
  try {
    const r = await getJSON('/api/ranking');
    allRows = r.results || [];
    renderMarket(r.market);
    renderBoard('all');
  } catch { if (!allRows) $('allBoardList').innerHTML = '<li class="board-empty">載入失敗，稍後再試</li>'; }
}
function renderMarket(m) {
  const el = $('marketStrip');
  if (!m || (!m.taiex && !m.otc)) { el.classList.add('hidden'); return; }
  const item = (name, d) => d ? `<div class="market-item"><span class="market-name">${name}</span>
    <span class="market-vals"><span class="market-last">${d.last.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
    <span class="market-chg ${cls(d.changePct)}">${arrow(d.changePct)} ${fmtPct(d.changePct)}</span></span></div>` : '';
  el.innerHTML = item('加權指數', m.taiex) + item('櫃買指數', m.otc);
  el.classList.remove('hidden');
}
async function loadFavEstimates() {
  const codes = favorites.map((f) => f.code).join(',');
  if (!codes) return;
  try {
    const results = (await getJSON(`/api/estimates?codes=${encodeURIComponent(codes)}`)).results || [];
    favRows = results;
    for (const r of results) favEstimates.set(r.code, r);
    renderBoard('fav');
    renderFavList();
  } catch { /* keep previous */ }
}
function renderBoard(which) {
  const rows = which === 'all' ? allRows : favRows;
  const listEl = which === 'all' ? $('allBoardList') : $('favBoardList');
  if (!rows) return;
  const ranked = rows.filter((r) => r.estimatedMovePct != null);
  if (!ranked.length) { listEl.innerHTML = '<li class="board-empty">目前無估算資料（可能非交易時間或無台股持股）</li>'; return; }
  const dir = boardDir[which];
  const sorted = [...ranked].sort((a, b) =>
    dir === 'up' ? b.estimatedMovePct - a.estimatedMovePct : a.estimatedMovePct - b.estimatedMovePct);
  const top = which === 'all' ? sorted.slice(0, 12) : sorted;
  listEl.innerHTML = top.map((r, i) =>
    `<li class="rank-row" data-code="${r.code}" data-name="${encodeURIComponent(r.name)}">
       <span class="rank-num">${i + 1}</span>
       <span class="rank-name">${r.name}</span>
       <span class="rank-move ${cls(r.estimatedMovePct)}">${arrow(r.estimatedMovePct)} ${fmtPct(r.estimatedMovePct)}</span>
     </li>`).join('');
}
document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dir]');
    if (!btn) return;
    const which = seg.dataset.board;
    boardDir[which] = btn.dataset.dir;
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
    renderBoard(which);
  });
});
$('homeView').addEventListener('click', (e) => {
  const row = e.target.closest('.rank-row');
  if (row) showDetail(row.dataset.code, decodeURIComponent(row.dataset.name));
});

/* ---------------------------- Favorites ---------------------------- */
function loadFavorites() { try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; } }
function saveFavorites() { localStorage.setItem('favorites', JSON.stringify(favorites)); }
function isFav(code) { return favorites.some((f) => f.code === code); }
function toggleFav() {
  if (!currentCode) return;
  if (isFav(currentCode)) favorites = favorites.filter((f) => f.code !== currentCode);
  else favorites.unshift({ code: currentCode, name: currentName || currentCode });
  saveFavorites(); renderFavList(); updateStar();
}
function updateStar() {
  const b = $('starBtn');
  const on = !!(currentCode && isFav(currentCode));
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? '從常用移除' : '加入常用');
}
function renderFavList() {
  const count = $('favCount');
  if (favorites.length) { count.textContent = favorites.length; count.classList.remove('hidden'); }
  else count.classList.add('hidden');
  if (!favorites.length) { favList.innerHTML = '<p class="fav-empty">尚無常用基金</p>'; return; }
  favList.innerHTML = favorites.map((f) => {
    const e = favEstimates.get(f.code);
    const cur = f.code === currentCode ? ' current' : '';
    const nav = e && e.nav != null ? `淨值 ${fmtPrice(e.nav)}` : '淨值 —';
    const est = e && e.estimatedMovePct != null
      ? `<span class="fav-est ${cls(e.estimatedMovePct)}">${arrow(e.estimatedMovePct)} ${fmtPct(e.estimatedMovePct)}</span>` : '';
    return `<div class="fav-item${cur}" data-code="${f.code}" data-name="${encodeURIComponent(f.name)}">
      <button type="button" class="fav-open">
        <span class="fav-name">${f.name}</span>
        <span class="fav-meta"><span class="fav-nav">${nav}</span>${est}<span class="fav-code">${f.code}</span></span>
      </button>
      <button type="button" class="x" data-x="${f.code}" aria-label="移除">×</button></div>`;
  }).join('');
}
favList.addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) { favorites = favorites.filter((f) => f.code !== x.dataset.x); saveFavorites(); renderFavList(); updateStar(); return; }
  const item = e.target.closest('.fav-item');
  if (item) { start(item.dataset.code, decodeURIComponent(item.dataset.name)); main.dataset.view = 'detail'; clearInterval(homeTimer); closeDrawer(); }
});

/* ---------------------------- Drawer ---------------------------- */
let lastFocus = null;
function openDrawer() {
  lastFocus = document.activeElement;
  drawer.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  drawer.querySelector('.drawer-close').focus();
  renderFavList();
  if (favorites.length) loadFavEstimates(); // refresh NAV every time the drawer opens
}
function closeDrawer() {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  if (lastFocus) lastFocus.focus();
}
menuBtn.addEventListener('click', openDrawer);
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/* ---------------------------- Search ---------------------------- */
let debounce = null;
input.addEventListener('input', () => {
  $('clearBtn').classList.toggle('hidden', !input.value);
  clearTimeout(debounce);
  const q = input.value.trim();
  if (!q) { hideSuggest(); return; }
  debounce = setTimeout(() => runSearch(q), 220);
});
async function runSearch(q) {
  try { sugList = (await getJSON(`/api/search?q=${encodeURIComponent(q)}`)).results || []; renderSuggest(); }
  catch { hideSuggest(); }
}
function renderSuggest() {
  sugActive = -1;
  if (!sugList.length) { suggest.innerHTML = '<li class="s-empty">找不到基金；也可直接輸入代碼查詢</li>'; suggest.classList.remove('hidden'); return; }
  suggest.innerHTML = sugList.map((f, i) =>
    `<li data-i="${i}" role="option"><span class="s-name">${f.name}</span>
       <span class="s-co">${f.company || ''}</span><span class="s-code">${f.code}</span></li>`).join('');
  suggest.classList.remove('hidden');
}
function hideSuggest() { suggest.classList.add('hidden'); sugList = []; sugActive = -1; }
suggest.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-i]');
  if (!li) return;
  e.preventDefault();
  showDetail(sugList[+li.dataset.i].code, sugList[+li.dataset.i].name);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hideSuggest(); return; }
  if (suggest.classList.contains('hidden') || !sugList.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sugActive = (sugActive + (e.key === 'ArrowDown' ? 1 : -1) + sugList.length) % sugList.length;
    [...suggest.children].forEach((el, i) => el.classList.toggle('active', i === sugActive));
  } else if (e.key === 'Enter' && sugActive >= 0) {
    e.preventDefault();
    showDetail(sugList[sugActive].code, sugList[sugActive].name);
  }
});
$('clearBtn').addEventListener('click', () => { input.value = ''; $('clearBtn').classList.add('hidden'); hideSuggest(); input.focus(); });
document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) hideSuggest(); });
form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) showDetail(q.toUpperCase(), null); });

/* ---------------------------- Detail: load + render ---------------------------- */
let navSeries = null, chartRange = 132, chartName = null;
async function loadChart(name) {
  chartName = name; navSeries = null;
  $('chartCard').classList.remove('hidden');
  $('navChart').innerHTML = '<div class="chart-loading">載入中…</div>';
  $('chartChange').textContent = '';
  try {
    const { series } = await getJSON(`/api/navhistory?name=${encodeURIComponent(name)}`);
    if (name !== chartName) return; // superseded by another fund
    navSeries = series;
    drawChart();
  } catch { $('chartCard').classList.add('hidden'); }
}
function drawChart() {
  if (!navSeries || !navSeries.v || navSeries.v.length < 2) { $('chartCard').classList.add('hidden'); return; }
  $('chartCard').classList.remove('hidden');
  const { v, t } = navSeries;
  const start = chartRange && chartRange < v.length ? v.length - chartRange : 0;
  const vs = v.slice(start), ts = t.slice(start);
  $('navChart').innerHTML = lineChartSVG(vs);
  const chg = (vs[vs.length - 1] / vs[0] - 1) * 100;
  const cc = $('chartChange'); cc.textContent = fmtPct(chg); cc.className = `chart-change ${cls(chg)}`;
  $('chartStart').textContent = `${fmtDate(ts[0])}　${fmtPrice(vs[0])}`;
  $('chartEnd').textContent = `${fmtDate(ts[ts.length - 1])}　${fmtPrice(vs[vs.length - 1])}`;
}
$('chartRange').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-range]');
  if (!b) return;
  chartRange = +b.dataset.range;
  $('chartRange').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  drawChart();
});

function showLoading() {
  detailView.dataset.state = 'loading';
  $('fundName').innerHTML = '<span class="skeleton skel-name"></span>';
  hero.className = 'hero';
  $('estArrow').textContent = '';
  $('estMove').innerHTML = '<span class="skeleton skel-hero"></span>';
  $('navLine').classList.add('hidden');
  $('chartCard').classList.add('hidden');
  $('benchmark').classList.add('hidden');
  $('accNote').classList.add('hidden');
  $('fundamentals').classList.add('hidden');
  $('trust').innerHTML = Array.from({ length: 3 }, () =>
    '<div class="trust-item"><span class="skeleton skel-row" style="width:60%"></span><span class="skeleton skel-row" style="width:80%"></span></div>').join('');
  $('holdingsBody').innerHTML = Array.from({ length: 4 }, () =>
    '<tr><td colspan="5"><span class="skeleton skel-row"></span></td></tr>').join('');
}
function showError(msg) {
  detailView.dataset.state = 'error';
  hero.className = 'hero';
  $('estArrow').textContent = ''; $('estMove').textContent = '';
  $('estError').textContent = msg;
  $('fundName').textContent = currentName ? `${currentName}（${currentCode}）` : currentCode;
  updateStar();
}
async function load(code, settle) {
  try { render(await getJSON(`/api/fund/${encodeURIComponent(code)}`), settle); }
  catch (err) { if (!hasData) showError(err.message); }
}
function renderBenchmark(est, market) {
  const el = $('benchmark');
  const tx = market && market.taiex;
  if (!tx || est == null) { el.classList.add('hidden'); return; }
  const rel = est - tx.changePct;
  el.innerHTML =
    `<span class="bm-label">大盤</span><span class="${cls(tx.changePct)}">${arrow(tx.changePct)} ${fmtPct(tx.changePct)}</span>
     <span class="bm-label">估算相對</span><span class="bm-rel ${cls(rel)}">${fmtPct(rel)}</span>`;
  el.classList.remove('hidden');
}
function renderFundamentals(f) {
  const sec = $('fundamentals');
  if (!f) { sec.classList.add('hidden'); return; }
  $('factsCategory').textContent = f.category || '';
  const R = f.returns || {};
  const rt = (label, v) => `<div class="fact-return"><span class="fr-label">${label}</span><span class="fr-value ${cls(v)}">${fmtPct(v)}</span></div>`;
  $('factsReturns').innerHTML = [['近1月', R.m1], ['近3月', R.m3], ['近6月', R.m6], ['近1年', R.y1], ['近3年', R.y3], ['近5年', R.y5]]
    .map(([l, v]) => rt(l, v)).join('');
  const stars = f.starRating ? '★'.repeat(f.starRating) + '☆'.repeat(Math.max(0, 5 - f.starRating)) : '—';
  const size = f.totalNetAsset ? `${(f.totalNetAsset / 1e8).toLocaleString('en-US', { maximumFractionDigits: 0 })} 億` : '—';
  const inc = f.inceptionDate ? fmtDate(f.inceptionDate).slice(0, 7) : '—';
  const fact = (k, v, c = '') => `<div class="fact"><span class="fact-k">${k}</span><span class="fact-v ${c}">${v}</span></div>`;
  $('factsGrid').innerHTML = [
    fact('晨星評等', stars, 'stars'),
    fact('風險等級', f.riskLevel ? `RR${f.riskLevel}` : '—'),
    fact('經理費', f.managementFee != null ? `${f.managementFee}%` : '—'),
    fact('基金規模', size),
    fact('計價幣別', f.currency || '—'),
    fact('成立', inc),
  ].join('');
  sec.classList.remove('hidden');
}

/* Estimate-accuracy tracker (client-side): compare a day's estimate to the
   official NAV change once it's published. Accumulates on your device over time. */
const lsGet = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
function trackAccuracy(code, est, navDate, navChangePct) {
  if (est == null) return;
  const log = lsGet('estLog', {});
  log[code] = log[code] || {};
  log[code][todayKey()] = est; // last view of the day is closest to close
  const nk = navDate ? navDate.replace(/\//g, '') : null;
  if (nk && nk !== todayKey() && navChangePct != null && log[code][nk] != null) {
    const acc = lsGet('estAcc', []);
    acc.push({ err: Math.abs(log[code][nk] - navChangePct) });
    while (acc.length > 60) acc.shift();
    localStorage.setItem('estAcc', JSON.stringify(acc));
    delete log[code][nk];
  }
  localStorage.setItem('estLog', JSON.stringify(log));
  renderAccuracy();
}
function renderAccuracy() {
  const acc = lsGet('estAcc', []);
  const el = $('accNote');
  if (acc.length < 3) { el.classList.add('hidden'); return; }
  const mae = acc.reduce((a, x) => a + x.err, 0) / acc.length;
  el.textContent = `估算 vs 實際淨值　平均誤差 ±${mae.toFixed(2)}%（${acc.length} 筆）`;
  el.classList.remove('hidden');
}

function render(d, settle) {
  const firstLoad = !hasData;
  currentName = d.fundName || currentName || d.fundCode;
  const fav = favorites.find((f) => f.code === currentCode);
  if (fav && fav.name !== currentName) { fav.name = currentName; saveFavorites(); }
  if (firstLoad) loadChart(currentName); // NAV history once per fund, not on 30s refresh

  $('fundName').textContent = `${currentName}（${d.fundCode}）`;
  updateStar();

  hero.className = `hero ${dirCls(d.estimatedMovePct)}`;
  $('estArrow').textContent = arrow(d.estimatedMovePct);
  $('estMove').textContent = fmtPct(d.estimatedMovePct);
  if (settle) { hero.classList.remove('settle'); void hero.offsetWidth; hero.classList.add('settle'); }

  // NAV line
  if (d.nav != null) {
    $('navLine').classList.remove('hidden');
    $('navValue').textContent = fmtPrice(d.nav);
    const nc = $('navChange');
    nc.textContent = d.navChangePct != null ? fmtPct(d.navChangePct) : '';
    nc.className = `nav-change ${cls(d.navChangePct)}`;
    $('navDate').textContent = d.navDate ? mmdd(d.navDate) : '';
  } else {
    $('navLine').classList.add('hidden');
  }

  renderBenchmark(d.estimatedMovePct, d.market);
  renderFundamentals(d.fundamentals);
  trackAccuracy(currentCode, d.estimatedMovePct, d.navDate, d.navChangePct);

  const t = new Date(d.updatedAt).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
  $('trust').innerHTML = `
    <div class="trust-item"><span class="t-label">資料月份</span><span class="t-value">${d.asOf || '—'}</span></div>
    <div class="trust-item"><span class="t-label">估算涵蓋</span><span class="t-value">${d.disclosedWeight.toFixed(1)}%</span></div>
    <div class="trust-item"><span class="t-label">更新時間</span><span class="t-value t-live">${t}</span></div>
    ${d.unresolved.length ? `<div class="trust-item full"><span class="t-label">未取價</span><span class="t-value warn">${d.unresolved.join('、')}</span></div>` : ''}`;

  const maxC = Math.max(0.01, ...d.holdings.map((h) => Math.abs(h.contribution || 0)));
  $('holdingsBody').innerHTML = d.holdings.map((h) => {
    if (!h.code) {
      return `<tr>
        <td class="name miss">${h.name}<span class="code">未對應</span></td>
        <td class="num weight">${h.weight.toFixed(2)}%</td>
        <td class="num miss" colspan="3">未取價</td></tr>`;
    }
    const barW = Math.round((Math.abs(h.contribution || 0) / maxC) * 40);
    const barColor = h.contribution > 0 ? 'var(--color-up)' : h.contribution < 0 ? 'var(--color-down)' : 'var(--color-flat)';
    return `<tr>
      <td class="name">${h.name}<span class="code">${h.code}</span></td>
      <td class="num weight">${h.weight.toFixed(2)}%</td>
      <td class="num price">${fmtPrice(h.last)}</td>
      <td class="num ${cls(h.changePct)}">${fmtPct(h.changePct)}</td>
      <td class="num contrib-cell ${cls(h.contribution)}">
        <span class="contrib-wrap"><span>${fmtPct(h.contribution)}</span>
        <span class="contrib-bar" style="width:${barW}px;background:${barColor}"></span></span>
      </td></tr>`;
  }).join('');

  hasData = true;
  detailView.dataset.state = 'loaded';
}
function start(code, name) {
  currentCode = String(code).toUpperCase();
  currentName = name || null;
  hasData = false;
  input.value = ''; $('clearBtn').classList.add('hidden'); hideSuggest(); input.blur();
  updateStar();
  clearInterval(detailTimer);
  showLoading();
  load(currentCode, true);
  detailTimer = setInterval(() => load(currentCode), DETAIL_MS);
}
$('starBtn').addEventListener('click', toggleFav);

/* ---------------------------- Visibility ---------------------------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(detailTimer); clearInterval(homeTimer); return; }
  if (main.dataset.view === 'detail' && currentCode) { load(currentCode, true); detailTimer = setInterval(() => load(currentCode), DETAIL_MS); }
  else if (main.dataset.view === 'home') { loadHome(); homeTimer = setInterval(loadHome, HOME_MS); }
});

/* ---------------------------- Boot ---------------------------- */
renderFavList();
showHome();
