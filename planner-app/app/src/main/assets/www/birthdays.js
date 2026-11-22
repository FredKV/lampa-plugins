'use strict';
/* =====================================================================
   Дні народження + ідеї подарунків
   person: {id, name, bday:'YYYY-MM-DD', noYear, photo, remind:days, budget, note, gifts:[]}
   gift:   {id, title, url, price, photo, note, status:'idea'|'planned'|'bought', txId}
   ===================================================================== */
const GIFT_STATUS = { idea: ['💡', 'Ідея'], planned: ['🗓', 'Заплановано'], bought: ['✅', 'Придбано'] };
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const Birthdays = {
  dateIn(p, year) {
    const [, m, d] = p.bday.split('-').map(Number);
    const dd = m === 2 && d === 29 && !isLeap(year) ? 28 : d;
    return `${year}-${pad(m)}-${pad(dd)}`;
  },
  next(p, from = today()) {
    const y = parseYmd(from).getFullYear();
    let d = this.dateIn(p, y);
    if (d < from) d = this.dateIn(p, y + 1);
    return d;
  },
  ageAt(p, date) { if (p.noYear) return null; const a = parseYmd(date).getFullYear() - +p.bday.slice(0, 4); return a >= 0 ? a : null; },
  currentAge(p) { if (p.noYear) return null; const t = today(); let a = this.ageAt(p, t); if (this.dateIn(p, parseYmd(t).getFullYear()) > t) a--; return a; },
  upcoming(daysAhead = 365) {
    const t = today();
    return S.people.map(p => { const date = this.next(p, t); return { p, date, days: diffDays(t, date), age: this.ageAt(p, date) }; })
      .filter(x => x.days <= daysAhead).sort((a, b) => a.days - b.days);
  },
  onDate(date) {
    const y = parseYmd(date).getFullYear();
    return S.people.filter(p => this.dateIn(p, y) === date && (p.noYear || +p.bday.slice(0, 4) <= y)).map(p => ({ p, age: this.ageAt(p, date) }));
  },
  mapForRange(from, to) {
    const m = {}; const y1 = parseYmd(from).getFullYear(), y2 = parseYmd(to).getFullYear();
    S.people.forEach(p => { for (let y = y1; y <= y2; y++) { const d = this.dateIn(p, y); if (d >= from && d <= to) m[d] = 1; } });
    return m;
  },
  giftTotals(p) {
    const g = p.gifts || [];
    const planned = g.filter(x => x.status !== 'idea').reduce((a, x) => a + num(x.price), 0);
    const bought = g.filter(x => x.status === 'bought').reduce((a, x) => a + num(x.price), 0);
    return { planned, bought };
  },
  countdown(days) { return days === 0 ? 'Сьогодні! 🎉' : days === 1 ? 'Завтра' : `через ${days} ${plural(days, 'день', 'дні', 'днів')}`; }
};
REMINDER_PROVIDERS.push(() => {
  const out = [];
  S.people.forEach(p => {
    const date = Birthdays.next(p), age = Birthdays.ageAt(p, date);
    const who = `${p.name}${age ? ` (${age})` : ''}`;
    const g = (p.gifts || []).some(x => x.status === 'bought') ? '' : ' Подарунок ще не придбано 🎁';
    out.push({ id: 'bd14-' + p.id, at: at9(addDays(date, -14)), title: '🎂 Через 2 тижні день народження', text: `${who} — ${shortDate(date)}.${g}` });
    out.push({ id: 'bd7-' + p.id, at: at9(addDays(date, -7)), title: '🎂 Через тиждень день народження', text: `${who} — ${shortDate(date)}.${g}` });
    out.push({ id: 'bd0-' + p.id, at: at9(date), title: '🎂 Сьогодні день народження!', text: `${who} — не забудь привітати 🎉` });
  });
  return out;
});

function avatar(p, size = 46) {
  const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return p.photo ? `<div class="ava ph-box" style="width:${size}px;height:${size}px"><img data-photo="${esc(p.photo)}" alt=""></div>`
    : `<div class="ava" style="width:${size}px;height:${size}px;font-size:${size * .38}px">${esc(initials)}</div>`;
}

