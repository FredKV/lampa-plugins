'use strict';
/* =====================================================================
   Цілі та звички.
   • habit — щоденна звичка («Читати книжку, мінімум 30 хв»): галочка щодня, серія днів,
     якщо не відмічено — пульсує бубочка і приходять (жорсткі 🌶 або лагідні) нагадування.
   • quit  — досягнення-відмова («Кинути курити»): лічильник днів без…, щоденна відмітка з похвалою,
     медалі за 1/3/7/14/30/60/90/180/365 днів, «Зірвалась» — почати заново (спроби зберігаються).
   goal: {id, type, title, min, time, start, log:{'YYYY-MM-DD':1}, attempts:[{start,end,days}], created}
   ===================================================================== */
const MILESTONES = [[1, '🌱', 'Перший день'], [3, '✨', '3 дні'], [7, '🔥', 'Тиждень'], [14, '💪', '2 тижні'], [30, '🏅', 'Місяць'],
  [60, '🥈', '2 місяці'], [90, '🥇', '3 місяці'], [180, '💎', 'Пів року'], [365, '👑', 'Рік']];

const NAG = {
  spicy: [
    t => `«${t}» досі без галочки. ${G('Незібраний ти долбойоб', 'Незібрана ти долбойобка')} 😂 Давай, ворушись!`,
    t => `Бубочка пульсує, совість гризе 🫠 «${t}» саме себе не зробить.`,
    t => `Знову «з понеділка почну»? 😏 «${t}» — сьогодні, а не колись.`,
    t => `Агов, ледащо! 🦥 «${t}» чекає. Відміть — і я відчеплюсь.`,
    t => `Ще трохи — і я почну розповідати всім, що ти здуваєшся 😤 «${t}»!`,
    t => `Диван тебе не похвалить 🛋 А я похвалю — після «${t}».`
  ],
  soft: [
    t => `Не забудь сьогодні про «${t}» 🌱`,
    t => `Маленький крок щодня — «${t}» 💪`,
    t => `Знайди хвилинку для «${t}» — ти молодець ✨`
  ]
};
const PRAISE = [
  n => `Ти ${G('неймовірний', 'неймовірна')}! Уже ${n} ${plural(n, 'день', 'дні', 'днів')} 🏆`,
  n => `${n} ${plural(n, 'день', 'дні', 'днів')} сили волі! Пишаюсь тобою 💚`,
  n => `Ще один день перемоги — разом ${n}! 🔥`,
  n => `Так тримати! ${n} ${plural(n, 'день', 'дні', 'днів')} — це серйозно 💪`,
  n => `${G('Король', 'Королева')} самоконтролю 👑 ${n} ${plural(n, 'день', 'дні', 'днів')}!`
];
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const seedOf = s => [...String(s)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7);

/* icons: chosen by the user or guessed from the title; quit icons get a red «ban» ring */
const GOAL_IC = {
  quit: ['⛔', '🚬', '🍷', '🍺', '🍬', '📱', '🍔', '☕', '🎰', '💸'],
  habit: ['🎯', '🏋️', '🏃', '📚', '💧', '🧘', '😴', '🚶', '🧠', '🥗']
};
const GOAL_GUESS = {
  quit: [[/кур|сигар|цигар|вейп|тютюн|нікот|кальян/, '🚬'], [/пив/, '🍺'], [/алко|вин[оа]|горіл|бух|спирт|коньяк|пити/, '🍷'], [/солод|цукор|цукер|шоколад|десерт/, '🍬'],
    [/телефон|смартфон|соцмереж|інстаграм|тікток|tiktok|instagram|ютуб|youtube|рілс/, '📱'], [/фастфуд|бургер|чипс|фаст-фуд/, '🍔'], [/кав[аиу]/, '☕'], [/ставк|казино|азарт/, '🎰'], [/покуп|шопінг|витрат|марнотрат/, '💸']],
  habit: [[/спорт|зал|трену|присід|віджим/, '🏋️'], [/біг/, '🏃'], [/чита|книж|книг/, '📚'], [/вод[аиуі]/, '💧'], [/медит|йог|дихан/, '🧘'], [/сон|спат|лягат/, '😴'], [/ходи|крок|прогул/, '🚶'], [/англ|мов[аиу]|вчит|навча|курс/, '🧠'], [/овоч|фрукт|салат|харч/, '🥗']]
};
const guessGoalIcon = (type, title) => { const t = String(title || '').toLowerCase(), k = type === 'quit' ? 'quit' : 'habit'; const m = GOAL_GUESS[k].find(([re]) => re.test(t)); return m ? m[1] : GOAL_IC[k][0]; };
const goalIcon = g => g.icon || guessGoalIcon(g.type, g.title);
const goalIconHtml = g => { const ic = goalIcon(g); return `<span class="gi ${g.type === 'quit' && ic !== '⛔' ? 'ban' : ''}">${ic}</span>`; };
const goalIconTxt = g => g.type === 'quit' ? (goalIcon(g) === '⛔' ? '⛔' : '🚫' + goalIcon(g)) : goalIcon(g);

