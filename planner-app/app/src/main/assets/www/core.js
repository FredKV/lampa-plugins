'use strict';
/* =====================================================================
   ЛАД — core: helpers, storage + migrations, router, UI primitives
   ===================================================================== */

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000); // b - a
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parseYmd(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const num = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const round2 = n => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isUrl = s => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(s || '').trim());
const money = (n, sign = false) => {
  const v = round2(n || 0);
  const s = Math.abs(v).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '')) + s + ' ₴';
};
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};
const fmtDateTime = ts => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_LOC = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'];
const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WD_FULL = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];

function dateLabel(s, withWeekday = true) {
  const t = today();
  if (s === t) return 'Сьогодні';
  if (s === addDays(t, 1)) return 'Завтра';
  if (s === addDays(t, -1)) return 'Вчора';
  const d = parseYmd(s);
  let r = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  if (d.getFullYear() !== new Date().getFullYear()) r += ` ${d.getFullYear()}`;
  if (withWeekday) r += `, ${WD_FULL[d.getDay()]}`;
  return r;
}
const shortDate = s => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };

/* ---------------- icons ---------------- */
const P = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  home: `<svg viewBox="0 0 24 24" ${P}><path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.8 1.8 0 0 1-1.8 1.8H5.3A1.8 1.8 0 0 1 3.5 19z"/><path d="M9.5 20.8v-6h5v6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" ${P}><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" ${P}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11.5" rx="3"/><path d="M16 13.8h1.5"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" ${P}><path d="M3 4h2.2l2.2 11h10.4l2-8H6.3"/><circle cx="9" cy="19.2" r="1.4"/><circle cx="17" cy="19.2" r="1.4"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" ${P}><rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" ${P}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" ${P}><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>`,
  finger: `<svg viewBox="0 0 24 24" ${P}><path d="M12 11v3.5c0 2-.6 3.8-1.6 5.3"/><path d="M8.6 9.5A3.5 3.5 0 0 1 15.5 11v2.5c0 1.6-.2 3.2-.7 4.6"/><path d="M5.6 8a7 7 0 0 1 12.8 3v1.5c0 1.6-.2 3.1-.6 4.6"/><path d="M8.5 14.5c0 1.8-.4 3.5-1.2 4.9M5.5 12.5c0 1.4-.2 2.7-.7 4"/><path d="M7.5 4.6a9 9 0 0 1 11.5 2.3"/></svg>`,
  backspace: `<svg viewBox="0 0 24 24" ${P}><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" ${P}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>`,
  ext: `<svg viewBox="0 0 24 24" ${P}><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" ${P}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${P}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" ${P}><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2c.6 5.2 4.8 9.4 10 10-5.2.6-9.4 4.8-10 10-.6-5.2-4.8-9.4-10-10 5.2-.6 9.4-4.8 10-10z"/></svg>`
};
function paintIcons(root = document) {
  $$('i[data-ic]', root).forEach(i => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.ic] || ''; });
}

/* ---------------- storage + migrations ---------------- */
const KEY = 'planer.v1';           // historic key name kept so existing data is found
const SCHEMA = 3;
const DEF = {
  v: SCHEMA,
  tasks: [], events: [], tx: [], shop: [], recipes: [],
  customCats: [], budget: { total: 0, cats: {} },
  cycle: { periods: [], remind: true, remindDays: 2, hide: false },
  people: [], wishes: [], favs: [],
  prices: { city: '', stores: null, lastRun: null },
  weather: { mode: 'auto', place: null },
  settings: { model: 'gemini-2.5-flash', theme: 'auto', name: '', pin: '', bio: false, notif: true, avatar: '' }
};

