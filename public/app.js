const $ = (id) => document.getElementById(id);
const main = $('main');
const form = $('fundForm');
const input = $('codeInput');
const suggest = $('suggest');
const menuBtn = $('menuBtn');
const drawer = $('drawer');
const favList = $('favList');
const hero = document.querySelector('.hero');
const REFRESH_MS = 30000;

let timer = null;
let currentCode = null;
let currentName = null;
let hasData = false;               // true once the current fund has rendered at least once
let favorites = loadFavorites();
let sugList = [];
let sugActive = -1;

const fmtPct = (v, s = true) => (v == null ? '—' : `${s && v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const fmtPrice = (v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const cls = (v) => (v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const dirClass = (v) => (v == null ? 'dir-flat' : v > 0 ? 'dir-up' : v < 0 ? 'dir-down' : 'dir-flat');
const arrow = (v) => (v == null ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '—');
const setState = (s) => { main.dataset.state = s; };

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

/* ---------------------------- Favorites ---------------------------- */
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; }
}
function saveFavorites() { localStorage.setItem('favorites', JSON.stringify(favorites)); }
function isFav(code) { return favorites.some((f) => f.code === code); }
function toggleFav() {
  if (!currentCode) return;
  if (isFav(currentCode)) favorites = favorites.filter((f) => f.code !== currentCode);
  else favorites.unshift({ code: currentCode, name: currentName || currentCode });
  saveFavorites();
  renderFavList();
  updateStar();
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

  if (!favorites.length) {
    favList.innerHTML = `<p class="fav-empty">尚無常用基金</p>`;
    return;
  }
  favList.innerHTML = favorites.map((f) => {
    const cur = f.code === currentCode ? ' current' : '';
    return `<div class="fav-item${cur}" data-code="${f.code}" data-name="${encodeURIComponent(f.name)}">
      <button type="button" class="fav-open"><span class="fav-name">${f.name}</span><span class="fav-code">${f.code}</span></button>
      <button type="button" class="x" data-x="${f.code}" aria-label="移除">×</button></div>`;
  }).join('');
}
favList.addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) { favorites = favorites.filter((f) => f.code !== x.dataset.x); saveFavorites(); renderFavList(); updateStar(); return; }
  const item = e.target.closest('.fav-item');
  if (item) { start(item.dataset.code, decodeURIComponent(item.dataset.name)); closeDrawer(); }
});

/* ---------------------------- Drawer ---------------------------- */
let lastFocus = null;
function openDrawer() {
  lastFocus = document.activeElement;
  drawer.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  drawer.querySelector('.drawer-close').focus();
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
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const { results } = await res.json();
    sugList = results || [];
    renderSuggest();
  } catch { hideSuggest(); }
}
function renderSuggest() {
  sugActive = -1;
  if (!sugList.length) {
    suggest.innerHTML = `<li class="s-empty">找不到基金；也可直接輸入代碼查詢</li>`;
    suggest.classList.remove('hidden');
    return;
  }
  suggest.innerHTML = sugList.map((f, i) =>
    `<li data-i="${i}" role="option"><span class="s-name">${f.name}</span>
       <span class="s-co">${f.company || ''}</span>
       <span class="s-code">${f.code}</span></li>`).join('');
  suggest.classList.remove('hidden');
}
function hideSuggest() { suggest.classList.add('hidden'); sugList = []; sugActive = -1; }
suggest.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-i]');
  if (!li) return;
  e.preventDefault();
  start(sugList[+li.dataset.i].code, sugList[+li.dataset.i].name);
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
    start(sugList[sugActive].code, sugList[sugActive].name);
  }
});
$('clearBtn').addEventListener('click', () => {
  input.value = ''; $('clearBtn').classList.add('hidden'); hideSuggest(); input.focus();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) hideSuggest(); });
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) start(q.toUpperCase(), null);
});

/* ---------------------------- Load + render ---------------------------- */
function showLoading() {
  setState('loading');
  $('fundName').innerHTML = '<span class="skeleton skel-name"></span>';
  hero.className = 'hero';
  $('estArrow').textContent = '';
  $('estMove').innerHTML = '<span class="skeleton skel-hero"></span>';
  $('trust').innerHTML = Array.from({ length: 3 }, () =>
    `<div class="trust-item"><span class="skeleton skel-row" style="width:60%"></span>
       <span class="skeleton skel-row" style="width:80%"></span></div>`).join('');
  $('holdingsBody').innerHTML = Array.from({ length: 4 }, () =>
    `<tr><td colspan="5"><span class="skeleton skel-row"></span></td></tr>`).join('');
}
function showError(msg) {
  setState('error');
  hero.className = 'hero';
  $('estArrow').textContent = '';
  $('estMove').textContent = '';
  $('estError').textContent = msg;
  $('fundName').textContent = currentName ? `${currentName}（${currentCode}）` : currentCode;
  updateStar();
}
async function load(code, { settle = false } = {}) {
  try {
    const res = await fetch(`/api/fund/${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '查詢失敗');
    render(data, settle);
  } catch (err) {
    if (!hasData) showError(err.message);   // keep last-good data on refresh failures
  }
}
function render(d, settle) {
  currentName = d.fundName || currentName || d.fundCode;
  const fav = favorites.find((f) => f.code === currentCode);
  if (fav && fav.name !== currentName) { fav.name = currentName; saveFavorites(); renderFavList(); }

  $('fundName').textContent = `${currentName}（${d.fundCode}）`;
  updateStar();

  // Hero
  hero.className = `hero ${dirClass(d.estimatedMovePct)}`;
  $('estArrow').textContent = arrow(d.estimatedMovePct);
  $('estMove').textContent = fmtPct(d.estimatedMovePct);
  if (settle) {
    hero.classList.remove('settle');
    void hero.offsetWidth;             // restart animation
    hero.classList.add('settle');
  }

  // Trust strip
  const t = new Date(d.updatedAt).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
  $('trust').innerHTML = `
    <div class="trust-item"><span class="t-label">資料月份</span><span class="t-value">${d.asOf || '—'}</span></div>
    <div class="trust-item">
      <span class="t-label">估算涵蓋</span><span class="t-value">${d.disclosedWeight.toFixed(1)}%</span>
    </div>
    <div class="trust-item"><span class="t-label">更新時間</span><span class="t-value t-live">${t}</span></div>
    ${d.unresolved.length
      ? `<div class="trust-item full"><span class="t-label">未取價</span><span class="t-value warn">${d.unresolved.join('、')}</span></div>`
      : ''}`;

  // Holdings
  const maxContrib = Math.max(0.01, ...d.holdings.map((h) => Math.abs(h.contribution || 0)));
  $('holdingsBody').innerHTML = d.holdings.map((h) => {
    if (!h.code) {
      return `<tr>
        <td class="name miss">${h.name}<span class="code">未對應</span></td>
        <td class="num weight">${h.weight.toFixed(2)}%</td>
        <td class="num miss" colspan="3">未取價</td></tr>`;
    }
    const barW = Math.round((Math.abs(h.contribution || 0) / maxContrib) * 40);
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
  setState('loaded');
}

function start(code, name) {
  currentCode = String(code).toUpperCase();
  currentName = name || null;
  hasData = false;
  localStorage.setItem('fundCode', currentCode);
  input.value = '';
  $('clearBtn').classList.add('hidden');
  hideSuggest();
  input.blur();
  renderFavList();
  updateStar();
  clearInterval(timer);
  showLoading();
  load(currentCode, { settle: true });
  timer = setInterval(() => load(currentCode), REFRESH_MS);
}

$('starBtn').addEventListener('click', toggleFav);

document.addEventListener('visibilitychange', () => {
  if (!currentCode) return;
  if (document.hidden) clearInterval(timer);
  else { load(currentCode, { settle: true }); timer = setInterval(() => load(currentCode), REFRESH_MS); }
});

/* ---------------------------- Boot ---------------------------- */
renderFavList();
const saved = localStorage.getItem('fundCode');
if (saved) start(saved, favorites.find((f) => f.code === saved)?.name || null);