const Goals = {
  doneOn: (g, d) => !!(g.log && g.log[d]),
  slipOn: (g, d) => !!(g.slips && g.slips[d]),
  started: (g, d = today()) => !g.start || g.start <= d,
  doneToday: g => Goals.doneOn(g, today()),
  /** days without (quit) */
  clean: g => {
    const s = g.start || today(), n = Math.max(0, diffDays(s, today()));
    return Math.max(0, n - Object.keys(g.slips || {}).filter(d => d >= s && d < today()).length);
  },
  /** consecutive checked days ending today (or yesterday, if today isn't checked yet) */
  streak(g) {
    let d = Goals.doneToday(g) ? today() : addDays(today(), -1), n = 0;
    while (Goals.doneOn(g, d)) { n++; d = addDays(d, -1); }
    return n;
  },
  best(g) {
    const days = Object.keys(g.log || {}).sort(); let best = 0, run = 0, prev = '';
    days.forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    return best;
  },
  /* «N разів на тиждень / місяць» */
  periodic: g => g.type === 'habit' && (g.per === 'week' || g.per === 'month') && (g.times || 0) > 0,
  pStart: (g, d) => g.per === 'week' ? mondayOf(d) : d.slice(0, 8) + '01',
  pEnd: (g, d) => g.per === 'week' ? addDays(mondayOf(d), 6) : addDays(addMonthsYmd(d.slice(0, 8) + '01', 1), -1),
  doneIn(g, d) { const a = Goals.pStart(g, d), b = Goals.pEnd(g, d); return Object.keys(g.log || {}).filter(x => x >= a && x <= b).length; },
  left: (g, d = today()) => Math.max(0, g.times - Goals.doneIn(g, d)),
  daysLeft: (g, d = today()) => diffDays(d, Goals.pEnd(g, d)) + 1,
  /** must be done today to still hit the period target */
  urgent: (g, d = today()) => !Goals.doneOn(g, d) && Goals.left(g, d) > 0 && Goals.left(g, d) >= Goals.daysLeft(g, d),
  /** completed periods in a row (the current one counts once it is met) */
  pStreak(g) {
    let d = Goals.doneIn(g, today()) >= g.times ? today() : addDays(Goals.pStart(g, today()), -1), n = 0;
    while (n < 520 && Goals.doneIn(g, d) >= g.times) { n++; d = addDays(Goals.pStart(g, d), -1); }
    return n;
  },
  total: g => Object.keys(g.log || {}).length,
  score: g => g.type === 'quit' ? Goals.clean(g) : Goals.periodic(g) ? Goals.total(g) : Math.max(Goals.streak(g), Goals.best(g)),
  pending: () => S.goals.filter(g => Goals.started(g) && !Goals.slipOn(g, today()) && (Goals.periodic(g) ? Goals.urgent(g) : !Goals.doneToday(g))),
  medals: g => (Goals.periodic(g) ? MILESTONES_TIMES : MILESTONES).map(([n, ic, l]) => ({ n, ic, l, got: Goals.score(g) >= n })),
  perWord: g => g.per === 'week' ? 'тиждень' : 'місяць',
  perThis: g => g.per === 'week' ? 'цього тижня' : 'цього місяця'
};
const MILESTONES_TIMES = [[1, '🌱', 'Перший раз'], [5, '✨', '5 разів'], [10, '🔥', '10 разів'], [25, '💪', '25 разів'], [50, '🏅', '50 разів'],
  [100, '🥈', '100 разів'], [150, '🥇', '150 разів'], [200, '💎', '200 разів'], [365, '👑', '365 разів']];
