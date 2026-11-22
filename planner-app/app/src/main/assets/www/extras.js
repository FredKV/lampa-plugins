'use strict';
/* =====================================================================
   • Регулярні платежі: комуналка, підписки, кредит — нагадування за 3 дні та в день,
     «Оплачено» → витрата і перенос на наступний раз; в «Огляді» — що ще попереду цього місяця.
   • Сканер чека: фото чека → Gemini → сума, магазин, дата, категорія, позиції → витрата з фото чека.
   • Підсумок тижня: неділя, 19:00 — сповіщення; сторінка з витратами, цілями, планами й наступним тижнем.
   bill: {id, name, amount, cat, per:'week'|'month'|'year', next:'YYYY-MM-DD', paid:[{date, txId}]}
   ===================================================================== */

/* ---------------- recurring payments ---------------- */
const BILL_PER = [['week', 'Щотижня'], ['month', 'Щомісяця'], ['year', 'Щороку']];
const Bills = {
  list: () => (S.bills || []).slice().sort((a, b) => a.next < b.next ? -1 : 1),
  monthEnd: () => { const t = today(); return addDays(addMonthsYmd(t.slice(0, 8) + '01', 1), -1); },
  /** still to pay until the end of this month (overdue included) */
  leftThisMonth: () => Bills.list().reduce((a, b) => { let d = b.next, n = 0; while (d <= Bills.monthEnd() && n < 6) { a += b.amount; d = nextRepeat(d, b.per); n++; } return a; }, 0),
  dueLabel(b) {
    const k = diffDays(today(), b.next);
    return k < 0 ? `прострочено ${-k} ${plural(-k, 'день', 'дні', 'днів')}` : k === 0 ? 'сьогодні' : k === 1 ? 'завтра' : `через ${k} ${plural(k, 'день', 'дні', 'днів')} · ${shortDate(b.next)}`;
  }
};
function billsCard() {
  const l = Bills.list(); if (!l.length) return `<button class="chip card-bg" style="margin:0 0 12px" data-a="billNew">🔁 Додати регулярний платіж</button>`;
  const soon = l.filter(b => b.next <= addDays(today(), 31)).slice(0, 4);
  return `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Регулярні платежі</h2><button class="link small" data-a="go" data-page="bills">усі ›</button></div>
    <div class="card">
      <div class="row between"><span class="small muted">Ще до кінця місяця</span><b>${money(Bills.leftThisMonth())}</b></div>
      <div class="list flat" style="margin-top:6px">${soon.map(billRow).join('')}</div></div>`;
}
function billRow(b) {
  const k = diffDays(today(), b.next), c = Fin.cat('exp', b.cat);
  return `<div class="item" data-a="billEdit" data-id="${b.id}"><div class="emoji sm">${c[1]}</div>
    <div class="grow" style="min-width:0"><div class="title ellipsis">${esc(b.name)}</div><div class="meta ${k < 0 ? 'red' : k <= 3 ? 'amber' : ''}">${Bills.dueLabel(b)}</div></div>
    <div class="right"><div class="amount">${money(b.amount)}</div>${k <= 3 ? `<button class="chip sm-chip" data-a="billPay" data-id="${b.id}">Оплачено</button>` : ''}</div></div>`;
}
PAGES.bills = () => ({
  title: 'Регулярні платежі', html: `
    ${S.bills.length ? `<div class="card"><div class="row between"><span class="muted">Ще до кінця місяця</span><b>${money(Bills.leftThisMonth())}</b></div>
      <div class="row between" style="margin-top:6px"><span class="muted">На місяць загалом</span><b>${money(S.bills.reduce((a, b) => a + (b.per === 'week' ? b.amount * 52 / 12 : b.per === 'year' ? b.amount / 12 : b.amount), 0))}</b></div></div>
      <div class="list">${Bills.list().map(billRow).join('')}</div>`
      : emptyCard('🔁', 'Комуналка, підписки, кредит, оренда — ЛАД нагадає за 3 дні й у день оплати.', { label: '+ Додати платіж', attrs: 'data-a="billNew"' })}`
});
FABS.bills = () => billSheet();
function billSheet(id) {
  const b = S.bills.find(x => x.id === id) || { name: '', amount: '', cat: 'utils', per: 'month', next: today() };
  openSheet(`<h2>${id ? 'Платіж' : 'Новий регулярний платіж'}</h2>
    <div class="field"><input class="input big" id="bAmount" inputmode="decimal" placeholder="0 ₴" value="${b.amount || ''}"></div>
    <div class="field"><input class="input" id="bName" maxlength="60" placeholder="Що (напр. Інтернет, Netflix, кредит)" value="${esc(b.name)}"></div>
    <div class="field"><label>Як часто</label>${seg('bPer', BILL_PER, b.per)}</div>
    <div class="field"><label>Наступна оплата</label><input type="date" class="input" id="bNext" value="${b.next}"></div>
    <div class="field"><label>Категорія</label><div class="chips" id="bCats">${Fin.cats('exp').map(c => `<button class="chip ${c[0] === b.cat ? 'on' : ''}" data-a="billCat" data-cat="${c[0]}">${c[1]} ${esc(c[2])}</button>`).join('')}</div></div>
    ${id ? `<div class="btns"><button class="btn" data-a="billPay" data-id="${id}">Оплачено зараз</button></div>` : ''}
    <div class="btns ${id ? 'two' : ''}">${id ? `<button class="btn danger" data-a="billDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn ${id ? 'ghost card-btn' : ''}" data-a="billSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#bAmount', r).focus(), 300); });
}
REMINDER_PROVIDERS.push(() => (S.bills || []).flatMap(b => [
  { id: 'bill3-' + b.id, at: at9(addDays(b.next, -3), 10), title: `🔁 ${b.name} — через 3 дні`, text: `${money(b.amount)} · ${shortDate(b.next)}`, page: 'bills' },
  { id: 'bill0-' + b.id, at: at9(b.next, 10), title: `🔁 Сьогодні оплата: ${b.name}`, text: `${money(b.amount)} — відміть «Оплачено» в ЛАД`, page: 'bills' }]));

/* ---------------- receipt scanner ---------------- */
async function readReceipt(dataUrl) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const cats = Fin.cats('exp').map(x => x[0]).join(', ');
  const { text } = await gemini({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: c.toDataURL('image/jpeg', .9).split(',')[1] } }, { text:
      'Це фото касового чека з України. Прочитай його і відповідай ЛИШЕ JSON: {"ok":true/false (false якщо це не чек),"store":"назва магазину/закладу",' +
      '"date":"YYYY-MM-DD або порожньо","total":підсумкова сума до сплати числом,"items":[{"name":"коротка назва українською","price":сума за позицію числом}],' +
      `"cat":"одна з категорій: ${cats}"}. Не вигадуй: лише те, що видно на чеку.` }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });
  const j = extractJson(text);
  return {
    ok: j.ok !== false && num(j.total) > 0, store: String(j.store || '').slice(0, 40), date: isDate(j.date) && j.date <= today() ? j.date : today(),
    total: round2(num(j.total)), cat: Fin.cats('exp').some(x => x[0] === j.cat) ? j.cat : 'food',
    items: (Array.isArray(j.items) ? j.items : []).slice(0, 60).map(x => ({ name: String(x.name || '').slice(0, 50), price: round2(num(x.price)) })).filter(x => x.name)
  };
}
U.rc = null;
async function startReceipt() {
  if (!Keys.has()) { toast('Для сканування чеків додайте ключ Gemini у Налаштуваннях'); settingsSheet(); return; }
  const id = await pickPhoto(2000); if (!id) return;
  U.rc = { photo: id, loading: true, r: null, err: '' }; receiptSheet();
  try { const r = await readReceipt(await Photos.get(id)); if (!U.rc || U.rc.photo !== id) return; U.rc.r = r; if (!r.ok) U.rc.err = 'Не вдалося прочитати чек. Сфотографуйте рівно, щоб було видно підсумок, або введіть суму вручну.'; }
  catch (e) { if (U.rc) U.rc.err = e.message; }
  if (U.rc) { U.rc.loading = false; receiptSheet(); }
}
function receiptSheet() {
  const s = U.rc; if (!s) return;
  const photo = `<div class="scan-photo ph-box"><img data-photo="${esc(s.photo)}" alt="Чек"></div>`;
  if (s.loading) { openSheet(`<h2>Чек</h2>${photo}<div class="sf-load"><div class="spinner"></div><span>Читаю чек…</span></div>`); return; }
  const r = s.r || { total: '', store: '', date: today(), cat: 'food', items: [] };
  openSheet(`<h2>Чек</h2>${photo}
    ${s.err ? `<div class="hint" style="margin-bottom:10px">${esc(s.err)}</div>` : ''}
    <div class="field"><input class="input big" id="rcTotal" inputmode="decimal" placeholder="0 ₴" value="${r.total || ''}"></div>
    <div class="row" style="gap:10px"><div class="field grow"><input class="input" id="rcStore" maxlength="40" placeholder="Магазин" value="${esc(r.store)}"></div>
      <div class="field grow"><input type="date" class="input" id="rcDate" value="${r.date}"></div></div>
    <div class="field"><label>Категорія</label><div class="chips" id="rcCats">${Fin.cats('exp').map(c => `<button class="chip ${c[0] === r.cat ? 'on' : ''}" data-a="receiptCat" data-cat="${c[0]}">${c[1]} ${esc(c[2])}</button>`).join('')}</div></div>
    ${r.items.length ? `<details class="card" style="padding:4px 14px;margin-bottom:12px"><summary class="small muted" style="padding:10px 0">Позиції в чеку (${r.items.length})</summary>
      <div class="list flat">${r.items.map(i => `<div class="row between" style="padding:6px 0;font-size:14px"><span class="ellipsis">${esc(i.name)}</span><b>${i.price ? money(i.price) : ''}</b></div>`).join('')}</div></details>` : ''}
    <div class="btns"><button class="btn" data-a="receiptSave">Записати витрату</button></div>`);
}

