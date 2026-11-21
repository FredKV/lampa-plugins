'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = (n, sign = false) => {
  const v = Math.round(n * 100) / 100;
  const s = Math.abs(v).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '')) + s + ' ₴';
};

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_LOC = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'];
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

/* ================= icons ================= */
const P = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  plans: `<svg viewBox="0 0 24 24" ${P}><rect x="4" y="3.5" width="16" height="17" rx="3.5"/><path d="M8 9l1.6 1.6L12.5 7.7M8 15h8M14.5 9.5H16"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" ${P}><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" ${P}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11.5" rx="3"/><path d="M16 13.8h1.5"/></svg>`,
  chef: `<svg viewBox="0 0 24 24" ${P}><path d="M7 14.5a4 4 0 1 1 1.5-7.7 4 4 0 0 1 7 0A4 4 0 1 1 17 14.5V20H7z"/><path d="M7 17h10"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" ${P}><path d="M3 4h2.2l2.2 11h10.4l2-8H6.3"/><circle cx="9" cy="19.2" r="1.4"/><circle cx="17" cy="19.2" r="1.4"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2c.6 5.2 4.8 9.4 10 10-5.2.6-9.4 4.8-10 10-.6-5.2-4.8-9.4-10-10 5.2-.6 9.4-4.8 10-10z"/></svg>`
};
function paintIcons(root = document) {
  $$('i[data-ic]', root).forEach(i => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.ic] || ''; });
}

/* ================= state ================= */
const KEY = 'planer.v1';
const DEF = {
  tasks: [], events: [], tx: [], shop: [], dishes: [],
  settings: { apiKey: '', model: 'gemini-2.5-flash', search: false, theme: 'auto', name: '' }
};
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d) return { ...clone(DEF), ...d, settings: { ...DEF.settings, ...(d.settings || {}) } };
  } catch (e) { }
  return clone(DEF);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не вдалося зберегти дані'); } }

const now = new Date();
const U = {
  tab: 'plans', planFilter: 'active',
  cal: { y: now.getFullYear(), m: now.getMonth() }, calSel: today(),
  fin: { y: now.getFullYear(), m: now.getMonth() },
  kitchen: null, loading: false, dish: '', servings: 2, kError: ''
};
try { const t = localStorage.getItem('planer.tab'); if (t) U.tab = t; } catch (e) { }

/* ================= categories ================= */
const CATS = {
  exp: [['food', '🛒', 'Продукти'], ['cafe', '🍔', 'Кафе'], ['transport', '🚕', 'Транспорт'], ['home', '🏠', 'Дім'], ['utils', '💡', 'Комуналка'],
    ['health', '💊', 'Здоровʼя'], ['clothes', '👕', 'Одяг'], ['fun', '🎮', 'Розваги'], ['phone', '📱', 'Звʼязок'], ['gift', '🎁', 'Подарунки'],
    ['beauty', '💅', 'Краса'], ['kids', '🧸', 'Діти'], ['other', '📦', 'Інше']],
  inc: [['salary', '💼', 'Зарплата'], ['side', '💸', 'Підробіток'], ['gift', '🎁', 'Подарунок'], ['invest', '📈', 'Інвестиції'], ['cashback', '🪙', 'Кешбек'], ['other', '📦', 'Інше']]
};
const catOf = (type, id) => (CATS[type].find(c => c[0] === id) || CATS[type][CATS[type].length - 1]);
const CAT_COLORS = ['#3b6cff', '#e5484d', '#18a058', '#f5a524', '#8e4ec6', '#12a594', '#d6409f', '#f76b15', '#0090ff', '#978365', '#5b5bd6', '#30a46c', '#8b8d98'];

/* ================= native bridge ================= */
const Bridge = window.AndroidBridge || null;
const pendingHttp = {};
window.__httpCb = (id, status, text) => { const p = pendingHttp[id]; delete pendingHttp[id]; if (p) p({ status, text }); };
window.__setInsets = (t, b) => {
  document.documentElement.style.setProperty('--sat', t + 'px');
  document.documentElement.style.setProperty('--sab', b + 'px');
};
function httpPost(url, body) {
  if (Bridge && Bridge.httpPost) {
    return new Promise(res => { const id = uid(); pendingHttp[id] = res; Bridge.httpPost(url, body, id); });
  }
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    .then(async r => ({ status: r.status, text: await r.text() }))
    .catch(e => ({ status: 0, text: String(e) }));
}
function openUrl(url) { if (Bridge && Bridge.openUrl) Bridge.openUrl(url); else window.open(url, '_blank'); }

/* ================= theme ================= */
const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && mq && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (Bridge && Bridge.setTheme) Bridge.setTheme(dark, dark ? '#0b0b0d' : '#e6f0fb');
}
if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

/* ================= UI primitives ================= */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2300);
}
let sheetOnClose = null;
function openSheet(html, onMount, onClose) {
  $('#sheetBody').innerHTML = html;
  paintIcons($('#sheetBody'));
  $('#sheet').scrollTop = 0;
  $('#sheetWrap').classList.add('open');
  sheetOnClose = onClose || null;
  if (onMount) onMount($('#sheetBody'));
}
function closeSheet() {
  if (!$('#sheetWrap').classList.contains('open')) return false;
  $('#sheetWrap').classList.remove('open');
  if (document.activeElement) document.activeElement.blur();
  const f = sheetOnClose; sheetOnClose = null; if (f) f();
  return true;
}
const segVal = (root, group) => { const b = $(`[data-group="${group}"].on`, root); return b ? b.dataset.val : null; };
const seg = (group, options, val, cls = 'flat') =>
  `<div class="seg ${cls}">${options.map(([v, l]) => `<button data-a="seg" data-group="${group}" data-val="${v}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const toggleHtml = (id, on) => `<button class="toggle ${on ? 'on' : ''}" data-a="toggle" id="${id}"></button>`;