const timesTxt = n => `${n} ${plural(n, 'раз', 'рази', 'разів')}`;

function goalRow(g, day) {
  const D = typeof day === 'string' && day ? day : today(), done = Goals.doneOn(g, D), slip = Goals.slipOn(g, D); // .map() passes an index here
  if (!Goals.started(g, D)) return `<div class="item goal-row" data-id="${g.id}">
    <button class="check round" disabled aria-label="Ще не почалось" style="opacity:.35"></button>
    <div class="grow" style="min-width:0" data-a="goalOpen" data-id="${g.id}"><div class="title ellipsis">${goalIconHtml(g)} ${esc(g.title)}</div>
      <div class="meta">старт ${esc(dateLabel(g.start).toLowerCase())}</div></div>
    <div class="goal-num muted" data-a="goalOpen" data-id="${g.id}">—</div></div>`;
  if (Goals.periodic(g)) return goalRowPeriodic(g, done, D);
  const big = g.type === 'quit' ? Goals.clean(g) : Goals.streak(g);
  const sub = slip ? 'зрив — завтра новий день 💚' : g.type === 'quit' ? `${big} ${plural(big, 'день', 'дні', 'днів')} без` : big ? `серія ${big} ${plural(big, 'день', 'дні', 'днів')} 🔥` : 'почни серію сьогодні';
  return `<div class="item goal-row ${done ? 'checked' : ''}" data-id="${g.id}" ${done ? '' : 'data-swr="goalCheck"'}>
    <button class="check round ${done ? 'on' : ''} ${slip ? 'slip' : ''}" data-a="goalCheck" data-id="${g.id}" data-d="${D}" aria-label="Відмітити"></button>
    <div class="grow" style="min-width:0" data-a="goalOpen" data-id="${g.id}">
      <div class="title ellipsis">${goalIconHtml(g)} ${esc(g.title)}${!done && !slip ? '<i class="nag-dot"></i>' : ''}</div>
      <div class="meta">${esc(sub)}${g.min ? ` · ${esc(g.min)}` : ''}</div></div>
    <div class="goal-num" data-a="goalOpen" data-id="${g.id}">${big}</div></div>`;
}

function goalRowPeriodic(g, done, D = today()) {
  const got = Goals.doneIn(g, D), met = got >= g.times, urgent = D === today() && Goals.urgent(g, D), left = Goals.left(g, D);
  const sub = met ? `ціль ${Goals.perThis(g)} виконано ✓` : `${Goals.perThis(g)} ще ${timesTxt(left)}${urgent ? ' — сьогодні треба!' : ''}`;
  return `<div class="item goal-row ${done || met ? 'checked' : ''}" data-id="${g.id}" ${done ? '' : 'data-swr="goalCheck"'}>
    <button class="check round ${done ? 'on' : ''}" data-a="goalCheck" data-id="${g.id}" data-d="${D}" aria-label="Відмітити"></button>
    <div class="grow" style="min-width:0" data-a="goalOpen" data-id="${g.id}">
      <div class="title ellipsis">${goalIconHtml(g)} ${esc(g.title)}${urgent ? '<i class="nag-dot"></i>' : ''}</div>
      <div class="meta">${esc(sub)}${g.min ? ` · ${esc(g.min)}` : ''}</div></div>
    <div class="goal-num" data-a="goalOpen" data-id="${g.id}">${got}<small>/${g.times}</small></div></div>`;
}

