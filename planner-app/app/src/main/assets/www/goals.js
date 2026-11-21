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
    t => `«${t}» досі без галочки. Незібраний ти долбойоб 😂 Давай, ворушись!`,
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
  n => `Ти неймовірна! Уже ${n} ${plural(n, 'день', 'дні', 'днів')} 🏆`,
  n => `${n} ${plural(n, 'день', 'дні', 'днів')} сили волі! Пишаюсь тобою 💚`,
  n => `Ще один день перемоги — разом ${n}! 🔥`,
  n => `Так тримати! ${n} ${plural(n, 'день', 'дні', 'днів')} — це серйозно 💪`,
  n => `Королева самоконтролю 👑 ${n} ${plural(n, 'день', 'дні', 'днів')}!`
];
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const seedOf = s => [...String(s)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7);

const Goals = {
  doneOn: (g, d) => !!(g.log && g.log[d]),
  doneToday: g => Goals.doneOn(g, today()),
  /** days without (quit) */
  clean: g => Math.max(0, diffDays(g.start || today(), today())),
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
  score: g => g.type === 'quit' ? Goals.clean(g) : Math.max(Goals.streak(g), Goals.best(g)),
  pending: () => S.goals.filter(g => !Goals.doneToday(g)),
  medals: g => MILESTONES.map(([n, ic, l]) => ({ n, ic, l, got: Goals.score(g) >= n }))
};

function goalRow(g) {
  const done = Goals.doneToday(g);
  const big = g.type === 'quit' ? Goals.clean(g) : Goals.streak(g);
  const sub = g.type === 'quit' ? `${big} ${plural(big, 'день', 'дні', 'днів')} без` : big ? `серія ${big} ${plural(big, 'день', 'дні', 'днів')} 🔥` : 'почни серію сьогодні';
  return `<div class="item goal-row ${done ? 'checked' : ''}">
    <button class="check round ${done ? 'on' : ''}" data-a="goalCheck" data-id="${g.id}" aria-label="Відмітити сьогодні"></button>
    <div class="grow" style="min-width:0" data-a="goalOpen" data-id="${g.id}">
      <div class="title ellipsis">${g.type === 'quit' ? '🚭 ' : '🎯 '}${esc(g.title)}${!done ? '<i class="nag-dot"></i>' : ''}</div>
      <div class="meta">${esc(sub)}${g.min ? ` · ${esc(g.min)}` : ''}</div></div>
    <div class="goal-num" data-a="goalOpen" data-id="${g.id}">${big}</div></div>`;
}

/** block for the home screen */
function goalsHome() {
  if (!S.goals.length) return '';
  const pend = Goals.pending().length;
  return `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Цілі на сьогодні</h2>
    <span class="small ${pend ? 'red' : 'green'}">${pend ? `${pend} не відмічено` : 'усе відмічено ✓'}</span></div>
    <div class="list">${S.goals.map(goalRow).join('')}</div>`;
}

PAGES.goals = () => ({
  title: 'Цілі та звички', html: `
    ${S.goals.length ? `<div class="list">${S.goals.map(goalRow).join('')}</div>` : emptyCard('🏆', 'Додайте звичку («Читати 30 хв щодня») або ціль-відмову («Кинути курити») — і відмічайте щодня.', { label: '+ Нова ціль', attrs: 'data-a="goalNew"' })}
    <div class="card st-card" style="padding:2px 14px;margin-top:14px">
      <div class="switch"><div><b>🌶 Жорсткі нагадування</b><div class="small muted">${S.settings.tone === 'spicy' ? 'Буду соромити, поки не відмітиш 😈' : 'Лагідно нагадаю'}</div></div>${toggleHtml('gTone', S.settings.tone === 'spicy').replace('data-a="toggle"', 'data-a="goalTone"')}</div></div>`
});
FABS.goals = () => goalSheet();