const MIGRATIONS = {
  // v1 (Мій день) → v2 (Танічка, now ЛАД): new modules, payment method, category set, key moved out of web storage
  1: d => {
    const oldOnly = { home: ['🏠', 'Дім'], phone: ['📱', 'Звʼязок'], kids: ['🧸', 'Діти'] };
    d.customCats = d.customCats || [];
    (d.tx || []).forEach(t => {
      if (!t.pay) t.pay = 'card';
      if (t.type === 'exp' && oldOnly[t.cat] && !d.customCats.some(c => c.id === t.cat))
        d.customCats.push({ id: t.cat, type: 'exp', emoji: oldOnly[t.cat][0], name: oldOnly[t.cat][1] });
    });
    if (d.settings && d.settings.apiKey) { d._legacyKey = d.settings.apiKey; delete d.settings.apiKey; }
    d.v = 2;
    return d;
  },
  // v2 → v3: product price search replaced by dish → ingredients → store comparison.
  // Kitchen history becomes saved recipes; product favourites are dropped (kept in the automatic backup).
  2: d => {
    d.recipes = d.recipes || [];
    (d.dishes || []).forEach(x => {
      if (!x || !x.dish || d.recipes.some(r => r.dish.toLowerCase() === String(x.dish).toLowerCase())) return;
      const servings = +x.servings || 2;
      d.recipes.push({
        id: x.id || uid(), dish: String(x.dish), servings, base: servings, steps: Array.isArray(x.steps) ? x.steps : [], ts: Date.now(),
        ingredients: (x.items || []).map(i => ({ id: uid(), name: String(i.name || ''), ...parseAmount(i.amount), have: false }))
      });
    });
    delete d.dishes;
    d.prices = { city: '', stores: null, lastRun: null };
    if (d.settings) delete d.settings.search;
    d.v = 3;
    return d;
  }
};

/** "500 г" / "2 шт" / "1,5 кг" / "2 ст. л." / "за смаком" → {qty, unit, grams, count} (grams = g or ml, approximate for spoons). */
function parseAmount(txt) {
  const t = String(txt || '').toLowerCase().replace(',', '.').trim();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(кг|г|гр|л|мл|шт|ст\.?\s*л|ч\.?\s*л|зубч\w*|пуч\w*|склян\w*|банк\w*)?/);
  if (!m) return { qty: 0, unit: 'за смаком', grams: 0, count: 0 };
  const q = parseFloat(m[1]), u = (m[2] || 'шт').replace(/\s/g, '');
  const map = { кг: ['кг', q * 1000], г: ['г', q], гр: ['г', q], л: ['л', q * 1000], мл: ['мл', q], шт: ['шт', 0] };
  if (map[u]) return { qty: q, unit: map[u][0], grams: map[u][1], count: u === 'шт' ? q : 0 };
  if (/^ст/.test(u)) return { qty: q, unit: 'ст. л.', grams: q * 15, count: 0 };
  if (/^ч/.test(u)) return { qty: q, unit: 'ч. л.', grams: q * 5, count: 0 };
  if (/^зуб/.test(u)) return { qty: q, unit: 'зубч.', grams: q * 5, count: 0 };
  if (/^пуч/.test(u)) return { qty: q, unit: 'пучок', grams: q * 50, count: 0 };
  if (/^скл/.test(u)) return { qty: q, unit: 'склянка', grams: q * 250, count: 0 };
  return { qty: q, unit: 'шт', grams: 0, count: q };
}

function migrate(d) {
  if (!d || typeof d !== 'object') return clone(DEF);
  let v = d.v || 1;
  while (v < SCHEMA && MIGRATIONS[v]) { d = MIGRATIONS[v](d); v = d.v; }
  // fill any missing top-level structure without touching existing values
  const out = { ...clone(DEF), ...d };
  out.settings = { ...DEF.settings, ...(d.settings || {}) };
  out.budget = { ...DEF.budget, ...(d.budget || {}) };
  out.cycle = { ...DEF.cycle, ...(d.cycle || {}) };
  out.prices = { ...DEF.prices, ...(d.prices || {}) };
  out.weather = { ...DEF.weather, ...(d.weather || {}) };
  ['tasks', 'events', 'tx', 'shop', 'recipes', 'customCats', 'people', 'wishes', 'favs'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.v = SCHEMA;
  return out;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if ((d.v || 1) < SCHEMA) { try { localStorage.setItem(KEY + '.backup.v' + (d.v || 1), raw); } catch (e) { } }
      return migrate(d);
    }
  } catch (e) { console.error('load failed', e); }
  return clone(DEF);
}
let S = load();
let saveTimer;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Не вдалося зберегти дані — памʼять переповнена'); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(syncReminders, 800);
}