/** block for the home screen */
function goalsHome() {
  if (!S.goals.length) return '';
  const pend = Goals.pending().length;
  return `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Цілі на сьогодні</h2>
    <span class="small ${pend ? 'red' : 'green'}">${pend ? `${pend} чекає на сьогодні` : 'на сьогодні все ✓'}</span></div>
    <div class="list">${S.goals.map(goalRow).join('')}</div>`;
}

PAGES.goals = () => ({
  title: 'Цілі та звички', html: `
    ${S.goals.length ? `<div class="list">${S.goals.map(goalRow).join('')}</div>` : emptyCard('🏆', 'Додайте звичку («Читати 30 хв щодня») або ціль-відмову («Кинути курити») — і відмічайте щодня.', { label: '+ Нова ціль', attrs: 'data-a="goalNew"' })}
    <div class="card st-card" style="padding:2px 14px;margin-top:14px">
      <div class="switch"><div><b>🌶 Жорсткі нагадування</b><div class="small muted">${S.settings.tone === 'spicy' ? 'Буду соромити, поки не відмітиш 😈' : 'Лагідно нагадаю'}</div></div>${toggleHtml('gTone', S.settings.tone === 'spicy').replace('data-a="toggle"', 'data-a="goalTone"')}</div></div>`
});
FABS.goals = () => goalSheet();

