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
  return [{ id: 'cycle-next', at: at9(addDays(nx.date, -days)), title: 'ЛАД · цикл', text: days ? `Орієнтовно через ${days} ${plural(days, 'день', 'дні', 'днів')} почнеться менструація.` : 'Орієнтовно сьогодні почнеться менструація.' }];
});

/* ---------------- event reminders ---------------- */
function eventReminder(e, date) {
  let at;
  if (e.remind === 'hour' && e.time) { const [h, mi] = e.time.split(':').map(Number); const d = parseYmd(date); d.setHours(h, mi - 60, 0, 0); at = d.getTime(); }
  else if (e.remind === 'prev') at = at9(addDays(date, -1), 18);
  else at = at9(date, 8);
  return { id: 'ev-' + e.id + (e.repeat ? '-' + date : ''), at, title: e.important ? '⭐ ' + e.title : e.title, text: `${dateLabel(date)}${e.time ? ' о ' + e.time : ''}${e.note ? ' · ' + e.note : ''}` };
}
REMINDER_PROVIDERS.push(() => {
  const out = [], from = addDays(today(), -1);
  S.events.filter(e => e.remind).forEach(e => {
    if (!e.repeat) { if (e.date >= from) out.push(eventReminder(e, e.date)); return; }
    let d = e.date; for (let k = 0; k < 400 && d < from; k++) d = nextRepeat(d, e.repeat);
    for (let k = 0; k < 6; k++) { out.push(eventReminder(e, d)); d = nextRepeat(d, e.repeat); }
  });
  return out;
});

/* ---------------- Calendar view ---------------- */
const now0 = new Date();
U.cal = { y: now0.getFullYear(), m: now0.getMonth() }; U.calSel = today();

function eventRow(e) {
  return `<div class="item" data-a="eventEdit" data-id="${e.id}">
    <div class="emoji sm" style="font-size:13px;font-weight:600">${e.time ? esc(e.time) : (e.important ? '⭐' : '📌')}</div>
    <div class="grow"><div class="title">${e.important ? '⭐ ' : ''}${esc(e.title)}</div>
    <div class="meta">${e.remind ? '🔔 ' : ''}${e.repeat ? `🔁 ${REPEAT_SHORT[e.repeat]} ` : ''}${e.note ? `<span class="ellipsis">${esc(e.note)}</span>` : ''}</div></div></div>`;
}
/** Everything recorded for one date (used by the grid and the day sheet). */
function dayData(date, cmap) {
  const evs = S.events.filter(e => repeatsOn(e.date, e.repeat, date)).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  const tasks = S.tasks.filter(t => t.due === date || (t.repeat && !t.done && t.due && date > t.due && repeatsOn(t.due, t.repeat, date)));
  const bds = Birthdays.onDate(date);
  const cyc = !S.cycle.hide && cmap ? cmap[date] : '';
  return { evs, tasks, bds, cyc };
}
const CYC_LABEL = { period: '🩸 Менструація', predicted: '🩸 Очікувана менструація (прогноз)', ovulation: '🌱 Орієнтовна овуляція', fertile: '🌿 Фертильне вікно (прогноз)' };

U.calView = 'week'; // opens on the week view; 'month' | 'week'
const mondayOf = ds => { const d = parseYmd(ds); return addDays(ds, -((d.getDay() + 6) % 7)); };

/** Entries of one date for display: [{cls, text, attrs, done}] */
function dayEntries(date, cmap, withCycle) {
  const dd = dayData(date, cmap), out = [];
  dd.bds.forEach(b => out.push({ cls: 'bd', text: `🎂 ${b.p.name}${b.age ? ' · ' + b.age : ''}`, attrs: `data-a="go" data-page="person" data-id="${b.p.id}"` }));
  dd.evs.forEach(e => out.push({ cls: e.important ? 'imp' : 'ev', text: `${e.time ? e.time + ' ' : ''}${e.title}`, attrs: `data-a="eventEdit" data-id="${e.id}"` }));
  dd.tasks.forEach(t => out.push({ cls: 'pl', text: t.title, done: t.done, attrs: `data-a="taskEdit" data-id="${t.id}"` }));
  if (withCycle && dd.cyc) {
    const prev = cmap[addDays(date, -1)];

  }
  return out;
}