PAGES.goal = p => {
  const g = S.goals.find(x => x.id === p.id); if (!g) return null;
  const done = Goals.doneToday(g), quit = g.type === 'quit';
  const big = quit ? Goals.clean(g) : Goals.streak(g);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today(), i - 27));
  return {
    title: g.title, actions: shareBtn('goalShare', g.id), html: `
    <div class="card goal-hero ${done ? '' : 'pending'}">
      <div class="goal-big">${big}</div>
      <div class="muted">${quit ? `${plural(big, 'день', 'дні', 'днів')} без зривів 💚` : `${plural(big, 'день', 'дні', 'днів')} поспіль`}</div>
      ${g.min ? `<div class="small muted" style="margin-top:4px">Мінімум: ${esc(g.min)}</div>` : ''}
      <button class="btn ${done ? 'ghost card-btn' : ''}" style="margin-top:16px" data-a="goalCheck" data-id="${g.id}">${done ? '✓ Сьогодні відмічено' : quit ? '✅ Сьогодні тримаюсь!' : '✅ Сьогодні виконала'}</button>
    </div>
    <h2>Останні 4 тижні</h2>
    <div class="card goal-days">${days.map(d => `<i class="${Goals.doneOn(g, d) || (quit && g.start && d >= g.start && d < today()) ? 'on' : ''} ${d === today() ? 'today' : ''}" title="${d}"></i>`).join('')}</div>
    <h2>Досягнення</h2>
    <div class="medals">${Goals.medals(g).map(m => `<div class="medal ${m.got ? 'got' : ''}"><span>${m.ic}</span><b>${m.l}</b></div>`).join('')}</div>
    <div class="card" style="margin-top:12px">
      <div class="kv"><span>${quit ? 'Без зривів з' : 'Почато'}</span><b>${shortDate(quit ? g.start : (g.created ? ymd(new Date(g.created)) : today()))}</b></div>
      <div class="kv"><span>Найдовша серія</span><b>${Math.max(Goals.best(g), quit ? Goals.clean(g) : 0)} ${plural(Math.max(Goals.best(g), quit ? Goals.clean(g) : 0), 'день', 'дні', 'днів')}</b></div>
      ${g.time ? `<div class="kv"><span>Нагадування</span><b>о ${g.time}</b></div>` : ''}
      ${quit && (g.attempts || []).length ? `<div class="kv"><span>Попередні спроби</span><b>${g.attempts.map(a => a.days).join(', ')} дн.</b></div>` : ''}</div>
    <div class="btns two">${quit ? `<button class="btn ghost card-btn" data-a="goalRelapse" data-id="${g.id}">😔 Зірвалась</button>` : `<button class="btn danger" data-a="goalDel" data-id="${g.id}">Видалити</button>`}
      <button class="btn ghost card-btn" data-a="goalEdit" data-id="${g.id}">Редагувати</button></div>
    ${quit ? `<div class="btns"><button class="btn danger" data-a="goalDel" data-id="${g.id}">Видалити</button></div>` : ''}`
  };
};