/** last 6 weeks/months with how many times the goal was done */
function goalPeriods(g) {
  const out = []; let d = today();
  for (let k = 0; k < 6; k++) {
    const st = Goals.pStart(g, d), dt = parseYmd(st);
    out.unshift({ n: Goals.doneIn(g, d), cur: k === 0, label: g.per === 'week' ? `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}` : MONTHS_SHORT[dt.getMonth()] });
    d = addDays(st, -1);
  }
  return out;
}
PAGES.goal = p => {
  const g = S.goals.find(x => x.id === p.id); if (!g) return null;
  const done = Goals.doneToday(g), quit = g.type === 'quit', per = Goals.periodic(g), slip = Goals.slipOn(g, today());
  if (!Goals.started(g)) {
    const n = diffDays(today(), g.start);
    return { title: g.title, actions: shareBtn('goalShare', g.id), html: `
    <div class="card goal-hero"><div style="font-size:44px;line-height:1">${goalIconHtml(g)}</div>
      <div class="goal-big">${n}</div><div class="muted">${plural(n, 'день', 'дні', 'днів')} до старту · ${esc(dateLabel(g.start).toLowerCase())}</div></div>
    <div class="btns two"><button class="btn danger" data-a="goalDel" data-id="${g.id}">Видалити</button><button class="btn ghost card-btn" data-a="goalEdit" data-id="${g.id}">Редагувати</button></div>` };
  }
  const big = quit ? Goals.clean(g) : per ? Goals.doneIn(g, today()) : Goals.streak(g);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today(), i - 27));
  return {
    title: g.title, actions: shareBtn('goalShare', g.id), html: `
    <div class="card goal-hero ${done || (per && !Goals.urgent(g)) ? '' : 'pending'}">
      <div class="goal-big">${big}${per ? `<small>/${g.times}</small>` : ''}</div>
      <div class="muted">${quit ? `${plural(big, 'день', 'дні', 'днів')} без зривів 💚` : per ? `${Goals.perThis(g)} · ціль ${timesTxt(g.times)} на ${Goals.perWord(g)}` : `${plural(big, 'день', 'дні', 'днів')} поспіль`}</div>
      ${per ? `<div style="margin:12px auto 0;max-width:240px">${progressBar(Math.min(100, big / g.times * 100), big >= g.times ? 'var(--green)' : '')}</div>` : ''}
      ${g.min ? `<div class="small muted" style="margin-top:4px">Мінімум: ${esc(g.min)}</div>` : ''}
      ${slip ? `<button class="btn ghost card-btn red" style="margin-top:16px" data-a="goalRelapse" data-id="${g.id}">Сьогодні зрив · прибрати</button>`
        : `<button class="btn ${done ? 'ghost card-btn' : ''}" style="margin-top:16px" data-a="goalCheck" data-id="${g.id}">${done ? 'Сьогодні відмічено ✓' : quit ? 'Сьогодні тримаюсь' : G('Сьогодні виконав', 'Сьогодні виконала')}</button>`}
    </div>
    ${per ? `<h2>${g.per === 'week' ? 'Останні тижні' : 'Останні місяці'}</h2>
      <div class="card gp-weeks">${goalPeriods(g).map(pp => `<div class="gp ${pp.cur ? 'cur' : ''} ${pp.n >= g.times ? 'ok' : ''}"><div class="gp-dots">${Array.from({ length: g.times }, (_, k) => `<i class="${k < pp.n ? 'on' : ''}"></i>`).join('')}</div><span>${pp.label}</span></div>`).join('')}</div>`
    : `<h2>Останні 2 тижні</h2>
      <div class="card goal-days">${days.slice(-14).map(d => `<i class="${Goals.slipOn(g, d) ? 'bad' : Goals.doneOn(g, d) || (quit && g.start && d >= g.start && d < today()) ? 'on' : ''} ${d === today() ? 'today' : ''}" title="${d}"></i>`).join('')}</div>`}
    ${(() => { const md = Goals.medals(g), got = md.filter(x => x.got); return `<details class="card fold"><summary><span>Досягнення <span class="gm-row">${got.map(x => x.ic).join('')}</span></span><span class="muted">${got.length} з ${md.length} ›</span></summary>
      <div class="medals" style="margin-top:10px">${md.map(m => `<div class="medal ${m.got ? 'got' : ''}"><span>${m.ic}</span><b>${m.l}</b></div>`).join('')}</div></details>`; })()}
    <div class="card" style="margin-top:12px">
      <div class="kv"><span>${quit ? 'Без зривів з' : 'Почато'}</span><b>${shortDate(g.start || (g.created ? ymd(new Date(g.created)) : today()))}</b></div>
      ${quit && Object.keys(g.slips || {}).filter(d => d >= g.start).length ? `<div class="kv"><span>Зривів у цій спробі</span><b class="red">${Object.keys(g.slips).filter(d => d >= g.start).length}</b></div>` : ''}
      ${per ? `<div class="kv"><span>Виконано ${g.per === 'week' ? 'тижнів' : 'місяців'} поспіль</span><b>${Goals.pStreak(g)}</b></div><div class="kv"><span>Усього разів</span><b>${Goals.total(g)}</b></div>`
        : `<div class="kv"><span>Найдовша серія</span><b>${Math.max(Goals.best(g), quit ? Goals.clean(g) : 0)} ${plural(Math.max(Goals.best(g), quit ? Goals.clean(g) : 0), 'день', 'дні', 'днів')}</b></div>`}
      ${g.time ? `<div class="kv"><span>Нагадування</span><b>о ${g.time}</b></div>` : ''}
      ${quit && (g.attempts || []).length ? `<div class="kv"><span>Попередні спроби</span><b>${g.attempts.map(a => a.days).join(', ')} дн.</b></div>` : ''}</div>
    <div class="btns two">${quit ? `<button class="btn ghost card-btn" data-a="goalRelapse" data-id="${g.id}">${slip ? 'Прибрати зрив' : G('Зірвався', 'Зірвалась')}</button>` : `<button class="btn danger" data-a="goalDel" data-id="${g.id}">Видалити</button>`}
      <button class="btn ghost card-btn" data-a="goalEdit" data-id="${g.id}">Редагувати</button></div>
    ${quit ? `<div class="btns"><button class="btn danger" data-a="goalDel" data-id="${g.id}">Видалити</button></div>` : ''}`
  };
};