function calMonthView(cmap, showCycle) {
  const { y, m } = U.cal, tdy = today();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7, start = new Date(y, m, 1 - offset);
  const weeks = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7);
  let cells = WD.map((w, i) => `<div class="mh ${i > 4 ? 'we' : ''}">${w}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = ymd(d), list = dayEntries(ds, cmap, showCycle), cyc = showCycle ? cmap[ds] : '';
    const shown = list.slice(0, 3);
    cells += `<button class="mcell ${d.getMonth() !== m ? 'other' : ''} ${i % 7 > 4 ? 'we' : ''} ${ds === tdy ? 'today' : ''} ${ds === U.calSel ? 'sel' : ''} ${cyc ? 'c-' + cyc : ''}" data-a="calPick" data-d="${ds}">
      <span class="mnum">${d.getDate()}${cyc && CYC_DROP[cyc] ? `<i class="cdrop c-${cyc}">${CYC_DROP[cyc]}</i>` : ''}</span>
      ${shown.map(e => `<span class="mline ${e.cls} ${e.done ? 'done' : ''}">${esc(e.text)}</span>`).join('')}
      ${list.length > 3 ? `<span class="mmore">+${list.length - 3}</span>` : ''}</button>`;
  }
  return `<div class="mgrid" id="cgrid">${cells}</div>`;
}

const CYC_DROP = { period: '🩸', predicted: '🩸', ovulation: '🌱' };
function calWeekView(cmap, showCycle) {
  const tdy = today(), mon = U.calWeek || mondayOf(tdy);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return `<div class="wstrip" id="cgrid">${days.map((ds, i) => { const d = parseYmd(ds), n = dayEntries(ds, cmap, showCycle).length;
      return `<button class="${ds === tdy ? 'today' : ''} ${ds === U.calSel ? 'sel' : ''} ${i > 4 ? 'we' : ''}" data-a="calWeekPick" data-d="${ds}">${WD[i]}<b>${d.getDate()}</b><i class="${n ? 'has' : ''}"></i>${showCycle && CYC_DROP[cmap[ds]] ? `<em class="cdrop c-${cmap[ds]}">${CYC_DROP[cmap[ds]]}</em>` : ''}</button>`; }).join('')}</div>
    <div class="list wlist">${days.map((ds, i) => {
      const d = parseYmd(ds), list = dayEntries(ds, cmap, showCycle);
      return `<div class="wday ${ds === tdy ? 'today' : ''}" id="wd-${ds}">
        <button class="wdn" data-a="calPick" data-d="${ds}"><b>${d.getDate()}</b><span>${WD[i]}${showCycle && CYC_DROP[cmap[ds]] ? ` <i class="cdrop c-${cmap[ds]}">${CYC_DROP[cmap[ds]]}</i>` : ''}</span></button>
        <div class="wen">${list.length ? list.map(e => `<button class="went ${e.cls} ${e.done ? 'done' : ''}" ${e.attrs}>${esc(e.text)}</button>`).join('')
          : `<button class="wempty" data-a="calAddOn" data-d="${ds}">+ додати</button>`}</div></div>`;
    }).join('')}</div>`;
}

VIEWS.calendar = () => {
  const showCycle = !S.cycle.hide && S.cycle.periods.length > 0;
  const cmap = showCycle ? Cycle.map() : {};
  const tdy = today(), week = U.calView === 'week';
  if (week && !U.calWeek) U.calWeek = mondayOf(U.calSel || tdy);
  const atToday = calAtToday();
  // upcoming list only under the month grid
  let up = '';
  if (!week) {
    const items = [];
    for (let k = 0; k < 14 && items.length < 8; k++) { const ds = addDays(tdy, k); dayEntries(ds, cmap, showCycle).filter(e => !e.done).forEach(e => items.push({ ds, e })); }
    up = `<h2>Найближчі 2 тижні</h2>${items.length ? `<div class="list">${items.slice(0, 8).map(({ ds, e }) => `<div class="item" ${e.attrs}><div class="up-date"><b>${parseYmd(ds).getDate()}</b><span>${MONTHS_SHORT[parseYmd(ds).getMonth()]}</span></div>
      <div class="grow" style="min-width:0"><div class="title ellipsis"><span class="tdot ${e.cls}"></span>${esc(e.text)}</div><div class="meta">${ds === tdy ? 'Сьогодні' : ds === addDays(tdy, 1) ? 'Завтра' : dateLabel(ds)}</div></div></div>`).join('')}</div>`
      : `<div class="card empty" style="padding:20px">Найближчим часом нічого не заплановано</div>`}`;
  }
  return `
    <div class="seg" style="margin-bottom:10px"><button data-a="calView" data-v="week" class="${week ? 'on' : ''}">Тиждень</button><button data-a="calView" data-v="month" class="${!week ? 'on' : ''}">Місяць</button></div>
    ${week ? calWeekView(cmap, showCycle) : `<div class="card mgrid-card">${calMonthView(cmap, showCycle)}</div>`}
    <div class="legend-row" style="margin:8px 0 4px">
      <span><i class="tdot imp"></i>Важливо</span><span><i class="tdot ev"></i>Подія</span><span><i class="tdot pl"></i>План</span><span><i class="tdot bd"></i>ДН</span>${showCycle ? '<span><i class="tdot cy"></i>Цикл</span>' : ''}
    </div>
    ${up}`;
};
FABS.calendar = () => eventSheet(null, U.calSel);
function calAtToday() {
  const tdy = today();
  return U.calView === 'week' ? (U.calWeek || mondayOf(tdy)) === mondayOf(tdy) : (U.cal.y === new Date().getFullYear() && U.cal.m === new Date().getMonth());
}
TAB_HEADERS.calendar = () => {
  let title;
  if (U.calView === 'week') {
    const mon = U.calWeek || mondayOf(today()), a = parseYmd(mon), b = parseYmd(addDays(mon, 6));
    title = a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} <span class="muted">${MONTHS_GEN[b.getMonth()]}</span>` : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  } else title = `${MONTHS[U.cal.m]} <span class="muted">${U.cal.y}</span>`;
  return { title, actions: `${!calAtToday() ? '<button class="chip card-bg" data-a="calToday">Сьогодні</button>' : ''}
` };
};

