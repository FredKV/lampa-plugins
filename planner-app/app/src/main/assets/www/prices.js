'use strict';
/* =====================================================================
   Вигідні продукти: страва → інгредієнти (AI) → реальні ціни в магазинах → де купити дешевше
   AI (Gemini) використовується ЛИШЕ для рецепта й інгредієнтів. Ціни — тільки з каталогів магазинів:
     • zakaz.ua (NOVUS, METRO, Auchan, MEGAMARKET, ЕкоМаркет, …) — пошук по магазину обраного міста
     • Сільпо — каталог філії обраного міста (або загальний онлайн-каталог)
     • АТБ — сторінка пошуку інтернет-магазину (загальнонаціональні ціни)
   Магазини без відкритого пошуку показуються як «ціни недоступні».
   ===================================================================== */

/* ---------------- directory of stores ---------------- */
const CITIES = [['kiev', 'Київ'], ['lviv', 'Львів'], ['odesa', 'Одеса'], ['kharkiv', 'Харків'], ['dnipro', 'Дніпро'], ['zaporizhzhia', 'Запоріжжя'],
  ['vinnytsia', 'Вінниця'], ['zhytomyr', 'Житомир'], ['rivne', 'Рівне'], ['chernivtsi', 'Чернівці'], ['ivanofrankivsk', 'Івано-Франківськ'],
  ['poltava', 'Полтава'], ['kryvyyrig', 'Кривий Ріг'], ['chernihiv', 'Чернігів'], ['ternopil', 'Тернопіль'], ['lutsk', 'Луцьк'],
  ['uzhhorod', 'Ужгород'], ['khmelnytskyi', 'Хмельницький'], ['mykolaiv', 'Миколаїв'], ['sumy', 'Суми']];
const cityName = code => (CITIES.find(c => c[0] === code) || [code, code])[1];
const ZAKAZ_CHAINS = { novus: 'NOVUS', metro: 'METRO', auchan: 'Auchan', megamarket: 'MEGAMARKET', ultramarket: 'Ultramarket', zaraz: 'За Раз',
  ekomarket: 'ЕкоМаркет', cosmos: 'Космос', tavriav: 'Таврія В', torba: 'Torba', vostorg: 'Восторг', chudomarket: 'Чудо Маркет' };
const DEFAULT_STORES = ['atb', 'silpo', 'z:novus', 'z:metro', 'z:auchan'];
const UNAVAILABLE_STORES = [{ key: 'varus', name: 'VARUS', reason: 'Магазин не надає відкритого пошуку цін' }];
const DIR_KEY = 'tanichka.storesDir', DIR_TTL = 24 * 3600 * 1000;

const Dir = {
  data: null, loading: null,
  cached() { if (this.data) return this.data; try { this.data = JSON.parse(localStorage.getItem(DIR_KEY)); } catch (e) { } return this.data; },
  async load(force = false) {
    const c = this.cached();
    if (c && !force && Date.now() - c.ts < DIR_TTL) return c;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [z, s] = await Promise.all([
        http('GET', 'https://stores-api.zakaz.ua/stores/', null, { 'Accept-Language': 'uk' }),
        http('GET', 'https://sf-ecom-api.silpo.ua/v1/uk/branches?limit=600&offset=0')
      ]);
      const out = { ts: Date.now(), zakaz: c ? c.zakaz : [], silpo: c ? c.silpo : [] };
      try { if (z.status === 200) out.zakaz = JSON.parse(z.text).filter(x => ZAKAZ_CHAINS[x.retail_chain] && x.is_active !== false).map(x => ({ id: x.id, chain: x.retail_chain, city: x.city, name: x.name })); } catch (e) { }
      try { if (s.status === 200) out.silpo = JSON.parse(s.text).items.filter(b => b.cityFull).map(b => ({ id: b.branchId, city: b.cityFull, pickup: !!b.hasPickup })); } catch (e) { }
      if (z.status !== 200 && s.status !== 200 && !c) out.ts = 0; // nothing loaded — retry next time
      this.data = out; this.loading = null;
      try { localStorage.setItem(DIR_KEY, JSON.stringify(out)); } catch (e) { }
      return out;
    })();
    return this.loading;
  },
  /** All stores we can query in a city: [{key,name,kind,...}] */
  forCity(code) {
    const d = this.cached() || { zakaz: [], silpo: [] }, name = cityName(code);
    const list = [{ key: 'atb', name: 'АТБ', kind: 'atb', note: 'ціни інтернет-магазину, загальні для України' }];
    const sb = d.silpo.find(b => b.city === name && b.pickup);
    list.push(sb ? { key: 'silpo', name: 'Сільпо', kind: 'silpo', branch: sb.id, dt: 'SelfPickup' }
      : { key: 'silpo', name: 'Сільпо', kind: 'silpo', branch: '00000000-0000-0000-0000-000000000000', dt: 'DeliveryHome', note: 'загальний онлайн-каталог' });
    const seen = new Set();
    d.zakaz.filter(x => x.city === code).forEach(x => {
      if (seen.has(x.chain)) return; seen.add(x.chain);
      list.push({ key: 'z:' + x.chain, name: ZAKAZ_CHAINS[x.chain], kind: 'zakaz', storeId: x.id, branchName: x.name });
    });
    return list;
  }
};
function priceCity() {
  if (S.prices.city) return S.prices.city;
  const w = typeof Weather !== 'undefined' && Weather.place();
  const m = w && CITIES.find(c => w.name && w.name.toLowerCase().startsWith(c[1].toLowerCase()));
  return m ? m[0] : 'kiev';
}
function enabledStores() {
  const all = Dir.forCity(priceCity());
  const on = S.prices.stores || DEFAULT_STORES;
  const list = all.filter(s => on.includes(s.key));
  return list.length ? list : all.filter(s => DEFAULT_STORES.includes(s.key));
}