/* ================= header ================= */
function renderHeader() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
  $('#hello').textContent = S.settings.name ? `${g}, ${S.settings.name}` : g;
  const d = new Date();
  $('#today').textContent = `${WD_FULL[d.getDay()][0].toUpperCase() + WD_FULL[d.getDay()].slice(1)}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/* ================= PLANS ================= */
const PRIO = { 3: ['Високий', 'var(--red)'], 2: ['Середній', 'var(--amber)'], 1: ['Низький', 'var(--green)'] };
function taskSort(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if ((b.prio || 1) !== (a.prio || 1)) return (b.prio || 1) - (a.prio || 1);
  return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
}
function taskRow(t) {
  const tdy = today();
  let due = '';
  if (t.due) {
    const over = !t.done && t.due < tdy;
    due = `<span class="pill ${over ? 'red' : t.due === tdy ? 'blue' : ''}">${over ? 'Прострочено · ' : ''}${dateLabel(t.due, false)}</span>`;
  }
  const pr = PRIO[t.prio || 1];
  return `<div class="item ${t.done ? 'done' : ''}">
    <button class="check round ${t.done ? 'on' : ''}" data-a="taskToggle" data-id="${t.id}"></button>
    <div class="grow" data-a="taskEdit" data-id="${t.id}">
      <div class="title">${esc(t.title)}</div>
      <div class="meta"><span class="dot" style="background:${pr[1]}"></span>${pr[0]}${due ? ' ' + due : ''}${t.note ? `<span class="ellipsis" style="max-width:100%">${esc(t.note)}</span>` : ''}</div>
    </div></div>`;
}
function vPlans() {
  const tdy = today();
  const active = S.tasks.filter(t => !t.done);
  const done = S.tasks.filter(t => t.done);
  const todayCnt = active.filter(t => t.due && t.due <= tdy).length;
  const pct = S.tasks.length ? Math.round(done.length / S.tasks.length * 100) : 0;
  const list = (U.planFilter === 'active' ? active : U.planFilter === 'done' ? done : S.tasks.slice()).sort(taskSort);
  const evToday = S.events.filter(e => e.date === tdy).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
  return `
    <div class="stats">
      <div class="stat"><b>${todayCnt}</b><span>на сьогодні</span></div>
      <div class="stat"><b>${active.length}</b><span>активних</span></div>
      <div class="stat"><b>${done.length}</b><span>виконано</span></div>
    </div>
    ${S.tasks.length ? `<div class="card"><div class="row between"><b>Прогрес</b><span class="muted">${pct}%</span></div><div class="progress"><div style="width:${pct}%"></div></div></div>` : ''}
    ${evToday.length ? `<h2>Сьогодні в календарі</h2><div class="list">${evToday.map(eventRow).join('')}</div>` : ''}
    <h2>Мої плани</h2>
    ${seg('planFilter', [['active', 'Активні'], ['done', 'Виконані'], ['all', 'Усі']], U.planFilter, '')}
    ${list.length ? `<div class="list">${list.map(taskRow).join('')}</div>`
      : `<div class="card empty"><div class="big">${U.planFilter === 'done' ? '🏁' : '📝'}</div>${U.planFilter === 'done' ? 'Ще нічого не виконано' : 'Планів поки немає.<br>Натисніть «+», щоб додати перший.'}</div>`}
    ${done.length && U.planFilter !== 'active' ? `<button class="btn ghost" data-a="clearDone">Видалити виконані</button>` : ''}`;
}
function taskSheet(id) {
  const t = S.tasks.find(x => x.id === id) || { title: '', note: '', prio: 2, due: '' };
  openSheet(`
    <h2>${id ? 'Редагувати план' : 'Новий план'}</h2>
    <div class="field"><input class="input" id="tTitle" placeholder="Що потрібно зробити?" value="${esc(t.title)}"></div>
    <div class="field"><textarea class="input" id="tNote" placeholder="Нотатка (необовʼязково)">${esc(t.note)}</textarea></div>
    <div class="field"><label>Пріоритет</label>${seg('prio', [['1', 'Низький'], ['2', 'Середній'], ['3', 'Високий']], String(t.prio || 2))}</div>
    <div class="field"><label>Термін</label>
      <div class="chips" style="margin-bottom:8px">
        <button class="chip" data-a="setDue" data-d="0">Сьогодні</button><button class="chip" data-a="setDue" data-d="1">Завтра</button>
        <button class="chip" data-a="setDue" data-d="7">Через тиждень</button><button class="chip" data-a="setDue" data-d="">Без дати</button></div>
      <input type="date" class="input" id="tDue" value="${t.due || ''}"></div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="taskDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="taskSave" data-id="${id || ''}">Зберегти</button>
    </div>`, r => { if (!id) setTimeout(() => $('#tTitle', r).focus(), 300); });
}

/* ================= CALENDAR ================= */
function eventRow(e) {
  return `<div class="item" data-a="eventEdit" data-id="${e.id}">
    <div class="emoji" style="font-size:15px;font-weight:600">${e.time ? esc(e.time) : (e.important ? '⭐' : '📌')}</div>
    <div class="grow"><div class="title">${e.important ? '⭐ ' : ''}${esc(e.title)}</div>
    ${e.note ? `<div class="meta ellipsis">${esc(e.note)}</div>` : ''}</div></div>`;
}
function vCalendar() {
  const { y, m } = U.cal;
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - offset);
  const tdy = today();
  const byDate = {};
  S.events.forEach(e => { (byDate[e.date] = byDate[e.date] || { ev: 0, imp: 0, task: 0 }); byDate[e.date][e.important ? 'imp' : 'ev']++; });
  S.tasks.forEach(t => { if (t.due && !t.done) { (byDate[t.due] = byDate[t.due] || { ev: 0, imp: 0, task: 0 }); byDate[t.due].task++; } });
  let cells = WD.map((w, i) => `<div class="wd ${i > 4 ? 'we' : ''}">${w}</div>`).join('');
  const weeks = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = ymd(d); const info = byDate[s];
    const dots = info ? `${info.imp ? '<i style="background:var(--red)"></i>' : ''}${info.ev ? '<i style="background:var(--blue)"></i>' : ''}${info.task ? '<i style="background:var(--green)"></i>' : ''}` : '';
    cells += `<button class="day ${d.getMonth() !== m ? 'other' : ''} ${s === tdy ? 'today' : ''} ${s === U.calSel ? 'sel' : ''}" data-a="calPick" data-d="${s}">
      ${d.getDate()}<span class="dots">${dots}</span></button>`;
  }
  const sel = U.calSel;
  const evs = S.events.filter(e => e.date === sel).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  const tasks = S.tasks.filter(t => t.due === sel);
  const upcoming = S.events.filter(e => e.important && e.date >= tdy).sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1).slice(0, 5);
  return `
    <div class="card">
      <div class="cal-head"><button class="nav-btn" data-a="calNav" data-d="-1">‹</button>
        <b>${MONTHS[m]} ${y}</b><button class="nav-btn" data-a="calNav" data-d="1">›</button></div>
      <div class="cal-grid">${cells}</div>
      <div class="row small muted" style="margin-top:12px;gap:14px;justify-content:center">
        <span class="row" style="gap:5px"><span class="dot" style="background:var(--red)"></span>Важливо</span>
        <span class="row" style="gap:5px"><span class="dot" style="background:var(--blue)"></span>Подія</span>
        <span class="row" style="gap:5px"><span class="dot" style="background:var(--green)"></span>План</span></div>
    </div>
    <div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">${dateLabel(sel)}</h2>
      ${sel !== tdy ? `<button class="chip" data-a="calToday">Сьогодні</button>` : ''}</div>
    ${evs.length || tasks.length ? `<div class="list">${evs.map(eventRow).join('')}${tasks.map(taskRow).join('')}</div>`
      : `<div class="card empty" style="padding:22px">Справ на цей день немає<div class="btns"><button class="btn sm" style="margin:0 auto" data-a="eventNew">Додати справу</button></div></div>`}
    ${upcoming.length ? `<h2>Найближчі важливі</h2><div class="list">${upcoming.map(e => `<div class="item" data-a="eventEdit" data-id="${e.id}">
      <div class="emoji">⭐</div><div class="grow"><div class="title">${esc(e.title)}</div>
      <div class="meta">${dateLabel(e.date)}${e.time ? ' · ' + esc(e.time) : ''}</div></div></div>`).join('')}</div>` : ''}`;
}
function eventSheet(id, date) {
  const e = S.events.find(x => x.id === id) || { title: '', note: '', date: date || U.calSel, time: '', important: true };
  openSheet(`
    <h2>${id ? 'Редагувати справу' : 'Важлива справа'}</h2>
    <div class="field"><input class="input" id="eTitle" placeholder="Назва (напр. День народження мами)" value="${esc(e.title)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Дата</label><input type="date" class="input" id="eDate" value="${e.date}"></div>
      <div class="field" style="width:42%"><label>Час</label><input type="time" class="input" id="eTime" value="${e.time || ''}"></div>
    </div>
    <div class="field"><textarea class="input" id="eNote" placeholder="Деталі (необовʼязково)">${esc(e.note)}</textarea></div>
    <div class="switch"><div><b>Важливо</b><div class="small muted">Показувати серед найближчих важливих</div></div>${toggleHtml('eImp', e.important)}</div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="eventDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="eventSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#eTitle', r).focus(), 300); });
}

