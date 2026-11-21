'use strict';
/* =====================================================================
   Покупки: список покупок. Товари з «Вигідних продуктів» мають магазин, упаковку, ціну й посилання.
   item: {id, name, qty, buy, price, dish, store, url, bought}
   ===================================================================== */
U.shopMode = 'dishes'; // 'dishes' | 'all'
U.shopMerge = true;

const DISH_EMOJI = [['борщ', '🍲'], ['вареник', '🥟'], ['пельмен', '🥟'], ['олів', '🥗'], ['салат', '🥗'], ['цезар', '🥗'], ['сирник', '🥞'], ['млин', '🥞'],
  ['налисник', '🥞'], ['паст', '🍝'], ['карбонар', '🍝'], ['спагет', '🍝'], ['плов', '🍛'], ['рис', '🍛'], ['суп', '🍜'], ['юшк', '🍜'], ['піц', '🍕'],
  ['запіканк', '🥧'], ['пиріг', '🥧'], ['торт', '🎂'], ['голубц', '🥬'], ['котлет', '🍖'], ['шашлик', '🍢'], ['риб', '🐟'], ['курк', '🍗'], ['кур', '🍗']];
function dishEmoji(name) {
  if (!name || name === 'Інше') return '🛒';
  if (name === 'Улюблене') return '❤️';
  const n = name.toLowerCase().replace(/[ʼ'’]/g, '');
  const m = DISH_EMOJI.find(([k]) => n.includes(k.replace(/[ʼ'’]/g, '')));
  return m ? m[1] : '🍽';
}
const dishOf = i => i.dish || 'Інше';
/** Shopping items grouped by dish: [{name, items, toBuy, bought, sum, left}] — dishes first, «Інше» last. */
function shopDishes() {
  const g = {};
  S.shop.forEach(i => (g[dishOf(i)] = g[dishOf(i)] || []).push(i));
  return Object.entries(g).map(([name, items]) => {
    const bought = items.filter(i => i.bought).length;
    return { name, items, bought, total: items.length, left: round2(items.filter(i => !i.bought).reduce((a, i) => a + num(i.price), 0)) };
  }).sort((a, b) => (a.name === 'Інше') - (b.name === 'Інше') || (a.bought === a.total) - (b.bought === b.total) || a.name.localeCompare(b.name, 'uk'));
}
/** Same products across dishes → one row. Key ignores case and text in brackets. */
const mergeKey = n => String(n || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[ʼ'’]/g, '').replace(/\s+/g, ' ').trim();
function mergedItems(list) {
  if (!U.shopMerge) return list.map(i => ({ key: i.id, items: [i] }));
  const g = new Map();
  list.forEach(i => { const k = mergeKey(i.name); if (!g.has(k)) g.set(k, { key: k, items: [] }); g.get(k).items.push(i); });
  return [...g.values()];
}
function itemRow(i, showDish) {
  return `<div class="item ${i.bought ? 'done' : ''}">
    <button class="check ${i.bought ? 'on' : ''}" data-a="shopToggle" data-id="${i.id}" aria-label="Куплено"></button>
    <div class="grow" style="min-width:0" data-a="shopEdit" data-id="${i.id}"><div class="title">${esc(i.name)}</div>
      <div class="meta ellipsis">${esc([i.qty, i.store, i.buy, showDish && i.dish !== 'Інше' ? i.dish : ''].filter(Boolean).join(' · '))}</div></div>
    <div class="right"><div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div>
      ${i.url && !i.bought ? `<button class="small link" data-a="openLink" data-url="${esc(i.url)}">товар ↗</button>` : ''}
      ${i.bought ? `<button class="small link" data-a="favFromShop" data-id="${i.id}" aria-label="В улюблені">❤️ в улюблені</button>` : ''}</div></div>`;
}
function mergedRow(m) {
  if (m.items.length === 1) return itemRow(m.items[0], true);
  const done = m.items.every(i => i.bought), dishes = [...new Set(m.items.map(dishOf))];
  const sum = m.items.reduce((a, i) => a + num(i.price), 0);
  const stores = [...new Set(m.items.map(i => i.store).filter(Boolean))];
  return `<div class="item ${done ? 'done' : ''}">
    <button class="check ${done ? 'on' : ''}" data-a="shopToggleMany" data-ids="${m.items.map(i => i.id).join(',')}" aria-label="Куплено"></button>
    <div class="grow" style="min-width:0" data-a="shopMergedEdit" data-ids="${m.items.map(i => i.id).join(',')}">
      <div class="title">${esc(m.items[0].name.replace(/\s*\(.*?\)/g, ''))} <span class="pill blue">×${dishes.length > 1 ? dishes.length + ' ' + plural(dishes.length, 'страва', 'страви', 'страв') : m.items.length}</span></div>
      <div class="meta ellipsis">${esc(m.items.map(i => i.qty).filter(Boolean).join(' + '))}${stores.length ? ' · ' + esc(stores.join(', ')) : ''}</div>
      <div class="meta ellipsis">${esc(dishes.join(' · '))}</div></div>
    <div class="right"><div class="amount">${sum ? money(sum) : ''}</div></div></div>`;
}
function shopReceipt(list, extra = '') {
  const toBuy = list.filter(i => !i.bought), bought = list.filter(i => i.bought);
  const sumToBuy = toBuy.reduce((a, i) => a + num(i.price), 0), sumBought = bought.reduce((a, i) => a + num(i.price), 0);
  return `<div class="card receipt">
      <div class="rc-row"><span>Товарів у списку</span><b>${toBuy.length}${extra}</b></div>
      <div class="rc-row"><span>У кошику</span><b>${bought.length} · ${money(sumBought)}</b></div>
      <div class="rc-cut"></div>
      <div class="rc-row rc-total"><b>До сплати</b><b>≈ ${money(sumToBuy)}</b></div>`;
}
function boughtActions() {
  return S.shop.some(i => i.bought) ? `<div class="btns two"><button class="btn ghost card-btn" data-a="shopClear">Прибрати куплене</button><button class="btn" data-a="shopToExpense">Записати у витрати</button></div>` : '';
}
function vShop() {
  const toBuy = S.shop.filter(i => !i.bought);
  const merged = mergedItems(toBuy);
  const mergedCount = U.shopMerge && merged.length < toBuy.length ? ` → ${merged.length} після обʼєднання` : '';
  const head = `${shopReceipt(S.shop, U.shopMode === 'all' ? mergedCount : '')}
      <div class="rc-links"><button class="link" data-a="go" data-page="prices">🔎 Продукти для страви</button>
        ${U.shopMode === 'all' && toBuy.length ? `<button class="link" data-a="shopMerge">🔗 ${U.shopMerge ? 'Обʼєднано' : 'Обʼєднати однакові'}</button>` : ''}</div>
    </div>
    <div class="seg"><button data-a="shopMode" data-v="dishes" class="${U.shopMode === 'dishes' ? 'on' : ''}">🍽 Страви</button><button data-a="shopMode" data-v="all" class="${U.shopMode === 'all' ? 'on' : ''}">🧺 Усі продукти</button></div>`;
  if (!S.shop.length) return head + emptyCard('🛒', 'Список покупок порожній.<br>Додайте товар «+» або складіть список для страви з реальними цінами магазинів.', { label: 'Підібрати продукти для страви', attrs: 'data-a="go" data-page="prices"' });
  if (U.shopMode === 'dishes') {
    return head + `<div class="list">${shopDishes().map(d => `<div class="item" data-a="go" data-page="shopDish" data-id="${esc(d.name)}">
      <div class="emoji">${dishEmoji(d.name)}</div>
      <div class="grow" style="min-width:0"><div class="title ellipsis">${esc(d.name)}</div>
        <div class="meta">${d.bought}/${d.total} куплено${d.left ? ' · ' + money(d.left) : d.bought === d.total ? ' · усе є ✓' : ''}</div>
        ${progressBar(d.bought / d.total * 100, 'var(--green)')}</div><span class="muted">›</span></div>`).join('')}</div>
      <div class="small muted" style="margin:6px">Натисніть на страву, щоб відкрити її список. «Усі продукти» — однакові продукти з різних страв обʼєднано.</div>
      ${boughtActions()}`;
  }
  const bought = S.shop.filter(i => i.bought);
  return head + `${merged.length ? `<div class="list">${merged.map(mergedRow).join('')}</div>` : `<div class="card empty" style="padding:20px">Усе куплено ✓</div>`}
    ${bought.length ? `<div class="group-h"><span>✅ У кошику</span><span>${money(bought.reduce((a, i) => a + num(i.price), 0))}</span></div><div class="list">${mergedItems(bought).map(mergedRow).join('')}</div>` : ''}
    ${boughtActions()}`;
}

PAGES.shopDish = p => {
  const name = p.id, items = S.shop.filter(i => dishOf(i) === name);
  if (!items.length) return null;
  const rec = S.recipes.find(r => r.dish.toLowerCase() === name.toLowerCase());
  const toBuy = items.filter(i => !i.bought), bought = items.filter(i => i.bought);
  return {
    title: name, html: `${shopReceipt(items)}</div>
    <div class="list">${toBuy.map(i => itemRow(i, false)).join('')}${!toBuy.length ? '<div class="item muted">Усе куплено ✓</div>' : ''}</div>
    ${bought.length ? `<div class="group-h"><span>✅ У кошику</span><span>${money(bought.reduce((a, i) => a + num(i.price), 0))}</span></div><div class="list">${bought.map(i => itemRow(i, false)).join('')}</div>` : ''}
    <div class="btns ${rec ? 'two' : ''}"><button class="btn ghost card-btn" data-a="shopDishDel" data-id="${esc(name)}">Прибрати страву</button>
      ${rec ? `<button class="btn" data-a="dpOpen" data-id="${rec.id}">Рецепт і ціни</button>` : ''}</div>`
  };
};
FABS.shopDish = () => { const top = U.stack[U.stack.length - 1]; shopSheet(null, top.p.id); };

function shopSheet(id, presetDish) {
  const i = S.shop.find(x => x.id === id) || { name: '', qty: '', buy: '', price: '', dish: presetDish && presetDish !== 'Інше' ? presetDish : '', store: '', url: '' };
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
  shopMode: d => { U.shopMode = d.v; render(); },
  shopMerge: () => { U.shopMerge = !U.shopMerge; render(); },
  shopToggleMany: d => {
    const ids = d.ids.split(','), list = S.shop.filter(i => ids.includes(i.id)), to = !list.every(i => i.bought);
    list.forEach(i => { i.bought = to; }); save(); render();
  },
  shopMergedEdit: d => {
    const ids = d.ids.split(','), list = S.shop.filter(i => ids.includes(i.id));
    openSheet(`<h2>${esc(list[0].name.replace(/\s*\(.*?\)/g, ''))}</h2><div class="small muted" style="margin:-8px 0 12px">Обʼєднано з ${list.length} позицій</div>
      <div class="list flat">${list.map(i => `<div class="item" data-a="shopEdit" data-id="${i.id}"><div class="emoji sm">${dishEmoji(dishOf(i))}</div>
        <div class="grow"><div class="title">${esc(dishOf(i))}</div><div class="meta">${esc([i.qty, i.store].filter(Boolean).join(' · '))}</div></div>
        <div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div></div>`).join('')}</div>`);
  },
  shopDishDel: async d => {
    const n = S.shop.filter(i => dishOf(i) === d.id).length;
    if (!await ask({ title: `Прибрати «${d.id}»?`, text: `${n} ${plural(n, 'товар', 'товари', 'товарів')} буде видалено зі списку покупок.`, ok: 'Прибрати', danger: true })) return;
    S.shop = S.shop.filter(i => dishOf(i) !== d.id); save(); back(); toast('Страву прибрано зі списку');
  },
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
