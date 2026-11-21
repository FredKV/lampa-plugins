'use strict';
/* =====================================================================
   Фінанси: операції, категорії (+власні), аналітика, бюджет, накопичення
   tx.type: 'exp' | 'inc' | 'save' (відкладено на хотілку; amount<0 — повернено з накопичень)
   ===================================================================== */

const CATS_DEFAULT = {
  exp: [['food', '🛒', 'Продукти'], ['cafe', '🍽', 'Кафе та ресторани'], ['transport', '🚕', 'Транспорт та пальне'], ['clothes', '👗', 'Одяг і взуття'],
    ['beauty', '💅', 'Краса та догляд'], ['health', '💊', 'Здоровʼя'], ['fun', '🎬', 'Розваги'], ['shopping', '🛍', 'Покупки'], ['gift', '🎁', 'Подарунки'],
    ['utils', '💡', 'Комунальні послуги'], ['subs', '🔁', 'Підписки'], ['savings', '🏦', 'Заощадження'], ['other', '📦', 'Інше']],
  inc: [['salary', '💼', 'Зарплата'], ['side', '💸', 'Підробіток'], ['gift', '🎁', 'Подарунок'], ['invest', '📈', 'Інвестиції'], ['cashback', '🪙', 'Кешбек'], ['other', '📦', 'Інше']]
};
const VIZ = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const VIZ_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const vizColor = i => (document.documentElement.dataset.theme === 'dark' ? VIZ_DARK : VIZ)[i % 8];

const Fin = {
  cats(type) {
    const def = CATS_DEFAULT[type];
    const custom = S.customCats.filter(c => c.type === type).map(c => [c.id, c.emoji, c.name, true]);
    return [...def.slice(0, -1), ...custom, def[def.length - 1]];
  },
  cat(type, id) {
    if (type === 'save') return ['save', '🐷', 'Відкладено на хотілку'];
    return Fin.cats(type).find(c => c[0] === id) || CATS_DEFAULT[type][CATS_DEFAULT[type].length - 1];
  },
  /** Validated insert; returns the transaction. */
  add(t) {
    const tx = { id: uid(), pay: 'card', note: '', date: today(), ...t };
    tx.amount = round2(tx.amount);
    if (!tx.amount || (tx.type !== 'save' && tx.amount < 0)) throw new Error('Некоректна сума');
    S.tx.push(tx);
    return tx;
  },
  remove(id) {
    const t = S.tx.find(x => x.id === id);
    if (t && t.photo) Photos.del(t.photo);
    S.tx = S.tx.filter(x => x.id !== id);
  },
  inRange: (t, from, to) => t.date >= from && t.date <= to,
  sum(list, type) { return list.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0); },
  stats(from, to) {
    const l = S.tx.filter(t => Fin.inRange(t, from, to));
    const inc = Fin.sum(l, 'inc'), exp = Fin.sum(l, 'exp'), saved = Fin.sum(l, 'save');
    return { list: l, inc, exp, saved, bal: inc - exp - saved };
  },
  totalBalance() { return S.tx.reduce((a, t) => a + (t.type === 'inc' ? t.amount : -t.amount), 0); },
  totalSaved() { return S.tx.filter(t => t.type === 'save').reduce((a, t) => a + t.amount, 0); },
  monthRange(y, m) { return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))]; },
  spentInMonth(cat, y, m) {
    const [a, b] = Fin.monthRange(y, m);
    return S.tx.filter(t => t.type === 'exp' && Fin.inRange(t, a, b) && (!cat || t.cat === cat)).reduce((s, t) => s + t.amount, 0);
  },
  /** Toast a warning if a new expense brings a budget close to / over its limit. */
  checkBudget(tx) {
    if (tx.type !== 'exp') return;
    const d = parseYmd(tx.date), y = d.getFullYear(), m = d.getMonth();
    const msgs = [];
    const lim = S.budget.cats[tx.cat];
    if (lim) {
      const s = Fin.spentInMonth(tx.cat, y, m), name = Fin.cat('exp', tx.cat)[2];
      if (s > lim) msgs.push(`⚠️ Перевищено ліміт «${name}»: ${money(s)} з ${money(lim)}`);
      else if (s >= lim * 0.8) msgs.push(`Увага: «${name}» — використано ${Math.round(s / lim * 100)}% ліміту`);
    }
    if (S.budget.total) {
      const s = Fin.spentInMonth(null, y, m), lim2 = S.budget.total;
      if (s > lim2) msgs.push(`⚠️ Перевищено місячний бюджет: ${money(s)} з ${money(lim2)}`);
      else if (s >= lim2 * 0.8 && !msgs.length) msgs.push(`Увага: витрачено ${Math.round(s / lim2 * 100)}% місячного бюджету`);
    }
    if (msgs.length) setTimeout(() => toast(msgs[0]), 700);
  }
};

