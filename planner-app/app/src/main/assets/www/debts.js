'use strict';
/* =====================================================================
   Фінанси → Борги: хто кому винен, часткові повернення, нагадування на дату.
   debt: {id, who, amount, dir:'in' (мені винні) | 'out' (я винна), date, due, note, pays:[{id, amount, date}], closed}
   ===================================================================== */
const Debts = {
  paid: d => round2((d.pays || []).reduce((a, p) => a + p.amount, 0)),
  left: d => Math.max(0, round2(d.amount - Debts.paid(d))),
  open: () => S.debts.filter(d => !d.closed),
  total: dir => round2(Debts.open().filter(d => d.dir === dir).reduce((a, d) => a + Debts.left(d), 0))
};

function debtRow(d) {
  const left = Debts.left(d), pct = d.amount ? Debts.paid(d) / d.amount * 100 : 0, tdy = today();
  const over = !d.closed && d.due && d.due < tdy;
  return `<div class="item" data-a="debtOpen" data-id="${d.id}">
    <div class="emoji sm">${d.dir === 'in' ? '🫴' : '🤝'}</div>
    <div class="grow" style="min-width:0"><div class="title ellipsis">${esc(d.who)}</div>
      <div class="meta">${d.closed ? 'Повернуто ✓' : d.due ? `<span class="pill ${over ? 'red' : ''}">${over ? 'Прострочено · ' : 'до '}${dateLabel(d.due, false)}</span>` : shortDate(d.date)}${d.note ? ` · <span class="ellipsis">${esc(d.note)}</span>` : ''}</div>
      ${!d.closed && pct > 0 ? progressBar(pct, 'var(--green)') : ''}</div>
    <div class="right"><div class="amount ${d.dir === 'in' ? 'green' : ''}">${money(d.closed ? d.amount : left)}</div>${!d.closed && pct > 0 ? `<div class="small muted">з ${money(d.amount)}</div>` : ''}</div></div>`;
}

function vFinDebts() {
  const open = Debts.open(), closed = S.debts.filter(d => d.closed);
  const ins = open.filter(d => d.dir === 'in'), outs = open.filter(d => d.dir === 'out');
  return `
    <div class="sum-tiles">
      <div class="card"><span>Мені винні</span><b class="green">${money(Debts.total('in'))}</b><small>${ins.length} ${plural(ins.length, 'борг', 'борги', 'боргів')}</small></div>
      <div class="card"><span>Я винна</span><b>${money(Debts.total('out'))}</b><small>${outs.length} ${plural(outs.length, 'борг', 'борги', 'боргів')}</small></div></div>
    ${!S.debts.length ? emptyCard('🤝', 'Боргів немає. Запишіть, хто кому скільки винен — і ЛАД нагадає про повернення.', { label: '+ Додати борг', attrs: 'data-a="debtNew"' }) : ''}
    ${ins.length ? `<div class="group-h"><span>🫴 Мені винні</span><span>${money(Debts.total('in'))}</span></div><div class="list">${ins.map(debtRow).join('')}</div>` : ''}
    ${outs.length ? `<div class="group-h"><span>🤝 Я винна</span><span>${money(Debts.total('out'))}</span></div><div class="list">${outs.map(debtRow).join('')}</div>` : ''}
    ${closed.length ? `<details class="card" style="padding:4px 14px"><summary class="small muted" style="padding:10px 0">Повернуті (${closed.length})</summary><div class="list flat">${closed.map(debtRow).join('')}</div></details>` : ''}`;
}