PAGES.birthdays = () => {
  const list = Birthdays.upcoming();
  return {
    title: 'Дні народження', html: list.length ? `
      ${list.slice(0, 1).map(x => `<div class="card bd-next" data-a="go" data-page="person" data-id="${x.p.id}">
        <div class="grow" style="min-width:0"><div class="small muted">Найближчий</div><div style="font-size:21px;font-weight:700;margin-top:2px">${esc(x.p.name)}</div>
        <div class="muted small">${shortDate(x.date)}${x.age ? ` · виповнюється ${x.age}` : ''}</div></div>
        <div class="bd-days">${x.days === 0 ? '🎉' : `<b>${x.days}</b><span>${plural(x.days, 'день', 'дні', 'днів')}</span>`}</div></div>`).join('')}
      <div class="list">${list.map(x => `<div class="item" data-a="go" data-page="person" data-id="${x.p.id}">${avatar(x.p)}
        <div class="grow"><div class="title">${esc(x.p.name)}</div>
        <div class="meta">${shortDate(x.date)}${x.age ? ` · ${x.age} ${plural(x.age, 'рік', 'роки', 'років')}` : ''}${(x.p.gifts || []).length ? ` · 🎁 ${x.p.gifts.length}` : ''}</div></div>
        <span class="pill ${x.days <= 7 ? 'red' : ''}">${Birthdays.countdown(x.days)}</span></div>`).join('')}</div>`
      : emptyCard('🎂', 'Додайте близьких — ЛАД нагадає про свято та допоможе з подарунком.', { label: 'Додати людину', attrs: 'data-a="personNew"' })
  };
};
FABS.birthdays = () => personSheet();

PAGES.person = p => {
  const pr = S.people.find(x => x.id === p.id); if (!pr) return null;
  const date = Birthdays.next(pr), days = diffDays(today(), date), age = Birthdays.currentAge(pr), nextAge = Birthdays.ageAt(pr, date);
  const t = Birthdays.giftTotals(pr);
  const gifts = (pr.gifts || []).slice().sort((a, b) => ['planned', 'idea', 'bought'].indexOf(a.status) - ['planned', 'idea', 'bought'].indexOf(b.status));
  return {
    actions: shareBtn('personShare', pr.id), title: pr.name, html: `
    <div class="card" style="text-align:center">
      <div style="font-size:22px;font-weight:700;margin-top:4px">${esc(pr.name)}</div>
      <div class="muted">${pr.noYear ? `${+pr.bday.slice(8)} ${MONTHS_GEN[+pr.bday.slice(5, 7) - 1]}` : `${+pr.bday.slice(8)} ${MONTHS_GEN[+pr.bday.slice(5, 7) - 1]} ${pr.bday.slice(0, 4)}`}${age !== null ? ` · ${age} ${plural(age, 'рік', 'роки', 'років')}` : ''}</div>
      <div class="countdown-box">${days === 0 ? '🎉 Сьогодні свято!' : `До свята: <b>${days}</b> ${plural(days, 'день', 'дні', 'днів')}`}${nextAge ? ` · виповниться ${nextAge}` : ''}</div>
      ${pr.note ? `<div class="small muted" style="margin-top:8px">${esc(pr.note)}</div>` : ''}
      <div class="small muted" style="margin-top:8px">🔔 Нагадаю за 2 тижні, за тиждень і в день свята</div>
      <div class="btns"><button class="btn ghost" data-a="personEdit" data-id="${pr.id}">Редагувати</button></div>
    </div>
    <div class="card" data-a="personBudget" data-id="${pr.id}">
      <div class="row between"><b>Бюджет на подарунок</b><span class="link small">${pr.budget ? 'Змінити' : 'Задати'}</span></div>
      ${pr.budget ? `<div class="small muted" style="margin-top:6px">Заплановано ${money(t.planned)} з ${money(pr.budget)} · придбано на ${money(t.bought)}</div>
        ${progressBar(t.planned / pr.budget * 100, t.planned > pr.budget ? 'var(--red)' : '')}
        <div class="small ${t.planned > pr.budget ? 'red' : 'muted'}" style="margin-top:6px">${t.planned > pr.budget ? `Перевищено на ${money(t.planned - pr.budget)}` : `Залишилось ${money(pr.budget - t.planned)}`}</div>`
        : `<div class="small muted" style="margin-top:6px">Скільки готові витратити на подарунок?</div>`}
    </div>
    <div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Ідеї подарунків</h2><button class="link small" data-a="giftNew" data-pid="${pr.id}">+ Ідея</button></div>
    ${gifts.length ? `<div class="list">${gifts.map(g => `<div class="item" data-a="giftEdit" data-pid="${pr.id}" data-id="${g.id}">
      ${g.photo ? `<div class="thumb ph-box"><img data-photo="${esc(g.photo)}" alt=""></div>` : `<div class="emoji">${GIFT_STATUS[g.status][0]}</div>`}
      <div class="grow"><div class="title">${esc(g.title)}</div><div class="meta"><span class="pill ${g.status === 'bought' ? 'green' : g.status === 'planned' ? 'blue' : ''}">${GIFT_STATUS[g.status][1]}</span>${g.url ? '🔗' : ''}${g.note ? `<span class="ellipsis">${esc(g.note)}</span>` : ''}</div></div>
      <div class="amount">${num(g.price) ? money(num(g.price)) : ''}</div></div>`).join('')}</div>`
      : `<div class="card empty" style="padding:22px">Ще немає ідей. Додайте те, що може сподобатись.</div>`}`
  };
};
FABS.person = () => { const top = U.stack[U.stack.length - 1]; giftSheet(top.p.id); };