/* ---------------- UI state + router ---------------- */
const U = { tab: 'home', stack: [], seg: {} };
const VIEWS = {};      // tab → () => html
const PAGES = {};      // page → (params) => ({title, html})
const TAB_HEADERS = {}; // tab → () => ({title (html), actions (html)}); the greeting is shown only on «Головна»
const FABS = {};       // tab|page → () => void
const A = {};          // click actions: name → (dataset, el, event)
const AFTER_RENDER = []; // hooks after every render
const TAB_ALIASES = { plans: 'home', kitchen: 'shop' }; // tabs from older versions
try { const t = localStorage.getItem('planer.tab'); if (t) U.tab = TAB_ALIASES[t] || t; } catch (e) { }

function navigate(page, p = {}) { U.stack.push({ page, p }); window.scrollTo(0, 0); render(); }
function back() { if (!U.stack.length) return false; U.stack.pop(); render(); return true; }
function replacePage(page, p = {}) { U.stack[U.stack.length - 1] = { page, p }; render(); }
function go(tab) {
  U.stack = [];
  if (U.tab !== tab) { U.tab = tab; try { localStorage.setItem('planer.tab', tab); } catch (e) { } window.scrollTo(0, 0); }
  render();
}
function renderHeader(title, actions) {
  const head = $('#top');
  if (title !== undefined) {
    head.innerHTML = `<button class="icon-btn" data-a="back" aria-label="Назад">${ICONS.back}</button>
      <div class="grow page-title ellipsis">${esc(title)}</div>${actions ? `<div class="head-actions">${actions}</div>` : '<span style="width:44px"></span>'}`;
    return;
  }
  if (U.tab !== 'home' && TAB_HEADERS[U.tab]) {
    const t = TAB_HEADERS[U.tab]();
    head.innerHTML = `<div class="grow tab-title">${t.title}</div>${t.actions ? `<div class="head-actions">${t.actions}</div>` : ''}`;
    return;
  }
  const h = new Date().getHours();
  const g = h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
  const d = new Date();
  const wd = WD_FULL[d.getDay()];
  head.innerHTML = `<div class="grow">
      <div class="hello">${esc(S.settings.name ? `${g}, ${S.settings.name}` : g)}</div>
      <div class="sub">${wd[0].toUpperCase() + wd.slice(1)}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</div></div>
    ${S.settings.avatar ? `<button class="head-ava ph-box" data-a="settings" aria-label="Налаштування"><img data-photo="${esc(S.settings.avatar)}" alt=""></button>` : `<button class="icon-btn" data-a="settings" aria-label="Налаштування">${ICONS.gear}</button>`}`;
}
function render() {
  if (typeof closeDayPop === 'function') closeDayPop();
  const top = U.stack[U.stack.length - 1];
  let html;
  try {
    if (top) {
      const r = PAGES[top.page] ? PAGES[top.page](top.p) : null;
      if (!r) { U.stack.pop(); return render(); }
      renderHeader(r.title, r.actions);
      html = r.html;
    } else {
      renderHeader();
      html = (VIEWS[U.tab] || VIEWS.home)();
    }
  } catch (e) {
    console.error(e);
    html = `<div class="card"><b class="red">Помилка відображення</b><div class="small muted">${esc(e.message)}</div></div>`;
  }
  $('#view').innerHTML = html;
  paintIcons($('#view'));
  hydratePhotos($('#top'));
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === U.tab));
  const fab = FABS[top ? top.page : U.tab];
  const fabOn = !!fab && !(fab.visible && !fab.visible());
  $('#fab').classList.toggle('hidden', !fabOn); document.body.classList.toggle('has-fab', fabOn);
  const n = S.shop.filter(i => !i.bought).length;
  $('#shopBadge').textContent = n ? String(n) : '';
  hydratePhotos($('#view'));
  AFTER_RENDER.forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