/* ---------------- weekly summary ---------------- */
function weekStats(mon) {
  const sun = addDays(mon, 6), st = Fin.stats(mon, sun), prev = Fin.stats(addDays(mon, -7), addDays(mon, -1));
  const cats = {}; st.list.filter(t => t.type === 'exp').forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + t.amount; });
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const goals = (S.goals || []).map(g => ({ g, n: Object.keys(g.log || {}).filter(d => d >= mon && d <= sun).length }));
  const tasksDone = S.tasks.filter(t => t.done || (t.lastDone && t.lastDone >= mon)).length;
  const nextMon = addDays(mon, 7), upcoming = [];
  for (let k = 0; k < 7; k++) { const d = addDays(nextMon, k); dayData(d, null).evs.forEach(e => upcoming.push({ d, e })); }
  return { mon, sun, exp: st.exp, inc: st.inc, prevExp: prev.exp, top, goals, tasksDone, upcoming, bills: (S.bills || []).filter(b => b.next >= nextMon && b.next <= addDays(nextMon, 6)) };
}
PAGES.week = () => {
  const tdy = today(), mon = parseYmd(tdy).getDay() === 0 || parseYmd(tdy).getDay() === 6 ? mondayOf(tdy) : addDays(mondayOf(tdy), -7);
  const w = weekStats(mon), diff = w.prevExp ? Math.round((w.exp - w.prevExp) / w.prevExp * 100) : 0;
  return {
    title: 'Підсумок тижня', actions: shareBtn('weekShare', mon), html: `
    <div class="card" style="text-align:center;padding:20px 16px">
      <div class="small muted">${shortDate(w.mon)} – ${shortDate(w.sun)}</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:-.6px;margin:6px 0">${money(w.exp)}</div>
      <div class="small muted">витрачено${w.prevExp ? ` · ${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% до минулого тижня` : ''}</div></div>
    ${w.top.length ? `<h2>На що найбільше</h2><div class="card">${w.top.map(([c, v]) => { const k = Fin.cat('exp', c); return `<div class="row between" style="padding:7px 0"><span>${k[1]} ${esc(k[2])}</span><b>${money(v)}</b></div>`; }).join('')}</div>` : ''}
    ${w.goals.length ? `<h2>Цілі</h2><div class="card">${w.goals.map(({ g, n }) => `<div class="row between" style="padding:7px 0"><span>${g.type === 'quit' ? '🚭' : '🎯'} ${esc(g.title)}</span><b>${g.type === 'quit' ? `${Goals.clean(g)} дн. без зривів` : g.per === 'week' ? `${n} з ${g.times}` : `${n} з 7 днів`}</b></div>`).join('')}</div>` : ''}
    <h2>Наступний тиждень</h2>
    <div class="card">${w.upcoming.length || w.bills.length ? [...w.upcoming.map(({ d, e }) => `<div class="row between" style="padding:7px 0"><span>${e.important ? '⭐' : '📅'} ${esc(e.title)}</span><span class="muted small">${shortDate(d)}${e.time ? ' ' + e.time : ''}</span></div>`),
      ...w.bills.map(b => `<div class="row between" style="padding:7px 0"><span>🔁 ${esc(b.name)}</span><span class="muted small">${shortDate(b.next)} · ${money(b.amount)}</span></div>`)].join('') : '<div class="muted small">Поки нічого не заплановано</div>'}</div>`
  };
};
function weekText(mon) {
  const w = weekStats(mon);
  return [`📊 Мій тиждень ${shortDate(w.mon)} – ${shortDate(w.sun)}`, `Витрачено: ${money(w.exp)}`,
    ...w.top.map(([c, v]) => `• ${Fin.cat('exp', c)[2]}: ${money(v)}`),
    ...w.goals.filter(x => x.n).map(({ g, n }) => `🎯 ${g.title}: ${n} ${plural(n, 'раз', 'рази', 'разів')}`)].join('\n');
}
REMINDER_PROVIDERS.push(() => {
  const tdy = today(), dow = parseYmd(tdy).getDay(), sun = addDays(tdy, (7 - dow) % 7);
  const w = weekStats(mondayOf(sun));
  return [0, 7].map(k => { const d = addDays(sun, k); const t = parseYmd(d); t.setHours(19, 0, 0, 0);
    return { id: 'week-' + d, at: t.getTime(), title: '📊 Підсумок тижня', text: k ? 'Подивись, як минув тиждень' : `Витрачено ${money(w.exp)}${w.goals.length ? ` · цілі: ${w.goals.filter(x => x.n).length} з ${w.goals.length}` : ''}. Натисни, щоб побачити все`, page: 'week' }; });
});
window.__openPage = p => { if (PAGES[p]) { if (Lock.locked) { window.__afterUnlock = () => navigate(p); return; } navigate(p); } };

Object.assign(A, {
  billNew: () => billSheet(),
  billEdit: d => billSheet(d.id),
  billCat: (d, el) => { $$('#bCats .chip').forEach(c => c.classList.toggle('on', c === el)); },
  billSave: d => {
    const r = $('#sheetBody'), amount = num($('#bAmount', r).value), name = $('#bName', r).value.trim(), next = $('#bNext', r).value;
    if (!(amount > 0)) return invalid('bAmount', 'Вкажіть суму');
    if (!name) return invalid('bName', 'Що це за платіж?');
    if (!isDate(next)) return invalid('bNext', 'Оберіть дату');
    const cat = ($('#bCats .chip.on', r) || {}).dataset ? $('#bCats .chip.on', r).dataset.cat : 'other';
    const data = { name: name.slice(0, 60), amount: round2(amount), per: segVal(r, 'bPer') || 'month', next, cat };
    if (d.id) Object.assign(S.bills.find(x => x.id === d.id), data); else S.bills.push({ id: uid(), paid: [], ...data });
    ensureNotifPermission(); save(); closeSheet(); render(); toast('Збережено — нагадаю за 3 дні');
  },
  billPay: d => {
    const b = S.bills.find(x => x.id === d.id); if (!b) return;
    const tx = Fin.add({ type: 'exp', amount: b.amount, cat: b.cat, note: b.name + ' (регулярний платіж)', date: today() });
    b.paid = (b.paid || []).concat([{ date: today(), txId: tx.id }]).slice(-24);
    let nx = nextRepeat(b.next, b.per); while (nx <= today()) nx = nextRepeat(nx, b.per); b.next = nx;
    save(); closeSheet(); render(); toast(`✓ ${b.name} оплачено · наступний раз ${shortDate(nx)}`);
  },
  billDel: async d => {
    const b = S.bills.find(x => x.id === d.id);
    if (!await ask({ title: `Видалити «${b.name}»?`, text: 'Записані раніше витрати залишаться.', ok: 'Видалити', danger: true })) return;
    S.bills = S.bills.filter(x => x.id !== d.id); save(); closeSheet(); render();
  },
  receiptStart: () => startReceipt(),
  receiptCat: (d, el) => { $$('#rcCats .chip').forEach(c => c.classList.toggle('on', c === el)); },
  receiptSave: () => {
    const r = $('#sheetBody'), total = num($('#rcTotal', r).value); if (!(total > 0)) return invalid('rcTotal', 'Вкажіть суму');
    const store = $('#rcStore', r).value.trim(), date = $('#rcDate', r).value || today(), cat = ($('#rcCats .chip.on', r) || { dataset: { cat: 'food' } }).dataset.cat;
    const items = (U.rc && U.rc.r && U.rc.r.items) || [];
    const note = (store + (items.length ? ': ' + items.slice(0, 6).map(i => i.name).join(', ') + (items.length > 6 ? '…' : '') : '')).slice(0, 200) || 'Чек';
    const tx = Fin.add({ type: 'exp', amount: total, cat, note, date, photo: U.rc ? U.rc.photo : '' });
    U.rc = null; save(); closeSheet(); render(); toast(`Витрату ${money(total)} записано`); Fin.checkBudget && Fin.checkBudget(tx);
  },
  weekShare: d => shareText(weekText(d.id))
});