/* ---------------- catalogue fetchers → normalised offers ---------------- */
/** Pack size from a product title: "Сметана 350 г", "1,5кг", "0,5л", "10шт". */
function sizeFromText(t) {
  const re = /(\d+(?:[.,]\d+)?)\s*(кг|гр|г|мл|л|шт)(?![а-яіїєґa-z])/gi;
  let m, last = null; while ((m = re.exec(String(t || '').toLowerCase()))) last = m;
  if (!last) return {};
  const v = parseFloat(last[1].replace(',', '.')), u = last[2];
  if (u === 'кг') return { g: v * 1000 }; if (u === 'г' || u === 'гр') return { g: v };
  if (u === 'л') return { g: v * 1000, vol: true }; if (u === 'мл') return { g: v, vol: true };
  return { count: v };
}
const Fetchers = {
  async zakaz(st, q) {
    const r = await http('GET', `https://stores-api.zakaz.ua/stores/${st.storeId}/products/search/?q=${encodeURIComponent(q)}&per_page=30`, null, { 'Accept-Language': 'uk' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return (JSON.parse(r.text).results || []).map(x => {
      const kg = x.unit === 'kg', sz = sizeFromText(x.title);
      return {
        title: x.title, url: x.web_url, img: x.img ? (x.img.s150x150 || x.img.s200x200 || '') : '', price: x.price / 100,
        kg, packG: kg ? 0 : (sz.g || x.weight || 0), vol: !!sz.vol, packCount: kg ? 0 : (x.pack_amount || sz.count || 0),
        minG: kg && x.quantity ? x.quantity.min || 0 : 0, stepG: kg && x.quantity ? x.quantity.step || 0 : 0, inStock: x.in_stock !== false
      };
    });
  },
  async silpo(st, q) {
    const u = `https://sf-ecom-api.silpo.ua/v1/uk/branches/${st.branch}/products?limit=40&offset=0&deliveryType=${st.dt}&search=${encodeURIComponent(q)}&includeChildCategories=true&sortBy=popularity&sortDirection=desc&inStock=true`;
    const r = await http('GET', u);
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return (JSON.parse(r.text).items || []).map(x => {
      const kg = !!x.weighted, sz = sizeFromText(x.displayRatio);
      const step = x.addToBasketStep ? (x.addToBasketStep < 20 ? x.addToBasketStep * 1000 : x.addToBasketStep) : 100;
      return {
        title: x.title, url: `https://silpo.ua/product/${x.slug}`, img: '', price: +x.price,
        kg, packG: kg ? 0 : (sz.g || sizeFromText(x.title).g || 0), vol: !!sz.vol, packCount: kg ? 0 : (sz.count || 0),
        minG: kg ? step : 0, stepG: kg ? step : 0, inStock: x.stock === undefined ? true : x.stock > 0
      };
    });
  },
  async atb(st, q) {
    const r = await http('GET', `https://www.atbmarket.com/sch?lang=uk&query=${encodeURIComponent(q)}`, null,
      { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', Accept: 'text/html' });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    const doc = new DOMParser().parseFromString(r.text, 'text/html');
    return $$('article.catalog-item', doc).map(a => {
      const link = $('.catalog-item__title a', a); if (!link) return null;
      const box = $('.product-price:not([hidden]) data.product-price__top', a) || $('data.product-price__top', a);
      if (!box) return null;
      const unit = (box.querySelector('.product-price__unit') || {}).textContent || '';
      const kg = /кг/.test(unit), title = link.textContent.trim(), sz = sizeFromText(title);
      const add = $('.b-addToCart', a), step = add ? parseFloat(add.dataset.step || '0') : 0;
      const img = $('img.catalog-item__img', a);
      return {
        title, url: 'https://www.atbmarket.com' + link.getAttribute('href'), img: img ? img.getAttribute('src') : '', price: parseFloat(box.getAttribute('value')),
        kg, packG: kg ? 0 : (sz.g || 0), vol: !!sz.vol, packCount: kg ? 0 : (sz.count || 0),
        minG: kg && step ? step * 1000 : 0, stepG: kg && step ? step * 1000 : 0, inStock: null
      };
    }).filter(Boolean);
  }
};
const fetchCache = new Map(); const FETCH_TTL = 2 * 3600 * 1000;
async function fetchOffers(st, q) {
  const k = st.key + '|' + (st.storeId || st.branch || '') + '|' + q.toLowerCase();
  const c = fetchCache.get(k); if (c && Date.now() - c.ts < FETCH_TTL) return c.list;
  const list = await Fetchers[st.kind](st, q);
  fetchCache.set(k, { ts: Date.now(), list });
  return list;
}

/* ---------------- matching + real purchase cost ---------------- */
const DEFAULT_EXCLUDE = ['варен', 'відвар', 'корейськ', 'салат', 'консерв', 'маринов', 'копчен', 'сушен', 'вялен', 'чипс', 'сік', 'соус', 'пюре', 'суп',
  'морозив', 'цукерк', 'горілк', 'настоян', 'лікер', 'корм', 'сухар', 'снек', 'батончик', 'молоковмісн', 'напій', 'йогурт', 'десерт', 'торт', 'печив', 'вафл',
  'пиріг', 'пельмен', 'котлет', 'фарширов', 'смажен', 'запечен', 'зраз', 'шашлик', 'рулет', 'паштет', 'ковбас', 'сосиск', 'кетчуп', 'майонез', 'приправ',
  'пампуш', 'хліб', 'багет', 'булк', 'лаваш', 'грінк', 'крекер', 'тушков', 'начинк', 'гранул', 'мелен', 'ваніл', 'пудр', 'кориц', 'какао', 'шоколад', 'глазур', 'згущ'];
const tokens = t => String(t || '').toLowerCase().replace(/[ʼ'’`]/g, '').replace(/[«»"(),.%®™+!:;]/g, ' ').split(/[\s\-\/]+/).filter(Boolean);
/** Rough Ukrainian stem: drop a final vowel, shorten long words — «яйця»→«яйц», «картопля»→«картоп», «свиняча»→«свиняч». */
const stemOf = w => {
  w = w.toLowerCase().replace(/[ʼ'’]/g, '');
  if (w.length <= 3) return w;
  w = w.replace(/[аеєиіїоуюяйь]$/, '');
  return w.length > 6 ? w.slice(0, w.length - 2) : w;
};
function searchSpec(ing) {
  const query = (ing.query || ing.name || '').replace(/\(.*?\)/g, '').replace(/[\d.,–%-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const must = (ing.must && ing.must.length ? ing.must : tokens(query).filter(w => w.length > 2).slice(0, 3).map(stemOf)).map(s => s.toLowerCase().replace(/[ʼ'’]/g, ''));
  const own = (ing.name + ' ' + query).toLowerCase();
  const exclude = [...new Set([...(ing.exclude || []), ...DEFAULT_EXCLUDE])].map(s => s.toLowerCase()).filter(e => !own.includes(e) && !must.some(m => m.startsWith(e) || e.startsWith(m)));
  return { query, must, exclude };
}
/** All key stems present, one of them among the first words (the product type), no excluded words. */
function matches(offer, spec) {
  const tk = tokens(offer.title), head = tk.slice(0, 3);
  return spec.must.every(m => tk.some(t => t.startsWith(m))) && spec.must.some(m => head.some(t => t.startsWith(m)))
    && !spec.exclude.some(e => tk.some(t => t.startsWith(e)));
}
const fmtG = (g, vol) => g >= 1000 ? `${round2(g / 1000).toLocaleString('uk-UA')} ${vol ? 'л' : 'кг'}` : `${Math.round(g)} ${vol ? 'мл' : 'г'}`;
/** Cost of buying enough of `offer` for `ing` (full packages / store weighing step). */
function costFor(offer, ing) {
  const needG = ing.grams || 0, needCnt = ing.count || 0;
  if (offer.kg) {
    let g = needG || (needCnt ? needCnt * 150 : 0); if (!g) return null;
    const step = offer.stepG || 0;
    if (step) g = Math.ceil(g / step) * step;
    g = Math.max(g, offer.minG || 0);
    return { cost: round2(offer.price * g / 1000), buy: `≈ ${fmtG(g)}`, perKg: offer.price, unitLbl: '/кг', exact: true };
  }
  let packs, exact = true;
  if (offer.packG && needG) packs = Math.ceil(needG / offer.packG - 1e-9);
  else if (offer.packCount && needCnt) packs = Math.ceil(needCnt / offer.packCount - 1e-9);
  else if (needCnt && !offer.packG && !offer.packCount) packs = Math.ceil(needCnt);
  else { packs = 1; exact = false; }
  packs = Math.max(1, packs);
  const size = offer.packG ? fmtG(offer.packG, offer.vol) : offer.packCount ? `${offer.packCount} шт` : '';
  return {
    cost: round2(offer.price * packs), buy: `${packs} × ${size || 'уп.'}`, packs, exact,
    perKg: offer.packG ? round2(offer.price / offer.packG * 1000) : null, unitLbl: offer.vol ? '/л' : '/кг'
  };
}
function bestOffers(list, ing) {
  const spec = searchSpec(ing);
  return list.filter(o => o.price > 0 && matches(o, spec)).map(o => ({ ...o, ...costFor(o, ing) })).filter(o => o.cost > 0)
    .sort((a, b) => (a.inStock === false) - (b.inStock === false) || (!a.exact) - (!b.exact) || a.cost - b.cost || (a.perKg || 1e9) - (b.perKg || 1e9));
}

/* ---------------- recipe: AI or built-in ---------------- */
const PCS_G = { буря: 250, карто: 150, морк: 120, цибу: 100, яйц: 55, яйце: 55, помід: 150, огір: 120, перец: 150, ябл: 180, лимо: 120, банан: 150, часн: 5 };
const PANTRY = ['сіль', 'перець чорн', 'перець мелен', 'лавров', 'вода', 'спеці', 'сода'];
function normIngredient(i) {
  const amt = typeof i.qty === 'number' || i.unit ? { qty: +i.qty || 0, unit: i.unit || 'шт', grams: +i.grams || 0, count: +i.count || 0 } : parseAmount(i.amount);
  if (amt.unit === 'шт' && !amt.count) amt.count = amt.qty;
  if (!amt.grams && amt.count) { const k = Object.keys(PCS_G).find(s => tokens(i.name)[0] && tokens(i.name)[0].startsWith(s)); if (k) amt.grams = PCS_G[k] * amt.count; }
  const name = String(i.name || '').slice(0, 80);
  return {
    id: uid(), name, ...amt, query: String(i.query || '').slice(0, 60), must: Array.isArray(i.must) ? i.must.slice(0, 3).map(String) : [],
    exclude: Array.isArray(i.exclude) ? i.exclude.slice(0, 10).map(String) : [],
    have: !!i.pantry || PANTRY.some(p => name.toLowerCase().includes(p))
  };
}
function recipePrompt(dish, servings) {
  return `Ти — кулінарний помічник для користувача з України. Страва: "${dish}". Кількість порцій: ${servings}.
Склади класичний рецепт і повний список інгредієнтів для ${servings} порц.
Для кожного інгредієнта поверни:
- name — назва українською, як продукт у супермаркеті (напр. "Буряк", "Свинина (лопатка)", "Сметана 15%")
- qty — число; unit — одне з: "г","кг","мл","л","шт","ст. л.","ч. л.","зубч.","пучок","за смаком"
- grams — приблизна вага або обʼєм цієї кількості в г/мл (для "шт" — середня вага), число
- count — кількість штук, якщо unit "шт", інакше 0
- query — короткий пошуковий запит для каталогу супермаркету (1–3 слова, напр. "буряк", "лопатка свиняча", "томатна паста")
- must — 1–2 основи слів без закінчень, які обовʼязково є в назві потрібного товару (напр. ["буряк"], ["свин"], ["томат","паст"])
- exclude — основи слів, яких не має бути в назві (напр. для сирого буряка ["варен","корейськ"])
- pantry — true для солі, перцю, води, лаврового листа та спецій, що зазвичай є вдома
Також: time — орієнтовний час, steps — 3–8 коротких кроків.
НЕ вказуй ціни. Відповідай ЛИШЕ JSON:
{"dish":"Назва","servings":${servings},"time":"~1 год","ingredients":[{"name":"Буряк","qty":2,"unit":"шт","grams":500,"count":2,"query":"буряк","must":["буряк"],"exclude":["варен"],"pantry":false}],"steps":["..."]}
Якщо це не страва — {"error":"коротке пояснення"}.`;
}
function builtinRecipe(dish, servings) {
  const q = dish.toLowerCase().replace(/[ʼ'’]/g, '');
  const b = (window.BUILTIN_RECIPES || []).find(r => r.keys.some(k => q.includes(k.replace(/[ʼ'’]/g, ''))));
  if (!b) return null;
  return scaleRecipe({ id: '', dish: b.dish, servings: b.servings, base: b.servings, time: b.time, steps: b.steps, ingredients: b.ingredients.map(normIngredient), source: 'builtin' }, servings);
}
async function buildRecipe(dish, servings) {
  if (Keys.has()) {
    try { return await buildRecipeAI(dish, servings); }
    catch (e) { const r = builtinRecipe(dish, servings); if (r) { toast('Gemini не відповів — взяв вбудований рецепт'); return r; } throw e; }
  }
  const r = builtinRecipe(dish, servings);
  if (!r) throw new Error('Без ключа Gemini доступні лише вбудовані рецепти: борщ, вареники, олівʼє, сирники, карбонара, млинці. Додайте безкоштовний ключ у Налаштуваннях, щоб складати рецепт будь-якої страви.');
  return r;
}
async function buildRecipeAI(dish, servings) {
  {
    const { text } = await gemini({ contents: [{ role: 'user', parts: [{ text: recipePrompt(dish, servings) }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } });
    const j = extractJson(text);
    if (j.error) throw new Error(j.error);
    if (!Array.isArray(j.ingredients) || !j.ingredients.length) throw new Error('Не вдалося скласти список інгредієнтів');
    return { id: '', dish: String(j.dish || dish).slice(0, 80), servings, base: servings, time: String(j.time || ''), steps: (j.steps || []).map(String).slice(0, 12), ingredients: j.ingredients.map(normIngredient), source: 'ai' };
  }
}
function scaleRecipe(r, servings) {
  const k = servings / (r.servings || 1);
  if (!isFinite(k) || k === 1) return r;
  r.ingredients.forEach(i => { i.qty = round2(i.qty * k); i.grams = round2(i.grams * k); i.count = round2(i.count * k); });
  r.servings = servings; delete r.results;
  return r;
}
const amountLabel = i => i.unit === 'за смаком' || !i.qty ? 'за смаком' : `${String(round2(i.qty)).replace('.', ',')} ${i.unit}${i.unit !== 'г' && i.unit !== 'мл' && i.grams ? ` (≈${fmtG(i.grams)})` : ''}`;

/* ---------------- search + analysis ---------------- */
async function pool(tasks, n, onDone) {
  let i = 0; const run = async () => { while (i < tasks.length) { const t = tasks[i++]; await t().catch(() => { }); onDone(); } };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, run));
}
const DP = { loading: false, err: '', progress: 0, view: 'combined' };
async function runSearch(recipe) {
  const ings = recipe.ingredients.filter(i => !i.have && (i.grams || i.count));
  if (!ings.length) { toast('Усі інгредієнти позначено як наявні вдома'); return; }
  DP.loading = true; DP.err = ''; DP.progress = 0; render();
  await Dir.load().catch(() => { });
  const stores = enabledStores();
  const res = { ts: Date.now(), city: priceCity(), stores: stores.map(s => ({ key: s.key, name: s.name, note: s.note || '', ok: 0, fail: 0, err: '' })), cells: {} };
  DP.loading = true; DP.err = ''; DP.progress = 0; render();
  const total = stores.length * ings.length; let done = 0;
  const tasks = [];
  stores.forEach((st, si) => ings.forEach(ing => tasks.push(async () => {
    const meta = res.stores[si];
    try {
      const list = await fetchOffers(st, searchSpec(ing).query);
      const offers = bestOffers(list, ing).slice(0, 4);
      res.cells[ing.id + '|' + st.key] = offers.map(o => ({ title: o.title, url: o.url, img: o.img, price: round2(o.price), cost: o.cost, buy: o.buy, perKg: o.perKg, unitLbl: o.unitLbl, inStock: o.inStock, exact: o.exact, kg: o.kg }));
      meta.ok++;
    } catch (e) { meta.fail++; meta.err = /HTTP 4|HTTP 5/.test(e.message) ? 'сервіс магазину відповів помилкою' : 'немає зʼєднання'; }
  })));
  await pool(tasks, 6, () => { done++; DP.progress = done / total; const el = $('#dpProg'); if (el) { el.style.width = Math.round(DP.progress * 100) + '%'; $('#dpProgT').textContent = `${done} з ${total} запитів`; } });
  res.stores.forEach(s => { s.failed = s.ok === 0 && s.fail > 0; });
  recipe.results = res; recipe.plan = { mode: 'combined', store: '', picks: {} };
  DP.loading = false;
  if (res.stores.every(s => s.failed)) DP.err = 'Не вдалося отримати ціни з жодного магазину. Перевірте підключення до інтернету.';
  if (recipe.id) { const i = S.recipes.findIndex(r => r.id === recipe.id); if (i >= 0) S.recipes[i] = recipe; save(); }
  render();
}
/** Builds per-store totals, the cheapest combined plan and the user's chosen plan. */
function analyze(recipe) {
  const res = recipe.results; if (!res) return null;
  const stores = res.stores.filter(s => !s.failed);
  const ings = recipe.ingredients.filter(i => !i.have && (i.grams || i.count));
  const offer = (ing, sk, idx = 0) => { const c = res.cells[ing.id + '|' + sk]; const o = c && c.find((x, k) => k >= idx && x.inStock !== false); return o || null; };
  const globalBest = {};
  ings.forEach(ing => { stores.forEach(s => { const o = offer(ing, s.key); if (o && (!globalBest[ing.id] || o.cost < globalBest[ing.id].o.cost)) globalBest[ing.id] = { o, store: s }; }); });
  const nowhere = ings.filter(i => !globalBest[i.id]);
  const perStore = stores.map(s => {
    const found = [], missing = [];
    ings.forEach(i => { const o = offer(i, s.key); if (o) found.push({ ing: i, o }); else missing.push(i); });
    const total = round2(found.reduce((a, x) => a + x.o.cost, 0));
    const alt = round2(missing.reduce((a, i) => a + (globalBest[i.id] ? globalBest[i.id].o.cost : 0), 0));
    return { s, found, missing, total, alt, full: round2(total + alt), complete: missing.filter(i => globalBest[i.id]).length === 0 };
  }).filter(x => x.found.length).sort((a, b) => a.full - b.full || b.found.length - a.found.length);
  // the user's plan
  const plan = recipe.plan || { mode: 'combined', picks: {} };
  const chosen = ings.map(ing => {
    const pick = plan.picks && plan.picks[ing.id];
    if (pick) { const c = res.cells[ing.id + '|' + pick.store]; const o = c && c[pick.idx]; const st = stores.find(s => s.key === pick.store); if (o && st) return { ing, o, store: st, manual: true }; }
    if (plan.mode === 'store' && plan.store) { const st = stores.find(s => s.key === plan.store); const o = st && offer(ing, st.key); if (o) return { ing, o, store: st }; }
    return globalBest[ing.id] ? { ing, o: globalBest[ing.id].o, store: globalBest[ing.id].store } : { ing, o: null };
  });
  const combinedTotal = round2(ings.reduce((a, i) => a + (globalBest[i.id] ? globalBest[i.id].o.cost : 0), 0));
  const planTotal = round2(chosen.reduce((a, c) => a + (c.o ? c.o.cost : 0), 0));
  const bestSingle = perStore[0] || null;
  const combinedStores = new Set(Object.values(globalBest).map(g => g.store.key)).size;
  return { ings, stores, perStore, globalBest, nowhere, chosen, combinedTotal, planTotal, bestSingle, combinedStores, saving: bestSingle ? round2(bestSingle.full - combinedTotal) : 0 };
}

/* ---------------- pages ---------------- */
U.dp = { recipe: null, dish: '', servings: 2 };
window.__resumeHooks.push(() => Dir.load());

PAGES.prices = () => {
  const city = priceCity();
  const d = Dir.cached();
  if (!d || Date.now() - d.ts > DIR_TTL) Dir.load().then(() => { if (U.stack.length && U.stack[U.stack.length - 1].page === 'prices') render(); });
  const st = enabledStores();
  return {
    title: 'Вигідні продукти', html: `
    <button class="city-chip" data-a="dpCity">📍 ${esc(cityName(city))} · ${st.length} ${plural(st.length, 'магазин', 'магазини', 'магазинів')} <span class="muted">змінити</span></button>
    <div class="hero">
      <h3 style="font-size:19px;margin-bottom:12px">Яку страву хочете приготувати?</h3>
      <div class="row" style="gap:8px"><input class="input grow" id="dpDish" maxlength="80" placeholder="Напр. борщ український" value="${esc(U.dp.dish)}" enterkeyhint="go"></div>
      <div class="row" style="margin-top:10px">
        <div class="servings"><button data-a="dpSrv" data-d="-1">−</button><b>${U.dp.servings}</b><button data-a="dpSrv" data-d="1">+</button></div>
        <span class="small muted grow">порції</span>
        <button class="btn btn-inline" data-a="dpBuild" ${DP.loading ? 'disabled' : ''}>Скласти список</button>
      </div>
    </div>
    ${DP.loading ? `<div class="card empty"><div class="spinner"></div>Складаю рецепт і список інгредієнтів…<div class="small muted" id="dpSec" style="margin-top:6px"></div></div>` : ''}
    ${DP.err && !DP.loading ? `<div class="card"><b class="red">Не вдалося</b><div class="small muted" style="margin-top:6px">${esc(DP.err)}</div></div>` : ''}
    ${S.recipes.length ? `<h2>Збережені рецепти</h2><div class="list">${S.recipes.map(r => `<div class="item" data-a="dpOpen" data-id="${r.id}"><div class="emoji sm">🍽</div>
      <div class="grow"><div class="title">${esc(r.dish)}</div><div class="meta">${r.servings} порц. · ${r.ingredients.length} інгр.${r.results ? ` · ціни від ${fmtDateTime(r.results.ts)}` : ''}</div></div><button class="del-btn" data-a="recipeDel" data-id="${r.id}" aria-label="Видалити рецепт">${ICONS.trash}</button></div>`).join('')}</div>` : ''}
`
  };
};

PAGES.recipe = () => {
  const r = U.dp.recipe; if (!r) return null;
  const need = r.ingredients.filter(i => !i.have).length;
  return {
    title: r.dish, html: `
    <div class="card compact-head">
      <div class="row between"><div><div class="small muted">${r.time ? esc(r.time) + ' · ' : ''}${r.source === 'ai' ? '✨ рецепт від Gemini' : r.source === 'builtin' ? 'вбудований рецепт' : 'мій рецепт'}</div>
        <b>${r.ingredients.length} ${plural(r.ingredients.length, 'інгредієнт', 'інгредієнти', 'інгредієнтів')} · купити ${need}</b></div>
        <div class="servings"><button data-a="rcSrv" data-d="-1">−</button><b>${r.servings}</b><button data-a="rcSrv" data-d="1">+</button></div></div>
    </div>
    <div class="small muted" style="margin:0 6px 8px">Відмітьте ✓ те, що вже є вдома. Натисніть на продукт, щоб змінити.</div>
    <div class="list">${r.ingredients.map((i, n) => `<div class="item ${i.have ? 'have' : ''}">
      <button class="check ${i.have ? 'on' : ''}" data-a="rcHave" data-n="${n}" aria-label="Є вдома"></button>
      <div class="grow" data-a="rcEdit" data-n="${n}"><div class="title">${esc(i.name)}</div><div class="meta">${esc(amountLabel(i))}${i.have ? ' · є вдома' : ''}</div></div>
      <span class="muted" data-a="rcEdit" data-n="${n}">✎</span></div>`).join('')}</div>
    <button class="btn ghost card-btn" data-a="rcAdd">+ Додати інгредієнт</button>
    ${r.steps && r.steps.length ? `<details class="steps" style="margin-top:12px"><summary>Як готувати</summary><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
    <div class="btns two" style="margin-top:12px"><button class="btn ghost card-btn" data-a="rcSave">${r.id ? '✓ Збережено' : 'Зберегти рецепт'}</button>
      ${r.results ? `<button class="btn ghost card-btn" data-a="go" data-page="priceResults">Останні ціни</button>` : '<span></span>'}</div>
    <div class="sticky-cta"><button class="btn" data-a="rcSearch" ${need ? '' : 'disabled'}>Знайти найвигідніші ціни</button></div>`
  };
};
FABS.recipe = () => A.rcAdd();
FABS.recipe.visible = () => false;

function storeBadge(name) { return `<span class="store-badge">${esc(name)}</span>`; }
PAGES.priceResults = () => {
  const r = U.dp.recipe; if (!r) return null;
  if (DP.loading) return {
    title: r.dish, html: `<div class="card empty"><div class="spinner"></div><b style="color:var(--text)">Шукаю ціни в магазинах…</b>
    <div class="progress" style="margin-top:14px"><div id="dpProg" style="width:${Math.round(DP.progress * 100)}%"></div></div><div class="small" id="dpProgT" style="margin-top:6px">готуюсь…</div></div>`
  };
  const a = analyze(r);
  if (!a) return { title: r.dish, html: `<div class="card empty">Ще немає результатів</div>` };
  const res = r.results;
  const failed = res.stores.filter(s => s.failed);
  const view = DP.view;
  const offerLine = (o, extra = '') => `<div class="grow" style="min-width:0"><div class="title ellipsis">${esc(o.title)}</div>
    <div class="meta">${esc(o.buy)}${o.perKg ? ` · ${money(o.perKg)}${o.unitLbl}` : ''}${o.inStock === false ? ' · <span class="red">немає</span>' : o.inStock === null ? ' · наявність уточнюйте' : ''}${!o.exact ? ' · <span class="red">вага уп. невідома</span>' : ''}${extra}</div></div>`;
  let body = '';
  if (view === 'combined') {
    const groups = {};
    a.chosen.forEach(c => { if (!c.o) return; (groups[c.store.key] = groups[c.store.key] || { st: c.store, items: [] }).items.push(c); });
    body = Object.values(groups).map(g => `<div class="group-h"><span>${storeBadge(g.st.name)}</span><span>${money(g.items.reduce((s, c) => s + c.o.cost, 0))}</span></div>
      <div class="list">${g.items.map(c => `<div class="item" data-a="dpPick" data-id="${c.ing.id}">
        <div class="thumb sm">${c.o.img ? `<img src="${esc(c.o.img)}" alt="" onerror="this.style.visibility='hidden'">` : '🛒'}</div>
        <div class="grow" style="min-width:0"><div class="title">${esc(c.ing.name)}${c.manual ? ' <span class="pill blue">обрано</span>' : ''}</div>
        <div class="meta ellipsis">${esc(c.o.title)}</div><div class="meta">${esc(c.o.buy)}${c.o.perKg ? ` · ${money(c.o.perKg)}${c.o.unitLbl}` : ''}</div></div>
        <div class="amount">${money(c.o.cost)}</div></div>`).join('')}</div>`).join('')
      + (a.chosen.some(c => !c.o) ? `<div class="group-h"><span>⚠️ Не знайдено</span></div><div class="list">${a.chosen.filter(c => !c.o).map(c => `<div class="item"><div class="grow"><div class="title">${esc(c.ing.name)}</div><div class="meta">Немає в обраних магазинах — змініть назву чи запит інгредієнта</div></div></div>`).join('')}</div>` : '');
  } else if (view === 'stores') {
    body = `<div class="list">${a.perStore.map((x, k) => `<div class="item store-row">
      <div class="grow" style="min-width:0"><div class="title">${k === 0 ? '🏆 ' : ''}${esc(x.s.name)} ${x.complete ? '<span class="pill green">усе є</span>' : `<span class="pill">${x.found.length}/${a.ings.length}</span>`}</div>
        <div class="meta">${x.complete ? `Усе в одному магазині` : `Немає: ${esc(x.missing.map(i => i.name).join(', '))}`}</div>
        ${!x.complete && x.alt ? `<div class="meta">+ ${money(x.alt)} — докупити відсутнє в інших магазинах</div>` : ''}
        <button class="chip" style="margin-top:8px" data-a="dpUseStore" data-k="${x.s.key}">Купувати тут</button></div>
      <div class="right"><div class="amount">${money(x.full)}</div>${x.alt ? `<div class="small muted">тут ${money(x.total)}</div>` : ''}${k > 0 && a.bestSingle ? `<div class="small red">+${money(x.full - a.bestSingle.full)}</div>` : ''}</div></div>`).join('')}</div>
      <div class="small muted" style="margin:8px 6px">Магазини впорядковано за повною вартістю: якщо чогось немає, додано найдешевшу ціну цього продукту в іншому магазині.</div>`;
  } else {
    body = a.ings.map(ing => {
      const rows = [];
      a.stores.forEach(s => (res.cells[ing.id + '|' + s.key] || []).forEach((o, idx) => rows.push({ s, o, idx })));
      rows.sort((x, y) => (x.o.inStock === false) - (y.o.inStock === false) || x.o.cost - y.o.cost);
      const cur = a.chosen.find(c => c.ing.id === ing.id);
      return `<div class="group-h"><span>${esc(ing.name)} · ${esc(amountLabel(ing))}</span><span>${rows.length ? 'від ' + money(rows[0].o.cost) : ''}</span></div>
      <div class="list">${rows.length ? rows.slice(0, 8).map(({ s, o, idx }) => `<div class="item ${cur && cur.o === o ? 'picked' : ''}" data-a="dpChoose" data-id="${ing.id}" data-s="${s.key}" data-i="${idx}">
        ${offerLine(o, '')}<div class="right"><div class="amount">${money(o.cost)}</div><div class="small muted">${esc(s.name)}</div>
        ${goLink(o.url)}</div></div>`).join('') : `<div class="item muted small">Не знайдено в жодному магазині</div>`}</div>`;
    }).join('');
  }
  const plan = r.plan || {};
  const planLbl = plan.mode === 'store' && plan.store ? `купівля в «${(a.stores.find(s => s.key === plan.store) || {}).name}» + решта деінде` : 'найдешевше по кожному продукту';
  return {
    title: r.dish, html: `
    <div class="kpis">
      <div class="kpi"><span>Один магазин</span><b>${a.bestSingle ? money(a.bestSingle.full) : '—'}</b><small>${a.bestSingle ? esc(a.bestSingle.s.name) + (a.bestSingle.complete ? '' : ` + докупити`) : ''}</small></div>
      <div class="kpi"><span>Комбіновано</span><b>${money(a.combinedTotal)}</b><small>${a.combinedStores} ${plural(a.combinedStores, 'магазин', 'магазини', 'магазинів')}</small></div>
      <div class="kpi"><span>Економія</span><b class="${a.saving > 0 ? 'green' : ''}">${money(Math.max(0, a.saving))}</b><small>проти 1 магазину</small></div>
    </div>
    <div class="small muted" style="margin:-4px 6px 10px">📍 ${esc(cityName(res.city))} · оновлено ${fmtDateTime(res.ts)} · ${r.servings} порц. · доставка не врахована (магазини не повідомляють її вартість без адреси)
      ${failed.length || UNAVAILABLE_STORES.length ? `<br>${failed.map(s => `⚠️ ${esc(s.name)}: ${esc(s.err || 'ціни недоступні')}`).concat(UNAVAILABLE_STORES.map(u => `${esc(u.name)}: ціни недоступні`)).join(' · ')}` : ''}
      ${a.nowhere.length ? `<br>❗ Не знайдено ніде: ${esc(a.nowhere.map(i => i.name).join(', '))}` : ''}</div>
    <div class="seg">${[['combined', 'Мій список'], ['stores', 'Магазини'], ['items', 'Продукти']].map(([v, l]) => `<button data-a="dpView" data-v="${v}" class="${view === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${view === 'combined' ? `<div class="small muted" style="margin:-4px 6px 8px">План: ${esc(planLbl)}. Натисніть на продукт, щоб обрати інший магазин.${plan.mode === 'store' || Object.keys(plan.picks || {}).length ? ` <b class="link" data-a="dpReset">Скинути</b>` : ''}</div>` : ''}
    ${body}
    <div class="sticky-cta"><div class="row between small" style="margin:0 4px 8px"><span class="muted">Разом за моїм списком</span><b style="font-size:17px">${money(a.planTotal)}</b></div>
      <div class="btns two" style="margin:0"><button class="btn ghost card-btn" data-a="dpSelect">Вибрати продукти</button><button class="btn" data-a="dpAddAll">До покупок</button></div></div>
    <div class="btns"><button class="btn ghost card-btn" data-a="rcSearch">↻ Оновити ціни</button></div>`
  };
};

function pickSheet(ingId) {
  const r = U.dp.recipe, a = analyze(r), ing = r.ingredients.find(i => i.id === ingId);
  const rows = [];
  a.stores.forEach(s => (r.results.cells[ingId + '|' + s.key] || []).forEach((o, idx) => rows.push({ s, o, idx })));
  rows.sort((x, y) => (x.o.inStock === false) - (y.o.inStock === false) || x.o.cost - y.o.cost);
  openSheet(`<h2>${esc(ing.name)}</h2><div class="small muted" style="margin:-8px 0 12px">Потрібно: ${esc(amountLabel(ing))}</div>
    <div class="list flat">${rows.map(({ s, o, idx }) => `<div class="item" data-a="dpChoose" data-id="${ingId}" data-s="${s.key}" data-i="${idx}">
      <div class="grow" style="min-width:0"><div class="title">${esc(s.name)}</div><div class="meta ellipsis">${esc(o.title)}</div>
      <div class="meta">${esc(o.buy)}${o.perKg ? ` · ${money(o.perKg)}${o.unitLbl}` : ''}${o.inStock === false ? ' · <span class="red">немає в наявності</span>' : ''}</div></div>
      <div class="right"><div class="amount">${money(o.cost)}</div>${goLink(o.url)}</div></div>`).join('') || '<div class="item muted">Немає пропозицій</div>'}</div>`);
}
function ingSheet(n) {
  const r = U.dp.recipe, i = n === undefined ? { name: '', qty: '', unit: 'г', query: '' } : r.ingredients[n];
  const UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'ст. л.', 'ч. л.', 'зубч.', 'пучок', 'за смаком'];
  openSheet(`<h2>${n === undefined ? 'Новий інгредієнт' : 'Інгредієнт'}</h2>
    <div class="field"><input class="input" id="iName" maxlength="80" placeholder="Назва (напр. Сметана 15%)" value="${esc(i.name)}"></div>
    <div class="row" style="gap:10px"><div class="field" style="width:40%"><label>Кількість</label><input class="input" id="iQty" inputmode="decimal" value="${i.qty || ''}"></div>
      <div class="field grow"><label>Одиниця</label><select class="input" id="iUnit">${UNITS.map(u => `<option ${u === i.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div class="field"><label>Вага/обʼєм для пошуку, г або мл (для шт, ложок)</label><input class="input" id="iGrams" inputmode="decimal" value="${i.grams || ''}" placeholder="авто"></div>
    <div class="field"><label>Як шукати в магазині</label><input class="input" id="iQuery" maxlength="60" value="${esc(i.query || '')}" placeholder="${esc((i.name || '').toLowerCase() || 'напр. лопатка свиняча')}"></div>
    <div class="btns ${n === undefined ? '' : 'two'}">${n === undefined ? '' : `<button class="btn danger" data-a="rcDel" data-n="${n}">Видалити</button>`}
      <button class="btn" data-a="rcIngSave" data-n="${n === undefined ? '' : n}">Зберегти</button></div>`, root => { if (n === undefined) setTimeout(() => $('#iName', root).focus(), 300); });
}
function citySheet() {
  const city = priceCity(), on = S.prices.stores || DEFAULT_STORES, list = Dir.forCity(city);
  openSheet(`<h2>Місто та магазини</h2>
    <div class="field"><label>Місто (впливає на ціни та наявність)</label><select class="input" id="dpCitySel">${CITIES.map(c => `<option value="${c[0]}" ${c[0] === city ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
    <div class="small muted" style="margin:0 4px 8px">Порівнювати в магазинах:</div>
    <div class="list flat" id="dpStores">${list.map(s => `<div class="item"><div class="grow"><div class="title">${esc(s.name)}</div>${s.note || s.branchName ? `<div class="meta">${esc(s.note || s.branchName)}</div>` : ''}</div>
      ${toggleHtml('st_' + s.key.replace(':', '_'), on.includes(s.key)).replace('class="toggle', `data-key="${s.key}" class="toggle`)}</div>`).join('')}
      ${UNAVAILABLE_STORES.map(u => `<div class="item muted"><div class="grow"><div class="title">${esc(u.name)}</div><div class="meta">${esc(u.reason)}</div></div><span class="small">недоступно</span></div>`).join('')}</div>
    ${!Dir.cached() || !Dir.cached().zakaz.length ? `<div class="small muted" style="margin-top:8px">Список магазинів міста ще завантажується — відкрийте це вікно пізніше.</div>` : ''}
    <div class="small muted" style="margin:8px 4px">Що більше магазинів, то довше триває пошук (кожен продукт перевіряється в кожному магазині).</div>
    <div class="btns"><button class="btn" data-a="dpCitySave">Зберегти</button></div>`);
}

function addToShop(sel) {
  const r = U.dp.recipe, a = analyze(r); let n = 0, upd = 0;
  a.chosen.filter(c => c.o && (!sel || sel.includes(c.ing.id))).forEach(c => {
    const ex = S.shop.find(s => !s.bought && s.name.toLowerCase() === c.ing.name.toLowerCase() && s.dish === r.dish);
    const item = { name: c.ing.name, qty: c.o.buy, buy: c.o.title, price: c.o.cost, dish: r.dish, store: c.store.name, url: c.o.url };
    if (ex) { Object.assign(ex, item); upd++; } else { S.shop.push({ id: uid(), bought: false, ...item }); n++; }
  });
  save();
  toast(`Додано ${n} у покупки${upd ? `, оновлено ${upd}` : ''}`);
  U.stack = []; U.seg.shop = 'list'; go('shop');
}

Object.assign(A, {
  dpCity: async () => { await Dir.load(); citySheet(); },
  dpCitySave: () => {
    const r = $('#sheetBody'); const city = $('#dpCitySel', r).value;
    if (city !== priceCity()) { S.prices.city = city; save(); closeSheet(); citySheet(); return; } // store list depends on city
    const on = $$('#dpStores .toggle', r).filter(t => t.classList.contains('on')).map(t => t.dataset.key);
    if (!on.length) { toast('Оберіть хоча б один магазин'); return; }
    S.prices.city = city; S.prices.stores = on; save(); closeSheet(); render(); toast('Збережено');
  },
  dpSrv: d => { const el = $('#dpDish'); if (el) U.dp.dish = el.value; U.dp.servings = clamp(U.dp.servings + +d.d, 1, 20); render(); },
  dpBuild: async () => {
    const el = $('#dpDish'); if (el) U.dp.dish = el.value.trim();
    if (U.dp.dish.length < 2) { toast('Напишіть назву страви'); if (el) el.focus(); return; }
    if (document.activeElement) document.activeElement.blur();
    const ex = S.recipes.find(r => r.dish.toLowerCase() === U.dp.dish.toLowerCase());
    if (ex && await ask({ title: 'Рецепт уже збережено', text: `«${esc(ex.dish)}» є серед збережених. Відкрити його чи скласти новий?`, ok: 'Відкрити збережений', cancel: 'Скласти новий' })) { A.dpOpen({ id: ex.id }); return; }
    DP.loading = true; DP.err = ''; render();
    const t0 = Date.now(), tick = setInterval(() => { const el = $('#dpSec'); if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} с`; }, 1000);
    try { U.dp.recipe = await buildRecipe(U.dp.dish, U.dp.servings); DP.loading = false; navigate('recipe'); }
    catch (e) { DP.loading = false; DP.err = e.message || String(e); render(); }
    finally { clearInterval(tick); }
  },
  recipeDel: async d => {
    const r = S.recipes.find(x => x.id === d.id); if (!r) return;
    if (!await ask({ title: `Видалити рецепт «${r.dish}»?`, text: 'Список покупок не зміниться.', ok: 'Видалити', danger: true })) return;
    S.recipes = S.recipes.filter(x => x.id !== d.id); save(); render(); toast('Рецепт видалено');
  },
  dpOpen: d => { const r = S.recipes.find(x => x.id === d.id); if (!r) return; U.dp.recipe = clone(r); DP.view = 'combined'; navigate('recipe'); },
  rcSrv: d => {
    const r = U.dp.recipe, n = clamp(r.servings + +d.d, 1, 20); if (n === r.servings) return;
    scaleRecipe(r, n); if (r.id) persistRecipe(r); render();
  },
  rcHave: d => { const i = U.dp.recipe.ingredients[+d.n]; i.have = !i.have; if (U.dp.recipe.id) persistRecipe(U.dp.recipe); render(); },
  rcEdit: d => ingSheet(+d.n),
  rcAdd: () => ingSheet(),
  rcIngSave: d => {
    const root = $('#sheetBody'), name = $('#iName', root).value.trim();
    if (!name) return invalid('iName', 'Введіть назву');
    const unit = $('#iUnit', root).value, qtyRaw = $('#iQty', root).value, qty = num(qtyRaw);
    if (unit !== 'за смаком' && !(qty > 0)) return invalid('iQty', 'Вкажіть кількість');
    if (qty > 100000) return invalid('iQty', 'Занадто велике значення');
    const p = parseAmount(`${qty} ${unit}`);
    const gRaw = $('#iGrams', root).value.trim(), grams = gRaw ? num(gRaw) : 0;
    if (gRaw && !(grams > 0)) return invalid('iGrams', 'Некоректна вага');
    const r = U.dp.recipe, n = d.n === '' ? -1 : +d.n;
    const prev = n >= 0 ? r.ingredients[n] : null;
    const query = $('#iQuery', root).value.trim();
    const renamed = prev && (prev.name !== name || (prev.query || '') !== query);
    const ing = normIngredient({ name, qty, unit, grams: grams || p.grams || (prev && prev.unit === unit && !renamed ? prev.grams / (prev.qty || 1) * qty : 0), count: unit === 'шт' ? qty : 0, query,
      must: renamed ? [] : prev ? prev.must : [], exclude: renamed ? [] : prev ? prev.exclude : [] });
    if (prev) { ing.id = prev.id; ing.have = prev.have; r.ingredients[n] = ing; } else { ing.have = false; r.ingredients.push(ing); }
    delete r.results; if (r.id) persistRecipe(r);
    closeSheet(); render();
  },
  rcDel: d => { const r = U.dp.recipe; r.ingredients.splice(+d.n, 1); delete r.results; if (r.id) persistRecipe(r); closeSheet(); render(); },
  rcSave: () => {
    const r = U.dp.recipe;
    if (!r.id) { r.id = uid(); r.ts = Date.now(); S.recipes.unshift(clone(r)); save(); toast('Рецепт збережено'); }
    else { persistRecipe(r); toast('Збережено'); }
    render();
  },
  rcSearch: async () => {
    const r = U.dp.recipe;
    DP.view = 'combined';
    if (U.stack[U.stack.length - 1].page !== 'priceResults') navigate('priceResults');
    await runSearch(r);
  },
  dpView: d => { DP.view = d.v; render(); },
  dpPick: d => pickSheet(d.id),
  dpChoose: (d, el, e) => {
    if (e && e.target.closest('[data-a="openLink"]')) return;
    const r = U.dp.recipe; r.plan = r.plan || { mode: 'combined', picks: {} }; r.plan.picks = r.plan.picks || {};
    r.plan.picks[d.id] = { store: d.s, idx: +d.i }; if (r.id) persistRecipe(r);
    closeSheet(); render(); toast('Обрано');
  },
  dpUseStore: d => { const r = U.dp.recipe; r.plan = { mode: 'store', store: d.k, picks: {} }; if (r.id) persistRecipe(r); DP.view = 'combined'; render(); toast('План оновлено'); },
  dpReset: () => { const r = U.dp.recipe; r.plan = { mode: 'combined', store: '', picks: {} }; if (r.id) persistRecipe(r); render(); },
  dpAddAll: () => addToShop(null),
  dpSelect: () => {
    const a = analyze(U.dp.recipe);
    openSheet(`<h2>Що додати до покупок?</h2><div class="list flat" id="dpSel">${a.chosen.filter(c => c.o).map(c => `<div class="item" data-a="dpSelToggle">
      <button class="check on" data-id="${c.ing.id}"></button><div class="grow"><div class="title">${esc(c.ing.name)}</div><div class="meta">${esc(c.store.name)} · ${esc(c.o.buy)}</div></div>
      <div class="amount">${money(c.o.cost)}</div></div>`).join('')}</div>
      <div class="btns"><button class="btn" data-a="dpSelAdd">Додати вибране</button></div>`);
  },
  dpSelToggle: (d, el) => { const c = $('.check', el); c.classList.toggle('on'); },
  dpSelAdd: () => {
    const ids = $$('#dpSel .check.on').map(c => c.dataset.id);
    if (!ids.length) { toast('Нічого не вибрано'); return; }
    closeSheet(); addToShop(ids);
  }
});
function persistRecipe(r) {
  const i = S.recipes.findIndex(x => x.id === r.id);
  const copy = clone(r); copy.ts = Date.now();
  if (i >= 0) S.recipes[i] = copy; else S.recipes.unshift(copy);
  save();
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'dpDish') { e.preventDefault(); A.dpBuild(); } });
document.addEventListener('input', e => { if (e.target.id === 'dpDish') U.dp.dish = e.target.value; });