/* ---------- switcher animation: the dark pill slides to the new option, content slides in ---------- */
const SegMem = new Map();
function animateSegs(root, scope) {
  $$('.seg', root).forEach((seg, n) => {
    const btns = [...seg.children].filter(b => b.tagName === 'BUTTON'); if (!btns.length) return;
    const f = btns[0], key = scope + '|' + n + '|' + (f.dataset.a || '') + (f.dataset.group || f.dataset.key || '') + btns.length;
    const idx = btns.findIndex(b => b.classList.contains('on')), prev = SegMem.get(key);
    SegMem.set(key, idx);
    if (prev === undefined || prev === idx || idx < 0 || prev < 0 || !btns[prev]) return;
    const from = btns[prev], to = btns[idx];
    const th = document.createElement('span'); th.className = 'seg-thumb';
    const place = (b) => { th.style.top = b.offsetTop + 'px'; th.style.height = b.offsetHeight + 'px'; th.style.width = b.offsetWidth + 'px'; th.style.transform = `translateX(${b.offsetLeft}px)`; };
    from.classList.add('was'); seg.classList.add('anim');
    th.style.transition = 'none'; place(from); seg.prepend(th);
    th.getBoundingClientRect();
    requestAnimationFrame(() => { th.style.transition = ''; place(to); seg.classList.add('go'); });
    setTimeout(() => { th.remove(); from.classList.remove('was'); seg.classList.remove('anim', 'go'); }, 360);
    // content after the switcher slides in from the side of the chosen option
    const dir = idx > prev ? 'swap-r' : 'swap-l';
    let el = seg.nextElementSibling;
    for (let k = 0; el && k < 4; k++, el = el.nextElementSibling) { el.classList.remove('swap-r', 'swap-l'); void el.offsetWidth; el.classList.add(dir); }
  });
}
AFTER_RENDER.push(() => { const top = U.stack[U.stack.length - 1]; animateSegs($('#view'), top ? top.page + JSON.stringify(top.p || {}) : 'tab:' + U.tab); });

const segUI = (key, options, cls = '', def) => {
  const val = U.seg[key] || def || options[0][0];
  return `<div class="seg ${cls}">${options.map(([v, l]) => `<button data-a="useg" data-key="${key}" data-val="${v}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}</div>`;
};
const segOf = (key, def) => U.seg[key] || def;

/* ---------------- native bridge ---------------- */
const Bridge = window.AndroidBridge || null;
const pendingCb = {};
window.__httpCb = (id, status, text) => { const p = pendingCb[id]; delete pendingCb[id]; if (p) p({ status, text }); };
window.__locCb = (id, lat, lon, name, err) => { const p = pendingCb[id]; delete pendingCb[id]; if (p) p({ lat, lon, name, err }); };
window.__setInsets = (t, b) => {
  document.documentElement.style.setProperty('--sat', t + 'px');
  document.documentElement.style.setProperty('--sab', b + 'px');
};
function http(method, url, body = null, headers = null) {
  if (Bridge && Bridge.http) return new Promise(res => { const id = uid(); pendingCb[id] = res; Bridge.http(method, url, body || '', headers ? JSON.stringify(headers) : '', id); });
  const h = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) };
  delete h['User-Agent']; // browsers forbid overriding it
  return fetch(url, { method, headers: h, body: body || undefined })
    .then(async r => ({ status: r.status, text: await r.text() }))
    .catch(e => ({ status: 0, text: String(e) }));
}
const DEV_KEY = 'tanichka.devkey'; // browser preview only; on Android the key lives in native storage
const Keys = {
  has: () => Bridge && Bridge.hasApiKey ? Bridge.hasApiKey() : !!localStorage.getItem(DEV_KEY),
  hint: () => Bridge && Bridge.apiKeyHint ? Bridge.apiKeyHint() : (localStorage.getItem(DEV_KEY) ? '••••' : ''),
  set: k => { if (Bridge && Bridge.setApiKey) Bridge.setApiKey(k || ''); else if (k) localStorage.setItem(DEV_KEY, k); else localStorage.removeItem(DEV_KEY); }
};
function geminiRaw(body) {
  const model = (S.settings.model || 'gemini-2.5-flash').trim();
  if (Bridge && Bridge.gemini) return new Promise(res => { const id = uid(); pendingCb[id] = res; Bridge.gemini(model, JSON.stringify(body), id); });
  const k = localStorage.getItem(DEV_KEY) || '';
  return http('POST', `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(k)}`, JSON.stringify(body));
}
/** Calls Gemini and returns {text, data}. Throws Error with a human message. */
async function gemini(body) {
  if (!Keys.has()) throw new Error('Додайте безкоштовний ключ Gemini у Налаштуваннях.');
  const r = await geminiRaw(body);
  let data = null; try { data = JSON.parse(r.text); } catch (e) { }
  if (r.status !== 200) {
    const msg = data && data.error ? data.error.message : r.text;
    const model = S.settings.model;
    let err;
    if (r.status === 0) err = 'Немає підключення до інтернету.';
    else if ((r.status === 400 && /api key/i.test(msg || '')) || r.status === 401) err = 'Ключ Gemini недійсний. Перевірте його в налаштуваннях.';
    else if (r.status === 403) err = 'Доступ заборонено (403). Перевірте ключ або чи доступний Gemini API у вашому регіоні.';
    else if (r.status === 404) err = `Модель «${model}» не знайдена. Змініть модель у налаштуваннях.`;
    else if (r.status === 429) err = 'Вичерпано безкоштовний ліміт запитів Gemini. Зачекайте й спробуйте пізніше.';
    else if (r.status >= 500) err = 'Сервіс Gemini тимчасово недоступний. Спробуйте пізніше.';
    else err = `Помилка ${r.status}: ${String(msg || '').slice(0, 200)}`;
    const e = new Error(err); e.status = r.status; throw e;
  }
  const cand = data && data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
  if (!text) throw new Error('Gemini повернув порожню відповідь. Спробуйте ще раз.');
  return { text, data, cand };
}
function extractJson(text) {
  const t = String(text || '').replace(/```json|```/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Не вдалося розібрати відповідь');
  return JSON.parse(t.slice(a, b + 1));
}
function openUrl(url) {
  if (!isUrl(url)) { toast('Некоректне посилання'); return; }
  if (Bridge && Bridge.openUrl) Bridge.openUrl(url); else window.open(url, '_blank', 'noopener');
}

/* ---------------- theme ---------------- */
const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && mq && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (Bridge && Bridge.setTheme) Bridge.setTheme(dark, dark ? '#0b0b0d' : '#e6f0fb');
}
if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