function personSheet(id) {
  const p = S.people.find(x => x.id === id) || { name: '', bday: '', noYear: false, photo: '', remind: 3, note: '' };
  openSheet(`<h2>${id ? 'Редагувати' : 'Нова людина'}</h2>
    <div class="field"><input class="input" id="pName" maxlength="60" placeholder="Імʼя" value="${esc(p.name)}"></div>
    <div class="field"><label>Дата народження</label><input type="date" class="input" id="pDate" max="${today()}" value="${p.noYear ? '2000' + p.bday.slice(4) : p.bday}"></div>
    <div class="switch" style="padding-top:0"><div><b>Рік невідомий</b><div class="small muted">Вік не показуватиметься</div></div>${toggleHtml('pNoYear', p.noYear)}</div>
    <div class="small muted" style="margin:-2px 4px 12px">🔔 Нагадаю за 2 тижні, за тиждень і в сам день народження</div>
    <div class="field"><input class="input" id="pNote" maxlength="300" placeholder="Нотатка (розмір, вподобання)" value="${esc(p.note || '')}"></div>
    <div class="field"><label>Фото (за бажанням)</label>${photoField(p.photo)}</div>
    <div class="btns ${id ? 'two' : ''}">${id ? `<button class="btn danger" data-a="personDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="personSave" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#pName', r).focus(), 300); });
}
function giftSheet(pid, id) {
  const pr = S.people.find(x => x.id === pid);
  const g = (pr.gifts || []).find(x => x.id === id) || { title: '', url: '', price: '', photo: '', note: '', status: 'idea' };
  openSheet(`<h2>${id ? 'Подарунок' : 'Ідея подарунка'}</h2>
    <div class="small muted" style="margin:-8px 0 14px">для ${esc(pr.name)}</div>
    <div class="field"><input class="input" id="gTitle" maxlength="120" placeholder="Назва подарунка" value="${esc(g.title)}"></div>
    <div class="field"><label>Статус</label>${seg('gStatus', [['idea', 'Ідея'], ['planned', 'Заплановано'], ['bought', 'Придбано']], g.status)}</div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Орієнтовна вартість, ₴</label><input class="input" id="gPrice" inputmode="decimal" value="${g.price || ''}" placeholder="0"></div>
    </div>
    <div class="field"><label>Посилання на товар</label><input class="input" id="gUrl" inputmode="url" placeholder="https://…" value="${esc(g.url)}">
      ${g.url ? `<button class="chip" style="margin-top:8px" data-a="openLink" data-url="${esc(g.url)}">Відкрити посилання ↗</button>` : ''}</div>
    <div class="field"><textarea class="input" id="gNote" maxlength="500" placeholder="Примітки (колір, розмір…)">${esc(g.note)}</textarea></div>
    <div class="field"><label>Фото подарунка</label>${photoField(g.photo)}</div>
    ${g.txId ? `<div class="small muted" style="margin-bottom:8px">💸 Сума внесена у витрати «Подарунки»</div>` : ''}
    <div class="btns ${id ? 'two' : ''}">${id ? `<button class="btn danger" data-a="giftDel" data-pid="${pid}" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="giftSave" data-pid="${pid}" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#gTitle', r).focus(), 300); });
}

Object.assign(A, {
  personShare: d => { const pr = S.people.find(x => x.id === d.id); if (!pr) return; const date = Birthdays.next(pr), age = Birthdays.ageAt(pr, date);
    shareText(`🎂 ${pr.name} — день народження ${dateLabel(date)}${age ? ` (${age} ${plural(age, 'рік', 'роки', 'років')})` : ''}`); },
  personNew: () => personSheet(),
  personEdit: d => personSheet(d.id),
  personSave: d => {
    const r = $('#sheetBody'); const name = $('#pName', r).value.trim(); const date = $('#pDate', r).value;
    if (name.length < 1) return invalid('pName', 'Введіть імʼя');
    if (!isDate(date)) return invalid('pDate', 'Вкажіть дату народження');
    const noYear = $('#pNoYear', r).classList.contains('on');
    if (!noYear && date > today()) return invalid('pDate', 'Дата народження не може бути в майбутньому');
    const data = { name: name.slice(0, 60), bday: noYear ? '0000' + date.slice(4) : date, noYear, note: $('#pNote', r).value.trim().slice(0, 300), photo: photoVal(r) };
    let p;
    if (d.id) { p = S.people.find(x => x.id === d.id); if (p.photo && p.photo !== data.photo) Photos.del(p.photo); Object.assign(p, data); }
    else { p = { id: uid(), budget: 0, gifts: [], ...data }; S.people.push(p); }
    ensureNotifPermission();
    save(); closeSheet();
    if (!d.id) navigate('person', { id: p.id }); else render();
    toast('Збережено');
  },
  personDel: async d => {
    const p = S.people.find(x => x.id === d.id);
    if (!await ask({ title: `Видалити ${p.name}?`, text: 'Разом з усіма ідеями подарунків. Витрати у фінансах залишаться.', ok: 'Видалити', danger: true })) return;
    if (p.photo) Photos.del(p.photo); (p.gifts || []).forEach(g => g.photo && Photos.del(g.photo));
    S.people = S.people.filter(x => x.id !== d.id); save();
    if (U.stack.length && U.stack[U.stack.length - 1].page === 'person') back(); else render();
  },
  personBudget: async d => {
    const p = S.people.find(x => x.id === d.id);
    const v = await askNumber({ title: 'Бюджет на подарунок', label: 'Сума, ₴', value: p.budget || '', hint: 'Введіть 0, щоб прибрати бюджет.', allowZero: true });
    if (v === null) return; p.budget = v; save(); render();
  },
  giftNew: d => giftSheet(d.pid),
  giftEdit: d => giftSheet(d.pid, d.id),
  openLink: d => openUrl(d.url),
  giftSave: async d => {
    const r = $('#sheetBody'); const p = S.people.find(x => x.id === d.pid);
    const title = $('#gTitle', r).value.trim(); if (!title) return invalid('gTitle', 'Введіть назву подарунка');
    const url = $('#gUrl', r).value.trim(); if (url && !isUrl(url)) return invalid('gUrl', 'Посилання має починатися з https://');
    const priceRaw = $('#gPrice', r).value.trim(), price = num(priceRaw);
    if (priceRaw && (price < 0 || price > 1e8)) return invalid('gPrice', 'Некоректна вартість');
    const status = segVal(r, 'gStatus') || 'idea';
    const data = { title: title.slice(0, 120), url, price: priceRaw ? round2(price) : '', note: $('#gNote', r).value.trim().slice(0, 500), photo: photoVal(r), status };
    p.gifts = p.gifts || [];
    let g = p.gifts.find(x => x.id === d.id);
    const wasBought = g && g.status === 'bought';
    if (g) { if (g.photo && g.photo !== data.photo) Photos.del(g.photo); Object.assign(g, data); }
    else { g = { id: uid(), txId: '', ...data }; p.gifts.push(g); }
    save(); closeSheet(); render();
    // integration with finances
    if (status === 'bought' && !wasBought && !g.txId) {
      if (await ask({ title: 'Внести у витрати?', text: `Записати ${price ? money(price) : 'покупку'} у категорію «Подарунки»?`, ok: 'Так, внести', cancel: 'Ні' })) {
        const amount = price || await askNumber({ title: 'Скільки коштував подарунок?' });
        if (amount) {
          const tx = Fin.add({ type: 'exp', amount, cat: 'gift', note: `Подарунок для ${p.name}: ${g.title}`.slice(0, 200) });
          g.txId = tx.id; if (!price) g.price = amount;
          save(); render(); toast('Внесено у витрати «Подарунки»'); Fin.checkBudget(tx);
        }
      }
    } else if (status !== 'bought' && wasBought && g.txId && S.tx.some(t => t.id === g.txId)) {
      if (await ask({ title: 'Прибрати витрату?', text: 'Подарунок більше не позначено як придбаний. Видалити повʼязану витрату з фінансів?', ok: 'Видалити витрату', cancel: 'Залишити' })) {
        Fin.remove(g.txId); g.txId = ''; save(); render();
      }
    }
  },
  giftDel: async d => {
    const p = S.people.find(x => x.id === d.pid); const g = p.gifts.find(x => x.id === d.id);
    if (!await ask({ title: 'Видалити подарунок?', text: g.txId ? 'Повʼязана витрата у фінансах залишиться.' : '', ok: 'Видалити', danger: true })) return;
    if (g.photo) Photos.del(g.photo);
    p.gifts = p.gifts.filter(x => x.id !== d.id); save(); render();
  }
});
