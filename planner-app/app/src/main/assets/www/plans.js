'use strict';
/* =====================================================================
   Плани (завдання) — перенесено з v1 без змін у даних
   ===================================================================== */
const PRIO = { 3: ['Високий', 'var(--red)'], 2: ['Середній', 'var(--amber)'], 1: ['Низький', 'var(--green)'] };
U.planFilter = 'active';

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
  return `<div class="item ${t.done ? 'done' : ''}" data-id="${t.id}" data-swr="taskToggle" data-swl="taskDel">
    <button class="check round ${t.done ? 'on' : ''}" data-a="taskToggle" data-id="${t.id}" aria-label="Виконано"></button>
    <div class="grow" data-a="taskEdit" data-id="${t.id}">
      <div class="title">${esc(t.title)}</div>
      <div class="meta"><span class="dot" style="background:${pr[1]}"></span>${pr[0]}${due ? ' ' + due : ''}${t.repeat ? ` <span class="pill">🔁 ${REPEAT_SHORT[t.repeat]}</span>` : ''}${t.note ? `<span class="ellipsis" style="max-width:100%">${esc(t.note)}</span>` : ''}</div>
    </div></div>`;
}
function plansBlock(inPager) {
  const active = S.tasks.filter(t => !t.done), done = S.tasks.filter(t => t.done);
  const list = (U.planFilter === 'active' ? active : U.planFilter === 'done' ? done : S.tasks.slice()).sort(taskSort);
  const pct = S.tasks.length ? Math.round(done.length / S.tasks.length * 100) : 0;
  return `
    ${inPager ? '' : `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Мої плани</h2>
      ${S.tasks.length ? `<span class="small muted">${done.length}/${S.tasks.length} · ${pct}%</span>` : ''}</div>`}
    <div class="seg">${[['active', 'Активні'], ['done', 'Виконані'], ['all', 'Усі']].map(([v, l]) => `<button data-a="planFilter" data-v="${v}" class="${U.planFilter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map(taskRow).join('')}</div>`
      : emptyCard(U.planFilter === 'done' ? '🏁' : '📝', U.planFilter === 'done' ? 'Ще нічого не виконано' : 'Планів поки немає', U.planFilter === 'done' ? null : { label: 'Додати план', attrs: 'data-a="taskNew"' })}
    ${done.length && U.planFilter !== 'active' ? `<button class="btn ghost card-btn" data-a="clearDone">Видалити виконані</button>` : ''}`;
}
const CAL_IC = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;
/** Updates the calendar button (icon <-> date) and the quick chips from the hidden #tDue value. */
function syncDue() {
  const inp = $('#tDue'), btn = $('#tDueBtn'); if (!inp || !btn) return;
  const v = inp.value;
  if (v) { const d = parseYmd(v); btn.innerHTML = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + String(d.getFullYear()).slice(2) : ''}`; btn.classList.toggle('set', true); btn.setAttribute('aria-label', 'Термін: ' + dateLabel(v)); }
  else { btn.innerHTML = CAL_IC; btn.classList.toggle('set', false); btn.setAttribute('aria-label', 'Обрати дату'); }
  const t = today();
  $$('[data-a="setDue"]').forEach(c => c.classList.toggle('on', c.dataset.d === '' ? !v : v === addDays(t, +c.dataset.d)));
}
function taskSheet(id, presetDue) {
  const t = S.tasks.find(x => x.id === id) || { title: '', note: '', prio: 2, due: presetDue || '' };
  openSheet(`
    <h2>${id ? 'Редагувати план' : 'Новий план'}</h2>
    <div class="title-row">
      <input class="input grow" id="tTitle" maxlength="200" placeholder="Що потрібно зробити?" value="${esc(t.title)}">
      <button class="cal-btn" id="tDueBtn" data-a="pickDue"></button>
      <input type="date" id="tDue" class="due-hidden" tabindex="-1" aria-hidden="true" value="${t.due || ''}">
    </div>
    <div class="field"><label>Пріоритет</label>${seg('prio', [['1', 'Низький'], ['2', 'Середній'], ['3', 'Високий']], String(t.prio || 2))}</div>
    <div class="field"><label>Термін</label>
      <div class="due-chips"><button class="chip" data-a="setDue" data-d="0">Сьогодні</button><button class="chip" data-a="setDue" data-d="1">Завтра</button><button class="chip" data-a="setDue" data-d="">Без дати</button></div></div>
    ${repeatChips(t.repeat, 'task')}
    <div class="field"><textarea class="input" id="tNote" maxlength="1000" placeholder="Нотатка (необовʼязково)">${esc(t.note)}</textarea></div>
    ${id ? `<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn ghost grow" data-a="taskToEvent" data-id="${id}">📅 У події</button><button class="btn ghost grow" data-a="taskShare" data-id="${id}">${ICONS.share} Поділитися</button></div>` : ''}
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="taskDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="taskSave" data-id="${id || ''}">Зберегти</button>
    </div>`, r => { syncDue(); if (!id) setTimeout(() => $('#tTitle', r).focus(), 300); });
}
document.addEventListener('change', e => { if (e.target.id === 'tDue') syncDue(); });
Object.assign(A, {
  planFilter: d => { U.planFilter = d.v; render(); },
  taskNew: () => taskSheet(),
  taskToggle: d => {
    const t = S.tasks.find(x => x.id === d.id); if (!t) return;
    if (t.repeat && !t.done) { // repeating: mark this time as done and move to the next date
      const tdy = today(); let nx = nextRepeat(t.due || tdy, t.repeat);
      while (nx <= tdy) nx = nextRepeat(nx, t.repeat);
      t.lastDone = tdy; t.count = (t.count || 0) + 1; t.due = nx;
      save(); render(); toast(`Виконано ✓ Наступного разу — ${dateLabel(nx)}`); return;
    }
    t.done = !t.done; save(); render(); if (t.done) toast('Виконано ✓');
  },
  taskToEvent: d => {
    const t = S.tasks.find(x => x.id === d.id); if (!t) return;
    const r = $('#sheetBody'), title = ($('#tTitle', r) || {}).value || t.title, due = ($('#tDue', r) || {}).value || t.due;
    const ev = { id: uid(), title: title.trim().slice(0, 200), date: due || today(), time: '', note: (($('#tNote', r) || {}).value || t.note || '').trim(), important: (+segVal(r, 'prio') || t.prio) === 3, remind: 'day', repeat: t.repeat || '' };
    S.events.push(ev); S.tasks = S.tasks.filter(x => x.id !== t.id); save(); render();
    toast(`📅 Перенесено в події: ${dateLabel(ev.date)} — можна вказати час`); eventSheet(ev.id); ensureNotifPermission();
  },
  taskShare: d => { const t = S.tasks.find(x => x.id === d.id); if (t) shareText(recordText('task', t)); },
  taskEdit: d => taskSheet(d.id),
  setDue: d => { $('#tDue').value = d.d === '' ? '' : addDays(today(), +d.d); syncDue(); },
  pickDue: () => { const inp = $('#tDue'); if (inp) Picker.open(inp); },

  taskSave: d => {
    const r = $('#sheetBody'); const title = $('#tTitle', r).value.trim();
    if (!title) return invalid('tTitle', 'Введіть назву');
    const due = $('#tDue', r).value;
    if (due && !isDate(due)) return invalid('tDue', 'Некоректна дата');
    const repeat = repVal(r);
    const data = { title: title.slice(0, 200), note: $('#tNote', r).value.trim().slice(0, 1000), prio: +segVal(r, 'prio') || 2, due: repeat && !due ? today() : due, repeat };
    if (d.id) Object.assign(S.tasks.find(x => x.id === d.id), data);
    else S.tasks.unshift({ id: uid(), done: false, created: Date.now(), ...data });
    save(); closeSheet(); render();
  },
  taskDel: d => { S.tasks = S.tasks.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Видалено'); },
  clearDone: async () => {
    const n = S.tasks.filter(t => t.done).length;
    if (!await ask({ title: 'Видалити виконані?', text: `${n} ${plural(n, 'план', 'плани', 'планів')} буде видалено.`, ok: 'Видалити', danger: true })) return;
    S.tasks = S.tasks.filter(t => !t.done); save(); render();
  }
});

/* =====================================================================
   Головна: погода (компактно), сьогодні, швидкі дії, плани
   ===================================================================== */
VIEWS.home = () => {
  const tdy = today();
  const ev = S.events.filter(e => repeatsOn(e.date, e.repeat, tdy)).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  const bdays = typeof Birthdays !== 'undefined' ? Birthdays.upcoming(7) : [];
  const cyc = typeof Cycle !== 'undefined' ? Cycle.todayLine() : '';
  const n = new Date();
  const lim = S.budget.total, spent = Fin.spentInMonth(null, n.getFullYear(), n.getMonth());
  const todayItems = [
    ...ev.map(e => `<div class="item" data-a="eventEdit" data-id="${e.id}"><div class="emoji sm">${e.important ? '⭐' : '📌'}</div>
      <div class="grow"><div class="title">${esc(e.title)}</div><div class="meta">${e.time ? esc(e.time) : 'Весь день'}</div></div></div>`),
    ...bdays.filter(b => b.days === 0).map(b => `<div class="item" data-a="go" data-page="person" data-id="${b.p.id}"><div class="emoji sm">🎂</div>
      <div class="grow"><div class="title">День народження: ${esc(b.p.name)}</div><div class="meta">${b.age ? b.age + ' ' + plural(b.age, 'рік', 'роки', 'років') : 'Сьогодні'}</div></div></div>`)
  ];
  return `
    ${typeof Weather !== 'undefined' ? Weather.mini() : ''}
    <div class="quick">
      <button data-a="txNew" data-type="exp"><span>💸</span>Витрата</button>
      <button data-a="taskNew"><span>📝</span>План</button>
      <button data-a="eventNew"><span>📅</span>Подія</button>
      <button data-a="go" data-page="wishes"><span>🎯</span>Хотілки</button>
    </div>
    ${todayItems.length || cyc ? `<h2>Сьогодні</h2><div class="list">${todayItems.join('')}${cyc}</div>` : ''}
    ${bdays.filter(b => b.days > 0).length ? `<div class="card row" data-a="go" data-page="birthdays" style="cursor:pointer">
      <div class="emoji">🎂</div><div class="grow">${bdays.filter(b => b.days > 0).slice(0, 2).map(b => `<div><b>${esc(b.p.name)}</b> <span class="muted small">— ${b.days === 1 ? 'завтра' : `через ${b.days} ${plural(b.days, 'день', 'дні', 'днів')}`}</span></div>`).join('')}</div></div>` : ''}
    ${lim ? `<div class="card" data-a="tabSeg" data-tab="finance" data-key="fin" data-val="budget" style="cursor:pointer">
      <div class="row between"><b>Бюджет на ${MONTHS[n.getMonth()].toLowerCase()}</b><span class="small muted">${money(spent)} з ${money(lim)}</span></div>
      ${progressBar(spent / lim * 100, spent > lim ? 'var(--red)' : spent > lim * .8 ? 'var(--amber)' : '')}</div>` : ''}
    ${S.goals && S.goals.length ? homePager() : plansBlock()}`;
};
FABS.home = () => taskSheet();

/* Home: «Цілі на сьогодні» ⇄ «Мої плани» — swipe pager; the tab strip slides with the pages, dots below */
U.hpIdx = U.hpIdx || 0;
U.hpDate = '';
U.hpCal = null; // {y, m} when the dropdown calendar is open
function homePager() {
  const D = U.hpDate || today(), isT = D === today(), d = parseYmd(D);
  const pend = isT ? Goals.pending().length : 0;
  const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const dayTasks = isT ? null : S.tasks.filter(t => t.due === D);
  const slot = (i, name) => `<button class="hp-slot ${i === U.hpIdx ? 'on' : ''}" data-a="hpSlot" data-i="${i}"><span class="hp-roll" style="transform:translateY(${i === U.hpIdx ? -100 : 0}%)"><span class="hp-l">${name}</span><span class="hp-l">${label}<i class="hp-chev"></i></span></span></button>`;
  return `<div class="hp-strip ${U.hpCal ? 'cal-open' : ''}" id="hpStrip"><span class="hp-pill" id="hpPill" style="transform:translateX(${U.hpIdx * 100}%)"></span>
      ${slot(0, 'Плани')}${slot(1, `Цілі${pend ? ` <i class="hp-badge">${pend}</i>` : ''}`)}</div>
    ${U.hpCal ? hpCalHtml(D) : ''}
    <div class="hp-dots" id="hpDots">${[0, 1].map(i => `<i data-a="hpGo" data-i="${i}" class="${i === U.hpIdx ? 'on' : ''}"></i>`).join('')}</div>
    <div class="hpager" id="hpager">
      <section>${isT ? plansBlock(true) : `${dayTasks.length ? `<div class="list">${dayTasks.sort(taskSort).map(taskRow).join('')}</div>` : emptyCard('📝', `На ${dateLabel(D).toLowerCase()} планів немає`, null)}
        <div class="btns"><button class="btn ghost card-btn" data-a="hpAddTask">+ План на ${shortDate(D)}</button></div>`}</section>
      <section><div class="list">${S.goals.map(g => goalRow(g, D)).join('')}</div>
        <div class="small ${isT ? (pend ? 'red' : 'green') : 'muted'}" style="margin:8px 6px 0">${isT ? (pend ? `${pend} чекає на сьогодні` : 'На сьогодні все ✓') : `Відмітки за ${dateLabel(D)}`}</div></section></div>`;
}
function hpCalHtml(sel) {
  const { y, m } = U.hpCal, first = new Date(y, m, 1), start = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), tdy = today();
  let cells = ''; for (let i = 0; i < start; i++) cells += '<span></span>';
  for (let dd = 1; dd <= days; dd++) { const ds = ymd(new Date(y, m, dd)); cells += `<button data-a="hpPick" data-d="${ds}" class="${ds === sel ? 'sel' : ''} ${ds === tdy ? 'tdy' : ''}">${dd}</button>`; }
  return `<div class="card hp-cal"><div class="row between"><button class="nav-btn sm" data-a="hpCalNav" data-d="-1">‹</button><b>${MONTHS[m]} ${y}</b><button class="nav-btn sm" data-a="hpCalNav" data-d="1">›</button></div>
    <div class="hp-cal-g">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(w => `<span class="muted">${w}</span>`).join('')}${cells}</div>
    ${sel !== tdy ? `<button class="chip card-bg" style="margin-top:8px" data-a="hpPick" data-d="${tdy}">Сьогодні</button>` : ''}</div>`;
}
let hpLastK = null;
function hpSync(idx) {
  const pg = $('#hpager'); if (!pg) return;
  const x = Math.max(0, Math.min(1, idx === undefined ? pg.scrollLeft / pg.clientWidth : idx)), k = Math.round(x);
  const pill = $('#hpPill'); if (pill) pill.style.transform = `translateX(${x * 100}%)`;
  $$('#hpStrip .hp-slot').forEach((el, i) => { const t = Math.max(0, 1 - Math.abs(x - i)); el.firstChild.style.transform = `translateY(${-t * 50}%)`; el.classList.toggle('on', i === k); });
  $$('.hp-dots i').forEach((d, i) => d.classList.toggle('on', i === k));
  if (hpLastK !== null && k !== hpLastK && typeof haptic === 'function') haptic('tick');
  hpLastK = k;
  const secs = pg.children; if (secs[k]) pg.style.height = secs[k].offsetHeight + 'px';
}
AFTER_RENDER.push(() => {
  const pg = $('#hpager'); if (!pg) return;
  pg.scrollLeft = U.hpIdx * pg.clientWidth; hpLastK = null; hpSync(U.hpIdx);
  let t = 0;
  pg.addEventListener('scroll', () => { hpSync(); clearTimeout(t); t = setTimeout(() => { const k = Math.round(pg.scrollLeft / pg.clientWidth); if (k !== U.hpIdx) U.hpIdx = k; hpSync(k); }, 90); }, { passive: true });
});
Object.assign(A, {
  hpSlot: d => { if (+d.i === U.hpIdx) A.hpCal(); else A.hpGo(d); },
  hpCal: () => { if (U.hpCal) U.hpCal = null; else { const d = parseYmd(U.hpDate || today()); U.hpCal = { y: d.getFullYear(), m: d.getMonth() }; } render(); },
  hpCalNav: d => { let { y, m } = U.hpCal; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } U.hpCal = { y, m }; render(); },
  hpPick: d => { U.hpDate = d.d === today() ? '' : d.d; U.hpCal = null; render(); },
  hpAddTask: () => taskSheet(null, U.hpDate)
});
A.hpGo = d => { const pg = $('#hpager'); if (!pg) return; U.hpIdx = +d.i; pg.scrollTo({ left: U.hpIdx * pg.clientWidth, behavior: 'smooth' }); };