/* ---------------- day popover (month view) ---------------- */
const PRIO_TXT = { 3: 'високий пріоритет', 2: 'середній пріоритет', 1: 'низький пріоритет' };
const REM_TXT = { day: 'нагадування в день', prev: 'нагадування за день', hour: 'нагадування за годину' };
function dayDetails(date, cmap) {
  const dd = dayData(date, cmap), out = [];
  dd.bds.forEach(b => {
    const g = b.p.gifts || [], bought = g.filter(x => x.status === 'bought');
    out.push({ cls: 'bd', title: `🎂 ${b.p.name}${b.age ? ' — ' + b.age + ' ' + plural(b.age, 'рік', 'роки', 'років') : ''}`,
      sub: bought.length ? 'Подарунок: ' + bought.map(x => x.title).join(', ') + ' (придбано)' : g.length ? `Ідей подарунків: ${g.length}` : 'День народження', attrs: `data-a="popGo" data-page="person" data-id="${b.p.id}"` });
  });
  dd.evs.forEach(e => out.push({ cls: e.important ? 'imp' : 'ev', title: `${e.time ? e.time + ' ' : ''}${e.important ? '⭐ ' : ''}${e.title}`,
    sub: [e.note, e.remind ? '🔔 ' + REM_TXT[e.remind] : ''].filter(Boolean).join(' · ') || 'Подія', attrs: `data-a="popEdit" data-k="event" data-id="${e.id}"` }));
  dd.tasks.forEach(t => out.push({ cls: 'pl', title: t.title, done: t.done,
    sub: ['План', PRIO_TXT[t.prio || 2], t.done ? 'виконано ✓' : '', t.note].filter(Boolean).join(' · '), attrs: `data-a="popEdit" data-k="task" data-id="${t.id}"` }));
  if (dd.cyc) out.push({ cls: 'cy', title: CYC_LABEL[dd.cyc], sub: Cycle.cycleDay(date) ? `${Cycle.cycleDay(date)}-й день циклу · прогноз орієнтовний` : 'прогноз орієнтовний', attrs: 'data-a="popGo" data-page="cycle"' });
  return out;
}
function closeDayPop() {
  const p = $('#dayPop'); if (!p) return false;
  p.remove(); const bg = $('#dayPopBg'); if (bg) bg.remove(); return true;
}
function dayPopover(date, cell) {
  closeDayPop();
  const showCycle = !S.cycle.hide && S.cycle.periods.length > 0;
  const list = dayDetails(date, showCycle ? Cycle.map() : {});
  const bg = document.createElement('div'); bg.id = 'dayPopBg'; bg.className = 'daypop-bg'; bg.dataset.a = 'popClose';
  const pop = document.createElement('div'); pop.id = 'dayPop'; pop.className = 'daypop'; pop.setAttribute('role', 'dialog');
  const d = parseYmd(date);
  pop.innerHTML = `<div class="row between" style="margin-bottom:8px;gap:8px"><b>${date === today() ? 'Сьогодні, ' : ''}${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</b>
      <button class="link small" data-a="popOpen" data-d="${date}">Відкрити ›</button></div>
    <div class="daypop-list">${list.length ? list.map(e => `<button class="dc-ent ${e.cls} ${e.done ? 'done' : ''}" ${e.attrs}><b>${esc(e.title)}</b><span>${esc(e.sub)}</span></button>`).join('')
      : '<div class="muted small" style="padding:6px 2px 10px">Записів немає</div>'}</div>
    <div class="row" style="gap:8px;margin-top:4px"><button class="chip grow" data-a="popAdd" data-k="task" data-d="${date}">+ План</button><button class="chip on grow" data-a="popAdd" data-k="event" data-d="${date}">+ Подія</button></div>`;
  document.body.appendChild(bg); document.body.appendChild(pop);
  // position: above the day if there is room, otherwise below; arrow points at the cell
  const r = cell.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(300, vw - 24); pop.style.width = w + 'px';
  const left = clamp(r.left + r.width / 2 - w / 2, 12, vw - w - 12); pop.style.left = left + 'px';
  pop.style.setProperty('--ax', clamp(r.left + r.width / 2 - left - 8, 14, w - 30) + 'px');
  const h = pop.offsetHeight, roomAbove = r.top - 12, roomBelow = vh - r.bottom - 90;
  if (h <= roomAbove || roomAbove > roomBelow) { pop.style.top = Math.max(12, r.top - h - 10) + 'px'; pop.classList.add('above'); }
  else { pop.style.top = (r.bottom + 10) + 'px'; pop.classList.add('below'); }
  pop.style.maxHeight = Math.max(200, (pop.classList.contains('above') ? roomAbove : roomBelow) - 10) + 'px';
}
window.addEventListener('scroll', () => closeDayPop(), { passive: true });