/* ---------------- photos (IndexedDB) ---------------- */
const Photos = (() => {
  let dbp = null; const cache = new Map();
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('tanichka-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('p', mode); const st = t.objectStore('p'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return {
    async put(dataUrl) { const id = 'ph_' + uid(); await tx('readwrite', s => s.put(dataUrl, id)); cache.set(id, dataUrl); return id; },
    async get(id) { if (!id) return null; if (cache.has(id)) return cache.get(id); const v = await tx('readonly', s => s.get(id)); if (v) cache.set(id, v); return v || null; },
    async del(id) { if (!id) return; cache.delete(id); try { await tx('readwrite', s => s.delete(id)); } catch (e) { } },
    async all() { const d = await db(); return new Promise(res => { const out = {}; const t = d.transaction('p', 'readonly'); const c = t.objectStore('p').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); }; }); },
    async clear() { cache.clear(); await tx('readwrite', s => s.clear()); }
  };
})();
function hydratePhotos(root) {
  $$('img[data-photo]', root).forEach(async img => {
    const v = await Photos.get(img.dataset.photo).catch(() => null);
    if (v) img.src = v; else img.closest('.ph-box') && img.closest('.ph-box').classList.add('ph-missing');
  });
}
/** Opens the system picker (gallery / camera), downscales and stores the image. Resolves to photo id or null. */
function pickPhoto(maxSide = 900) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      if (!/^image\//.test(f.type)) { toast('Оберіть зображення'); return resolve(null); }
      if (f.size > 25 * 1024 * 1024) { toast('Файл завеликий'); return resolve(null); }
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = async () => {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { resolve(await Photos.put(c.toDataURL('image/jpeg', 0.8))); }
        catch (e) { toast('Не вдалося зберегти фото'); resolve(null); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); toast('Не вдалося відкрити зображення'); resolve(null); };
      im.src = url;
    };
    inp.click();
  });
}
/** Photo field used inside sheets: <div class="ph-field" data-photo-field="id"> */
const photoField = (id, label = 'Додати фото') => `
  <div class="ph-field" id="phField" data-val="${esc(id || '')}">
    ${id ? `<div class="ph-box"><img data-photo="${esc(id)}" alt=""></div>` : ''}
    <button class="chip" data-a="phPick">${ICONS.camera.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:4px"')}${id ? 'Змінити фото' : label}</button>
    ${id ? `<button class="chip" data-a="phRemove">Прибрати</button>` : ''}
  </div>`;
