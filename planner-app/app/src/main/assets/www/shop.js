'use strict';
/* =====================================================================
   Покупки: список покупок. Товари з «Вигідних продуктів» мають магазин, упаковку, ціну й посилання.
   item: {id, name, qty, buy, price, dish, store, url, bought}
   ===================================================================== */
U.shopGroup = 'store';

function vShop() {
  const toBuy = S.shop.filter(i => !i.bought), bought = S.shop.filter(i => i.bought);
  const sumToBuy = toBuy.reduce((a, i) => a + num(i.price), 0), sumBought = bought.reduce((a, i) => a + num(i.price), 0);
  const by = U.shopGroup;
  const key = i => by === 'store' ? (i.store || 'Без магазину') : (i.dish || 'Інше');
  const groups = {};
  toBuy.forEach(i => (groups[key(i)] = groups[key(i)] || []).push(i));
  const row = i => `<div class="item ${i.bought ? 'done' : ''}">
    <button class="check ${i.bought ? 'on' : ''}" data-a="shopToggle" data-id="${i.id}" aria-label="Куплено"></button>
    <div class="grow" style="min-width:0" data-a="shopEdit" data-id="${i.id}"><div class="title">${esc(i.name)}</div>
      <div class="meta ellipsis">${esc([i.qty, i.buy, by === 'store' ? (i.dish !== 'Інше' ? i.dish : '') : i.store].filter(Boolean).join(' · '))}</div></div>
    <div class="right"><div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div>
      ${i.url && !i.bought ? `<button class="small link" data-a="openLink" data-url="${esc(i.url)}">товар ↗</button>` : ''}
      ${i.bought ? `<button class="small link" data-a="favFromShop" data-id="${i.id}" aria-label="В улюблені">❤️ в улюблені</button>` : ''}</div></div>`;
  return `
    <div class="sumline">
      <div><span>До сплати</span><b>≈ ${money(sumToBuy)}</b></div>
      <div><span>Товарів</span><b>${toBuy.length}</b></div>
      <div><span>У кошику</span><b>${bought.length}</b></div>
      <div><span>Кошик, сума</span><b>${money(sumBought)}</b></div>
    </div>
    <div class="row between" style="margin:0 2px 8px">
      <button class="chip card-bg" data-a="go" data-page="prices">🔎 Продукти для страви</button>
      ${toBuy.length ? `<button class="chip card-bg" data-a="shopGroup">⇅ ${by === 'store' ? 'Магазини' : 'Страви'}</button>` : ''}
    </div>
    ${!S.shop.length ? emptyCard('🛒', 'Список покупок порожній.<br>Додайте товар «+» або складіть список для страви з реальними цінами магазинів.', { label: 'Підібрати продукти для страви', attrs: 'data-a="go" data-page="prices"' }) : ''}
    ${Object.entries(groups).map(([g, l]) => `<div class="group-h"><span>${by === 'store' ? (g === 'Без магазину' ? '🛒 ' : '🏪 ') : '🍽 '}${esc(g)}</span><span>${money(l.reduce((a, i) => a + num(i.price), 0))}</span></div>
      <div class="list">${l.map(row).join('')}</div>`).join('')}
    ${bought.length ? `<div class="group-h"><span>✅ У кошику</span><span>${money(sumBought)}</span></div><div class="list">${bought.map(row).join('')}</div>
      <div class="btns two"><button class="btn ghost card-btn" data-a="shopClear">Прибрати куплене</button><button class="btn" data-a="shopToExpense">Записати у витрати</button></div>` : ''}`;
}
function shopSheet(id) {
  const i = S.shop.find(x => x.id === id) || { name: '', qty: '', buy: '', price: '', dish: '', store: '', url: '' };
  openSheet(`
    <h2>${id ? 'Товар' : 'Додати товар'}</h2>
    <div class="field"><input class="input" id="sName" maxlength="80" placeholder="Назва (напр. Молоко)" value="${esc(i.name)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Кількість</label><input class="input" id="sQty" maxlength="40" placeholder="1 л" value="${esc(i.qty)}"></div>
      <div class="field grow"><label>Ціна, ₴</label><input class="input" id="sPrice" inputmode="decimal" placeholder="0" value="${i.price || ''}"></div>
    </div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Магазин</label><input class="input" id="sStore" maxlength="40" placeholder="Будь-який" value="${esc(i.store || '')}"></div>
      <div class="field grow"><label>Для чого</label><input class="input" id="sDish" maxlength="60" placeholder="Інше" value="${esc(i.dish)}"></div>
    </div>
    ${i.buy ? `<div class="small muted" style="margin:-4px 4px 10px">Товар: ${esc(i.buy)}${i.url ? ` · <b class="link" data-a="openLink" data-url="${esc(i.url)}">відкрити ↗</b>` : ''}</div>` : ''}
    ${id ? `<button class="btn ghost" style="margin-bottom:10px" data-a="favFromShop" data-id="${id}">❤️ Сподобалось — сфотографувати в улюблені</button>` : ''}
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="shopDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="shopSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#sName', r).focus(), 300); });
}
Object.assign(A, {
  shopGroup: () => { U.shopGroup = U.shopGroup === 'store' ? 'dish' : 'store'; render(); },
  shopToggle: d => { const i = S.shop.find(x => x.id === d.id); if (!i) return; i.bought = !i.bought; save(); render(); },
  shopEdit: d => shopSheet(d.id),
  shopSave: d => {
    const r = $('#sheetBody'); const name = $('#sName', r).value.trim();
    if (!name) return invalid('sName', 'Введіть назву');
    const price = num($('#sPrice', r).value);
    if (price < 0 || price > 1e7) return invalid('sPrice', 'Некоректна ціна');
    const data = { name, qty: $('#sQty', r).value.trim(), price: round2(price), dish: $('#sDish', r).value.trim() || 'Інше', store: $('#sStore', r).value.trim() };
    if (d.id) Object.assign(S.shop.find(x => x.id === d.id), data);
    else S.shop.push({ id: uid(), buy: '', url: '', bought: false, ...data });
    save(); closeSheet(); render();
  },
  shopDel: d => { S.shop = S.shop.filter(x => x.id !== d.id); save(); closeSheet(); render(); },
  shopClear: () => { S.shop = S.shop.filter(i => !i.bought); save(); render(); },
  shopToExpense: () => {
    const bought = S.shop.filter(i => i.bought);
    const sum = bought.reduce((a, i) => a + num(i.price), 0);
    if (!sum) { toast('У куплених товарів немає цін'); return; }
    const parts = [...new Set(bought.map(i => i.store).filter(Boolean))].concat([...new Set(bought.map(i => i.dish).filter(x => x && x !== 'Інше'))]);
    const tx = Fin.add({ type: 'exp', amount: sum, cat: 'food', note: ('Покупки' + (parts.length ? ': ' + parts.join(', ') : '')).slice(0, 200) });
    S.shop = S.shop.filter(i => !i.bought);
    save(); toast(`Витрату ${money(sum)} записано`); U.seg.fin = 'overview'; U.finOff = 0; go('finance'); Fin.checkBudget(tx);
  }
});

VIEWS.shop = () => vShop();
FABS.shop = () => shopSheet();
