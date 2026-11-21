'use strict';
/* =====================================================================
   Календар: події, плани, дні народження, менструальний цикл
   ===================================================================== */

/* ---------------- Cycle model ---------------- */
const Cycle = {
  DEF_CYCLE: 28, DEF_PERIOD: 5,
  periods() { return S.cycle.periods.slice().sort((a, b) => a.start < b.start ? -1 : 1); },
  duration(p) { return p.end ? diffDays(p.start, p.end) + 1 : null; },
  /** Lengths between consecutive starts; implausible gaps (missed logs) are ignored. */
  lengths() {
    const ps = this.periods(), out = [];
    for (let i = 1; i < ps.length; i++) { const l = diffDays(ps[i - 1].start, ps[i].start); if (l >= 15 && l <= 60) out.push(l); }
    return out;
  },
  mean: a => a.reduce((s, x) => s + x, 0) / a.length,
  avgCycle() { const l = this.lengths().slice(-6); return l.length ? Math.round(this.mean(l)) : this.DEF_CYCLE; },
  avgPeriod() {
    const d = this.periods().map(p => this.duration(p)).filter(x => x && x <= 14).slice(-6);
    return d.length ? Math.round(this.mean(d)) : this.DEF_PERIOD;
  },
  last() { const p = this.periods(); return p[p.length - 1] || null; },
  ongoing() { const l = this.last(); return l && !l.end ? l : null; },
  next() {
    const l = this.last(); if (!l) return null;
    const date = addDays(l.start, this.avgCycle());
    return { date, late: Math.max(0, diffDays(date, today())), inDays: diffDays(today(), date) };
  },
  regularity() {
    const l = this.lengths();
    if (l.length < 2) return null;
    const m = this.mean(l), sd = Math.sqrt(this.mean(l.map(x => (x - m) ** 2)));
    const label = sd <= 2 ? 'Регулярний' : sd <= 4 ? 'Відносно регулярний' : 'Нерегулярний';
    return { sd: Math.round(sd * 10) / 10, min: Math.min(...l), max: Math.max(...l), label, n: l.length };
  },
  /** date → 'period' | 'predicted' | 'fertile' | 'ovulation' */
  map() {
    const m = {}; const ps = this.periods(); if (!ps.length) return m;
    const avgP = this.avgPeriod(), avgC = this.avgCycle(), tdy = today();
    ps.forEach(p => {
      const end = p.end || (tdy > p.start ? tdy : p.start);
      for (let d = p.start; d <= end; d = addDays(d, 1)) m[d] = 'period';
      if (!p.end) for (let d = addDays(end, 1), i = diffDays(p.start, end) + 1; i < avgP; i++, d = addDays(d, 1)) m[d] = m[d] || 'predicted';
    });
    const last = ps[ps.length - 1];
    for (let k = 1; k <= 4; k++) {
      let start = addDays(last.start, avgC * k);
      const ovu = addDays(start, -14);
      for (let d = addDays(ovu, -5); d <= addDays(ovu, 1); d = addDays(d, 1)) if (!m[d]) m[d] = 'fertile';
      m[ovu] = m[ovu] === 'period' ? 'period' : 'ovulation';
      if (start < tdy) continue; // overdue: don't paint predicted days in the past
      for (let i = 0; i < avgP; i++) { const d = addDays(start, i); if (!m[d]) m[d] = 'predicted'; }
    }
    return m;
  },
  cycleDay(date = today()) { const l = this.periods().filter(p => p.start <= date).pop(); return l ? diffDays(l.start, date) + 1 : null; },
  status() {
    if (!S.cycle.periods.length) return null;
    const tdy = today(), m = this.map(), nx = this.next(), on = this.ongoing();
    const ovu = nx ? addDays(nx.date, -14) : null;
    let line;
    if (m[tdy] === 'period') line = `Менструація, ${this.cycleDay()}-й день`;
    else if (nx && nx.late > 0) line = `Затримка ${nx.late} ${plural(nx.late, 'день', 'дні', 'днів')} (орієнтовно)`;
    else if (m[tdy] === 'ovulation') line = 'Орієнтовний день овуляції';
    else if (m[tdy] === 'fertile') line = 'Фертильне вікно (орієнтовно)';
    else if (nx) line = `Наступна менструація через ${nx.inDays} ${plural(nx.inDays, 'день', 'дні', 'днів')}`;
    return { line, day: this.cycleDay(), next: nx, ovu, ongoing: on };
  },
  todayLine() {
    if (S.cycle.hide) return '';
    const s = this.status(); if (!s) return '';
    return `<div class="item" data-a="go" data-page="cycle"><div class="emoji sm" style="background:var(--period-bg)">🌸</div>
      <div class="grow"><div class="title">${esc(s.line)}</div><div class="meta">${s.day ? `${s.day}-й день циклу · ` : ''}прогноз орієнтовний</div></div></div>`;
  },
  validate(start, end, ignoreId) {
    if (!isDate(start)) return 'Вкажіть перший день';
    if (start > today()) return 'Перший день не може бути в майбутньому';
    if (end) {
      if (!isDate(end)) return 'Некоректний останній день';
      if (end < start) return 'Останній день не може бути раніше першого';
      if (diffDays(start, end) > 13) return 'Тривалість понад 14 днів — перевірте дати';
    }
    const e1 = end || start;
    const clash = S.cycle.periods.find(p => p.id !== ignoreId && !(e1 < p.start || start > (p.end || p.start)));
    if (clash) return `Перетинається з циклом від ${shortDate(clash.start)}`;
    return '';
  }
};
REMINDER_PROVIDERS.push(() => {
  if (!S.cycle.remind || !S.cycle.periods.length) return [];
  const nx = Cycle.next(); if (!nx || nx.late > 0) return [];
  const days = S.cycle.remindDays || 0;
  return [{ id: 'cycle-next', at: at9(addDays(nx.date, -days)), title: 'Танічка🦝 · цикл', text: days ? `Орієнтовно через ${days} ${plural(days, 'день', 'дні', 'днів')} почнеться менструація.` : 'Орієнтовно сьогодні почнеться менструація.' }];
});