function daySheet(date) {
  const showCycle = !S.cycle.hide && S.cycle.periods.length > 0;
  const cmap = showCycle ? Cycle.map() : {};
  const dd = dayData(date, cmap), tdy = today();
  const spent = S.tx.filter(t => t.date === date && t.type === 'exp').reduce((a, t) => a + t.amount, 0);
  const inc = S.tx.filter(t => t.date === date && t.type === 'inc').reduce((a, t) => a + t.amount, 0);
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
    ${dd.cyc ? `<div class="day-cyc"><b>${CYC_DROP[dd.cyc] || ''} ${CYC_LABEL[dd.cyc]}</b>${Cycle.cycleDay(date) ? ` <span class="small muted">· ${Cycle.cycleDay(date)}-й день циклу</span>` : ''}</div>` : ''}
    ${spent || inc ? `<div class="day-fin" data-a="dayFin" data-d="${date}">💳 ${spent ? `Витрати: <b>${money(spent)}</b>` : ''}${spent && inc ? ' · ' : ''}${inc ? `Доходи: <b class="green">${money(inc)}</b>` : ''}</div>` : ''}
    ${empty ? '<div class="muted" style="padding:6px 2px 4px">Записів на цей день немає.</div>' : ''}
    ${!empty ? `<button class="btn ghost" style="margin-bottom:10px" data-a="dayShare" data-d="${date}">${ICONS.share} Поділитися днем</button>` : ''}
    <div class="btns two"><button class="btn ghost" data-a="dayAddTask" data-d="${date}">+ План</button><button class="btn" data-a="dayAddEvent" data-d="${date}">+ Подія</button></div>`);
}

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
    ${repeatChips(e.repeat, 'event')}
    <div class="field"><label>Нагадування</label>${seg('eRem', [['', 'Без'], ['day', 'У день'], ['prev', 'За день'], ['hour', 'За годину']], e.remind || '')}</div>
    <div class="switch"><div><b>Важливо</b><div class="small muted">Показувати серед найближчих важливих</div></div>${toggleHtml('eImp', e.important)}</div>
    ${id ? `<button class="btn ghost" style="margin:4px 0 10px" data-a="eventShare" data-id="${id}">${ICONS.share} Поділитися</button>` : ''}
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
    </div>` : `<div class="card empty"><div class="big">🌸</div>Позначте перший день останньої менструації — і ЛАД порахує прогноз.
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
      ${S.cycle.remind ? `<div class="field" style="margin:4px 0 8px">${seg('cycDays', [['0', 'У день'], ['1', '1 день'], ['2', '2 дні'], ['3', '3 дні']], String(S.cycle.remindDays))}</div>` : ''}
      <div class="switch"><div><b>Приховати в календарі</b><div class="small muted">Цикл не показуватиметься в календарі та на головній</div></div>${toggleHtml('cycHide', S.cycle.hide).replace('data-a="toggle"', 'data-a="cycHide"')}</div>
    </div>
    ${S.cycle.periods.length ? `<button class="btn danger" data-a="cycWipe">Видалити всі дані циклу</button>` : ''}`
  };
};