function goalIconChips(type, sel) {
  const k = type === 'quit' ? 'quit' : 'habit';
  return GOAL_IC[k].map(ic => `<button class="${ic === sel ? 'on' : ''}" data-a="goalIcon" data-v="${ic}"><span class="gi ${k === 'quit' && ic !== '⛔' ? 'ban' : ''}">${ic}</span></button>`).join('');
}
function goalIconSync() {
  const box = $('#gIcons'); if (!box) return;
  const type = segVal($('#sheetBody'), 'gType') || 'habit';
  const cur = box.dataset.picked ? ($('button.on', box) || {}).dataset?.v : guessGoalIcon(type, $('#gTitle').value);
  const list = GOAL_IC[type === 'quit' ? 'quit' : 'habit'];
  box.innerHTML = goalIconChips(type, list.includes(cur) ? cur : guessGoalIcon(type, $('#gTitle').value));
}
document.addEventListener('input', e => { if (e.target.id === 'gTitle' && !($('#gIcons') || {}).dataset?.picked) goalIconSync(); });
function goalSheet(id) {
  const g = S.goals.find(x => x.id === id) || { type: 'habit', title: '', min: '', time: '20:00', start: today(), per: 'day', times: 3 };
  const per = g.per || 'day', times = g.times || 3;
  openSheet(`<h2>${id ? 'Редагувати ціль' : 'Нова ціль'}</h2>
    ${seg('gType', [['habit', 'Звичка'], ['quit', 'Відмова від…']], g.type)}
    <div class="field"><input class="input" id="gTitle" maxlength="80" placeholder="${g.type === 'quit' ? 'Напр. Алкоголь, солодке, куріння' : 'Напр. Читати книжку'}" value="${esc(g.title)}"></div>
    <div class="gi-pick" id="gIcons" data-picked="${g.icon ? 1 : ''}">${goalIconChips(g.type, goalIcon(g))}</div>
    <div id="gHabitBox" ${g.type === 'quit' ? 'style="display:none"' : ''}>
      <div class="field"><label>Як часто</label>${seg('gPer', [['day', 'Щодня'], ['week', 'На тиждень'], ['month', 'На місяць']], per)}</div>
      <div class="field row between" id="gTimesBox" ${per === 'day' ? 'style="display:none"' : ''}><span class="muted">Скільки разів</span>
        <div class="stepper"><button data-a="goalTimes" data-d="-1">−</button><b id="gTimes" data-v="${times}">${times}</b><button data-a="goalTimes" data-d="1">+</button></div></div>
      <div class="field" id="gMinBox"><input class="input" id="gMin" maxlength="40" placeholder="Мінімум (напр. 30 хв)" value="${esc(g.min || '')}"></div></div>
    <div class="row" style="gap:10px">
      <div class="field grow" id="gStartBox"><label id="gStartL">${g.type === 'quit' ? 'Без зривів з' : 'Початок'}</label><input type="date" class="input" id="gStart" value="${g.start || (g.created ? ymd(new Date(g.created)) : today())}"></div>
      <div class="field grow"><label>Нагадувати о</label><input type="time" class="input" id="gTime" value="${g.time || ''}"></div></div>
    <div class="btns"><button class="btn" data-a="goalSave" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#gTitle', r)?.focus(), 300); });
}
SEG_HOOKS.gType = v => {
  const q = v === 'quit';
  $('#gHabitBox').style.display = q ? 'none' : ''; $('#gStartL').textContent = q ? 'Без зривів з' : 'Початок';
  $('#gTitle').placeholder = q ? 'Напр. Алкоголь, солодке, куріння' : 'Напр. Читати книжку';
  $('#gIcons').dataset.picked = ''; goalIconSync();
};

SEG_HOOKS.gPer = v => {
  $('#gTimesBox').style.display = v === 'day' ? 'none' : '';
  const t = $('#gTimes'), max = v === 'week' ? 7 : 31; if (+t.dataset.v > max) { t.dataset.v = max; t.textContent = max; }
};

function goalText(g) {
  if (Goals.periodic(g)) { const n = Goals.doneIn(g, today()); return `🎯 ${g.title}: ${n} з ${g.times} ${Goals.perThis(g)}${n >= g.times ? ' — ціль виконано! 🎉' : ''}`; }
  if (g.type === 'quit') { const n = Goals.clean(g); return `${goalIconTxt(g)} ${g.title}: уже ${n} ${plural(n, 'день', 'дні', 'днів')} без зривів! 💪`; }
  const n = Goals.streak(g); return `🎯 ${g.title}${g.min ? ` (мінімум ${g.min})` : ''}: серія ${n} ${plural(n, 'день', 'дні', 'днів')} поспіль 🔥`;
}

/* nagging notifications: at the chosen time, then every 2 h until 22:00, until it's checked */
REMINDER_PROVIDERS.push(() => {
  const out = [], tone = S.settings.tone === 'spicy' ? 'spicy' : 'soft';
  S.goals.filter(g => g.time).forEach(g => {
    const [h, m] = g.time.split(':').map(Number);
    for (let k = 0; k < 7; k++) {
      const d = addDays(today(), k);
      if (Goals.doneOn(g, d) || Goals.slipOn(g, d) || !Goals.started(g, d)) continue;
      let urgent = true;
      if (Goals.periodic(g)) { // only while the target is still open; nag only when it can't wait
        if (Goals.left(g, d) <= 0) continue;
        urgent = Goals.urgent(g, d);
      }
      for (let hh = h, i = 0; hh <= 22 && i < 5; hh += 2, i++) {
        const t = parseYmd(d); t.setHours(hh, i ? 0 : m, 0, 0);
        const seed = seedOf(g.id + d + i);
        const text = g.type === 'quit'
          ? `Уже ${Goals.clean(g) + k} ${plural(Goals.clean(g) + k, 'день', 'дні', 'днів')} без зривів! Відміть сьогоднішній день 💚`
          : Goals.periodic(g) && !urgent ? `${Goals.perThis(g)[0].toUpperCase() + Goals.perThis(g).slice(1)} ще ${timesTxt(Goals.left(g, d))} — може, сьогодні? 💪`
          : pick(NAG[tone], seed)(g.title);
        out.push({ id: `goal-${g.id}-${d}-${i}`, at: t.getTime(), title: `${goalIconTxt(g)} ${g.title}`, text, goal: g.id, date: d,
          a1: '✓ Відмітити', a2: g.type === 'quit' ? G('Зірвався', 'Зірвалась') : '' });
        if (g.type === 'quit' || tone === 'soft' || !urgent) break; // only spicy habits that can't wait nag repeatedly
      }
    }
  });
  return out;
});

Object.assign(A, {
  goalNew: () => goalSheet(),
  goalOpen: d => navigate('goal', { id: d.id }),
  goalEdit: d => goalSheet(d.id),
  goalShare: d => { const g = S.goals.find(x => x.id === d.id); if (g) shareText(goalText(g)); },
  goalTone: () => { S.settings.tone = S.settings.tone === 'spicy' ? 'soft' : 'spicy'; save(); render(); toast(S.settings.tone === 'spicy' ? 'Окей, буду жорсткою 😈' : 'Буду лагідною 🌸'); },
  goalCheck: d => {
    const g = S.goals.find(x => x.id === d.id); if (!g) return;
    g.log = g.log || {}; const t = d.d && d.d <= today() ? d.d : today();
    if (!Goals.started(g, t)) { toast(`Ціль стартує ${dateLabel(g.start).toLowerCase()}`); return; }
    if (g.slips && g.slips[t]) delete g.slips[t];
    if (t !== today()) { if (g.log[t]) delete g.log[t]; else g.log[t] = 1; save(); render(); toast(g.log[t] ? `Зараховано за ${shortDate(t)} ✓` : 'Відмітку знято'); return; }
    if (g.log[t]) { delete g.log[t]; save(); render(); return; }
    g.log[t] = 1; save(); render();
    if (Goals.periodic(g)) {
      const got = Goals.doneIn(g, t), m = MILESTONES_TIMES.find(x => x[0] === Goals.total(g));
      toast(m ? `${m[1]} Досягнення «${m[2]}»!` : got === g.times ? `🎉 Ціль ${Goals.perThis(g)} виконано: ${got} з ${g.times}!` : `Зараховано ✓ ${got} з ${g.times} ${Goals.perThis(g)}`);
      return;
    }
    const n = g.type === 'quit' ? Goals.clean(g) : Goals.streak(g);
    const m = MILESTONES.find(x => x[0] === n);
    toast(m ? `${m[1]} Досягнення «${m[2]}»! ${pick(PRAISE, seedOf(g.id + t))(n)}` : g.type === 'quit' ? pick(PRAISE, seedOf(g.id + t))(n) : `Виконано ✓ Серія: ${n} 🔥`);
  },
  goalTimes: d => {
    const t = $('#gTimes'), max = (segVal($('#sheetBody'), 'gPer') || 'week') === 'week' ? 7 : 31;
    const v = clamp(+t.dataset.v + +d.d, 1, max); t.dataset.v = v; t.textContent = v;
  },
  /* «Зірвалась»: today turns red; then choose — keep the count or start over */
  goalRelapse: d => {
    const g = S.goals.find(x => x.id === d.id); if (!g) return;
    const t = today(); g.slips = g.slips || {};
    if (g.slips[t]) { delete g.slips[t]; save(); render(); toast('Зрив прибрано'); return; }
    g.slips[t] = 1; if (g.log) delete g.log[t];
    save(); render(); if (typeof haptic === 'function') haptic('heavy');
    const n = Goals.clean(g);
    openSheet(`<h2>Зрив відмічено</h2>
      <div class="muted" style="margin:-4px 0 14px">Сьогоднішній день позначено червоним. Буває 💚 ${n ? `${n} ${plural(n, 'день', 'дні', 'днів')} без зривів — уже твоя перемога.` : ''}</div>
      <div class="btns two"><button class="btn ghost card-btn" data-a="goalSlipReset" data-id="${g.id}">Почати спочатку</button><button class="btn" data-a="goalSlipKeep">Продовжити</button></div>`);
  },
  goalSlipKeep: () => { closeSheet(); toast('Рахунок продовжується — завтра новий день 💪'); },
  goalSlipReset: d => {
    const g = S.goals.find(x => x.id === d.id); if (!g) return;
    g.attempts = g.attempts || []; g.attempts.push({ start: g.start, end: today(), days: Goals.clean(g) });
    g.start = today(); g.log = {}; save(); closeSheet(); render(); toast('Новий старт — ти зможеш 💪');
  },
  goalIcon: d => { const box = $('#gIcons'); if (!box) return; box.dataset.picked = '1'; $$('button', box).forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); },
  goalSave: d => {
    const r = $('#sheetBody'); const title = $('#gTitle', r).value.trim();
    if (!title) return invalid('gTitle', 'Введіть назву');
    const type = segVal(r, 'gType') || 'habit', time = $('#gTime', r).value, start = isDate($('#gStart', r).value) ? $('#gStart', r).value : today();
    const icB = $('#gIcons button.on', r), icon = icB ? icB.dataset.v : '';
    const per = type === 'habit' ? (segVal(r, 'gPer') || 'day') : 'day', times = per === 'day' ? 0 : +$('#gTimes', r).dataset.v;
    const data = { type, title: title.slice(0, 80), min: type === 'habit' ? $('#gMin', r).value.trim().slice(0, 40) : '', time, start, icon, per, times };
    if (d.id) Object.assign(S.goals.find(x => x.id === d.id), data);
    else S.goals.push({ id: uid(), log: {}, attempts: [], created: Date.now(), ...data });
    if (time) ensureNotifPermission();
    save(); closeSheet(); render(); toast('Збережено');
  },
  goalDel: async d => {
    const g = S.goals.find(x => x.id === d.id);
    if (!await ask({ title: `Видалити «${g.title}»?`, text: 'Уся історія відміток зникне.', ok: 'Видалити', danger: true })) return;
    S.goals = S.goals.filter(x => x.id !== d.id); save();
    const top = U.stack[U.stack.length - 1]; if (top && top.page === 'goal') back(); else render();
  }
});

// pulsing dot on «Ще» while something is not checked today
AFTER_RENDER.push(() => { const b = $('#tabbar [data-tab="more"]'); if (b) b.classList.toggle('nag', S.goals.length > 0 && Goals.pending().length > 0); });
