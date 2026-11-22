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
  return `<div class="item ${i.bought ? 'done' : ''}" data-id="${i.id}" data-swr="shopToggle" data-swl="shopDel">
    <button class="check ${i.bought ? 'on' : ''}" data-a="shopToggle" data-id="${i.id}" aria-label="Куплено"></button>
    <div class="grow" style="min-width:0" data-a="shopEdit" data-id="${i.id}"><div class="title">${esc(i.name)}</div>
      <div class="meta ellipsis">${esc([i.qty, i.store, i.buy, showDish && i.dish !== 'Інше' ? i.dish : ''].filter(Boolean).join(' · '))}</div></div>
    <div class="right"><div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div>
      ${i.url && !i.bought ? goLink(i.url) : ''}</div></div>`;
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
  return `<div class="sum-tiles">
      <div class="card st-pay"><span>До сплати</span><b>≈ ${money(sumToBuy)}</b><small>${toBuy.length} ${plural(toBuy.length, 'товар', 'товари', 'товарів')}${extra}</small></div>
      <div class="card st-cart"><span>У кошику</span><b>${money(sumBought)}</b><small>${bought.length} з ${list.length}</small></div></div>`;
}
function boughtActions() {
  return S.shop.some(i => i.bought) ? `<div class="btns two"><button class="btn ghost card-btn" data-a="shopClear">Прибрати куплене</button><button class="btn" data-a="shopToExpense">Записати у витрати</button></div>` : '';
}
function vShop() {
  const toBuy = S.shop.filter(i => !i.bought);
  const merged = mergedItems(toBuy);
  const mergedCount = U.shopMerge && merged.length < toBuy.length ? ` → ${merged.length}` : '';
  const head = `${shopReceipt(S.shop, U.shopMode === 'all' ? mergedCount : '')}
      <div class="sum-acts"><button class="chip card-bg grow" data-a="go" data-page="prices">🔎 Для страви</button><button class="chip card-bg grow" data-a="scanStart">📷 Сканувати цінник</button>
        ${U.shopMode === 'all' && toBuy.length ? `<button class="chip ${U.shopMerge ? 'on' : 'card-bg'}" data-a="shopMerge">🔗 ${U.shopMerge ? 'Обʼєднано' : 'Обʼєднати'}</button>` : ''}</div>
    <div class="seg"><button data-a="shopMode" data-v="dishes" class="${U.shopMode === 'dishes' ? 'on' : ''}">Страви</button><button data-a="shopMode" data-v="all" class="${U.shopMode === 'all' ? 'on' : ''}">Усі продукти</button></div>`;
  if (!S.shop.length) return head + emptyCard('🛒', 'Список покупок порожній.<br>Додайте товар «+» або складіть список для страви з реальними цінами магазинів.', { label: 'Підібрати продукти для страви', attrs: 'data-a="go" data-page="prices"' });
  if (U.shopMode === 'dishes') {
    return head + `<div class="list">${shopDishes().map(d => `<div class="item" data-a="go" data-page="shopDish" data-id="${esc(d.name)}">
      <div class="emoji">${dishEmoji(d.name)}</div>
      <div class="grow" style="min-width:0"><div class="title ellipsis">${esc(d.name)}</div>
        <div class="meta">${d.bought}/${d.total} куплено${d.left ? ' · ' + money(d.left) : d.bought === d.total ? ' · усе є ✓' : ''}</div>
        ${progressBar(d.bought / d.total * 100, 'var(--green)')}</div><button class="del-btn" data-a="shopDishDel" data-id="${esc(d.name)}" aria-label="Прибрати страву">${ICONS.trash}</button></div>`).join('')}</div>
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
    title: name, html: `${shopReceipt(items)}
    <div class="list">${toBuy.map(i => itemRow(i, false)).join('')}${!toBuy.length ? '<div class="item muted">Усе куплено ✓</div>' : ''}</div>
    ${bought.length ? `<div class="group-h"><span>✅ У кошику</span><span>${money(bought.reduce((a, i) => a + num(i.price), 0))}</span></div><div class="list">${bought.map(i => itemRow(i, false)).join('')}</div>` : ''}
    <div class="btns ${rec ? 'two' : ''}"><button class="btn ghost card-btn" data-a="shopDishDel" data-id="${esc(name)}">Прибрати страву</button>
      ${rec ? `<button class="btn" data-a="dpOpen" data-id="${rec.id}">Рецепт і ціни</button>` : ''}</div>`
  };
};
FABS.shopDish = () => { const top = U.stack[U.stack.length - 1]; shopSheet(null, top.p.id); };

/* ---------- new item: what + how much → search the stores → pick the cheapest ---------- */
U.sf = null; // {dish, loading, done, total, offers, err}
function shopAddSheet(presetDish) {
  U.sf = { dish: presetDish && presetDish !== 'Інше' ? presetDish : '', loading: false, offers: null, err: '' };
  openSheet(`<h2>Додати товар</h2>
    <div class="row" style="gap:10px">
      <div class="field grow"><input class="input" id="sfName" maxlength="80" placeholder="Що купити?"></div>
      <div class="field" style="width:34%"><input class="input" id="sfQty" maxlength="30" placeholder="Скільки?"></div></div>
    <button class="btn" data-a="shopFind">🔎 Знайти, де найдешевше</button>
    <div id="sfRes"></div>
    <button class="link small" style="display:block;margin:12px auto 2px" data-a="shopAddPlain">Додати без пошуку ціни</button>`,
    r => setTimeout(() => $('#sfName', r).focus(), 300));
}
function sfResHtml() {
  const f = U.sf; if (!f) return '';
  if (f.loading) return `<div class="sf-load"><div class="spinner"></div><span>Шукаю в магазинах… ${f.total ? `${f.done} з ${f.total}` : ''}</span></div>`;
  if (f.err) return `<div class="hint" style="margin-top:12px">${esc(f.err)}</div>`;
  if (!f.offers) return '';
  if (!f.offers.length) return `<div class="hint" style="margin-top:12px">Нічого не знайдено. Спробуйте іншу назву (напр. «молоко 2,5%»).</div>`;
  return `<div class="small muted" style="margin:14px 4px 6px">Від найдешевшого — натисніть, щоб додати:</div>
    <div class="list flat sf-list">${f.offers.map((o, k) => `<button class="item sf-offer ${k === 0 ? 'best' : ''}" data-a="shopPick" data-k="${k}">
      ${o.img ? `<img class="sf-img" src="${esc(o.img)}" alt="" loading="lazy">` : '<div class="emoji sm">🛒</div>'}
      <div class="grow" style="min-width:0;text-align:left"><div class="title ellipsis">${esc(o.title)}</div>
        <div class="meta">${storeBadge(o.store)} · ${esc(o.buy)}${o.inStock === false ? ' · немає в наявності' : ''}</div></div>
      <div class="right"><div class="amount">${money(o.cost)}</div>${k === 0 ? '<span class="pill green">найдешевше</span>' : ''}</div></button>`).join('')}</div>`;
}
const sfPaint = () => { const el = $('#sfRes'); if (el) el.innerHTML = sfResHtml(); };

function shopSheet(id, presetDish) {
  if (!id) return shopAddSheet(presetDish);
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
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="shopDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="shopSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#sName', r).focus(), 300); });
}
Object.assign(A, {
  shopFind: async () => {
    const f = U.sf; if (!f || f.loading) return;
    const name = $('#sfName').value.trim(); if (!name) return invalid('sfName', 'Що купити?');
    const qty = $('#sfQty').value.trim();
    f.name = name; f.qty = qty; f.loading = true; f.err = ''; f.offers = null; f.done = 0; f.total = 0; sfPaint();
    await Dir.load().catch(() => { });
    const stores = enabledStores(), ing = normIngredient({ name, amount: qty || '1 шт' });
    if (!qty) { ing.grams = 0; ing.count = 1; }
    f.total = stores.length; const all = [];
    await pool(stores.map(st => async () => {
      try {
        const list = await fetchOffers(st, searchSpec(ing).query);
        bestOffers(list, ing).slice(0, 3).forEach(o => all.push({ ...o, store: st.name }));
      } catch (e) { }
    }), 6, () => { f.done++; sfPaint(); });
    f.loading = false;
    f.offers = all.sort((a, b) => (a.inStock === false) - (b.inStock === false) || a.cost - b.cost).slice(0, 12);
    if (!all.length && !navigator.onLine) f.err = 'Немає інтернету — не вдалося отримати ціни.';
    sfPaint();
  },
  shopPick: d => {
    const f = U.sf, o = f && f.offers && f.offers[+d.k]; if (!o) return;
    S.shop.push({ id: uid(), name: f.name, qty: o.buy || f.qty, buy: o.title, price: o.cost, dish: f.dish || 'Інше', store: o.store, url: o.url || '', bought: false });
    save(); closeSheet(); render(); toast(`Додано: ${f.name} · ${o.store} · ${money(o.cost)}`);
  },
  shopAddPlain: () => {
    const name = $('#sfName').value.trim(); if (!name) return invalid('sfName', 'Що купити?');
    S.shop.push({ id: uid(), name, qty: $('#sfQty').value.trim(), buy: '', price: 0, dish: (U.sf && U.sf.dish) || 'Інше', store: '', url: '', bought: false });
    save(); closeSheet(); render(); toast('Додано до покупок');
  },
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
    S.shop = S.shop.filter(i => dishOf(i) !== d.id); save();
    const top = U.stack[U.stack.length - 1]; if (top && top.page === 'shopDish') back(); else render();
    toast('Страву прибрано зі списку');
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