/* ---------------- event reminders ---------------- */
REMINDER_PROVIDERS.push(() => S.events.filter(e => e.remind && e.date >= addDays(today(), -1)).map(e => {
  let at;
  if (e.remind === 'hour' && e.time) { const [h, mi] = e.time.split(':').map(Number); const d = parseYmd(e.date); d.setHours(h, mi - 60, 0, 0); at = d.getTime(); }
  else if (e.remind === 'prev') at = at9(addDays(e.date, -1), 18);
  else at = at9(e.date, 8);
  return { id: 'ev-' + e.id, at, title: e.important ? '⭐ ' + e.title : e.title, text: `${dateLabel(e.date)}${e.time ? ' о ' + e.time : ''}${e.note ? ' · ' + e.note : ''}` };
}));

/* ---------------- Calendar view ---------------- */
const now0 = new Date();
U.cal = { y: now0.getFullYear(), m: now0.getMonth() }; U.calSel = today();

function eventRow(e) {
  return `<div class="item" data-a="eventEdit" data-id="${e.id}">
    <div class="emoji sm" style="font-size:13px;font-weight:600">${e.time ? esc(e.time) : (e.important ? '⭐' : '📌')}</div>
    <div class="grow"><div class="title">${e.important ? '⭐ ' : ''}${esc(e.title)}</div>
    <div class="meta">${e.remind ? '🔔 ' : ''}${e.note ? `<span class="ellipsis">${esc(e.note)}</span>` : ''}</div></div></div>`;
}
/** Everything recorded for one date (used by the grid and the day sheet). */
function dayData(date, cmap) {
  const evs = S.events.filter(e => e.date === date).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  const tasks = S.tasks.filter(t => t.due === date);
  const bds = Birthdays.onDate(date);
  const cyc = !S.cycle.hide && cmap ? cmap[date] : '';
  return { evs, tasks, bds, cyc };
}
const CYC_LABEL = { period: '🩸 Менструація', predicted: '🩸 Очікувана менструація (прогноз)', ovulation: '🌱 Орієнтовна овуляція', fertile: '🌿 Фертильне вікно (прогноз)' };