/* ================= FINANCE ================= */
const inMonth = (s, y, m) => s.startsWith(`${y}-${pad(m + 1)}`);
function vFinance() {
  const { y, m } = U.fin;
  const txs = S.tx.filter(t => inMonth(t.date, y, m));
  const inc = txs.filter(t => t.type === 'inc').reduce((a, t) => a + t.amount, 0);
  const exp = txs.filter(t => t.type === 'exp').reduce((a, t) => a + t.amount, 0);
  const all = S.tx.reduce((a, t) => a + (t.type === 'inc' ? t.amount : -t.amount), 0);
  const bal = inc - exp;
  const [intPart, frac] = money(bal).replace(' ₴', '').split(',');

  const byCat = {};
  txs.filter(t => t.type === 'exp').forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + t.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;

  const groups = {};
  txs.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  const days = Object.keys(groups).sort().reverse();

  return `
    <div class="cal-head" style="margin:0 2px 12px"><button class="nav-btn" style="background:var(--card)" data-a="finNav" data-d="-1">‹</button>
      <b>${MONTHS[m]} ${y}</b><button class="nav-btn" style="background:var(--card)" data-a="finNav" data-d="1">›</button></div>
    <div class="mono">
      <div class="total">Загальний баланс<br><b style="font-size:14px;opacity:1">${money(all)}</b></div>
      <div class="lbl">За ${MONTHS[m].toLowerCase()}</div>
      <div class="sum">${intPart}${frac ? `<small>,${frac}</small>` : ''} <small>₴</small></div>
      <div class="row2">
        <div class="box"><div>Доходи</div><div>${money(inc, inc > 0)}</div></div>
        <div class="box"><div>Витрати</div><div>${exp ? '−' + money(exp) : money(0)}</div></div>
      </div>
    </div>
    <div class="btns two" style="margin:0 0 12px">
      <button class="btn ghost" style="background:var(--card);box-shadow:var(--shadow)" data-a="txNew" data-type="exp">− Витрата</button>
      <button class="btn ghost" style="background:var(--card);box-shadow:var(--shadow)" data-a="txNew" data-type="inc">+ Дохід</button>
    </div>
    ${cats.length ? `<h2>Куди йдуть гроші</h2><div class="card">${cats.map(([c, v], i) => {
      const cat = catOf('exp', c);
      return `<div style="margin-bottom:${i === cats.length - 1 ? 0 : 14}px"><div class="row between small"><span>${cat[1]} ${cat[2]}</span>
      <span><b>${money(v)}</b> <span class="muted">${Math.round(v / exp * 100)}%</span></span></div>
      <div class="bar"><div style="width:${Math.max(3, v / max * 100)}%;background:${CAT_COLORS[CATS.exp.findIndex(x => x[0] === c) % CAT_COLORS.length]}"></div></div></div>`;
    }).join('')}</div>` : ''}
    <h2>Операції</h2>
    ${days.length ? days.map(d => {
      const list = groups[d];
      const sum = list.reduce((a, t) => a + (t.type === 'inc' ? t.amount : -t.amount), 0);
      return `<div class="group-h"><span>${dateLabel(d)}</span><span>${money(sum, true)}</span></div>
      <div class="list">${list.map(t => {
        const c = catOf(t.type, t.cat);
        return `<div class="item" data-a="txEdit" data-id="${t.id}"><div class="emoji">${c[1]}</div>
        <div class="grow"><div class="title">${esc(c[2])}</div>${t.note ? `<div class="meta ellipsis">${esc(t.note)}</div>` : ''}</div>
        <div class="amount ${t.type === 'inc' ? 'green' : ''}">${t.type === 'inc' ? '+' : '−'}${money(t.amount)}</div></div>`;
      }).join('')}</div>`;
    }).join('') : `<div class="card empty"><div class="big">💳</div>У ${MONTHS_LOC[m]} операцій немає</div>`}`;
}
function txSheet(id, type) {
  const t = S.tx.find(x => x.id === id) || { type: type || 'exp', amount: '', cat: type === 'inc' ? 'salary' : 'food', note: '', date: today() };
  const chips = (tp, sel) => CATS[tp].map(c => `<button class="chip ${c[0] === sel ? 'on' : ''}" data-a="pickCat" data-cat="${c[0]}">${c[1]} ${c[2]}</button>`).join('');
  openSheet(`
    <h2>${id ? 'Операція' : t.type === 'inc' ? 'Новий дохід' : 'Нова витрата'}</h2>
    ${seg('txType', [['exp', 'Витрата'], ['inc', 'Дохід']], t.type)}
    <div class="field"><input class="input big" id="xAmount" inputmode="decimal" placeholder="0 ₴" value="${t.amount || ''}"></div>
    <div class="field"><label>Категорія</label><div class="chips" id="xCats">${chips(t.type, t.cat)}</div></div>
    <div class="field"><input class="input" id="xNote" placeholder="Коментар (необовʼязково)" value="${esc(t.note)}"></div>
    <div class="field"><label>Дата</label><input type="date" class="input" id="xDate" value="${t.date}"></div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="txDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="txSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => {
      r.__chips = chips;
      if (!id) setTimeout(() => $('#xAmount', r).focus(), 300);
    });
}

/* ================= KITCHEN (Gemini) ================= */
function vKitchen() {
  const k = U.kitchen;
  const hasKey = !!S.settings.apiKey;
  let body = '';
  if (U.loading) {
    body = `<div class="card empty"><div class="spinner"></div><b style="color:var(--text)">Gemini підбирає інгредієнти…</b><br><span class="small">рахуємо орієнтовні ціни в Сільпо</span></div>`;
  } else if (U.kError) {
    body = `<div class="card"><b class="red">Не вдалося отримати рецепт</b><div class="small muted" style="margin-top:6px;line-height:1.45">${esc(U.kError)}</div>
      <div class="btns two"><button class="btn ghost" data-a="settings">Налаштування</button><button class="btn" data-a="cook">Спробувати ще</button></div></div>`;
  } else if (k) {
    const missing = k.items.filter(i => !i.have);
    const sum = missing.reduce((a, i) => a + num(i.price), 0);
    body = `
      <div class="card" style="padding-bottom:10px">
        <div class="row between" style="align-items:flex-start"><div class="grow"><h3 style="font-size:20px">${esc(k.dish)}</h3>
          <div class="small muted">${k.servings} порц.${k.time ? ' · ' + esc(k.time) : ''} · ${k.items.length} інгредієнтів</div></div>
          ${k.source === 'ai' ? `<span class="ai-badge">${ICONS.spark} Gemini</span>` : `<span class="pill">Офлайн-рецепт</span>`}</div>
        <div class="small muted" style="margin-top:14px">Відмітьте, що вже є вдома 👇</div>
      </div>
      <div class="row between" style="margin:0 4px 8px"><span class="small muted">Є в холодильнику: ${k.items.length - missing.length}/${k.items.length}</span>
        <button class="chip" data-a="kAll">${missing.length ? 'Відмітити все' : 'Зняти все'}</button></div>
      <div class="list">${k.items.map((i, n) => `<div class="item ${i.have ? 'have' : ''}" data-a="kHave" data-n="${n}">
        <button class="check ${i.have ? 'on' : ''}"></button>
        <div class="grow"><div class="title">${esc(i.name)}</div><div class="meta">${esc(i.amount || '')}${i.buy && !i.have ? ` · <span class="ellipsis">${esc(i.buy)}</span>` : ''}</div></div>
        <div class="amount">${num(i.price) ? '≈' + money(num(i.price)) : ''}</div></div>`).join('')}</div>
      ${k.steps && k.steps.length ? `<details class="steps"><summary>Як готувати</summary><ol>${k.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      <div class="summary-bar"><div class="card" style="margin:0;box-shadow:0 10px 30px rgba(0,0,0,.12)">
        <div class="row between"><div><div class="small muted">Докупити ${missing.length} поз.</div><b style="font-size:20px">≈ ${money(sum)}</b></div>
        <span class="silpo">Ціни Сільпо*</span></div>
        <div class="btns" style="margin-top:12px"><button class="btn" data-a="kApprove" ${missing.length ? '' : 'disabled'}>Погодити → у список покупок</button></div>
      </div></div>
      <div class="small muted" style="margin:10px 6px">* Ціни орієнтовні та можуть відрізнятися від актуальних цін у магазині.</div>`;
  } else {
    body = `<h2>Ідеї</h2><div class="chips">${['Борщ', 'Вареники', 'Сирники', 'Олівʼє', 'Паста карбонара', 'Млинці', 'Плов', 'Голубці', 'Цезар'].map(d => `<button class="chip" style="background:var(--card);box-shadow:var(--shadow)" data-a="kIdea" data-d="${d}">${d}</button>`).join('')}</div>`;
  }
  const recent = S.dishes.slice(0, 10);
  return `
    <div class="hero">
      <div class="row between"><h3>Що готуємо?</h3><span class="ai-badge">${ICONS.spark} AI</span></div>
      <div class="small muted" style="margin-bottom:14px">Напишіть страву — покажу, що потрібно купити</div>
      <div class="field"><input class="input" id="dishInput" placeholder="Напр. борщ з пампушками" value="${esc(U.dish)}" enterkeyhint="go"></div>
      <div class="row">
        <div class="servings"><button data-a="srv" data-d="-1">−</button><b>${U.servings}</b><button data-a="srv" data-d="1">+</button></div>
        <span class="small muted grow">порції</span>
        <button class="btn sm" style="padding:13px 20px" data-a="cook" ${U.loading ? 'disabled' : ''}>Що потрібно?</button>
      </div>
      ${!hasKey ? `<div class="hint">Без ключа Gemini доступні лише кілька вбудованих рецептів. <b class="link" data-a="settings">Додайте безкоштовний ключ</b>, щоб рахувати будь-яку страву.</div>` : ''}
    </div>
    ${recent.length && !U.loading ? `<div class="recent">${recent.map(d => `<button class="chip" data-a="kOpen" data-id="${d.id}">🍽 ${esc(d.dish)}</button>`).join('')}</div>` : ''}
    ${body}`;
}

function buildPrompt(dish, servings, search) {
  return `Ти — кулінарний помічник для користувача з України.
Страва: "${dish}". Кількість порцій: ${servings}.

Склади повний список інгредієнтів, потрібних для приготування цієї страви на ${servings} порц. (включно з олією, спеціями, сіллю — користувач сам відмітить, що вже має).
Для кожного інгредієнта вкажи товар, який зазвичай продається в мережі супермаркетів «Сільпо» (Україна), у мінімальній фасовці, якої вистачить, і його орієнтовну ціну в гривнях.${search ? '\nВикористай пошук Google (бажано сайт silpo.ua), щоб уточнити актуальні ціни.' : ' Орієнтуйся на типові ціни Сільпо за останні відомі тобі дані.'}
Також дай коротку покрокову інструкцію приготування (3–8 кроків).

Відповідай ЛИШЕ валідним JSON без пояснень та без markdown, за схемою:
{"dish":"Назва страви українською","servings":${servings},"time":"~1 год","ingredients":[{"name":"Буряк","amount":"300 г","buy":"Буряк столовий, 1 кг","price":25}],"steps":["Крок 1","Крок 2"]}
"price" — число в гривнях (ціна товару "buy"), без валюти.
Якщо запит не є стравою чи напоєм, поверни {"error":"коротке пояснення українською"}.`;
}
function extractJson(text) {
  let t = String(text || '').replace(/```json|```/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Відповідь без JSON');
  return JSON.parse(t.slice(a, b + 1));
}
async function askGemini(dish, servings, useSearch) {
  const s = S.settings;
  const model = (s.model || 'gemini-2.5-flash').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(s.apiKey.trim())}`;
  const body = { contents: [{ role: 'user', parts: [{ text: buildPrompt(dish, servings, useSearch) }] }], generationConfig: { temperature: 0.3 } };
  if (useSearch) body.tools = [{ google_search: {} }];
  else body.generationConfig.responseMimeType = 'application/json';
  const r = await httpPost(url, JSON.stringify(body));
  let data = null; try { data = JSON.parse(r.text); } catch (e) { }
  if (r.status !== 200) {
    const msg = data && data.error ? data.error.message : r.text;
    if (r.status === 0) throw new Error('Немає підключення до інтернету.');
    if (r.status === 400 && /api key/i.test(msg || '')) throw new Error('Ключ Gemini недійсний. Перевірте його в налаштуваннях.');
    if (r.status === 403) throw new Error('Доступ заборонено (403). Перевірте ключ або чи доступний Gemini API у вашому регіоні.');
    if (r.status === 404) throw new Error(`Модель «${model}» не знайдена. Змініть модель у налаштуваннях (напр. gemini-2.5-flash).`);
    if (r.status === 429) throw new Error('Вичерпано безкоштовний ліміт запитів. Зачекайте хвилину й спробуйте ще.');
    const err = new Error(`Помилка ${r.status}: ${String(msg || '').slice(0, 220)}`); err.status = r.status; throw err;
  }
  const cand = data && data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
  if (!text) throw new Error('Gemini повернув порожню відповідь. Спробуйте переформулювати.');
  return extractJson(text);
}
function findBuiltin(dish) {
  const q = dish.toLowerCase().replace(/[ʼ'’]/g, '');
  return (window.BUILTIN_RECIPES || []).find(r => r.keys.some(k => q.includes(k.replace(/[ʼ'’]/g, ''))));
}
async function cook() {
  const inp = $('#dishInput');
  if (inp) U.dish = inp.value.trim();
  if (!U.dish) { toast('Напишіть назву страви'); inp && inp.focus(); return; }
  if (document.activeElement) document.activeElement.blur();
  U.kError = ''; U.kitchen = null;

  if (!S.settings.apiKey) {
    const b = findBuiltin(U.dish);
    if (!b) { U.kError = 'Цієї страви немає серед вбудованих рецептів (борщ, вареники, олівʼє, сирники, карбонара, млинці). Додайте безкоштовний ключ Gemini в налаштуваннях — і можна буде рахувати будь-яку страву.'; render(); return; }
    setKitchen({ dish: b.dish, servings: b.servings, time: b.time, ingredients: b.ingredients, steps: b.steps }, 'builtin');
    return;
  }
  U.loading = true; render();
  try {
    let res;
    try { res = await askGemini(U.dish, U.servings, !!S.settings.search); }
    catch (e) {
      if (S.settings.search && e.status === 400) res = await askGemini(U.dish, U.servings, false); // search not supported → retry plain
      else throw e;
    }
    if (res.error) throw new Error(res.error);
    if (!Array.isArray(res.ingredients) || !res.ingredients.length) throw new Error('Не вдалося розпізнати список інгредієнтів.');
    U.loading = false;
    setKitchen(res, 'ai');
  } catch (e) {
    U.loading = false; U.kError = e.message || String(e); render();
  }
}
function setKitchen(res, source) {
  const entry = {
    id: uid(), dish: res.dish || U.dish, servings: res.servings || U.servings, time: res.time || '', source,
    items: res.ingredients.map(i => ({ name: String(i.name || ''), amount: String(i.amount || ''), buy: String(i.buy || ''), price: num(i.price), have: false })),
    steps: Array.isArray(res.steps) ? res.steps.map(String) : [], date: today()
  };
  U.kitchen = entry;
  S.dishes = [entry, ...S.dishes.filter(d => d.dish.toLowerCase() !== entry.dish.toLowerCase())].slice(0, 15);
  save(); render();
  window.scrollTo({ top: 0 });
}
function approveKitchen() {
  const k = U.kitchen; if (!k) return;
  const missing = k.items.filter(i => !i.have);
  let added = 0, merged = 0;
  missing.forEach(i => {
    const ex = S.shop.find(s => !s.bought && s.name.toLowerCase() === i.name.toLowerCase());
    if (ex) { if (!ex.dish.includes(k.dish)) ex.dish += ', ' + k.dish; merged++; return; }
    S.shop.push({ id: uid(), name: i.name, qty: i.amount, buy: i.buy, price: num(i.price), dish: k.dish, bought: false });
    added++;
  });
  save();
  U.kitchen = null; U.dish = '';
  toast(`Додано ${added} у список покупок${merged ? ` (${merged} вже були)` : ''}`);
  go('shop');
}

/* ================= SHOP ================= */
function vShop() {
  const toBuy = S.shop.filter(i => !i.bought);
  const bought = S.shop.filter(i => i.bought);
  const sumToBuy = toBuy.reduce((a, i) => a + num(i.price), 0);
  const sumBought = bought.reduce((a, i) => a + num(i.price), 0);
  const groups = {};
  toBuy.forEach(i => (groups[i.dish || 'Інше'] = groups[i.dish || 'Інше'] || []).push(i));
  const row = i => `<div class="item ${i.bought ? 'done' : ''}">
    <button class="check ${i.bought ? 'on' : ''}" data-a="shopToggle" data-id="${i.id}"></button>
    <div class="grow" data-a="shopEdit" data-id="${i.id}"><div class="title">${esc(i.name)}</div>
      <div class="meta">${esc([i.qty, i.buy].filter(Boolean).join(' · '))}</div></div>
    <div class="right"><div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div>
      ${!i.bought ? `<button class="silpo" data-a="silpo" data-q="${esc(i.name)}">Сільпо ↗</button>` : ''}</div></div>`;
  return `
    <div class="mono" style="background:radial-gradient(120% 140% at 100% 0%, #f37021 0%, rgba(243,112,33,0) 55%), radial-gradient(120% 120% at 0% 100%, #18a058 0%, rgba(24,160,88,0) 60%), #121214">
      <div class="lbl">Орієнтовно до сплати</div>
      <div class="sum">${money(sumToBuy)}</div>
      <div class="row2"><div class="box"><div>Купити</div><div>${toBuy.length} поз.</div></div>
        <div class="box"><div>В кошику</div><div>${bought.length} · ${money(sumBought)}</div></div></div>
    </div>
    ${!S.shop.length ? `<div class="card empty"><div class="big">🛒</div>Список покупок порожній.<br>Додайте вручну «+» або через розділ <b class="link" data-a="tab" data-tab="kitchen">Кухня</b>.</div>` : ''}
    ${Object.entries(groups).map(([g, l]) => `<div class="group-h"><span>🍽 ${esc(g)}</span><span>${money(l.reduce((a, i) => a + num(i.price), 0))}</span></div>
      <div class="list">${l.map(row).join('')}</div>`).join('')}
    ${bought.length ? `<div class="group-h"><span>✅ Куплено</span><span>${money(sumBought)}</span></div><div class="list">${bought.map(row).join('')}</div>
      <div class="btns two"><button class="btn ghost" data-a="shopClear">Прибрати куплене</button><button class="btn" data-a="shopToExpense">Записати у витрати</button></div>` : ''}`;
}
function shopSheet(id) {
  const i = S.shop.find(x => x.id === id) || { name: '', qty: '', buy: '', price: '', dish: '' };
  openSheet(`
    <h2>${id ? 'Товар' : 'Додати товар'}</h2>
    <div class="field"><input class="input" id="sName" placeholder="Назва (напр. Молоко)" value="${esc(i.name)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Кількість</label><input class="input" id="sQty" placeholder="1 л" value="${esc(i.qty)}"></div>
      <div class="field grow"><label>Ціна, ₴</label><input class="input" id="sPrice" inputmode="decimal" placeholder="0" value="${i.price || ''}"></div>
    </div>
    <div class="field"><label>Для чого</label><input class="input" id="sDish" placeholder="Інше" value="${esc(i.dish)}"></div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="shopDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="shopSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#sName', r).focus(), 300); });
}

/* ================= SETTINGS ================= */
function settingsSheet() {
  const s = S.settings;
  openSheet(`
    <h2>Налаштування</h2>
    <div class="field"><label>Як до вас звертатися</label><input class="input" id="stName" placeholder="Імʼя" value="${esc(s.name)}"></div>
    <div class="field"><label>Тема</label>${seg('theme', [['light', 'Світла'], ['dark', 'Темна'], ['auto', 'Як у системі']], s.theme)}</div>

    <h2 style="margin-top:24px;font-size:18px">Gemini AI <span class="ai-badge" style="vertical-align:middle">${ICONS.spark} безкоштовно</span></h2>
    <div class="small muted" style="margin:-8px 0 12px;line-height:1.45">Ключ можна отримати безкоштовно в Google AI Studio — потрібен лише Google-акаунт.
      <br><b class="link" data-a="openKey">Отримати ключ → aistudio.google.com/apikey</b></div>
    <div class="field"><label>API ключ</label><input class="input" id="stKey" type="password" autocomplete="off" placeholder="AIza…" value="${esc(s.apiKey)}"></div>
    <div class="field"><label>Модель</label><input class="input" id="stModel" placeholder="gemini-2.5-flash" value="${esc(s.model)}">
      <div class="chips" style="margin-top:8px">${['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].map(m => `<button class="chip" data-a="pickModel" data-m="${m}">${m}</button>`).join('')}</div></div>
    <div class="switch"><div><b>Актуальні ціни через Google Пошук</b><div class="small muted">Точніше, але повільніше й витрачає більше ліміту</div></div>${toggleHtml('stSearch', s.search)}</div>
    <div class="btns two"><button class="btn ghost" data-a="testKey">Перевірити ключ</button><button class="btn" data-a="settingsSave">Зберегти</button></div>

    <h2 style="margin-top:28px;font-size:18px">Дані</h2>
    <div class="small muted" style="margin:-8px 0 12px">Усі дані зберігаються лише на цьому телефоні.</div>
    <div class="btns two" style="margin-top:0"><button class="btn ghost" data-a="exportData">Експорт</button><button class="btn ghost" data-a="importData">Імпорт</button></div>
    <div class="btns"><button class="btn danger" data-a="resetData">Видалити всі дані</button></div>
    <div class="small muted" style="text-align:center;margin-top:18px">Мій день · планер, календар, фінанси, кухня</div>`);
}
function readSettingsForm() {
  const r = $('#sheetBody');
  return {
    name: $('#stName', r).value.trim(), theme: segVal(r, 'theme') || 'auto',
    apiKey: $('#stKey', r).value.trim(), model: $('#stModel', r).value.trim() || 'gemini-2.5-flash',
    search: $('#stSearch', r).classList.contains('on')
  };
}

/* ================= render / nav ================= */
const VIEWS = { plans: vPlans, calendar: vCalendar, finance: vFinance, kitchen: vKitchen, shop: vShop };
function render() {
  renderHeader();
  $('#view').innerHTML = VIEWS[U.tab]();
  paintIcons($('#view'));
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === U.tab));
  $('#fab').classList.toggle('hidden', U.tab === 'kitchen');
  const n = S.shop.filter(i => !i.bought).length;
  $('#shopBadge').textContent = n ? String(n) : '';
}
function go(tab) {
  if (U.tab !== tab) { U.tab = tab; try { localStorage.setItem('planer.tab', tab); } catch (e) { } window.scrollTo({ top: 0 }); }
  render();
}