Object.assign(A, {
  calNav: d => {
    if (U.calView === 'week') U.calWeek = addDays(U.calWeek || mondayOf(today()), 7 * +d.d);
    else { let { y, m } = U.cal; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } U.cal = { y, m }; }
    render(); calSlide(+d.d > 0 ? 'swap-r' : 'swap-l');
  },
  calView: d => { U.calView = d.v; if (d.v === 'week') U.calWeek = mondayOf(U.calSel || today()); else { const dt = parseYmd(U.calSel || today()); U.cal = { y: dt.getFullYear(), m: dt.getMonth() }; } render(); },
  calWeekPick: d => { U.calSel = d.d; render(); const el = document.getElementById('wd-' + d.d); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  calAddOn: d => { U.calSel = d.d; daySheet(d.d); },
  calPick: (d, el) => {
    U.calSel = d.d; const dt = parseYmd(d.d);
    if (U.calView === 'month' && el && el.classList.contains('mcell')) {
      $$('.mcell.sel').forEach(c => c.classList.remove('sel')); el.classList.add('sel');
      dayPopover(d.d, el); return;
    }
    if (dt.getMonth() !== U.cal.m) U.cal = { y: dt.getFullYear(), m: dt.getMonth() };
    render(); daySheet(d.d);
  },
  popClose: () => closeDayPop(),
  popOpen: d => { closeDayPop(); daySheet(d.d); },
  popGo: d => { closeDayPop(); navigate(d.page, { id: d.id }); },
  popEdit: d => { closeDayPop(); if (d.k === 'event') eventSheet(d.id); else taskSheet(d.id); },
  popAdd: d => { closeDayPop(); if (d.k === 'event') eventSheet(null, d.d); else taskSheet(null, d.d); },
  dayGo: d => { closeSheet(); navigate(d.page, { id: d.id }); },
  dayAddEvent: d => eventSheet(null, d.d),
  dayAddTask: d => taskSheet(null, d.d),
  dayFin: d => { closeSheet(); U.finFilter.q = ''; U.finFilter.type = 'all'; U.seg.fin = 'ops'; go('finance'); },
  calToday: () => { U.calSel = today(); U.cal = { y: new Date().getFullYear(), m: new Date().getMonth() }; U.calWeek = mondayOf(today()); render(); },
  eventNew: () => eventSheet(null, U.tab === 'calendar' ? U.calSel : today()),
  eventEdit: d => eventSheet(d.id),
  eventSave: d => {
    const r = $('#sheetBody'); const title = $('#eTitle', r).value.trim(); const date = $('#eDate', r).value;
    if (!title) return invalid('eTitle', 'Введіть назву');
    if (!isDate(date)) return invalid('eDate', 'Оберіть дату');
    const time = $('#eTime', r).value;
    let remind = segVal(r, 'eRem') || '';
    if (remind === 'hour' && !time) return invalid('eTime', 'Вкажіть час, щоб нагадати за годину');
    const data = { title: title.slice(0, 200), date, time, note: $('#eNote', r).value.trim().slice(0, 1000), important: $('#eImp', r).classList.contains('on'), remind, repeat: repVal(r) };
    if (d.id) Object.assign(S.events.find(x => x.id === d.id), data);
    else S.events.push({ id: uid(), ...data });
    if (remind) ensureNotifPermission();
    U.calSel = date; const dt = parseYmd(date); U.cal = { y: dt.getFullYear(), m: dt.getMonth() };
    save(); closeSheet(); render(); toast('Збережено');
  },
  eventShare: d => { const e = S.events.find(x => x.id === d.id); if (e) shareText(recordText('event', e)); },
  dayShare: d => shareText(dayText(d.d)),
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

/* swipe left/right on the calendar = next/previous week or month */
function calSlide(cls) {
  ['#cgrid', '.mgrid-card', '.wlist'].forEach(sel => { const el = $(sel, $('#view')); if (el) { el.classList.remove('swap-r', 'swap-l'); void el.offsetWidth; el.classList.add(cls); } });
  const t = $('#top .tab-title'); if (t) { t.classList.remove('swap-r', 'swap-l'); void t.offsetWidth; t.classList.add(cls); }
}
(() => {
  let sx = 0, sy = 0, st = 0, ok = false;
  document.addEventListener('touchstart', e => {
    ok = U.tab === 'calendar' && !U.stack.length && !!e.target.closest('#view') && !e.target.closest('.seg, .sheet, input, textarea');
    if (!ok) return; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st < 800) A.calNav({ d: dx < 0 ? 1 : -1 });
  }, { passive: true });
})();

/* ---------------- text for sharing ---------------- */
function recordText(kind, x) {
  const L = [];
  if (kind === 'event') {
    L.push(`${x.important ? '⭐' : '📅'} ${x.title}`);
    L.push(`🗓 ${dateLabel(x.date)}${x.time ? ' о ' + x.time : ''}${x.repeat ? ` (🔁 ${REPEAT_SHORT[x.repeat]})` : ''}`);
  } else if (kind === 'task') {
    L.push(`📝 ${x.title}`);
    if (x.due) L.push(`🗓 до ${dateLabel(x.due)}${x.repeat ? ` (🔁 ${REPEAT_SHORT[x.repeat]})` : ''}`);
    else if (x.repeat) L.push(`🔁 ${REPEAT_SHORT[x.repeat]}`);
  }
  if (x.note) L.push(x.note);
  return L.join('\n');
}
function dayText(date) {
  const dd = dayData(date, null), L = [`📆 ${dateLabel(date)}, ${shortDate(date)}`];
  dd.bds.forEach(b => L.push(`🎂 День народження: ${b.p.name}`));
  dd.evs.forEach(e => L.push(`${e.time ? e.time + ' ' : '• '}${e.title}`));
  dd.tasks.forEach(t => L.push(`📝 ${t.title}${t.done ? ' ✓' : ''}`));
  return L.join('\n');
}
