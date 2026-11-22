'use strict';
/* =====================================================================
   Мої хотілки — цілі накопичення
   wish: {id,title,photo,desc,url,price,due,prio:1..3,status:'want'|'saving'|'bought',created,boughtAt,txId}
   Внески зберігаються як tx.type='save' з wishId → окремо від витрат, але в єдиному балансі.
   ===================================================================== */
const WISH_STATUS = { want: ['✨', 'Хочу'], saving: ['🐷', 'Накопичую'], bought: ['✅', 'Придбано'] };

const Wishes = {
  saved(w) { return round2(S.tx.filter(t => t.type === 'save' && t.wishId === w.id).reduce((a, t) => a + t.amount, 0)); },
  info(w) {
    const saved = this.saved(w), price = num(w.price), left = Math.max(0, round2(price - saved));
    const pct = price ? Math.min(100, Math.round(saved / price * 100)) : 0;
    let monthly = null, overdue = false, months = null;
    if (w.due && left > 0 && w.status !== 'bought') {
      const days = diffDays(today(), w.due);
      if (days <= 0) overdue = true;
      else { months = Math.max(1, Math.ceil(days / 30.44)); monthly = Math.ceil(left / months); }
    }
    return { saved, price, left, pct, monthly, months, overdue };
  },
  active() { return S.wishes.filter(w => w.status !== 'bought').sort((a, b) => (b.prio - a.prio) || ((a.due || '9') < (b.due || '9') ? -1 : 1)); }
};

function wishCard(w) {
  const i = Wishes.info(w);
  return `<div class="card wish" data-a="go" data-page="wish" data-id="${w.id}">
    <div class="row" style="gap:14px;align-items:flex-start">
      ${w.photo ? `<div class="thumb lg ph-box"><img data-photo="${esc(w.photo)}" alt=""></div>` : `<div class="emoji lg">${(WISH_STATUS[w.status] || WISH_STATUS.want)[0]}</div>`}
      <div class="grow" style="min-width:0">
        <div class="row between"><b class="ellipsis">${esc(w.title)}</b><span class="dot" title="${PRIO[w.prio || 2][0]}" style="background:${PRIO[w.prio || 2][1]}"></span></div>
        <div class="small muted" style="margin-top:2px">${w.status === 'bought' ? `Придбано${w.boughtAt ? ' ' + shortDate(w.boughtAt) : ''}` : `${money(i.saved)} з ${money(i.price)}`}</div>
        ${w.status !== 'bought' ? `${progressBar(i.pct, i.pct >= 100 ? 'var(--green)' : '')}
          <div class="row between small" style="margin-top:6px"><span class="muted">${i.pct}% · залишилось ${money(i.left)}</span>
          ${i.monthly ? `<span>${money(i.monthly)}/міс</span>` : i.overdue ? '<span class="red">термін минув</span>' : ''}</div>` : ''}
      </div></div></div>`;
}

PAGES.wishes = () => {
  const flt = segOf('wishFlt', 'active');
  const act = Wishes.active(), bought = S.wishes.filter(w => w.status === 'bought');
  const totalSaved = act.reduce((a, w) => a + Wishes.saved(w), 0), totalNeed = act.reduce((a, w) => a + num(w.price), 0);
  const list = flt === 'active' ? act : bought.sort((a, b) => (b.boughtAt || '') < (a.boughtAt || '') ? -1 : 1);
  return {
    title: 'Мої хотілки', html: `
    ${act.length ? `<div class="sumline three">
      <div><span>Накопичено</span><b class="violet">${money(totalSaved)}</b></div>
      <div><span>Потрібно всього</span><b>${money(totalNeed)}</b></div>
      <div><span>Ще відкласти</span><b>${money(Math.max(0, totalNeed - totalSaved))}</b></div></div>` : ''}
    ${segUI('wishFlt', [['active', `Активні · ${act.length}`], ['bought', `Придбані · ${bought.length}`]])}
    ${list.length ? list.map(wishCard).join('') : emptyCard(flt === 'active' ? '🎯' : '🛍', flt === 'active' ? 'Додайте річ чи мрію, на яку хочете накопичити.' : 'Ще нічого не придбано', flt === 'active' ? { label: 'Додати хотілку', attrs: 'data-a="wishNew"' } : null)}`
  };
};
FABS.wishes = () => wishSheet();