/* ================= actions ================= */
const A = {
  tab: d => go(d.tab),
  settings: () => settingsSheet(),
  closeSheet: () => closeSheet(),
  fab: () => ({ plans: () => taskSheet(), calendar: () => eventSheet(null, U.calSel), finance: () => txSheet(null, 'exp'), shop: () => shopSheet() }[U.tab] || (() => { }))(),
  seg: (d, el) => {
    $$(`[data-group="${d.group}"]`, el.parentNode).forEach(b => b.classList.toggle('on', b === el));
    if (d.group === 'planFilter') { U.planFilter = d.val; render(); }
    if (d.group === 'txType') { const box = $('#xCats'); box.innerHTML = $('#sheetBody').__chips(d.val, d.val === 'inc' ? 'salary' : 'food'); }
    if (d.group === 'theme') { S.settings.theme = d.val; save(); applyTheme(); }
  },
  toggle: (d, el) => el.classList.toggle('on'),

  // plans
  taskToggle: d => { const t = S.tasks.find(x => x.id === d.id); if (!t) return; t.done = !t.done; save(); render(); if (t.done) toast('Виконано ✓'); },
  taskEdit: d => taskSheet(d.id),
  setDue: d => { $('#tDue').value = d.d === '' ? '' : addDays(today(), +d.d); },
  taskSave: d => {
    const r = $('#sheetBody'); const title = $('#tTitle', r).value.trim();
    if (!title) { toast('Введіть назву'); return; }
    const data = { title, note: $('#tNote', r).value.trim(), prio: +segVal(r, 'prio') || 2, due: $('#tDue', r).value };
    if (d.id) Object.assign(S.tasks.find(x => x.id === d.id), data);
    else S.tasks.unshift({ id: uid(), done: false, created: Date.now(), ...data });
    save(); closeSheet(); render();
  },
  taskDel: d => { S.tasks = S.tasks.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Видалено'); },
  clearDone: () => { if (!confirm('Видалити всі виконані плани?')) return; S.tasks = S.tasks.filter(t => !t.done); save(); render(); },

  // calendar
  calNav: d => { let { y, m } = U.cal; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } U.cal = { y, m }; render(); },
  calPick: d => {
    if (U.calSel === d.d) { eventSheet(null, d.d); return; }
    U.calSel = d.d; const dt = parseYmd(d.d); U.cal = { y: dt.getFullYear(), m: dt.getMonth() }; render();
  },
  calToday: () => { U.calSel = today(); U.cal = { y: new Date().getFullYear(), m: new Date().getMonth() }; render(); },
  eventNew: () => eventSheet(null, U.calSel),
  eventEdit: d => eventSheet(d.id),
  eventSave: d => {
    const r = $('#sheetBody'); const title = $('#eTitle', r).value.trim(); const date = $('#eDate', r).value;
    if (!title) { toast('Введіть назву'); return; }
    if (!date) { toast('Оберіть дату'); return; }
    const data = { title, date, time: $('#eTime', r).value, note: $('#eNote', r).value.trim(), important: $('#eImp', r).classList.contains('on') };
    if (d.id) Object.assign(S.events.find(x => x.id === d.id), data);
    else S.events.push({ id: uid(), ...data });
    U.calSel = date; const dt = parseYmd(date); U.cal = { y: dt.getFullYear(), m: dt.getMonth() };
    save(); closeSheet(); render(); toast('Збережено');
  },
  eventDel: d => { S.events = S.events.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Видалено'); },

  // finance
  finNav: d => { let { y, m } = U.fin; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } U.fin = { y, m }; render(); },
  txNew: d => txSheet(null, d.type),
  txEdit: d => txSheet(d.id),
  pickCat: (d, el) => { $$('#xCats .chip').forEach(c => c.classList.toggle('on', c === el)); },
  txSave: d => {
    const r = $('#sheetBody'); const amount = Math.abs(num($('#xAmount', r).value));
    if (!amount) { toast('Введіть суму'); return; }
    const type = segVal(r, 'txType') || 'exp';
    const catEl = $('#xCats .chip.on', r);
    const data = { type, amount, cat: catEl ? catEl.dataset.cat : 'other', note: $('#xNote', r).value.trim(), date: $('#xDate', r).value || today() };
    if (d.id) Object.assign(S.tx.find(x => x.id === d.id), data);
    else S.tx.push({ id: uid(), ...data });
    const dt = parseYmd(data.date); U.fin = { y: dt.getFullYear(), m: dt.getMonth() };
    save(); closeSheet(); render(); toast(type === 'inc' ? 'Дохід додано' : 'Витрату додано');
  },
  txDel: d => { S.tx = S.tx.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Видалено'); },

  // kitchen
  srv: d => { U.dish = ($('#dishInput') || {}).value || U.dish; U.servings = Math.min(20, Math.max(1, U.servings + +d.d)); render(); },
  cook: () => cook(),
  kIdea: d => { U.dish = d.d; render(); cook(); },
  kHave: d => { const i = U.kitchen.items[+d.n]; i.have = !i.have; render(); },
  kAll: () => { const k = U.kitchen; const all = k.items.some(i => !i.have); k.items.forEach(i => i.have = all); render(); },
  kApprove: () => approveKitchen(),
  kOpen: d => {
    const e = S.dishes.find(x => x.id === d.id); if (!e) return;
    U.kitchen = clone(e); U.kitchen.items.forEach(i => i.have = false); U.kError = ''; U.dish = e.dish; render();
  },

  // shop
  shopToggle: d => { const i = S.shop.find(x => x.id === d.id); if (!i) return; i.bought = !i.bought; save(); render(); },
  shopEdit: d => shopSheet(d.id),
  shopSave: d => {
    const r = $('#sheetBody'); const name = $('#sName', r).value.trim();
    if (!name) { toast('Введіть назву'); return; }
    const data = { name, qty: $('#sQty', r).value.trim(), price: num($('#sPrice', r).value), dish: $('#sDish', r).value.trim() || 'Інше' };
    if (d.id) Object.assign(S.shop.find(x => x.id === d.id), data);
    else S.shop.push({ id: uid(), buy: '', bought: false, ...data });
    save(); closeSheet(); render();
  },
  shopDel: d => { S.shop = S.shop.filter(x => x.id !== d.id); save(); closeSheet(); render(); },
  shopClear: () => { S.shop = S.shop.filter(i => !i.bought); save(); render(); },
  shopToExpense: () => {
    const bought = S.shop.filter(i => i.bought);
    const sum = bought.reduce((a, i) => a + num(i.price), 0);
    if (!sum) { toast('У куплених товарів немає цін'); return; }
    const dishes = [...new Set(bought.map(i => i.dish).filter(x => x && x !== 'Інше'))];
    S.tx.push({ id: uid(), type: 'exp', amount: Math.round(sum * 100) / 100, cat: 'food', note: 'Покупки' + (dishes.length ? ': ' + dishes.join(', ') : ''), date: today() });
    S.shop = S.shop.filter(i => !i.bought);
    U.fin = { y: new Date().getFullYear(), m: new Date().getMonth() };
    save(); toast(`Витрату ${money(sum)} записано`); go('finance');
  },
  silpo: d => openUrl('https://silpo.ua/search?find=' + encodeURIComponent(d.q)),

  // settings
  openKey: () => openUrl('https://aistudio.google.com/apikey'),
  pickModel: d => { $('#stModel').value = d.m; },
  settingsSave: () => { S.settings = { ...S.settings, ...readSettingsForm() }; save(); applyTheme(); closeSheet(); render(); toast('Збережено'); },
  testKey: async (d, el) => {
    const f = readSettingsForm();
    if (!f.apiKey) { toast('Введіть ключ'); return; }
    el.textContent = 'Перевіряю…'; el.setAttribute('disabled', '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(f.model)}:generateContent?key=${encodeURIComponent(f.apiKey)}`;
    const r = await httpPost(url, JSON.stringify({ contents: [{ parts: [{ text: 'Відповідай одним словом: працює' }] }] }));
    el.textContent = 'Перевірити ключ'; el.removeAttribute('disabled');
    if (r.status === 200) toast('✅ Ключ працює!');
    else { let m = ''; try { m = JSON.parse(r.text).error.message; } catch (e) { m = r.text; } toast(`❌ ${r.status || 'Немає мережі'}: ${String(m).slice(0, 90)}`); }
  },
  exportData: () => {
    const data = JSON.stringify({ ...S, settings: { ...S.settings, apiKey: '' } });
    if (Bridge && Bridge.share) Bridge.share(data);
    else if (navigator.clipboard) navigator.clipboard.writeText(data).then(() => toast('Скопійовано в буфер'));
  },
  importData: () => openSheet(`<h2>Імпорт даних</h2><div class="small muted" style="margin-bottom:12px">Вставте текст, отриманий через «Експорт». Поточні дані буде замінено.</div>
    <div class="field"><textarea class="input" id="impText" style="min-height:160px" placeholder="{...}"></textarea></div>
    <div class="btns"><button class="btn" data-a="importDo">Імпортувати</button></div>`),
  importDo: () => {
    try {
      const d = JSON.parse($('#impText').value);
      if (!d || typeof d !== 'object' || !Array.isArray(d.tasks)) throw 0;
      const key = S.settings.apiKey;
      S = { ...clone(DEF), ...d, settings: { ...DEF.settings, ...(d.settings || {}), apiKey: (d.settings && d.settings.apiKey) || key } };
      save(); applyTheme(); closeSheet(); render(); toast('Дані імпортовано');
    } catch (e) { toast('Невірний формат даних'); }
  },
  resetData: () => {
    if (!confirm('Видалити ВСІ плани, події, операції та покупки? Це не можна скасувати.')) return;
    const keep = S.settings; S = clone(DEF); S.settings = keep; save(); closeSheet(); render(); toast('Дані видалено');
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'dishInput') { e.preventDefault(); cook(); }
});
document.addEventListener('input', e => { if (e.target.id === 'dishInput') U.dish = e.target.value; });

window.onAndroidBack = () => {
  if (closeSheet()) return true;
  if (U.tab === 'kitchen' && (U.kitchen || U.kError)) { U.kitchen = null; U.kError = ''; render(); return true; }
  if (U.tab !== 'plans') { go('plans'); return true; }
  return false;
};

/* ================= boot ================= */
$('#btnSettings').innerHTML = ICONS.gear;
$('#fab').innerHTML = ICONS.plus;
paintIcons();
applyTheme();
render();
setInterval(renderHeader, 60000);
