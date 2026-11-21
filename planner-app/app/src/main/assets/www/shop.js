'use strict';
/* =====================================================================
   Покупки: список покупок + Кухня (страва → інгредієнти → список)
   ===================================================================== */
Object.assign(U, { kitchen: null, loading: false, dish: '', servings: 2, kError: '' });

/* ================= KITCHEN (Gemini) ================= */
function vKitchen() {
  const k = U.kitchen;
  const hasKey = Keys.has();
  let body = '';
  if (U.loading) {
    body = `<div class="card empty"><div class="spinner"></div><b style="color:var(--text)">Gemini підбирає інгредієнти…</b><br><span class="small">рахуємо орієнтовні ціни в Сільпо</span></div>`;
  } else if (U.kError) {
    body = `<div class="card"><b class="red">Не вдалося отримати рецепт</b><div class="small muted" style="margin-top:6px;line-height:1.45">${esc(U.kError)}</div>
      <div class="btns two"><button class="btn ghost" data-a="settings">Налаштування</button><button class="btn" data-a="cook">Спробувати ще</button></div></div>`;
  } else if (k) {
    const missing = k.items.filter(i => !i.have);
    const sum = missing.reduce((a, i) => a + num(i.price), 0);
    body = `
      <div class="card" style="padding-bottom:10px">
        <div class="row between" style="align-items:flex-start"><div class="grow"><h3 style="font-size:20px">${esc(k.dish)}</h3>
          <div class="small muted">${k.servings} порц.${k.time ? ' · ' + esc(k.time) : ''} · ${k.items.length} інгредієнтів</div></div>
          ${k.source === 'ai' ? `<span class="ai-badge">${ICONS.spark} Gemini</span>` : `<span class="pill">Офлайн-рецепт</span>`}</div>
        <div class="small muted" style="margin-top:14px">Відмітьте, що вже є вдома 👇</div>
      </div>
      <div class="row between" style="margin:0 4px 8px"><span class="small muted">Є в холодильнику: ${k.items.length - missing.length}/${k.items.length}</span>
        <button class="chip" data-a="kAll">${missing.length ? 'Відмітити все' : 'Зняти все'}</button></div>
      <div class="list">${k.items.map((i, n) => `<div class="item ${i.have ? 'have' : ''}" data-a="kHave" data-n="${n}">
        <button class="check ${i.have ? 'on' : ''}"></button>
        <div class="grow"><div class="title">${esc(i.name)}</div><div class="meta">${esc(i.amount || '')}${i.buy && !i.have ? ` · <span class="ellipsis">${esc(i.buy)}</span>` : ''}</div></div>
        <div class="amount">${num(i.price) ? '≈' + money(num(i.price)) : ''}</div></div>`).join('')}</div>
      ${k.steps && k.steps.length ? `<details class="steps"><summary>Як готувати</summary><ol>${k.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      <div class="summary-bar"><div class="card" style="margin:0;box-shadow:0 10px 30px rgba(0,0,0,.12)">
        <div class="row between"><div><div class="small muted">Докупити ${missing.length} поз.</div><b style="font-size:20px">≈ ${money(sum)}</b></div>
        <span class="silpo">Ціни Сільпо*</span></div>
        <div class="btns" style="margin-top:12px"><button class="btn" data-a="kApprove" ${missing.length ? '' : 'disabled'}>Погодити → у список покупок</button></div>
      </div></div>
      <div class="small muted" style="margin:10px 6px">* Ціни орієнтовні та можуть відрізнятися від актуальних цін у магазині.</div>`;
  } else {
    body = `<h2>Ідеї</h2><div class="chips">${['Борщ', 'Вареники', 'Сирники', 'Олівʼє', 'Паста карбонара', 'Млинці', 'Плов', 'Голубці', 'Цезар'].map(d => `<button class="chip" style="background:var(--card);box-shadow:var(--shadow)" data-a="kIdea" data-d="${d}">${d}</button>`).join('')}</div>`;
  }
  const recent = S.dishes.slice(0, 10);
  return `
    <div class="hero">
      <div class="row between"><h3>Що готуємо?</h3><span class="ai-badge">${ICONS.spark} AI</span></div>
      <div class="small muted" style="margin-bottom:14px">Напишіть страву — покажу, що потрібно купити</div>
      <div class="field"><input class="input" id="dishInput" placeholder="Напр. борщ з пампушками" value="${esc(U.dish)}" enterkeyhint="go"></div>
      <div class="row">
        <div class="servings"><button data-a="srv" data-d="-1">−</button><b>${U.servings}</b><button data-a="srv" data-d="1">+</button></div>
        <span class="small muted grow">порції</span>
        <button class="btn sm" style="padding:13px 20px" data-a="cook" ${U.loading ? 'disabled' : ''}>Що потрібно?</button>
      </div>
      ${!hasKey ? `<div class="hint">Без ключа Gemini доступні лише кілька вбудованих рецептів. <b class="link" data-a="settings">Додайте безкоштовний ключ</b>, щоб рахувати будь-яку страву.</div>` : ''}
    </div>
    ${recent.length && !U.loading ? `<div class="recent">${recent.map(d => `<button class="chip" data-a="kOpen" data-id="${d.id}">🍽 ${esc(d.dish)}</button>`).join('')}</div>` : ''}
    ${body}`;
}

function buildPrompt(dish, servings, search) {
  return `Ти — кулінарний помічник для користувача з України.
Страва: "${dish}". Кількість порцій: ${servings}.

Склади повний список інгредієнтів, потрібних для приготування цієї страви на ${servings} порц. (включно з олією, спеціями, сіллю — користувач сам відмітить, що вже має).
Для кожного інгредієнта вкажи товар, який зазвичай продається в мережі супермаркетів «Сільпо» (Україна), у мінімальній фасовці, якої вистачить, і його орієнтовну ціну в гривнях.${search ? '\nВикористай пошук Google (бажано сайт silpo.ua), щоб уточнити актуальні ціни.' : ' Орієнтуйся на типові ціни Сільпо за останні відомі тобі дані.'}
Також дай коротку покрокову інструкцію приготування (3–8 кроків).

Відповідай ЛИШЕ валідним JSON без пояснень та без markdown, за схемою:
{"dish":"Назва страви українською","servings":${servings},"time":"~1 год","ingredients":[{"name":"Буряк","amount":"300 г","buy":"Буряк столовий, 1 кг","price":25}],"steps":["Крок 1","Крок 2"]}
"price" — число в гривнях (ціна товару "buy"), без валюти.
Якщо запит не є стравою чи напоєм, поверни {"error":"коротке пояснення українською"}.`;
}
async function askGemini(dish, servings, useSearch) {
  const body = { contents: [{ role: 'user', parts: [{ text: buildPrompt(dish, servings, useSearch) }] }], generationConfig: { temperature: 0.3 } };
  if (useSearch) body.tools = [{ google_search: {} }];
  else body.generationConfig.responseMimeType = 'application/json';
  const { text } = await gemini(body);
  return extractJson(text);
}
function findBuiltin(dish) {
  const q = dish.toLowerCase().replace(/[ʼ'’]/g, '');
  return (window.BUILTIN_RECIPES || []).find(r => r.keys.some(k => q.includes(k.replace(/[ʼ'’]/g, ''))));
}
async function cook() {
  const inp = $('#dishInput');
  if (inp) U.dish = inp.value.trim();
  if (!U.dish) { toast('Напишіть назву страви'); inp && inp.focus(); return; }
  if (document.activeElement) document.activeElement.blur();
  U.kError = ''; U.kitchen = null;

  if (!Keys.has()) {
    const b = findBuiltin(U.dish);
    if (!b) { U.kError = 'Цієї страви немає серед вбудованих рецептів (борщ, вареники, олівʼє, сирники, карбонара, млинці). Додайте безкоштовний ключ Gemini в налаштуваннях — і можна буде рахувати будь-яку страву.'; render(); return; }
    setKitchen({ dish: b.dish, servings: b.servings, time: b.time, ingredients: b.ingredients, steps: b.steps }, 'builtin');
    return;
  }
  U.loading = true; render();
  try {
    let res;
    try { res = await askGemini(U.dish, U.servings, !!S.settings.search); }
    catch (e) {
      if (S.settings.search && e.status === 400) res = await askGemini(U.dish, U.servings, false); // search not supported → retry plain
      else throw e;
    }
    if (res.error) throw new Error(res.error);
    if (!Array.isArray(res.ingredients) || !res.ingredients.length) throw new Error('Не вдалося розпізнати список інгредієнтів.');
    U.loading = false;
    setKitchen(res, 'ai');
  } catch (e) {
    U.loading = false; U.kError = e.message || String(e); render();
  }
}
function setKitchen(res, source) {
  const entry = {
    id: uid(), dish: res.dish || U.dish, servings: res.servings || U.servings, time: res.time || '', source,
    items: res.ingredients.map(i => ({ name: String(i.name || ''), amount: String(i.amount || ''), buy: String(i.buy || ''), price: num(i.price), have: false })),
    steps: Array.isArray(res.steps) ? res.steps.map(String) : [], date: today()
  };
  U.kitchen = entry;
  S.dishes = [entry, ...S.dishes.filter(d => d.dish.toLowerCase() !== entry.dish.toLowerCase())].slice(0, 15);
  save(); render();
  window.scrollTo({ top: 0 });
}
function approveKitchen() {
  const k = U.kitchen; if (!k) return;
  const missing = k.items.filter(i => !i.have);
  let added = 0, merged = 0;
  missing.forEach(i => {
    const ex = S.shop.find(s => !s.bought && s.name.toLowerCase() === i.name.toLowerCase());
    if (ex) { if (!ex.dish.includes(k.dish)) ex.dish += ', ' + k.dish; merged++; return; }
    S.shop.push({ id: uid(), name: i.name, qty: i.amount, buy: i.buy, price: num(i.price), dish: k.dish, bought: false });
    added++;
  });
  save();
  U.kitchen = null; U.dish = '';
  toast(`Додано ${added} у список покупок${merged ? ` (${merged} вже були)` : ''}`);
  U.seg.shop = 'list'; go('shop');
}

/* ================= SHOP ================= */
function vShop() {
  const toBuy = S.shop.filter(i => !i.bought);
  const bought = S.shop.filter(i => i.bought);
  const sumToBuy = toBuy.reduce((a, i) => a + num(i.price), 0);
  const sumBought = bought.reduce((a, i) => a + num(i.price), 0);
  const groups = {};
  toBuy.forEach(i => (groups[i.dish || 'Інше'] = groups[i.dish || 'Інше'] || []).push(i));
  const row = i => `<div class="item ${i.bought ? 'done' : ''}">
    <button class="check ${i.bought ? 'on' : ''}" data-a="shopToggle" data-id="${i.id}"></button>
    <div class="grow" data-a="shopEdit" data-id="${i.id}"><div class="title">${esc(i.name)}</div>
      <div class="meta">${esc([i.qty, i.buy].filter(Boolean).join(' · '))}</div></div>
    <div class="right"><div class="amount">${num(i.price) ? money(num(i.price)) : ''}</div>
      ${!i.bought ? `<button class="silpo" data-a="silpo" data-q="${esc(i.name)}">Сільпо ↗</button>` : ''}</div></div>`;
  return `
    <div class="mono" style="background:radial-gradient(120% 140% at 100% 0%, #f37021 0%, rgba(243,112,33,0) 55%), radial-gradient(120% 120% at 0% 100%, #18a058 0%, rgba(24,160,88,0) 60%), #121214">
      <div class="lbl">Орієнтовно до сплати</div>
      <div class="sum">${money(sumToBuy)}</div>
      <div class="row2"><div class="box"><div>Купити</div><div>${toBuy.length} поз.</div></div>
        <div class="box"><div>В кошику</div><div>${bought.length} · ${money(sumBought)}</div></div></div>
    </div>
    ${!S.shop.length ? `<div class="card empty"><div class="big">🛒</div>Список покупок порожній.<br>Додайте вручну «+» або через розділ <b class="link" data-a="useg" data-key="shop" data-val="kitchen">Кухня</b>.</div>` : ''}
    ${Object.entries(groups).map(([g, l]) => `<div class="group-h"><span>🍽 ${esc(g)}</span><span>${money(l.reduce((a, i) => a + num(i.price), 0))}</span></div>
      <div class="list">${l.map(row).join('')}</div>`).join('')}
    ${bought.length ? `<div class="group-h"><span>✅ Куплено</span><span>${money(sumBought)}</span></div><div class="list">${bought.map(row).join('')}</div>
      <div class="btns two"><button class="btn ghost" data-a="shopClear">Прибрати куплене</button><button class="btn" data-a="shopToExpense">Записати у витрати</button></div>` : ''}`;
}
function shopSheet(id) {
  const i = S.shop.find(x => x.id === id) || { name: '', qty: '', buy: '', price: '', dish: '' };
  openSheet(`
    <h2>${id ? 'Товар' : 'Додати товар'}</h2>
    <div class="field"><input class="input" id="sName" placeholder="Назва (напр. Молоко)" value="${esc(i.name)}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>Кількість</label><input class="input" id="sQty" placeholder="1 л" value="${esc(i.qty)}"></div>
      <div class="field grow"><label>Ціна, ₴</label><input class="input" id="sPrice" inputmode="decimal" placeholder="0" value="${i.price || ''}"></div>
    </div>
    <div class="field"><label>Для чого</label><input class="input" id="sDish" placeholder="Інше" value="${esc(i.dish)}"></div>
    <div class="btns ${id ? 'two' : ''}">
      ${id ? `<button class="btn danger" data-a="shopDel" data-id="${id}">Видалити</button>` : ''}
      <button class="btn" data-a="shopSave" data-id="${id || ''}">Зберегти</button></div>`,
    r => { if (!id) setTimeout(() => $('#sName', r).focus(), 300); });
}

Object.assign(A, {
  // kitchen
  srv: d => { U.dish = ($('#dishInput') || {}).value || U.dish; U.servings = Math.min(20, Math.max(1, U.servings + +d.d)); render(); },
  cook: () => cook(),
  kIdea: d => { U.dish = d.d; render(); cook(); },
  kHave: d => { const i = U.kitchen.items[+d.n]; i.have = !i.have; render(); },
  kAll: () => { const k = U.kitchen; const all = k.items.some(i => !i.have); k.items.forEach(i => i.have = all); render(); },
  kApprove: () => approveKitchen(),
  kOpen: d => {
    const e = S.dishes.find(x => x.id === d.id); if (!e) return;
    U.kitchen = clone(e); U.kitchen.items.forEach(i => i.have = false); U.kError = ''; U.dish = e.dish; render();
  },

  // shop
  shopToggle: d => { const i = S.shop.find(x => x.id === d.id); if (!i) return; i.bought = !i.bought; save(); render(); },
  shopEdit: d => shopSheet(d.id),
  shopSave: d => {
    const r = $('#sheetBody'); const name = $('#sName', r).value.trim();
    if (!name) return invalid('sName', 'Введіть назву');
    if (num($('#sPrice', r).value) < 0) return invalid('sPrice', 'Ціна не може бути відʼємною');
    const data = { name, qty: $('#sQty', r).value.trim(), price: num($('#sPrice', r).value), dish: $('#sDish', r).value.trim() || 'Інше' };
    if (d.id) Object.assign(S.shop.find(x => x.id === d.id), data);
    else S.shop.push({ id: uid(), buy: '', bought: false, ...data });
    save(); closeSheet(); render();
  },
  shopDel: d => { S.shop = S.shop.filter(x => x.id !== d.id); save(); closeSheet(); render(); },
  shopClear: () => { S.shop = S.shop.filter(i => !i.bought); save(); render(); },
  shopToExpense: () => {
    const bought = S.shop.filter(i => i.bought);
    const sum = bought.reduce((a, i) => a + num(i.price), 0);
    if (!sum) { toast('У куплених товарів немає цін'); return; }
    const dishes = [...new Set(bought.map(i => i.dish).filter(x => x && x !== 'Інше'))];
    Fin.add({ type: 'exp', amount: sum, cat: 'food', note: 'Покупки' + (dishes.length ? ': ' + dishes.join(', ') : '') });
    S.shop = S.shop.filter(i => !i.bought);
    save(); toast(`Витрату ${money(sum)} записано`); U.seg.fin = 'overview'; U.finOff = 0; go('finance'); Fin.checkBudget(S.tx[S.tx.length - 1]);
  },
  silpo: d => openUrl('https://silpo.ua/search?find=' + encodeURIComponent(d.q))
});

VIEWS.shop = () => {
  const seg = segOf('shop', 'list');
  return `${segUI('shop', [['list', 'Список'], ['kitchen', 'Кухня'], ['prices', 'Ціни']])}
    ${seg === 'kitchen' ? vKitchen() : vShop()}`;
};
FABS.shop = () => shopSheet();
FABS.shop.visible = () => segOf('shop', 'list') === 'list';
USEG_HOOKS.shop = v => { if (v === 'prices') { U.seg.shop = 'list'; navigate('prices'); return true; } };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'dishInput') { e.preventDefault(); cook(); } });
document.addEventListener('input', e => { if (e.target.id === 'dishInput') U.dish = e.target.value; });