const photoVal = root => { const f = $('#phField', root); return f ? f.dataset.val || '' : ''; };
Object.assign(A, {
  phPick: async () => {
    const f = $('#phField'); if (!f) return;
    const id = await pickPhoto(f.closest('[data-receipt]') ? 1400 : 900);
    if (!id) return;
    f.outerHTML = photoField(id);
    hydratePhotos($('#sheetBody'));
  },
  phRemove: () => { const f = $('#phField'); if (f) f.outerHTML = photoField(''); }
});

/* ---------------- UI primitives ---------------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
let sheetOnClose = null;
function openSheet(html, onMount, onClose) {
  if (sheetOnClose) { const f = sheetOnClose; sheetOnClose = null; f(); }
  $('#sheetBody').innerHTML = html;
  paintIcons($('#sheetBody'));
  hydratePhotos($('#sheetBody'));
  $('#sheet').scrollTop = 0;
  $('#sheetWrap').classList.add('open');
  sheetOnClose = onClose || null;
  if (typeof enhancePickers === 'function') enhancePickers($('#sheetBody'));
  animateSegs($('#sheetBody'), 'sheet:' + (($('#sheetBody h2') || {}).textContent || ''));
  if (onMount) onMount($('#sheetBody'));
}
function closeSheet() {
  if (!$('#sheetWrap').classList.contains('open')) return false;
  $('#sheetWrap').classList.remove('open');
  if (document.activeElement) document.activeElement.blur();
  const f = sheetOnClose; sheetOnClose = null; if (f) f();
  return true;
}
/** Replacement for window.confirm (which does nothing inside a WebView). */
function ask({ title, text = '', ok = 'Так', cancel = 'Скасувати', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    openSheet(`<h2>${esc(title)}</h2>${text ? `<div class="muted" style="line-height:1.45;margin-top:-6px">${text}</div>` : ''}
      <div class="btns two"><button class="btn ghost" data-a="askNo">${esc(cancel)}</button>
      <button class="btn ${danger ? 'danger solid' : ''}" data-a="askYes">${esc(ok)}</button></div>`,
      r => { r.__ask = finish; }, () => finish(false));
  });
}
/** Asks for a number. Resolves to number or null. */
function askNumber({ title, label = 'Сума, ₴', value = '', hint = '', ok = 'Зберегти', allowNegative = false, allowZero = false }) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    openSheet(`<h2>${esc(title)}</h2>${hint ? `<div class="small muted" style="margin:-8px 0 12px">${hint}</div>` : ''}
      <div class="field"><label>${esc(label)}</label><input class="input big" id="askNum" inputmode="decimal" value="${esc(value)}" placeholder="0"></div>
      <div class="btns"><button class="btn" data-a="askNumOk">${esc(ok)}</button></div>`,
      r => { r.__askNum = finish; r.__neg = allowNegative; r.__zero = allowZero; setTimeout(() => $('#askNum', r).focus(), 300); }, () => finish(null));
  });
}
Object.assign(A, {
  askYes: () => { const f = $('#sheetBody').__ask; $('#sheetBody').__ask = null; f && f(true); closeSheet(); },
  askNo: () => closeSheet(),
  askNumOk: () => {
    const r = $('#sheetBody'); const raw = $('#askNum', r).value;
    const v = num(raw);
    if (!raw.trim() || (!r.__zero && v === 0) || (!r.__neg && v < 0)) { toast('Введіть суму'); return; }
    if (Math.abs(v) > 1e9) { toast('Занадто велика сума'); return; }
    const f = r.__askNum; r.__askNum = null; f && f(round2(v)); closeSheet();
  }
});
const SEG_HOOKS = {};  // in-sheet segmented group → (value) => void
const USEG_HOOKS = {}; // page-level segmented key → (value) => true to cancel default re-render
const segVal = (root, group) => { const b = $(`[data-group="${group}"].on`, root); return b ? b.dataset.val : null; };
const seg = (group, options, val, cls = 'flat') =>
  `<div class="seg ${cls}">${options.map(([v, l]) => `<button data-a="seg" data-group="${group}" data-val="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