function goalSheet(id) {
  const g = S.goals.find(x => x.id === id) || { type: 'habit', title: '', min: '', time: '20:00', start: today() };
  openSheet(`<h2>${id ? 'Редагувати ціль' : 'Нова ціль'}</h2>
    ${seg('gType', [['habit', '🎯 Звичка щодня'], ['quit', '🚭 Відмова від…']], g.type)}
    <div class="field"><input class="input" id="gTitle" maxlength="80" placeholder="${g.type === 'quit' ? 'Напр. Кинути курити' : 'Напр. Читати книжку'}" value="${esc(g.title)}"></div>
    <div class="field" id="gMinBox" ${g.type === 'quit' ? 'style="display:none"' : ''}><input class="input" id="gMin" maxlength="40" placeholder="Мінімум (напр. 30 хв)" value="${esc(g.min || '')}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow" id="gStartBox" ${g.type === 'quit' ? '' : 'style="display:none"'}><label>Не курю з</label><input type="date" class="input" id="gStart" max="${today()}" value="${g.start || today()}"></div>
      <div class="field grow"><label>Нагадувати о</label><input type="time" class="input" id="gTime" value="${g.time || ''}"></div></div>
    <div class="btns"><button class="btn" data-a="goalSave" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#gTitle', r).focus(), 300); });
}
SEG_HOOKS.gType = v => {
  const q = v === 'quit';
  $('#gMinBox').style.display = q ? 'none' : ''; $('#gStartBox').style.display = q ? '' : 'none';
  $('#gTitle').placeholder = q ? 'Напр. Кинути курити' : 'Напр. Читати книжку';
};

function goalText(g) {
  if (g.type === 'quit') { const n = Goals.clean(g); return `🚭 ${g.title}: уже ${n} ${plural(n, 'день', 'дні', 'днів')} без зривів! 💪`; }
  const n = Goals.streak(g); return `🎯 ${g.title}${g.min ? ` (мінімум ${g.min})` : ''}: серія ${n} ${plural(n, 'день', 'дні', 'днів')} поспіль 🔥`;
}

/* nagging notifications: at the chosen time, then every 2 h until 22:00, until it's checked */
REMINDER_PROVIDERS.push(() => {
  const out = [], tone = S.settings.tone === 'spicy' ? 'spicy' : 'soft';
  S.goals.filter(g => g.time).forEach(g => {
    const [h, m] = g.time.split(':').map(Number);
    for (let k = 0; k < 7; k++) {
      const d = addDays(today(), k);
      if (Goals.doneOn(g, d)) continue;
      for (let hh = h, i = 0; hh <= 22 && i < 5; hh += 2, i++) {
        const t = parseYmd(d); t.setHours(hh, i ? 0 : m, 0, 0);
        const seed = seedOf(g.id + d + i);
        const text = g.type === 'quit'
          ? `Уже ${Goals.clean(g) + k} ${plural(Goals.clean(g) + k, 'день', 'дні', 'днів')} без зривів! Відміть сьогоднішній день 💚`
          : pick(NAG[tone], seed)(g.title);
        out.push({ id: `goal-${g.id}-${d}-${i}`, at: t.getTime(), title: g.type === 'quit' ? `🚭 ${g.title}` : `🎯 ${g.title}`, text });
        if (g.type === 'quit' || tone === 'soft') break; // only spicy habits nag repeatedly
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
    g.log = g.log || {}; const t = today();
    if (g.log[t]) { delete g.log[t]; save(); render(); return; }
    g.log[t] = 1; save(); render();
    const n = g.type === 'quit' ? Goals.clean(g) : Goals.streak(g);
    const m = MILESTONES.find(x => x[0] === n);
    toast(m ? `${m[1]} Досягнення «${m[2]}»! ${pick(PRAISE, seedOf(g.id + t))(n)}` : g.type === 'quit' ? pick(PRAISE, seedOf(g.id + t))(n) : `Виконано ✓ Серія: ${n} 🔥`);
  },
  goalRelapse: async d => {
    const g = S.goals.find(x => x.id === d.id); if (!g) return;
    if (!await ask({ title: 'Почати відлік заново?', text: `Нічого страшного — ${Goals.clean(g)} ${plural(Goals.clean(g), 'день', 'дні', 'днів')} уже були твоєю перемогою. Спробуємо ще раз 💚`, ok: 'Почати заново' })) return;
    g.attempts = g.attempts || []; g.attempts.push({ start: g.start, end: today(), days: Goals.clean(g) });
    g.start = today(); g.log = {}; save(); render(); toast('Новий старт — ти зможеш 💪');
  },
  goalSave: d => {
    const r = $('#sheetBody'); const title = $('#gTitle', r).value.trim();
    if (!title) return invalid('gTitle', 'Введіть назву');
    const type = segVal(r, 'gType') || 'habit', time = $('#gTime', r).value, start = $('#gStart', r).value || today();
    if (type === 'quit' && start > today()) return invalid('gStart', 'Дата не може бути в майбутньому');
    const data = { type, title: title.slice(0, 80), min: type === 'habit' ? $('#gMin', r).value.trim().slice(0, 40) : '', time, start: type === 'quit' ? start : '' };
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