VIEWS.calendar = () => {
  const { y, m } = U.cal;
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const start = new Date(y, m, 1 - offset);
  const tdy = today();
  const showCycle = !S.cycle.hide && S.cycle.periods.length > 0;
  const cmap = showCycle ? Cycle.map() : {};
  const weeks = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7);
  let cells = WD.map((w, i) => `<div class="cwd ${i > 4 ? 'we' : ''}">${w}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = ymd(d), dd = dayData(s, cmap);
    const marks = [];
    if (dd.bds.length) marks.push('<i class="mk bd"></i>');
    if (dd.evs.some(e => e.important)) marks.push('<i class="mk imp"></i>');
    if (dd.evs.some(e => !e.important)) marks.push('<i class="mk ev"></i>');
    if (dd.tasks.some(t => !t.done)) marks.push('<i class="mk task"></i>');
    const first = dd.bds[0] ? '🎂 ' + dd.bds[0].p.name : dd.evs[0] ? dd.evs[0].title : '';
    const n = dd.bds.length + dd.evs.length;
    cells += `<button class="cday ${d.getMonth() !== m ? 'other' : ''} ${i % 7 > 4 ? 'we' : ''} ${s === tdy ? 'today' : ''} ${s === U.calSel ? 'sel' : ''} ${dd.cyc ? 'c-' + dd.cyc : ''}" data-a="calPick" data-d="${s}" aria-label="${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${n ? ', записів: ' + n : ''}">
      <span class="cnum">${d.getDate()}</span>${first ? `<span class="clbl">${esc(first)}</span>` : ''}<span class="cmarks">${marks.join('')}</span></button>`;
  }
  // upcoming 14 days: events, birthdays, plans, expected period
  const up = [];
  for (let k = 0; k < 14; k++) {
    const ds = addDays(tdy, k), dd = dayData(ds, cmap);
    dd.bds.forEach(b => up.push({ d: ds, ic: '🎂', t: b.p.name, sub: 'День народження' + (b.age ? ` · ${b.age}` : ''), a: `data-a="go" data-page="person" data-id="${b.p.id}"` }));
    dd.evs.forEach(e => up.push({ d: ds, ic: e.important ? '⭐' : '📌', t: e.title, sub: (e.time || 'весь день') + (e.remind ? ' · 🔔' : ''), a: `data-a="eventEdit" data-id="${e.id}"` }));
    dd.tasks.filter(t => !t.done).forEach(t => up.push({ d: ds, ic: '📝', t: t.title, sub: 'План', a: `data-a="taskEdit" data-id="${t.id}"` }));
    if (showCycle && dd.cyc === 'predicted' && (k === 0 || dayData(addDays(ds, -1), cmap).cyc !== 'predicted')) up.push({ d: ds, ic: '🩸', t: 'Очікувана менструація', sub: 'прогноз', a: 'data-a="go" data-page="cycle"' });
  }
  return `
    <div class="card cal-card">
      <div class="cal-top">
        <div class="cal-title">${MONTHS[m]} <span class="muted">${y}</span></div>
        <div class="row" style="gap:6px">
          ${(y !== new Date().getFullYear() || m !== new Date().getMonth() || U.calSel !== tdy) ? '<button class="chip" data-a="calToday">Сьогодні</button>' : ''}
          <button class="nav-btn" data-a="calNav" data-d="-1" aria-label="Попередній місяць">‹</button>
          <button class="nav-btn" data-a="calNav" data-d="1" aria-label="Наступний місяць">›</button></div>
      </div>
      <div class="cgrid" id="cgrid">${cells}</div>
      <div class="legend-row">
        <span><i class="mk imp"></i>Важливо</span><span><i class="mk ev"></i>Подія</span><span><i class="mk task"></i>План</span><span><i class="mk bd"></i>ДН</span>
        ${showCycle ? `<span><i class="sq c-period"></i>Цикл</span><span><i class="sq c-predicted"></i>Прогноз</span><span><i class="sq c-fertile"></i>Фертильні</span>` : ''}
      </div>
    </div>
    <h2>Найближчі 2 тижні</h2>
    ${up.length ? `<div class="list">${up.slice(0, 12).map(x => `<div class="item" ${x.a}><div class="up-date"><b>${parseYmd(x.d).getDate()}</b><span>${MONTHS_SHORT[parseYmd(x.d).getMonth()]}</span></div>
      <div class="grow" style="min-width:0"><div class="title ellipsis">${x.ic} ${esc(x.t)}</div><div class="meta">${x.d === tdy ? 'Сьогодні · ' : x.d === addDays(tdy, 1) ? 'Завтра · ' : ''}${esc(x.sub)}</div></div></div>`).join('')}</div>`
      : `<div class="card empty" style="padding:20px">Найближчим часом нічого не заплановано</div>`}`;
};

function daySheet(date) {
  const showCycle = !S.cycle.hide && S.cycle.periods.length > 0;
  const cmap = showCycle ? Cycle.map() : {};
  const dd = dayData(date, cmap), tdy = today();
  const spent = S.tx.filter(t => t.date === date && t.type === 'exp').reduce((a, t) => a + t.amount, 0);
  const inc = S.tx.filter(t => t.date === date && t.type === 'inc').reduce((a, t) => a + t.amount, 0);
  const on = Cycle.ongoing();
  const inPeriod = S.cycle.periods.find(p => date >= p.start && date <= (p.end || p.start));
  const cycBtns = [];
  if (!S.cycle.hide && date <= tdy) {
    if (on && date >= on.start) cycBtns.push(`<button class="chip" data-a="cycEnd" data-d="${date}">Останній день менструації</button>`);
    else if (!inPeriod) cycBtns.push(`<button class="chip" data-a="cycStart" data-d="${date}">🩸 Початок менструації</button>`);
    if (inPeriod) cycBtns.push(`<button class="chip" data-a="cycEdit" data-id="${inPeriod.id}">Редагувати цикл</button>`);
  }
  const empty = !dd.evs.length && !dd.tasks.length && !dd.bds.length && !dd.cyc && !spent && !inc;
  openSheet(`<h2 style="margin-bottom:4px">${dateLabel(date)}</h2>
    <div class="small muted" style="margin-bottom:14px">${date !== tdy ? shortDate(date) + ' · ' : ''}${dd.evs.length + dd.bds.length + dd.tasks.length} ${plural(dd.evs.length + dd.bds.length + dd.tasks.length, 'запис', 'записи', 'записів')}</div>
    ${dd.bds.length || dd.evs.length || dd.tasks.length ? `<div class="list flat">
      ${dd.bds.map(b => `<div class="item" data-a="dayGo" data-page="person" data-id="${b.p.id}"><div class="emoji sm">🎂</div>
        <div class="grow"><div class="title">${esc(b.p.name)}</div><div class="meta">День народження${b.age ? ` · ${b.age} ${plural(b.age, 'рік', 'роки', 'років')}` : ''}</div></div></div>`).join('')}
      ${dd.evs.map(e => `<div class="item" data-a="eventEdit" data-id="${e.id}"><div class="emoji sm" style="font-size:12px;font-weight:600">${e.time ? esc(e.time) : e.important ? '⭐' : '📌'}</div>
        <div class="grow"><div class="title">${e.important ? '⭐ ' : ''}${esc(e.title)}</div><div class="meta">${e.remind ? `🔔 ${({ day: 'нагадування в день', prev: 'нагадування за день', hour: 'нагадування за годину' })[e.remind]}` : 'без нагадування'}${e.note ? ' · ' + esc(e.note) : ''}</div></div></div>`).join('')}
      ${dd.tasks.map(t => `<div class="item"><div class="emoji sm">📝</div><div class="grow" data-a="taskEdit" data-id="${t.id}"><div class="title ${t.done ? 'muted' : ''}">${esc(t.title)}</div><div class="meta">План${t.done ? ' · виконано' : ''}</div></div></div>`).join('')}
    </div>` : ''}
    ${dd.cyc || cycBtns.length ? `<div class="day-cyc">${dd.cyc ? `<b>${CYC_LABEL[dd.cyc]}</b>${Cycle.cycleDay(date) ? ` <span class="small muted">· ${Cycle.cycleDay(date)}-й день циклу</span>` : ''}` : ''}
      <div class="chips" style="margin-top:${dd.cyc ? 8 : 0}px">${cycBtns.join('')}<button class="chip" data-a="dayGo" data-page="cycle">Мій цикл</button></div></div>` : ''}
    ${spent || inc ? `<div class="day-fin" data-a="dayFin" data-d="${date}">💳 ${spent ? `Витрати: <b>${money(spent)}</b>` : ''}${spent && inc ? ' · ' : ''}${inc ? `Доходи: <b class="green">${money(inc)}</b>` : ''}</div>` : ''}
    ${empty ? '<div class="muted" style="padding:6px 2px 4px">Записів на цей день немає.</div>' : ''}
    <div class="btns two"><button class="btn ghost" data-a="dayAddTask" data-d="${date}">+ План</button><button class="btn" data-a="dayAddEvent" data-d="${date}">+ Подія</button></div>`);
}

FABS.calendar = () => eventSheet(null, U.calSel);

// swipe between months on the grid
(() => {
  let x0 = null, y0 = 0;
  document.addEventListener('touchstart', e => { if (e.target.closest('#cgrid')) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) A.calNav({ d: dx < 0 ? 1 : -1 });
  }, { passive: true });
})();

function eventSheet(id, date) {
  const e = S.events.find(x => x.id === id) || { title: '', note: '', date: date || U.calSel || today(), time: '', important: true, remind: 'day' };
  openSheet(`
    <h2>${id ? 'Редагувати справу' : 'Важлива справа'}</h2>
    <div class="field"><input class="input" id="eTitle" maxlength="200" placeholder="Назва (напр. Запис до лікаря)" value="${esc(e.title)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Дата</label><input type="date" class="input" id="eDate" value="${e.date}"></div>
      <div class="field" style="width:42%"><label>Час</label><input type="time" class="input" id="eTime" value="${e.time || ''}"></div>
    </div>
    <div class="field"><textarea class="input" id="eNote" maxlength="1000" placeholder="Деталі (необовʼязково)">${esc(e.note)}</textarea></div>
    <div class="field"><label>Нагадування</label>${seg('eRem', [['', 'Без'], ['day', 'У день'], ['prev', 'За день'], ['hour', 'За годину']], e.remind || '')}</div>
    <div class="switch"><div><b>Важливо</b><div class="small muted">Показувати серед найближчих важливих</div></div>${toggleHtml('eImp', e.important)}</div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="eventDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="eventSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#eTitle', r).focus(), 300); });
}