PAGES.wish = p => {
  const w = S.wishes.find(x => x.id === p.id); if (!w) return null;
  const i = Wishes.info(w);
  const hist = S.tx.filter(t => t.type === 'save' && t.wishId === w.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const R = 52, C = 2 * Math.PI * R;
  return {
    actions: shareBtn('wishShare', w.id), title: w.title, html: `
    ${w.photo ? `<div class="hero-photo ph-box"><img data-photo="${esc(w.photo)}" alt=""></div>` : ''}
    <div class="card">
      <div class="row between"><span class="pill ${w.status === 'bought' ? 'green' : w.status === 'saving' ? 'blue' : ''}">${(WISH_STATUS[w.status] || WISH_STATUS.want).join(' ')}</span>
        <span class="small muted"><span class="dot" style="background:${PRIO[w.prio || 2][1]}"></span> ${PRIO[w.prio || 2][0]} пріоритет</span></div>
      <div style="font-size:22px;font-weight:700;margin-top:10px">${esc(w.title)}</div>
      ${w.desc ? `<div class="muted" style="margin-top:6px;line-height:1.45;white-space:pre-wrap">${esc(w.desc)}</div>` : ''}
      ${w.url ? `<button class="chip" style="margin-top:10px" data-a="openLink" data-url="${esc(w.url)}">🔗 ${esc(domainOf(w.url) || 'Посилання')} ↗</button>` : ''}
    </div>
    ${w.status !== 'bought' ? `<div class="card ring-card">
      <svg viewBox="0 0 120 120" class="ring" role="img" aria-label="Накопичено ${i.pct}%"><circle cx="60" cy="60" r="${R}" stroke="var(--chip)" stroke-width="10" fill="none"/>
        <circle cx="60" cy="60" r="${R}" stroke="${i.pct >= 100 ? 'var(--green)' : 'var(--primary)'}" stroke-width="10" fill="none" stroke-linecap="round"
          stroke-dasharray="${C * i.pct / 100} ${C}" transform="rotate(-90 60 60)"/>
        <text x="60" y="58" text-anchor="middle" class="ring-pct">${i.pct}%</text><text x="60" y="76" text-anchor="middle" class="ring-lbl">накопичено</text></svg>
      <div class="grow">
        <div class="kv"><span>Ціль</span><b>${money(i.price)}</b></div>
        <div class="kv"><span>Накопичено</span><b>${money(i.saved)}</b></div>
        <div class="kv"><span>Залишок</span><b>${money(i.left)}</b></div>
        ${w.due ? `<div class="kv"><span>Купити до</span><b>${shortDate(w.due)}</b></div>` : ''}
      </div></div>
    ${i.left > 0 && !w.due ? `<div class="card st-row-card" data-a="wishEdit" data-id="${w.id}"><span>Ціль до дати</span><span class="muted">Додати ›</span></div>` : ''}
    ${i.left > 0 && w.due ? `<div class="hint ${i.overdue ? 'warn' : 'info'}">${i.monthly ? `Щоб встигнути до ${shortDate(w.due)}, відкладайте <b>${money(i.monthly)}</b> щомісяця (${i.months} ${plural(i.months, 'місяць', 'місяці', 'місяців')}).`
      : i.overdue ? `Бажана дата минула. Залишилось відкласти ${money(i.left)} — оновіть дату, щоб перерахувати план.` : ''}</div>`
      : i.left > 0 ? '' : `<div class="hint ok">🎉 Ціль досягнуто! Можна купувати.</div>`}
    <div class="btns two"><button class="btn" data-a="wishAdd" data-id="${w.id}">+ Відкласти</button>
      <button class="btn ghost card-btn" data-a="wishTake" data-id="${w.id}" ${i.saved > 0 ? '' : 'disabled'}>Забрати</button></div>
    <div class="btns"><button class="btn card-btn ghost" data-a="wishBuy" data-id="${w.id}">Придбано — закрити ціль</button></div>`
      : `<div class="card"><div class="kv"><span>Придбано</span><b>${w.boughtAt ? shortDate(w.boughtAt) : '—'}</b></div>
        <div class="kv"><span>Ціна</span><b>${money(num(w.price))}</b></div>
        ${w.txId && S.tx.some(t => t.id === w.txId) ? '<div class="small muted" style="margin-top:6px">💸 Покупку внесено у витрати «Покупки»</div>' : ''}
        <div class="btns"><button class="btn ghost" data-a="wishReopen" data-id="${w.id}">Повернути в активні</button></div></div>`}
    ${hist.length ? `<h2>Історія накопичень</h2><div class="list">${hist.map(t => `<div class="item" data-a="txEdit" data-id="${t.id}"><div class="emoji sm">${t.amount < 0 ? '↩️' : '🐷'}</div>
      <div class="grow"><div class="title">${t.amount < 0 ? 'Забрано з накопичень' : 'Відкладено'}</div><div class="meta">${dateLabel(t.date)}${t.note && t.note !== w.title ? ' · ' + esc(t.note) : ''}</div></div>
      <div class="amount ${t.amount < 0 ? '' : 'violet'}">${t.amount < 0 ? '−' : '+'}${money(Math.abs(t.amount))}</div></div>`).join('')}</div>` : ''}
    <div class="btns two" style="margin-top:16px"><button class="btn danger" data-a="wishDel" data-id="${w.id}">Видалити</button><button class="btn ghost card-btn" data-a="wishEdit" data-id="${w.id}">Редагувати</button></div>`
  };
};

function wishSheet(id) {
  const w = S.wishes.find(x => x.id === id) || { title: '', photo: '', desc: '', url: '', price: '', due: '', prio: 2, status: 'want' };
  openSheet(`<h2>${id ? 'Редагувати хотілку' : 'Нова хотілка'}</h2>
    <div class="field"><input class="input" id="wTitle" maxlength="100" placeholder="Що хочете? (напр. Новий телефон)" value="${esc(w.title)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Потрібна сума, ₴</label><input class="input" id="wPrice" inputmode="decimal" placeholder="30000" value="${w.price || ''}"></div>
      <div class="field grow"><label>Купити до</label><input type="date" class="input" id="wDue" value="${w.due || ''}"></div>
    </div>
    ${!id ? `<div class="field"><label>Вже накопичено, ₴ (необовʼязково)</label><input class="input" id="wStart" inputmode="decimal" placeholder="0"></div>` : ''}
    <div class="field"><label>Пріоритет</label>${seg('wPrio', [['3', 'Високий'], ['2', 'Середній'], ['1', 'Низький']], String(w.prio))}</div>
    ${w.status !== 'bought' ? `<div class="field"><label>Статус</label>${seg('wStatus', [['want', 'Хочу'], ['saving', 'Накопичую']], w.status)}</div>` : ''}
    <div class="field"><textarea class="input" id="wDesc" maxlength="1000" placeholder="Опис (модель, колір, чому хочу…)">${esc(w.desc)}</textarea></div>
    <div class="field"><label>Посилання на товар (необовʼязково)</label><input class="input" id="wUrl" inputmode="url" placeholder="https://…" value="${esc(w.url)}"></div>
    <div class="field"><label>Фото</label>${photoField(w.photo)}</div>
    <div class="btns"><button class="btn" data-a="wishSave" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#wTitle', r)?.focus(), 300); });
}
function buySheet(w) {
  const i = Wishes.info(w);
  openSheet(`<h2>Придбано! 🎉</h2><div class="muted" style="margin:-8px 0 14px">${esc(w.title)}</div>
    <div class="field"><label>Фактична ціна, ₴</label><input class="input big" id="bPrice" inputmode="decimal" value="${num(w.price) || ''}"></div>
    <div class="switch"><div><b>Внести у витрати «Покупки»</b><div class="small muted">${i.saved > 0 ? `Накопичені ${money(i.saved)} буде використано для оплати` : 'Сума зʼявиться у статистиці витрат'}</div></div>${toggleHtml('bExp', true)}</div>
    <div class="btns"><button class="btn" data-a="wishBuyDo" data-id="${w.id}">Закрити ціль</button></div>`);
}

Object.assign(A, {
  wishShare: d => { const w = S.wishes.find(x => x.id === d.id); if (!w) return; const i = Wishes.info(w);
    shareText(`🎯 Хочу: ${w.title}${w.price ? `\n💰 ${money(w.price)}` : ''}${Wishes.saved(w) ? `\nВідкладено: ${money(Wishes.saved(w))}` : ''}${w.url ? '\n' + w.url : ''}`); },
  wishNew: () => wishSheet(),
  wishEdit: d => wishSheet(d.id),
  wishSave: d => {
    const r = $('#sheetBody');
    const title = $('#wTitle', r).value.trim(); if (!title) return invalid('wTitle', 'Введіть назву');
    const price = num($('#wPrice', r).value); if (price <= 0) return invalid('wPrice', 'Вкажіть суму більше нуля');
    if (price > 1e9) return invalid('wPrice', 'Занадто велика сума');
    const due = $('#wDue', r).value; if (due && !isDate(due)) return invalid('wDue', 'Некоректна дата');
    const url = $('#wUrl', r).value.trim(); if (url && !isUrl(url)) return invalid('wUrl', 'Посилання має починатися з https://');
    const startRaw = $('#wStart', r) ? $('#wStart', r).value.trim() : '', start = num(startRaw);
    if (startRaw && (start < 0 || start > 1e9)) return invalid('wStart', 'Некоректна сума');
    const data = { title: title.slice(0, 100), price: round2(price), due, url, desc: $('#wDesc', r).value.trim().slice(0, 1000), prio: +segVal(r, 'wPrio') || 2, photo: photoVal(r) };
    const st = segVal(r, 'wStatus'); if (st) data.status = st;
    let w;
    if (d.id) { w = S.wishes.find(x => x.id === d.id); if (w.photo && w.photo !== data.photo) Photos.del(w.photo); Object.assign(w, data); }
    else {
      w = { id: uid(), status: 'want', created: Date.now(), boughtAt: '', txId: '', ...data }; S.wishes.push(w);
      if (start > 0) { Fin.add({ type: 'save', amount: start, wishId: w.id, note: 'Початкове накопичення' }); w.status = 'saving'; }
    }
    save(); closeSheet();
    if (!d.id) navigate('wish', { id: w.id }); else render();
  },
  wishAdd: async d => {
    const w = S.wishes.find(x => x.id === d.id); const i = Wishes.info(w);
    const v = await askNumber({ title: 'Відкласти на хотілку', hint: `${esc(w.title)} · залишилось ${money(i.left)}${i.monthly ? ` · план ${money(i.monthly)}/міс` : ''}`, value: i.monthly && i.monthly <= i.left ? i.monthly : '', ok: 'Відкласти' });
    if (!v) return;
    Fin.add({ type: 'save', amount: v, wishId: w.id, note: w.title });
    if (w.status === 'want') w.status = 'saving';
    save(); render();
    toast(Wishes.info(w).left <= 0 ? '🎉 Ціль досягнуто!' : `Відкладено ${money(v)}`);
  },
  wishTake: async d => {
    const w = S.wishes.find(x => x.id === d.id); const saved = Wishes.saved(w);
    const v = await askNumber({ title: 'Забрати з накопичень', hint: `Доступно ${money(saved)}. Сума повернеться у вільний баланс.`, ok: 'Забрати' });
    if (!v) return;
    if (v > saved) { toast(`Можна забрати не більше ${money(saved)}`); return; }
    Fin.add({ type: 'save', amount: -v, wishId: w.id, note: w.title }); save(); render();
  },
  wishBuy: d => buySheet(S.wishes.find(x => x.id === d.id)),
  wishBuyDo: d => {
    const r = $('#sheetBody'); const w = S.wishes.find(x => x.id === d.id);
    const price = num($('#bPrice', r).value); if (price <= 0) return invalid('bPrice', 'Вкажіть ціну');
    const toExp = $('#bExp', r).classList.contains('on');
    const saved = Wishes.saved(w);
    if (saved > 0) Fin.add({ type: 'save', amount: -saved, wishId: w.id, note: toExp ? 'Використано на покупку' : 'Ціль закрито' });
    if (toExp) { const tx = Fin.add({ type: 'exp', amount: price, cat: 'shopping', note: `Хотілка: ${w.title}`.slice(0, 200) }); w.txId = tx.id; Fin.checkBudget(tx); }
    w.status = 'bought'; w.boughtAt = today(); w.price = round2(price);
    save(); closeSheet(); render(); toast('Ціль закрито 🎉');
  },
  wishReopen: async d => {
    const w = S.wishes.find(x => x.id === d.id);
    const hasTx = w.txId && S.tx.some(t => t.id === w.txId);
    if (!await ask({ title: 'Повернути в активні?', text: hasTx ? 'Повʼязану витрату буде видалено з фінансів.' : '', ok: 'Повернути' })) return;
    if (hasTx) Fin.remove(w.txId);
    w.txId = ''; w.status = 'saving'; w.boughtAt = ''; save(); render();
  },
  wishDel: async d => {
    const w = S.wishes.find(x => x.id === d.id); const saved = Wishes.saved(w);
    if (!await ask({ title: `Видалити «${w.title}»?`, text: saved > 0 ? `Накопичені ${money(saved)} повернуться у вільний баланс.` : '', ok: 'Видалити', danger: true })) return;
    if (saved > 0) Fin.add({ type: 'save', amount: -saved, wishId: w.id, note: `Видалено хотілку «${w.title}»`.slice(0, 200) });
    if (w.photo) Photos.del(w.photo);
    S.wishes = S.wishes.filter(x => x.id !== d.id); save(); back();
  }
});