function debtSheet(id) {
  const d = S.debts.find(x => x.id === id) || { who: '', amount: '', dir: 'in', date: today(), due: '', note: '' };
  openSheet(`<h2>${id ? 'Редагувати борг' : 'Новий борг'}</h2>
    ${seg('dDir', [['in', 'Мені винні'], ['out', 'Я винна']], d.dir)}
    <div class="field"><input class="input big" id="dAmount" inputmode="decimal" placeholder="0 ₴" value="${d.amount || ''}"></div>
    <div class="field"><input class="input" id="dWho" maxlength="60" placeholder="Хто (імʼя)" value="${esc(d.who)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Коли</label><input type="date" class="input" id="dDate" value="${d.date}"></div>
      <div class="field grow"><label>Повернути до</label><input type="date" class="input" id="dDue" value="${d.due || ''}"></div></div>
    <div class="field"><input class="input" id="dNote" maxlength="200" placeholder="За що (необовʼязково)" value="${esc(d.note || '')}"></div>
    <div class="btns ${id ? 'two' : ''}">${id ? `<button class="btn danger" data-a="debtDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="debtSave" data-id="${id || ''}">Зберегти</button></div>`, r => { if (!id) setTimeout(() => $('#dAmount', r)?.focus(), 300); });
}

PAGES.debt = p => {
  const d = S.debts.find(x => x.id === p.id); if (!d) return null;
  const left = Debts.left(d), paid = Debts.paid(d);
  return {
    title: d.who, actions: shareBtn('debtShare', d.id), html: `
    <div class="card" style="text-align:center;padding:22px 16px">
      <div class="small muted">${d.dir === 'in' ? `${esc(d.who)} винен(-на) вам` : `Ви винні ${esc(d.who)}`}</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:-.6px;margin:4px 0">${money(d.closed ? 0 : left)}</div>
      <div class="small muted">з ${money(d.amount)}${paid ? ` · повернуто ${money(paid)}` : ''}</div>
      <div style="margin-top:12px">${progressBar(d.amount ? paid / d.amount * 100 : 0, 'var(--green)')}</div></div>
    <div class="card">
      <div class="kv"><span>Коли</span><b>${shortDate(d.date)}</b></div>
      ${d.due ? `<div class="kv"><span>Повернути до</span><b>${dateLabel(d.due)}</b></div>` : ''}
      ${d.note ? `<div class="kv"><span>За що</span><b>${esc(d.note)}</b></div>` : ''}</div>
    ${!d.closed ? `<div class="btns two"><button class="btn ghost card-btn" data-a="debtPay" data-id="${d.id}">Частково</button><button class="btn" data-a="debtClose" data-id="${d.id}">Повернуто все</button></div>` : `<div class="card empty" style="padding:16px">✅ Борг закрито</div>`}
    ${(d.pays || []).length ? `<h2>Повернення</h2><div class="list">${d.pays.slice().reverse().map(p => `<div class="item"><div class="emoji sm">💸</div><div class="grow"><div class="title">${money(p.amount)}</div><div class="meta">${shortDate(p.date)}</div></div></div>`).join('')}</div>` : ''}
    <div class="btns" style="margin-top:12px"><button class="btn ghost card-btn" data-a="debtEdit" data-id="${d.id}">Редагувати</button></div>`
  };
};

function debtText(d) {
  const left = Debts.left(d);
  return [d.dir === 'in' ? `🫴 ${d.who} винен(-на) мені ${money(left)}` : `🤝 Я винна ${d.who} ${money(left)}`,
    d.amount !== left ? `(з ${money(d.amount)}, вже повернуто ${money(Debts.paid(d))})` : '',
    d.due ? `Повернути до ${dateLabel(d.due)}` : '', d.note ? `За: ${d.note}` : ''].filter(Boolean).join('\n');
}

REMINDER_PROVIDERS.push(() => Debts.open().filter(d => d.due).map(d => ({
  id: 'debt-' + d.id, at: at9(d.due, 10), title: d.dir === 'in' ? '🫴 Час повернути борг вам' : '🤝 Час повернути борг',
  text: `${d.who} · ${money(Debts.left(d))}`
})));

Object.assign(A, {
  debtNew: () => debtSheet(),
  debtOpen: d => navigate('debt', { id: d.id }),
  debtEdit: d => debtSheet(d.id),
  debtShare: d => { const x = S.debts.find(y => y.id === d.id); if (x) shareText(debtText(x)); },
  debtSave: d => {
    const r = $('#sheetBody');
    const amount = num($('#dAmount', r).value);
    if (!(amount > 0) || amount > 1e8) return invalid('dAmount', 'Вкажіть суму');
    const who = $('#dWho', r).value.trim(); if (!who) return invalid('dWho', 'Вкажіть, хто');
    const date = $('#dDate', r).value || today(), due = $('#dDue', r).value;
    if (due && due < date) return invalid('dDue', 'Дата повернення раніше за дату боргу');
    const data = { who: who.slice(0, 60), amount: round2(amount), dir: segVal(r, 'dDir') || 'in', date, due, note: $('#dNote', r).value.trim().slice(0, 200) };
    if (d.id) { const x = S.debts.find(y => y.id === d.id); Object.assign(x, data); x.closed = Debts.left(x) <= 0; }
    else S.debts.unshift({ id: uid(), pays: [], closed: false, ...data });
    if (due) ensureNotifPermission();
    save(); closeSheet(); render(); toast('Збережено');
  },
  debtPay: async d => {
    const x = S.debts.find(y => y.id === d.id); if (!x) return;
    const v = await askNumber({ title: 'Скільки повернули?', hint: `Залишок ${money(Debts.left(x))}` }); if (v == null) return;
    if (v > Debts.left(x) + 0.001) { toast('Більше за залишок'); return; }
    x.pays = x.pays || []; x.pays.push({ id: uid(), amount: round2(v), date: today() });
    if (Debts.left(x) <= 0) { x.closed = true; toast('🎉 Борг повністю повернуто'); } else toast('Записано');
    save(); render();
  },
  debtClose: async d => {
    const x = S.debts.find(y => y.id === d.id); if (!x) return;
    if (!await ask({ title: 'Борг повернуто повністю?', text: `${x.who} · ${money(Debts.left(x))}`, ok: 'Так, закрити' })) return;
    const rest = Debts.left(x); if (rest > 0) { x.pays = x.pays || []; x.pays.push({ id: uid(), amount: rest, date: today() }); }
    x.closed = true; save(); render(); toast('🎉 Борг закрито');
  },
  debtDel: async d => {
    const x = S.debts.find(y => y.id === d.id);
    if (!await ask({ title: `Видалити борг «${x.who}»?`, ok: 'Видалити', danger: true })) return;
    S.debts = S.debts.filter(y => y.id !== d.id); save(); closeSheet();
    const top = U.stack[U.stack.length - 1]; if (top && top.page === 'debt') back(); else render();
  }
});