/** Compact pill that opens a product page in the browser */
const goLink = url => `<button class="go-link" data-a="openLink" data-url="${esc(url)}" aria-label="Відкрити товар у магазині">${ICONS.ext}</button>`;
const toggleHtml = (id, on) => `<button class="toggle ${on ? 'on' : ''}" data-a="toggle" id="${id}"></button>`;
const progressBar = (pct, color) => `<div class="progress"><div style="width:${clamp(pct, 0, 100)}%;${color ? 'background:' + color : ''}"></div></div>`;
const emptyCard = (emoji, text, btn) => `<div class="card empty"><div class="big">${emoji}</div>${text}${btn ? `<div class="btns"><button class="btn sm" style="margin:0 auto" ${btn.attrs}>${btn.label}</button></div>` : ''}</div>`;

/** Validates a sheet field; shows a toast and focuses the field on error. */
function invalid(id, msg) { toast(msg); const el = document.getElementById(id); if (el) { el.classList.add('err'); el.focus(); setTimeout(() => el.classList.remove('err'), 1500); } return true; }

/* ---------------- reminders (local notifications) ---------------- */
const REMINDER_PROVIDERS = []; // () => [{id, at(ms), title, text}]
function at9(dateStr, hour = 9) { const d = parseYmd(dateStr); d.setHours(hour, 0, 0, 0); return d.getTime(); }
function syncReminders() {
  if (!Bridge || !Bridge.setReminders) return;
  let list = [];
  if (S.settings.notif) {
    REMINDER_PROVIDERS.forEach(f => { try { list = list.concat(f()); } catch (e) { console.error(e); } });
    const now = Date.now(), horizon = now + 120 * 86400000;
    list = list.filter(r => r.at > now && r.at < horizon).sort((a, b) => a.at - b.at).slice(0, 100);
  }
  Bridge.setReminders(JSON.stringify(list));
}
function ensureNotifPermission() {
  if (Bridge && Bridge.notificationsAllowed && !Bridge.notificationsAllowed()) Bridge.requestNotifications();
}
window.__notifPerm = ok => { if (!ok) toast('Сповіщення вимкнені — нагадування не зʼявлятимуться'); };

