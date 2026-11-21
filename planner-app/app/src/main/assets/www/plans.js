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
  return `<div class="item ${t.done ? 'done' : ''}">
    <button class="check round ${t.done ? 'on' : ''}" data-a="taskToggle" data-id="${t.id}" aria-label="Виконано"></button>
    <div class="grow" data-a="taskEdit" data-id="${t.id}">
      <div class="title">${esc(t.title)}</div>
      <div class="meta"><span class="dot" style="background:${pr[1]}"></span>${pr[0]}${due ? ' ' + due : ''}${t.note ? `<span class="ellipsis" style="max-width:100%">${esc(t.note)}</span>` : ''}</div>
    </div></div>`;
}
function plansBlock() {
  const active = S.tasks.filter(t => !t.done), done = S.tasks.filter(t => t.done);
  const list = (U.planFilter === 'active' ? active : U.planFilter === 'done' ? done : S.tasks.slice()).sort(taskSort);
  const pct = S.tasks.length ? Math.round(done.length / S.tasks.length * 100) : 0;
  return `
    <div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Мої плани</h2>
      ${S.tasks.length ? `<span class="small muted">${done.length}/${S.tasks.length} · ${pct}%</span>` : ''}</div>
    <div class="seg">${[['active', 'Активні'], ['done', 'Виконані'], ['all', 'Усі']].map(([v, l]) => `<button data-a="planFilter" data-v="${v}" class="${U.planFilter === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map(taskRow).join('')}</div>`
      : emptyCard(U.planFilter === 'done' ? '🏁' : '📝', U.planFilter === 'done' ? 'Ще нічого не виконано' : 'Планів поки немає', U.planFilter === 'done' ? null : { label: 'Додати план', attrs: 'data-a="taskNew"' })}
    ${done.length && U.planFilter !== 'active' ? `<button class="btn ghost card-btn" data-a="clearDone">Видалити виконані</button>` : ''}`;
}
function taskSheet(id) {
  const t = S.tasks.find(x => x.id === id) || { title: '', note: '', prio: 2, due: '' };
  openSheet(`
    <h2>${id ? 'Редагувати план' : 'Новий план'}</h2>
    <div class="field"><input class="input" id="tTitle" maxlength="200" placeholder="Що потрібно зробити?" value="${esc(t.title)}"></div>
    <div class="field"><textarea class="input" id="tNote" maxlength="1000" placeholder="Нотатка (необовʼязково)">${esc(t.note)}</textarea></div>
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
Object.assign(A, {
  planFilter: d => { U.planFilter = d.v; render(); },
  taskNew: () => taskSheet(),
  taskToggle: d => { const t = S.tasks.find(x => x.id === d.id); if (!t) return; t.done = !t.done; save(); render(); if (t.done) toast('Виконано ✓'); },
  taskEdit: d => taskSheet(d.id),
  setDue: d => { $('#tDue').value = d.d === '' ? '' : addDays(today(), +d.d); },
  taskSave: d => {
    const r = $('#sheetBody'); const title = $('#tTitle', r).value.trim();
    if (!title) return invalid('tTitle', 'Введіть назву');
    const due = $('#tDue', r).value;
    if (due && !isDate(due)) return invalid('tDue', 'Некоректна дата');
    const data = { title: title.slice(0, 200), note: $('#tNote', r).value.trim().slice(0, 1000), prio: +segVal(r, 'prio') || 2, due };
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
  const ev = S.events.filter(e => e.date === tdy).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
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
      <button data-a="go" data-page="wishes"><span>💖</span>Хотілки</button>
    </div>
    ${todayItems.length || cyc ? `<h2>Сьогодні</h2><div class="list">${todayItems.join('')}${cyc}</div>` : ''}
    ${bdays.filter(b => b.days > 0).length ? `<div class="card row" data-a="go" data-page="birthdays" style="cursor:pointer">
      <div class="emoji">🎂</div><div class="grow">${bdays.filter(b => b.days > 0).slice(0, 2).map(b => `<div><b>${esc(b.p.name)}</b> <span class="muted small">— ${b.days === 1 ? 'завтра' : `через ${b.days} ${plural(b.days, 'день', 'дні', 'днів')}`}</span></div>`).join('')}</div></div>` : ''}
    ${lim ? `<div class="card" data-a="tabSeg" data-tab="finance" data-key="fin" data-val="budget" style="cursor:pointer">
      <div class="row between"><b>Бюджет на ${MONTHS[n.getMonth()].toLowerCase()}</b><span class="small muted">${money(spent)} з ${money(lim)}</span></div>
      ${progressBar(spent / lim * 100, spent > lim ? 'var(--red)' : spent > lim * .8 ? 'var(--amber)' : '')}</div>` : ''}
    ${plansBlock()}`;
};
FABS.home = () => taskSheet();