/* ---------------- period helpers ---------------- */
U.finOff = 0;
function finPeriod() {
  const per = segOf('finPer', 'month'), off = U.finOff, t = today();
  if (per === 'day') { const d = addDays(t, off); return { from: d, to: d, label: dateLabel(d) }; }
  if (per === 'week') {
    const now = parseYmd(t); const mon = addDays(t, -((now.getDay() + 6) % 7) + off * 7); const sun = addDays(mon, 6);
    const a = parseYmd(mon), b = parseYmd(sun);
    const label = off === 0 ? 'Цей тиждень' : off === -1 ? 'Минулий тиждень'
      : a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}` : `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
    return { from: mon, to: sun, label };
  }
  const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + off, 1);
  const [from, to] = Fin.monthRange(d.getFullYear(), d.getMonth());
  return { from, to, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, y: d.getFullYear(), m: d.getMonth() };
}

/* ---------------- charts ---------------- */
function donut(parts, total, center) {
  // parts: [{label, value, color}] — 2px surface gap between segments
  let acc = 0;
  const C = 2 * Math.PI * 15.9155;
  const segs = parts.map(p => {
    const frac = p.value / total, len = Math.max(0, frac * 100 - (parts.length > 1 ? 1.2 : 0));
    const s = `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${p.color}" stroke-width="5.5" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${25 - acc}"><title>${esc(p.label)}: ${money(p.value)}</title></circle>`;
    acc += frac * 100; return s;
  }).join('');
  return `<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Витрати за категоріями">
    <circle r="15.9155" cx="21" cy="21" fill="none" stroke="var(--chip)" stroke-width="5.5"/>${segs}
    <text x="21" y="20.2" text-anchor="middle" class="donut-sum">${esc(center[0])}</text>
    <text x="21" y="25.5" text-anchor="middle" class="donut-lbl">${esc(center[1])}</text></svg>`;
}
function monthBars() {
  const n = new Date(); const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), v: Fin.spentInMonth(null, d.getFullYear(), d.getMonth()) }); }
  const max = Math.max(...months.map(x => x.v), 1);
  const W = 300, H = 120, bw = 30, gap = (W - bw * 6) / 6;
  const bars = months.map((x, i) => {
    const h = Math.max(x.v ? 4 : 0, x.v / max * (H - 24));
    const X = gap / 2 + i * (bw + gap), Y = H - 18 - h, cur = i === 5;
    return `<g class="mbar" data-a="barTip" data-t="${esc(MONTHS[x.m])}: ${esc(money(x.v))}">
      <rect x="${X - gap / 2}" y="0" width="${bw + gap}" height="${H}" fill="transparent"/>
      <path d="M${X},${H - 18} V${Y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - 18} Z" fill="${vizColor(0)}" opacity="${cur ? 1 : .45}"/>
      ${cur && x.v ? `<text x="${X + bw / 2}" y="${Y - 4}" text-anchor="middle" class="bar-val">${esc(Math.round(x.v).toLocaleString('uk-UA'))}</text>` : ''}
      <text x="${X + bw / 2}" y="${H - 4}" text-anchor="middle" class="bar-lbl">${MONTHS_SHORT[x.m]}</text></g>`;
  }).join('');
  const prev = months[4].v, cur = months[5].v;
  let cmp = '';
  if (prev > 0) {
    const d = Math.round((cur - prev) / prev * 100);
    cmp = d === 0 ? 'Стільки ж, як минулого місяця' : `На ${Math.abs(d)}% ${d > 0 ? 'більше' : 'менше'}, ніж у ${MONTHS_LOC[months[4].m]}`;
  }
  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="bars" role="img" aria-label="Витрати за останні 6 місяців">
    <line x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="var(--line)"/>${bars}</svg>`, cmp, months };
}

/* ---------------- views ---------------- */
function txRow(t) {
  const c = Fin.cat(t.type, t.cat);
  const wish = t.wishId ? S.wishes.find(w => w.id === t.wishId) : null;
  const title = t.type === 'save' ? (t.amount < 0 ? 'Повернено з накопичень' : 'Відкладено') : c[2];
  const sub = [t.type === 'save' && wish ? wish.title : '', t.note, t.type !== 'save' ? (t.pay === 'cash' ? '💵 готівка' : '💳 картка') : '', t.photo ? '🧾 чек' : '']
    .filter(Boolean).join(' · ');
  const sign = t.type === 'inc' ? '+' : t.type === 'save' ? (t.amount < 0 ? '+' : '−') : '−';
  return `<div class="item" data-a="txEdit" data-id="${t.id}"><div class="emoji">${c[1]}</div>
    <div class="grow"><div class="title">${esc(title)}</div>${sub ? `<div class="meta ellipsis">${esc(sub)}</div>` : ''}</div>
    <div class="amount ${t.type === 'inc' ? 'green' : t.type === 'save' ? 'violet' : ''}">${sign}${money(Math.abs(t.amount))}</div></div>`;
}
function txGroups(list) {
  const groups = {};
  list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  return Object.keys(groups).sort().reverse().map(d => {
    const l = groups[d];
    const sum = l.reduce((a, t) => a + (t.type === 'inc' ? t.amount : -t.amount), 0);
    return `<div class="group-h"><span>${dateLabel(d)}</span><span>${money(sum, true)}</span></div><div class="list">${l.map(txRow).join('')}</div>`;
  }).join('');
}

function vFinOverview() {
  const p = finPeriod();
  const st = Fin.stats(p.from, p.to);
  const total = Fin.totalBalance(), savedAll = Fin.totalSaved();
  const byCat = {};
  st.list.filter(t => t.type === 'exp').forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + t.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const top = cats.slice(0, 5), rest = cats.slice(5).reduce((a, c) => a + c[1], 0);
  const parts = top.map(([c, v], i) => ({ label: Fin.cat('exp', c)[2], value: v, color: vizColor(i), c }));
  if (rest > 0) parts.push({ label: 'Решта категорій', value: rest, color: 'var(--muted)' });
  const mb = monthBars();
  const n = new Date();
  const lim = S.budget.total, spentM = Fin.spentInMonth(null, n.getFullYear(), n.getMonth());

  return `
    ${segUI('finPer', [['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць']], 'flat-card', 'month')}
    <div class="card fin-sum">
      <div class="row between" style="gap:6px">
        <button class="nav-btn sm" data-a="finNav" data-d="-1" aria-label="Попередній період">‹</button>
        <b class="grow" style="text-align:center">${esc(p.label)}</b>
        <button class="nav-btn sm" data-a="finNav" data-d="1" aria-label="Наступний період" ${U.finOff >= 0 ? 'disabled style="opacity:.3"' : ''}>›</button>
      </div>
      <div class="fin-tiles">
        <div class="ft"><span>Баланс</span><b class="${st.bal < 0 ? 'red' : ''}">${money(st.bal)}</b><small>загальний ${money(total)}</small></div>
        <div class="ft g" data-a="finTile" data-v="inc"><span>↑ Доходи</span><b class="green">${money(st.inc)}</b></div>
        <div class="ft r" data-a="finTile" data-v="exp"><span>↓ Витрати</span><b>${money(st.exp)}</b></div>
        <div class="ft v" data-a="go" data-page="wishes"><span>🎯 Відкладено</span><b class="violet">${money(st.saved)}</b></div>
      </div>
    </div>
    <div class="row" style="gap:8px;margin-bottom:12px">
      <button class="btn sm card-btn grow" data-a="txNew" data-type="exp">− Витрата</button>
      <button class="btn sm card-btn grow" data-a="txNew" data-type="inc">+ Дохід</button>
    </div>
    ${lim && segOf('finPer', 'month') === 'month' && U.finOff === 0 ? `<div class="card" data-a="useg" data-key="fin" data-val="budget">
      <div class="row between"><b>Бюджет на місяць</b><span class="small muted">${money(spentM)} з ${money(lim)}</span></div>
      ${progressBar(spentM / lim * 100, spentM > lim ? 'var(--red)' : spentM > lim * .8 ? 'var(--amber)' : '')}
      <div class="small ${spentM > lim ? 'red' : 'muted'}" style="margin-top:8px">${spentM > lim ? `Перевищено на ${money(spentM - lim)}` : `Залишилось ${money(lim - spentM)}`}</div></div>` : ''}

    <h2>Витрати за категоріями</h2>
    ${cats.length ? `<div class="card"><div class="donut-wrap">${donut(parts, st.exp, [money(st.exp).replace(' ₴', ''), '₴ витрачено'])}
      <div class="legend">${parts.map(pt => `<div class="lg-row"><i style="background:${pt.color}"></i><span class="grow ellipsis">${esc(pt.label)}</span><b>${Math.round(pt.value / st.exp * 100)}%</b></div>`).join('')}</div></div>
      <div class="sep"></div>
      <div class="small muted" style="margin-bottom:8px">Найбільші статті витрат</div>
      ${cats.slice(0, 5).map(([c, v], i) => { const k = Fin.cat('exp', c); return `<div class="row between" style="padding:7px 0"><span>${k[1]} ${esc(k[2])}</span><b>${money(v)}</b></div>`; }).join('')}
      </div>` : `<div class="card empty" style="padding:22px">Витрат за цей період немає</div>`}

    <h2>Порівняння місяців</h2>
    <div class="card"><div class="small muted" style="margin-bottom:6px">Витрати за останні 6 місяців, ₴</div>${mb.svg}
      ${mb.cmp ? `<div class="small" style="margin-top:8px">${esc(mb.cmp)}</div>` : ''}
      <details class="table-view"><summary>Показати таблицею</summary><table>${mb.months.map(x => `<tr><td>${MONTHS[x.m]} ${x.y}</td><td class="right">${money(x.v)}</td></tr>`).join('')}</table></details></div>

    <div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Операції за період</h2>
      <button class="chip card-bg" data-a="useg" data-key="fin" data-val="ops">Уся історія</button></div>
    ${st.list.length ? txGroups(st.list) : `<div class="card empty" style="padding:22px">Операцій немає</div>`}`;
}

U.finFilter = { q: '', type: 'all', limit: 60 };
function vFinOps() {
  const f = U.finFilter;
  const q = f.q.trim().toLowerCase();
  let list = S.tx.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  if (f.type !== 'all') list = list.filter(t => t.type === f.type);
  if (q) list = list.filter(t => [t.note, Fin.cat(t.type, t.cat)[2], String(t.amount)].join(' ').toLowerCase().includes(q));
  const shown = list.slice(0, f.limit);
  return `
    <div class="field"><input class="input card-bg" id="finSearch" placeholder="Пошук: коментар, категорія, сума" value="${esc(f.q)}"></div>
    <div class="seg seg-sm">${[['all', 'Усі'], ['exp', 'Витрати'], ['inc', 'Доходи'], ['save', 'Накопичення']].map(([v, l]) =>
      `<button class="${f.type === v ? 'on' : ''}" data-a="finType" data-v="${v}">${l}</button>`).join('')}</div>
    ${shown.length ? txGroups(shown) : `<div class="card empty">Нічого не знайдено</div>`}
    ${list.length > shown.length ? `<button class="btn ghost" data-a="finMore">Показати ще (${list.length - shown.length})</button>` : ''}`;
}

function vFinBudget() {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  const spent = Fin.spentInMonth(null, y, m);
  const lim = S.budget.total;
  const daysLeft = new Date(y, m + 1, 0).getDate() - n.getDate() + 1;
  const row = (c) => {
    const l = S.budget.cats[c[0]] || 0, s = Fin.spentInMonth(c[0], y, m);
    const pct = l ? s / l * 100 : 0;
    const state = !l ? '' : s > l ? 'red' : pct >= 80 ? 'amber' : '';
    return `<div class="item" data-a="budCat" data-cat="${c[0]}"><div class="emoji">${c[1]}</div>
      <div class="grow"><div class="row between"><span class="title">${esc(c[2])}</span><span class="small">${money(s)}${l ? ` / ${money(l)}` : ''}</span></div>
      ${l ? `${progressBar(pct, state === 'red' ? 'var(--red)' : state === 'amber' ? 'var(--amber)' : '')}
        <div class="small ${state === 'red' ? 'red' : 'muted'}" style="margin-top:5px">${s > l ? `⚠️ Перевищено на ${money(s - l)}` : `${pct >= 80 ? '⚠️ ' : ''}Залишилось ${money(l - s)}`}</div>`
        : `<div class="small muted">Ліміт не встановлено · натисніть, щоб задати</div>`}</div></div>`;
  };
  const cats = Fin.cats('exp');
  const withLim = cats.filter(c => S.budget.cats[c[0]]), without = cats.filter(c => !S.budget.cats[c[0]]);
  return `
    <div class="card" data-a="budTotal">
      <div class="row between"><b>Загальний ліміт на ${MONTHS[m].toLowerCase()}</b><span class="link small">${lim ? 'Змінити' : 'Встановити'}</span></div>
      ${lim ? `<div style="font-size:26px;font-weight:700;margin:8px 0 2px">${money(spent)} <span class="muted" style="font-size:15px;font-weight:500">з ${money(lim)}</span></div>
        ${progressBar(spent / lim * 100, spent > lim ? 'var(--red)' : spent > lim * .8 ? 'var(--amber)' : '')}
        <div class="small ${spent > lim ? 'red' : 'muted'}" style="margin-top:8px">${spent > lim ? `⚠️ Перевищено на ${money(spent - lim)}` : `Залишилось ${money(lim - spent)} · ≈ ${money((lim - spent) / daysLeft)} на день`}</div>`
        : `<div class="small muted" style="margin-top:6px">Задайте суму, яку плануєте витратити за місяць.</div>`}
    </div>
    <h2>Ліміти за категоріями</h2>
    <div class="list">${withLim.concat(without).map(row).join('')}</div>
    <h2>Власні категорії</h2>
    <div class="list">${S.customCats.length ? S.customCats.map(c => `<div class="item"><div class="emoji">${esc(c.emoji)}</div>
      <div class="grow"><div class="title">${esc(c.name)}</div><div class="meta">${c.type === 'inc' ? 'Дохід' : 'Витрата'}</div></div>
      <button class="chip" data-a="catDel" data-id="${c.id}">Видалити</button></div>`).join('') : `<div class="item muted small">Ще немає власних категорій</div>`}</div>
    <button class="btn ghost card-btn" data-a="catNew">+ Створити категорію</button>`;
}

VIEWS.finance = () => `
  ${segUI('fin', [['overview', 'Огляд'], ['ops', 'Історія'], ['budget', 'Бюджет'], ['debts', 'Борги']])}
  ${({ overview: vFinOverview, ops: vFinOps, budget: vFinBudget, debts: vFinDebts })[segOf('fin', 'overview')]()}`;
FABS.finance = () => segOf('fin', 'overview') === 'debts' ? debtSheet() : txSheet(null, 'exp');

/* ---------------- sheets ---------------- */
function txSheet(id, type) {
  const t = S.tx.find(x => x.id === id) || { type: type || 'exp', amount: '', cat: type === 'inc' ? 'salary' : 'food', note: '', date: today(), pay: 'card', photo: '' };
  if (t.type === 'save') return saveTxSheet(t);
  const chips = (tp, sel) => Fin.cats(tp).map(c => `<button class="chip ${c[0] === sel ? 'on' : ''}" data-a="pickCat" data-cat="${c[0]}">${c[1]} ${esc(c[2])}</button>`).join('')
    + `<button class="chip" data-a="catNew" data-type="${tp}">+ Своя</button>`;
  openSheet(`
    <h2>${id ? 'Операція' : t.type === 'inc' ? 'Новий дохід' : 'Нова витрата'}</h2>
    ${seg('txType', [['exp', 'Витрата'], ['inc', 'Дохід']], t.type)}
    <div class="field"><input class="input big" id="xAmount" inputmode="decimal" placeholder="0 ₴" value="${t.amount || ''}"></div>
    <div class="field"><label>Категорія</label><div class="chips" id="xCats">${chips(t.type, t.cat)}</div></div>
    <div class="field" id="xPayBox" ${t.type === 'inc' ? 'style="display:none"' : ''}><label>Спосіб оплати</label>${seg('pay', [['card', 'Картка'], ['cash', 'Готівка']], t.pay || 'card')}</div>
    <div class="field"><input class="input" id="xNote" maxlength="200" placeholder="Опис або коментар" value="${esc(t.note)}"></div>
    <div class="field"><label>Дата</label><input type="date" class="input" id="xDate" value="${t.date}"></div>
    <div class="field" data-receipt="1"><label>Фото чека (необовʼязково)</label>${photoField(t.photo, 'Додати чек')}</div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="txDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="txSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { r.__chips = chips; r.__keepCat = t.cat; if (!id) setTimeout(() => $('#xAmount', r).focus(), 300); });
}
function saveTxSheet(t) {
  const w = S.wishes.find(x => x.id === t.wishId);
  openSheet(`<h2>${t.amount < 0 ? 'Повернення з накопичень' : 'Відкладено'}</h2>
    <div class="small muted" style="margin:-8px 0 14px">${w ? 'Хотілка: ' + esc(w.title) : 'Хотілку видалено'}</div>
    <div class="field"><label>Сума, ₴</label><input class="input big" id="xAmount" inputmode="decimal" value="${Math.abs(t.amount)}"></div>
    <div class="field"><label>Дата</label><input type="date" class="input" id="xDate" value="${t.date}"></div>
    <div class="btns two"><button class="btn danger" data-a="txDel" data-id="${t.id}">Видалити</button><button class="btn" data-a="saveTxSave" data-id="${t.id}">Зберегти</button></div>`);
}
function catSheet(type = 'exp') {
  const EMO = ['🐶', '🚗', '🏋️', '📚', '✈️', '🏠', '📱', '🧸', '🍷', '☕', '🎨', '🛠', '🌿', '💻', '🎮', '⛽'];
  openSheet(`<h2>Нова категорія</h2>
    ${seg('ncType', [['exp', 'Витрата'], ['inc', 'Дохід']], type)}
    <div class="field"><input class="input" id="ncName" maxlength="30" placeholder="Назва (напр. Тварини)"></div>
    <div class="field"><label>Значок</label><div class="chips" id="ncEmo">${EMO.map((e, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-a="pickEmo" data-e="${e}" style="font-size:20px;padding:6px 10px">${e}</button>`).join('')}</div></div>
    <div class="btns"><button class="btn" data-a="catSave">Створити</button></div>`, r => setTimeout(() => $('#ncName', r).focus(), 300));
}

/* ---------------- actions ---------------- */
Object.assign(A, {
  finNav: d => { U.finOff = Math.min(0, U.finOff + +d.d); render(); },
  finTile: d => { U.finFilter.type = d.v; U.finFilter.q = ''; U.finFilter.limit = 60; U.seg.fin = 'ops'; render(); },
  finType: d => { U.finFilter.type = d.v; U.finFilter.limit = 60; render(); },
  finMore: () => { U.finFilter.limit += 100; render(); },
  barTip: d => toast(d.t),
  txNew: d => txSheet(null, d.type),
  txEdit: d => txSheet(d.id),
  pickCat: (d, el) => { $$('#xCats .chip').forEach(c => c.classList.toggle('on', c === el)); },
  pickEmo: (d, el) => { $$('#ncEmo .chip').forEach(c => c.classList.toggle('on', c === el)); },
  txSave: d => {
    const r = $('#sheetBody');
    const raw = $('#xAmount', r).value, amount = num(raw);
    if (!(amount > 0)) return invalid('xAmount', 'Введіть суму більше нуля');
    if (amount > 1e9) return invalid('xAmount', 'Занадто велика сума');
    const date = $('#xDate', r).value;
    if (!isDate(date)) return invalid('xDate', 'Оберіть дату');
    const type = segVal(r, 'txType') || 'exp';
    const catEl = $('#xCats .chip.on', r);
    const data = { type, amount: round2(amount), cat: catEl ? catEl.dataset.cat : 'other', note: $('#xNote', r).value.trim().slice(0, 200), date, pay: type === 'inc' ? '' : (segVal(r, 'pay') || 'card'), photo: photoVal(r) };
    let tx;
    if (d.id) {
      tx = S.tx.find(x => x.id === d.id);
      if (tx.photo && tx.photo !== data.photo) Photos.del(tx.photo);
      Object.assign(tx, data);
    } else tx = Fin.add(data);
    save(); closeSheet(); render(); toast(type === 'inc' ? 'Дохід збережено' : 'Витрату збережено');
    Fin.checkBudget(tx);
  },
  saveTxSave: d => {
    const r = $('#sheetBody'); const amount = num($('#xAmount', r).value);
    if (!(amount > 0)) return invalid('xAmount', 'Введіть суму більше нуля');
    const date = $('#xDate', r).value; if (!isDate(date)) return invalid('xDate', 'Оберіть дату');
    const t = S.tx.find(x => x.id === d.id); t.amount = t.amount < 0 ? -amount : amount; t.date = date;
    save(); closeSheet(); render();
  },
  txDel: async d => {
    const t = S.tx.find(x => x.id === d.id); if (!t) return;
    if (!await ask({ title: 'Видалити операцію?', text: `${Fin.cat(t.type, t.cat)[2]} · ${money(Math.abs(t.amount))}`, ok: 'Видалити', danger: true })) return;
    S.people.forEach(p => (p.gifts || []).forEach(g => { if (g.txId === t.id) g.txId = ''; }));
    S.wishes.forEach(w => { if (w.txId === t.id) w.txId = ''; });
    Fin.remove(d.id); save(); render(); toast('Видалено');
  },
  budTotal: async () => {
    const v = await askNumber({ title: 'Місячний бюджет', label: 'Ліміт витрат на місяць, ₴', value: S.budget.total || '', hint: 'Введіть 0, щоб прибрати ліміт.', ok: 'Зберегти', allowZero: true });
    if (v === null) return;
    S.budget.total = Math.max(0, v); save(); render();
  },
  budCat: async d => {
    const c = Fin.cat('exp', d.cat);
    const v = await askNumber({ title: `Ліміт: ${c[2]}`, label: 'Ліміт на місяць, ₴', value: S.budget.cats[d.cat] || '', hint: 'Введіть 0, щоб прибрати ліміт.', allowZero: true });
    if (v === null) return;
    if (v <= 0) delete S.budget.cats[d.cat]; else S.budget.cats[d.cat] = v;
    save(); render();
  },
  catNew: d => catSheet(d.type || 'exp'),
  catSave: () => {
    const r = $('#sheetBody'); const name = $('#ncName', r).value.trim();
    if (name.length < 2) return invalid('ncName', 'Введіть назву категорії');
    const type = segVal(r, 'ncType') || 'exp';
    if (Fin.cats(type).some(c => c[2].toLowerCase() === name.toLowerCase())) return invalid('ncName', 'Така категорія вже є');
    const emo = $('#ncEmo .chip.on', r);
    S.customCats.push({ id: 'c_' + uid(), type, emoji: emo ? emo.dataset.e : '📦', name: name.slice(0, 30) });
    save(); closeSheet(); render(); toast('Категорію створено');
  },
  catDel: async d => {
    const c = S.customCats.find(x => x.id === d.id); if (!c) return;
    const used = S.tx.filter(t => t.type === c.type && t.cat === c.id).length;
    if (!await ask({ title: `Видалити «${c.name}»?`, text: used ? `${used} ${plural(used, 'операцію', 'операції', 'операцій')} буде перенесено в «Інше».` : '', ok: 'Видалити', danger: true })) return;
    S.tx.forEach(t => { if (t.type === c.type && t.cat === c.id) t.cat = 'other'; });
    delete S.budget.cats[c.id];
    S.customCats = S.customCats.filter(x => x.id !== d.id);
    save(); render();
  }
});
// keep the category list in sync when switching expense/income inside the sheet
SEG_HOOKS.txType = val => {
  const r = $('#sheetBody');
  $('#xCats', r).innerHTML = r.__chips(val, val === 'inc' ? 'salary' : 'food');
  $('#xPayBox', r).style.display = val === 'inc' ? 'none' : '';
};