/* ЛАД sign (launcher icon): one continuous line */
const LAD_SIGN = `<svg viewBox="190 340 640 340" aria-hidden="true"><path d="M222,640 L264.7,419.2 A36,36 0 0,1 335.4,419.7 L369.6,610.3 A36,36 0 0,0 440.4,610.3 L474.6,419.7 A36,36 0 0,1 545.4,419.7 L579.6,610.3 A36,36 0 0,0 650.4,610.3 L684.6,419.7 A36,36 0 0,1 755.3,418.9 L800,640 L700,640 M505,527 L562,527" fill="none" stroke="#000" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* launcher icons (activity-alias in the manifest): id, name, background, line */
const APP_ICONS = [['olive', 'Оливковий', '#C4C17C', '#000'], ['terra', 'Теракотовий', '#D0694A', '#000'], ['yellow', 'Жовтий', '#FDD935', '#1B0A3F'], ['white', 'Білий', '#FFFFFF', '#000'], ['black', 'Чорний', '#000000', '#FFF']];
const curIcon = () => { try { return (Bridge && Bridge.getIcon && Bridge.getIcon()) || 'olive'; } catch (e) { return 'olive'; } };

/* ---------------- Biometrics (fingerprint / face via system prompt) ---------------- */
const Bio = {
  available() { try { return !!(Bridge && Bridge.canBiometric && Bridge.canBiometric()); } catch (e) { return false; } },
  ask(title) {
    return new Promise(res => {
      if (!this.available()) return res(false);
      window.__bioCb = ok => { window.__bioCb = null; res(!!ok); };
      Bridge.biometric(title || 'ЛАД');
    });
  }
};

/* ---------------- PIN lock ---------------- */
async function hashPin(pin) {
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tanichka:' + pin));
      return 'sha:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { }
  let h = 5381; for (const c of 'tanichka:' + pin) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return 'djb:' + h.toString(16);
}
const Lock = {
  entered: '', locked: false, pausedAt: 0, mode: 'unlock', first: '', resolve: null,
  show(mode = 'unlock', resolve = null) {
    this.mode = mode; this.entered = ''; this.first = ''; this.resolve = resolve; this.locked = mode === 'unlock';
    $('#lock').classList.add('show'); this.draw();
    if (this.locked && this.bioOn()) setTimeout(() => this.bio(), 250);
  },
  bioOn() { return !!(S.settings.bio && Bio.available()); },
  bio() {
    if (!this.locked || this.bioBusy) return;
    this.bioBusy = true;
    Bio.ask('Розблокувати ЛАД').then(ok => { this.bioBusy = false; if (ok && this.locked) this.hide(); });
  },
  hide() { $('#lock').classList.remove('show'); this.locked = false; },
  title() { return this.mode === 'unlock' ? 'Введіть PIN-код' : this.first ? 'Повторіть PIN-код' : 'Новий PIN-код (4 цифри)'; },
  draw(err = '') {
    const name = S.settings.name, unlock = this.mode === 'unlock';
    const head = unlock && S.settings.avatar
      ? `<div class="lk-ava ph-box"><img data-photo="${esc(S.settings.avatar)}" alt=""></div>`
      : `<div class="lk-logo">${LAD_SIGN}</div>`;
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-a="pinKey" data-k="${n}">${n}</button>`).join('');
    const left = unlock ? (this.bioOn() ? `<button data-a="pinBio" class="kp-icon kp-bio" aria-label="Біометрія">${ICONS.finger}</button>` : '<span></span>')
      : '<button data-a="pinCancel" class="kp-icon kp-text">Скасувати</button>';
    $('#lock').innerHTML = `<div class="lock-in">
      ${head}
      <div class="lock-title">${unlock ? (name ? `Привіт, ${esc(name)}` : 'Привіт!') : this.title()}</div>
      <div class="lock-sub">${unlock ? (this.bioOn() ? 'Введіть PIN-код або відбиток пальця' : 'Введіть PIN-код') : this.first ? 'Ще раз для підтвердження' : 'Його запитуватимемо при вході'}</div>
      <div class="pin-dots ${err ? 'err' : ''}">${[0, 1, 2, 3].map(i => `<i class="${i < this.entered.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="lock-err">${err}</div>
      <div class="keypad">${keys}${left}
        <button data-a="pinKey" data-k="0">0</button><button data-a="pinKey" data-k="del" class="kp-icon" aria-label="Стерти">${ICONS.backspace}</button></div></div>`;
    if (unlock && S.settings.avatar) hydratePhotos($('#lock'));
  },
  async key(k) {
    if (k === 'del') { this.entered = this.entered.slice(0, -1); return this.draw(); }
    if (this.entered.length >= 4) return;
    this.entered += k; this.draw();
    if (this.entered.length < 4) return;
    if (this.mode === 'unlock') {
      if (await hashPin(this.entered) === S.settings.pin) this.hide();
      else { this.entered = ''; setTimeout(() => this.draw('Невірний PIN'), 120); }
    } else if (!this.first) { this.first = this.entered; this.entered = ''; setTimeout(() => this.draw(), 120); }
    else if (this.first === this.entered) { S.settings.pin = await hashPin(this.entered); save(); LockNative.sync(); this.hide(); toast('PIN-код встановлено'); this.resolve && this.resolve(true); }
    else { this.first = ''; this.entered = ''; setTimeout(() => this.draw('Коди не збігаються'), 120); }
  }
};
Object.assign(A, {
  pinKey: d => Lock.key(d.k),
  pinBio: () => Lock.bio(),
  pinCancel: () => { Lock.hide(); Lock.resolve && Lock.resolve(false); }
});
window.__onPause = () => { Lock.pausedAt = Date.now(); };
/* native side keeps a solid cover over the app until the lock is drawn */
const LockNative = {
  sync() { try { Bridge && Bridge.setLock && Bridge.setLock(!!S.settings.pin); } catch (e) { } },
  ready() { requestAnimationFrame(() => requestAnimationFrame(() => { try { Bridge && Bridge.lockReady && Bridge.lockReady(); } catch (e) { } })); }
};
window.__onResume = () => {
  if (S.settings.pin && !Lock.locked && Lock.pausedAt && Date.now() - Lock.pausedAt > 60000) Lock.show('unlock');
  LockNative.ready();
  if (window.__resumeHooks) window.__resumeHooks.forEach(f => f());
};
window.__resumeHooks = [];