function cycleSheet(id, start = '', end = '') {
  const p = S.cycle.periods.find(x => x.id === id) || { start: start || today(), end: end || '' };
  openSheet(`<h2>${id ? 'Редагувати цикл' : 'Додати менструацію'}</h2>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Перший день</label><input type="date" class="input" id="cStart" max="${today()}" value="${p.start}"></div>
      <div class="field grow"><label>Останній день</label><input type="date" class="input" id="cEnd" max="${today()}" value="${p.end || ''}"></div>
    </div>
    <div class="small muted" style="margin:-4px 4px 8px">Залиште «Останній день» порожнім, якщо менструація ще триває.</div>
    <div class="btns ${id ? 'two' : ''}">${id ? `<button class="btn danger" data-a="cycDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="cycSave" data-id="${id || ''}">Зберегти</button></div>`);
}

PAGES.cycle = () => {
  const st = Cycle.status(), reg = Cycle.regularity(), ps = Cycle.periods().reverse();
  const avgC = Cycle.avgCycle(), avgP = Cycle.avgPeriod();
  const all = Cycle.periods();
  const hist = ps.map(p => {
    const i = all.findIndex(x => x.id === p.id); const nextP = all[i + 1];
    const len = nextP ? diffDays(p.start, nextP.start) : null;
    return `<div class="item" data-a="cycEdit" data-id="${p.id}"><div class="emoji sm" style="background:var(--period-bg)">🩸</div>
      <div class="grow"><div class="title">${shortDate(p.start)} — ${p.end ? shortDate(p.end) : 'триває'}</div>
      <div class="meta">${p.end ? `${Cycle.duration(p)} ${plural(Cycle.duration(p), 'день', 'дні', 'днів')}` : 'останній день не вказано'}${len ? ` · цикл ${len} ${plural(len, 'день', 'дні', 'днів')}${len < 15 || len > 60 ? ' (не враховано)' : ''}` : ' · поточний цикл'}</div></div></div>`;
  }).join('');
  return {
    title: 'Мій цикл', html: `
    ${st ? `<div class="card cycle-hero">
      <div class="small muted">Сьогодні</div><div class="big-line">${esc(st.line)}</div>
      ${st.day ? `<div class="small muted">${st.day}-й день циклу</div>` : ''}
      <div class="sep"></div>
      <div class="kv"><span>Наступна менструація</span><b>${st.next ? shortDate(st.next.date) : '—'}</b></div>
      <div class="kv"><span>Овуляція (орієнтовно)</span><b>${st.ovu ? shortDate(st.ovu) : '—'}</b></div>
      <div class="kv"><span>Фертильне вікно</span><b>${st.ovu ? `${shortDate(addDays(st.ovu, -5))} – ${shortDate(addDays(st.ovu, 1))}` : '—'}</b></div>
      ${st.ongoing ? `<div class="btns"><button class="btn" data-a="cycEnd" data-d="${today()}">Сьогодні останній день</button></div>`
        : `<div class="btns"><button class="btn" data-a="cycStart" data-d="${today()}">🩸 Почалась сьогодні</button></div>`}
    </div>` : `<div class="card empty"><div class="big">🌸</div>Позначте перший день останньої менструації — і Танічка порахує прогноз.
      <div class="btns"><button class="btn sm" style="margin:0 auto" data-a="cycNew">Додати</button></div></div>`}
    ${st ? `<h2>Статистика</h2><div class="stats">
      <div class="stat"><b>${avgC}</b><span>сер. цикл, дн.</span></div>
      <div class="stat"><b>${avgP}</b><span>сер. менструація</span></div>
      <div class="stat"><b>${S.cycle.periods.length}</b><span>${plural(S.cycle.periods.length, 'запис', 'записи', 'записів')}</span></div></div>
      <div class="card"><b>Регулярність</b>
      ${reg ? `<div style="margin-top:6px"><span class="pill ${reg.label === 'Регулярний' ? 'green' : reg.label === 'Нерегулярний' ? 'red' : 'blue'}">${reg.label}</span></div>
        <div class="small muted" style="margin-top:8px;line-height:1.45">Тривалість циклу від ${reg.min} до ${reg.max} днів, відхилення ±${reg.sd} дн. (за ${reg.n} ${plural(reg.n, 'циклом', 'циклами', 'циклами')}).</div>`
        : `<div class="small muted" style="margin-top:6px">Потрібно щонайменше 3 записи, щоб оцінити регулярність.</div>`}</div>` : ''}
    ${ps.length ? `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Попередні цикли</h2><button class="chip card-bg" data-a="cycNew">+ Додати</button></div><div class="list">${hist}</div>` : ''}
    <h2>Налаштування</h2>
    <div class="card">
      <div class="switch"><div><b>Нагадування</b><div class="small muted">Перед очікуваним початком</div></div>${toggleHtml('cycRem', S.cycle.remind).replace('data-a="toggle"', 'data-a="cycRemind"')}</div>
      ${S.cycle.remind ? `<div class="field" style="margin:4px 0 8px">${seg('cycDays', [['0', 'У день'], ['1', 'За 1 день'], ['2', 'За 2 дні'], ['3', 'За 3 дні']], String(S.cycle.remindDays))}</div>` : ''}
      <div class="switch"><div><b>Приховати в календарі</b><div class="small muted">Цикл не показуватиметься в календарі та на головній</div></div>${toggleHtml('cycHide', S.cycle.hide).replace('data-a="toggle"', 'data-a="cycHide"')}</div>
    </div>
    ${S.cycle.periods.length ? `<button class="btn danger" data-a="cycWipe">Видалити всі дані циклу</button>` : ''}`
  };
};

Object.assign(A, {
  calNav: d => { let { y, m } = U.cal; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } U.cal = { y, m }; render(); },
  calPick: d => {
    U.calSel = d.d; const dt = parseYmd(d.d);
    if (dt.getMonth() !== U.cal.m) U.cal = { y: dt.getFullYear(), m: dt.getMonth() };
    render(); daySheet(d.d);
  },
  dayGo: d => { closeSheet(); navigate(d.page, { id: d.id }); },
  dayAddEvent: d => eventSheet(null, d.d),
  dayAddTask: d => taskSheet(null, d.d),
  dayFin: d => { closeSheet(); U.finFilter.q = ''; U.finFilter.type = 'all'; U.seg.fin = 'ops'; go('finance'); },
  calToday: () => { U.calSel = today(); U.cal = { y: new Date().getFullYear(), m: new Date().getMonth() }; render(); },
  eventNew: () => eventSheet(null, U.tab === 'calendar' ? U.calSel : today()),
  eventEdit: d => eventSheet(d.id),
  eventSave: d => {
    const r = $('#sheetBody'); const title = $('#eTitle', r).value.trim(); const date = $('#eDate', r).value;
    if (!title) return invalid('eTitle', 'Введіть назву');
    if (!isDate(date)) return invalid('eDate', 'Оберіть дату');
    const time = $('#eTime', r).value;
    let remind = segVal(r, 'eRem') || '';
    if (remind === 'hour' && !time) return invalid('eTime', 'Вкажіть час, щоб нагадати за годину');
    const data = { title: title.slice(0, 200), date, time, note: $('#eNote', r).value.trim().slice(0, 1000), important: $('#eImp', r).classList.contains('on'), remind };
    if (d.id) Object.assign(S.events.find(x => x.id === d.id), data);
    else S.events.push({ id: uid(), ...data });
    if (remind) ensureNotifPermission();
    U.calSel = date; const dt = parseYmd(date); U.cal = { y: dt.getFullYear(), m: dt.getMonth() };
    save(); closeSheet(); render(); toast('Збережено');
  },
  eventDel: d => { S.events = S.events.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Видалено'); },

  cycNew: () => cycleSheet(null),
  cycEdit: d => cycleSheet(d.id),
  cycStart: d => {
    const err = Cycle.validate(d.d, '', null);
    if (err) { toast(err); return; }
    const on = Cycle.ongoing();
    if (on) on.end = addDays(on.start, Cycle.avgPeriod() - 1) < d.d ? addDays(on.start, Cycle.avgPeriod() - 1) : addDays(d.d, -1);
    S.cycle.periods.push({ id: uid(), start: d.d, end: '' });
    if (S.cycle.remind) ensureNotifPermission();
    save(); render(); toast('Початок менструації позначено');
    if (!U.stack.length && $('#sheetWrap').classList.contains('open')) daySheet(d.d);
  },
  cycEnd: d => {
    const on = Cycle.ongoing(); if (!on) return;
    const err = Cycle.validate(on.start, d.d, on.id); if (err) { toast(err); return; }
    on.end = d.d; save(); render(); if (!U.stack.length && $('#sheetWrap').classList.contains('open')) daySheet(d.d);
    toast(`Тривалість: ${Cycle.duration(on)} ${plural(Cycle.duration(on), 'день', 'дні', 'днів')}`);
  },
  cycSave: d => {
    const r = $('#sheetBody'); const start = $('#cStart', r).value, end = $('#cEnd', r).value;
    if (end && end > today()) return invalid('cEnd', 'Останній день не може бути в майбутньому');
    const err = Cycle.validate(start, end, d.id || null);
    if (err) return invalid('cStart', err);
    if (!end) { const open = S.cycle.periods.find(p => !p.end && p.id !== d.id); if (open && open.start > start) return invalid('cEnd', 'Вкажіть останній день — пізніший цикл ще триває'); }
    if (d.id) Object.assign(S.cycle.periods.find(x => x.id === d.id), { start, end });
    else S.cycle.periods.push({ id: uid(), start, end });
    // only the latest period may stay open
    const ps = Cycle.periods(); ps.slice(0, -1).forEach(p => { if (!p.end) p.end = addDays(p.start, Cycle.DEF_PERIOD - 1); });
    save(); closeSheet(); render(); toast('Збережено');
  },
  cycDel: async d => {
    if (!await ask({ title: 'Видалити запис циклу?', ok: 'Видалити', danger: true })) return;
    S.cycle.periods = S.cycle.periods.filter(p => p.id !== d.id); save(); render();
  },
  cycRemind: () => { S.cycle.remind = !S.cycle.remind; if (S.cycle.remind) ensureNotifPermission(); save(); render(); },
  cycHide: () => { S.cycle.hide = !S.cycle.hide; save(); render(); },
  cycWipe: async () => {
    if (!await ask({ title: 'Видалити всі дані циклу?', text: 'Усі записи та прогнози буде видалено безповоротно.', ok: 'Видалити все', danger: true })) return;
    S.cycle.periods = []; save(); render(); toast('Дані циклу видалено');
  }
});
SEG_HOOKS.cycDays = v => { S.cycle.remindDays = +v; save(); };
