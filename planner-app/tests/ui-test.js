const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html');
const shots = process.env.SHOTS_DIR || require('os').tmpdir() + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const weather = { current: { time: new Date().toISOString().slice(0, 13) + ':00', temperature_2m: 3.4, apparent_temperature: -1.2, relative_humidity_2m: 81, precipitation: 0.2, weather_code: 61, wind_speed_10m: 5.3, is_day: 1 },
  hourly: { time: [...Array(48)].map((_, i) => { const t = new Date(); t.setMinutes(0,0,0); t.setHours(t.getHours() + i); return new Date(t - t.getTimezoneOffset()*60000).toISOString().slice(0,16); }), temperature_2m: [...Array(48)].map((_, i) => 3 + Math.sin(i / 4) * 3), precipitation_probability: [...Array(48)].map((_, i) => (i * 7) % 90), weather_code: [...Array(48)].map((_, i) => [0, 2, 3, 61][i % 4]) },
  daily: { time: [...Array(7)].map((_, i) => d(i)), weather_code: [61, 3, 0, 2, 71, 95, 1], temperature_2m_max: [5, 6, 8, 4, 1, 7, 9], temperature_2m_min: [0, 1, 2, -1, -4, 2, 3], precipitation_probability_max: [80, 20, 0, 10, 60, 70, 5], precipitation_sum: [3, 0, 0, 0, 2, 5, 0], wind_speed_10m_max: [6, 4, 3, 5, 7, 9, 2] } };
const storeFx = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'fixtures/stores-borscht-kyiv.json'), 'utf8')).responses;
const geminiRecipe = { candidates: [{ content: { parts: [{ text: JSON.stringify({ dish: 'Сирники', servings: 2, time: '~30 хв', ingredients: [
  { name: 'Сир кисломолочний', qty: 400, unit: 'г', grams: 400, count: 0, query: 'сир кисломолочний', must: ['сир', 'кисломол'], exclude: ['глазур'], pantry: false },
  { name: 'Сіль', qty: 0, unit: 'за смаком', grams: 0, count: 0, query: 'сіль', must: ['сіл'], exclude: [], pantry: true }], steps: ['Змішати', 'Обсмажити'] }) }] } }] };
const geminiPrices = { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify({ product: 'Apple AirPods Pro 2', offers: [
  { store: 'Rozetka', title: 'Навушники Apple AirPods Pro 2', url: 'https://rozetka.com.ua/apple_airpods_pro_2/p1/', price: 8999, delivery: null, inStock: true, image: null },
  { store: 'Comfy', title: 'Apple AirPods Pro 2 USB-C', url: 'https://comfy.ua/airpods-pro-2.html', price: 8799, delivery: 99, inStock: true },
  { store: 'Фейк Шоп', title: 'Вигаданий', url: 'https://fake-shop.example/x', price: 5000, delivery: 0 },
  { store: 'Allo', title: 'AirPods Pro 2', url: 'https://allo.ua/ua/airpods-pro-2', price: 9199, delivery: 0, inStock: null } ] }) + '\n```' }] },
  groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x1', title: 'rozetka.com.ua' } }, { web: { uri: 'https://v/x2', title: 'comfy.ua' } }, { web: { uri: 'https://v/x3', title: 'allo.ua' } }] } }] };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }));
  await p.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Львів', latitude: 49.84, longitude: 24.03, country: 'Україна', admin1: 'Львівська область' }] }) }));
  await p.route('**/generativelanguage.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(geminiRecipe) }));
  for (const host of ['stores-api.zakaz.ua', 'sf-ecom-api.silpo.ua', 'www.atbmarket.com']) await p.route(`https://${host}/**`, r => {
    const x = storeFx[r.request().url()];
    if (!x) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: x.status, headers: { 'access-control-allow-origin': '*' }, contentType: host.includes('atb') ? 'text/html' : 'application/json', body: typeof x.body === 'string' ? x.body : JSON.stringify(x.body) });
  });
  await p.route('**/google.com/s2/**', r => r.fulfill({ status: 404 }));

  console.log('1. Міграція v1 → v3');
  await p.goto(URL);
  await p.evaluate(dd => {
    localStorage.clear();
    localStorage.setItem('planer.v1', JSON.stringify({ tasks: [{ id: 'a', title: 'Оплатити інтернет', prio: 3, due: dd[0], done: false }, { id: 'c', title: 'Прибрати', prio: 1, done: true }],
      events: [{ id: 'e1', title: 'Стоматолог', date: dd[0], time: '10:30', important: false }],
      tx: [{ id: 't1', type: 'inc', amount: 32000, cat: 'salary', date: dd[0] }, { id: 't2', type: 'exp', amount: 1450.5, cat: 'food', note: 'Сільпо', date: dd[0] }, { id: 't3', type: 'exp', amount: 500, cat: 'home', date: dd[1] }],
      shop: [{ id: 's1', name: 'Молоко', qty: '1 л', price: 42, dish: 'Інше', bought: false }], dishes: [], settings: { apiKey: 'AIzaLegacyKey1234567890', model: 'gemini-2.5-flash', theme: 'light', name: 'Таня' } }));
    localStorage.setItem('planer.tab', 'plans');
  }, [d(0), d(-1)]);
  await p.reload(); await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({ v: S.v, cc: S.customCats, pay: S.tx.map(t => t.pay), key: S.settings.apiKey, dev: localStorage.getItem('tanichka.devkey'), bak: !!localStorage.getItem('planer.v1.backup.v1'), tasks: S.tasks.length, tab: U.tab, legacy: S._legacyKey }));
  ok(st.v === 3, 'схема v3'); ok(st.cc.some(c => c.id === 'home' && c.name === 'Дім'), 'стара категорія «Дім» збережена як власна');
  ok(st.pay.every(x => x === 'card'), 'спосіб оплати проставлено'); ok(!st.key && st.dev === 'AIzaLegacyKey1234567890' && !st.legacy, 'ключ перенесено з даних у захищене сховище');
  ok(st.bak, 'резервна копія v1 створена'); ok(st.tasks === 2 && st.tab === 'home', 'плани збережені, стара вкладка → Головна');
  await p.screenshot({ path: shots + '01-home.png' });
  // v2 → v3: kitchen history becomes saved recipes, product price favourites dropped (kept in backup)
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('planer.v1')); raw.v = 2;
    raw.dishes = [{ id: 'k1', dish: 'Борщ український', servings: 4, items: [{ name: 'Буряк', amount: '2 шт', buy: 'x', price: 25, have: false }, { name: 'Сметана', amount: '200 г', price: 45 }], steps: ['Варити'] }];
    raw.prices = { history: [{ q: 'AirPods' }], favs: [{ id: 'f', q: 'AirPods' }] };
    raw.recipes = undefined; localStorage.setItem('planer.v1', JSON.stringify(raw));
  });
  await p.reload(); await p.waitForTimeout(300);
  const m3 = await p.evaluate(() => ({ v: S.v, r: S.recipes, favs: S.prices.favs, bak: !!localStorage.getItem('planer.v1.backup.v2'), dishes: S.dishes }));
  ok(m3.v === 3 && m3.r.length === 1 && m3.r[0].ingredients[1].grams === 200 && m3.r[0].ingredients[0].count === 2, 'історія кухні → збережені рецепти');
  ok(!m3.favs && !m3.dishes && m3.bak, 'старий пошук товарів прибрано, резервна копія v2 є');

  console.log('2. Фінанси');
  await p.click('[data-tab=finance]'); await p.waitForTimeout(150);
  ok(await p.locator('.donut').count() === 1, 'діаграма категорій'); ok(await p.locator('.bars').count() === 1, 'порівняння місяців');
  const fs1 = await p.evaluate(() => { const c = $('.fin-sum'); return c ? { h: c.getBoundingClientRect().height, txt: c.textContent } : null; });
  ok(fs1 && fs1.h < 190 && /Баланс/.test(fs1.txt) && /Доходи/.test(fs1.txt) && /Витрати/.test(fs1.txt) && /Відкладено/.test(fs1.txt) && !(await p.locator('#view .mono').count()), `компактний підсумок фінансів (${fs1 && Math.round(fs1.h)}px)`);
  await p.screenshot({ path: shots + '02-finance.png', fullPage: true });
  await p.click('[data-a=useg][data-val=budget]'); await p.waitForTimeout(100);
  await p.click('[data-a=budCat][data-cat=cafe]'); await p.fill('#askNum', '2000'); await p.click('[data-a=askNumOk]'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => S.budget.cats.cafe === 2000), 'ліміт «Кафе» 2000');
  await p.click('#fab'); await p.waitForTimeout(350);
  await p.fill('#xAmount', '1700'); await p.click('[data-a=pickCat][data-cat=cafe]'); await p.click('[data-a=seg][data-group=pay][data-val=cash]');
  await p.click('[data-a=txSave]'); await p.waitForTimeout(900);
  const t1 = await p.textContent('#toast'); ok(/85% ліміту/.test(t1), 'попередження бюджету: ' + t1);
  ok(await p.evaluate(() => S.tx.some(t => t.cat === 'cafe' && t.pay === 'cash')), 'витрата готівкою збережена');
  await p.click('#fab'); await p.waitForTimeout(350); await p.fill('#xAmount', '-5'); await p.click('[data-a=txSave]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => $('#sheetWrap').classList.contains('open')), 'відʼємна сума не пройшла валідацію');
  await p.evaluate(() => closeSheet());
  await p.screenshot({ path: shots + '03-budget.png', fullPage: true });
  await p.click('[data-a=catNew]'); await p.waitForTimeout(350); await p.fill('#ncName', 'Тварини'); await p.click('[data-a=catSave]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => Fin.cats('exp').some(c => c[2] === 'Тварини')), 'власна категорія створена');

  console.log('3. Календар + цикл');
  await p.evaluate(dd => { S.cycle.periods = [{ id: 'p1', start: dd[0], end: dd[1] }, { id: 'p2', start: dd[2], end: dd[3] }, { id: 'p3', start: dd[4], end: dd[5] }]; save(); }, [d(-88), d(-84), d(-60), d(-56), d(-31), d(-27)]);
  const cs = await p.evaluate(() => ({ avg: Cycle.avgCycle(), per: Cycle.avgPeriod(), next: Cycle.next(), reg: Cycle.regularity(), m: Cycle.map() }));
  ok(cs.avg === 29 && cs.per === 5, `сер. цикл ${cs.avg}, менстр. ${cs.per}`);
  ok(cs.next.date === d(-2) && cs.next.late === 2, 'прогноз наступної + затримка 2 дні');
  ok(cs.reg && cs.reg.label === 'Регулярний', 'регулярність: ' + (cs.reg && cs.reg.label));
  ok(Object.values(cs.m).includes('ovulation') && Object.values(cs.m).includes('fertile'), 'овуляція та фертильне вікно на календарі');
  await p.click('[data-tab=calendar]'); await p.waitForTimeout(150);
  const grid = await p.evaluate(() => ({ head: $$('.cwd').map(x => x.textContent).join(','), cells: $$('.cday').length, today: $$('.cday.today').length, we: $$('.cday.we').length, w: $('.cday').getBoundingClientRect().width, h: $('.cday').getBoundingClientRect().height }));
  ok(grid.head === 'Пн,Вт,Ср,Чт,Пт,Сб,Нд' && grid.cells % 7 === 0 && grid.today === 1 && grid.we === grid.cells / 7 * 2, `сітка: ${grid.cells} клітинок, тиждень з понеділка, вихідні виділені`);
  ok(grid.w >= 44 && grid.h >= 48, `клітинки зручні для пальця (${Math.round(grid.w)}×${Math.round(grid.h)})`);
  await p.click('.cday.today'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => $('#sheetWrap').classList.contains('open') && /Стоматолог/.test($('#sheetBody').textContent)), 'натискання на дату → інформація про день');
  await p.click('#sheetBody [data-a=cycStart]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!Cycle.ongoing()), 'менструація почалась сьогодні (з картки дня)');
  await p.evaluate(() => closeSheet());
  const m0 = await p.evaluate(() => U.cal.m); await p.click('[data-a=calNav][data-d="1"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(m => U.cal.m === (m + 1) % 12, m0), 'перемикання місяця');
  await p.click('[data-a=calToday]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => U.cal.m === new Date().getMonth() && U.calSel === today()), 'повернення до сьогодні');
  ok(await p.evaluate(() => Cycle.validate(today(), addDays(today(), -3), null) !== ''), 'валідація: кінець раніше початку');
  await p.screenshot({ path: shots + '04-calendar.png', fullPage: true });
  await p.evaluate(() => navigate('cycle')); await p.waitForTimeout(150);
  await p.screenshot({ path: shots + '05-cycle.png', fullPage: true });
  const rem = await p.evaluate(() => REMINDER_PROVIDERS.flatMap(f => f()).map(r => r.id));
  ok(true, 'нагадування: ' + rem.join(', '));

  console.log('4. Дні народження');
  await p.evaluate(() => { U.stack = []; navigate('birthdays'); }); await p.waitForTimeout(100);
  await p.click('#fab'); await p.waitForTimeout(350);
  await p.fill('#pName', 'Мама'); await p.fill('#pDate', d(5).replace(/^\d{4}/, '1968')); await p.click('[data-a=seg][data-group=pRem][data-val="3"]');
  await p.click('[data-a=personSave]'); await p.waitForTimeout(200);
  const per = await p.evaluate(() => { const x = S.people[0]; return { age: Birthdays.currentAge(x), next: Birthdays.next(x), up: Birthdays.upcoming()[0].days }; });
  ok(per.up === 5, 'зворотний відлік 5 днів'); ok(per.age === new Date().getFullYear() - 1968 - 1 || per.age === new Date().getFullYear() - 1968, 'вік ' + per.age);
  await p.click('[data-a=personBudget]'); await p.fill('#askNum', '3000'); await p.click('[data-a=askNumOk]'); await p.waitForTimeout(350);
  await p.click('#fab'); await p.waitForTimeout(350);
  await p.fill('#gTitle', 'Шарф'); await p.fill('#gPrice', '1200'); await p.fill('#gUrl', 'not a url'); await p.click('[data-a=giftSave]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => S.people[0].gifts.length === 0), 'валідація посилання');
  await p.fill('#gUrl', 'https://example.com/scarf'); await p.click('[data-a=seg][data-group=gStatus][data-val=bought]'); await p.click('[data-a=giftSave]'); await p.waitForTimeout(400);
  await p.click('[data-a=askYes]'); await p.waitForTimeout(300);
  const g = await p.evaluate(() => { const gg = S.people[0].gifts[0]; return { tx: S.tx.find(t => t.id === gg.txId) }; });
  ok(g.tx && g.tx.cat === 'gift' && g.tx.amount === 1200, 'придбаний подарунок → витрата «Подарунки»');
  await p.screenshot({ path: shots + '06-person.png', fullPage: true });
  await p.evaluate(() => { U.tab = 'calendar'; U.stack = []; U.calSel = Birthdays.next(S.people[0]); const dt = parseYmd(U.calSel); U.cal = { y: dt.getFullYear(), m: dt.getMonth() }; render(); });
  ok(await p.locator('.list .item:has-text("Мама")').count() > 0, 'ДН видно в календарі');

  console.log('5. Погода');
  await p.evaluate(() => navigate('weather')); await p.waitForTimeout(100);
  await p.fill('#wCity', 'Львів'); await p.click('[data-a=wSearch]'); await p.waitForTimeout(300);
  await p.click('[data-a=wPick]'); await p.waitForTimeout(400);
  ok(await p.locator('.w-temp').count() === 1, 'поточна погода'); ok(await p.locator('.hour').count() === 24, '24 години'); ok(await p.locator('.trange').count() === 7, '7 днів');
  ok(await p.locator('#top [data-a=wRefresh]').count() === 1 && await p.locator('#top [data-a=wCityOpen]').count() === 1, 'ярлики «Оновити» і «Змінити місто» в шапці');
  ok(await p.locator('#view [data-a=wRefresh], #view #wCity, #view :text("Оновлено")').count() === 0, 'без рядка оновлення, кнопки й блоку зміни міста');
  const heroH = await p.evaluate(() => $('.weather-hero').getBoundingClientRect().height); ok(heroH < 230, `компактна плашка погоди (${Math.round(heroH)}px)`);
  await p.click('#top [data-a=wCityOpen]'); await p.waitForTimeout(350);
  await p.fill('#wCity', 'Львів'); await p.click('[data-a=wSearch]'); await p.waitForTimeout(300);
  ok(await p.locator('#sheetBody [data-a=wPick]').count() === 1, 'пошук міста у вікні з ярлика');
  await p.click('#sheetBody [data-a=wPick]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !$('#sheetWrap').classList.contains('open') && Weather.place().name === 'Львів'), 'місто змінено');
  await p.screenshot({ path: shots + '07-weather.png', fullPage: true });
  let calls = 0; await p.route('**/api.open-meteo.com/**', r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }); });
  await p.evaluate(() => { U.stack = []; go('home'); }); await p.waitForTimeout(300);
  ok(calls === 0, 'кеш: повторний запит не робиться');
  await p.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 503, body: '{"reason":"down"}' }));
  await p.evaluate(() => Weather.load(true)); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!Weather.err && !!Weather.data()), 'помилка API → показано кеш + повідомлення');

  console.log('6. Хотілки');
  await p.evaluate(() => navigate('wishes')); await p.waitForTimeout(100);
  await p.click('#fab'); await p.waitForTimeout(350);
  await p.fill('#wTitle', 'Телефон'); await p.fill('#wPrice', '30000'); await p.fill('#wStart', '8000'); await p.fill('#wDue', d(200));
  await p.click('[data-a=wishSave]'); await p.waitForTimeout(200);
  const wi = await p.evaluate(() => Wishes.info(S.wishes[0]));
  ok(wi.left === 22000 && wi.pct === 27, `залишок ${wi.left}, ${wi.pct}%`); ok(wi.monthly === Math.ceil(22000 / Math.ceil(200 / 30.44)), 'щомісячно ' + wi.monthly);
  await p.screenshot({ path: shots + '08-wish.png', fullPage: true });
  await p.click('[data-a=wishAdd]'); await p.fill('#askNum', '2000'); await p.click('[data-a=askNumOk]'); await p.waitForTimeout(350);
  const exBefore = await p.evaluate(() => Fin.stats(today(), today()).exp);
  await p.click('[data-a=wishBuy]'); await p.waitForTimeout(350); await p.fill('#bPrice', '29500'); await p.click('[data-a=wishBuyDo]'); await p.waitForTimeout(300);
  const wb = await p.evaluate(() => ({ s: S.wishes[0].status, saved: Wishes.saved(S.wishes[0]), st: Fin.stats(today(), today()), bal: Fin.totalBalance() }));
  ok(wb.s === 'bought' && wb.saved === 0, 'ціль закрито, накопичення використано');
  ok(wb.st.exp - exBefore === 29500, 'покупка у витратах «Покупки»');
  ok(Math.abs(wb.bal - (32000 - 1450.5 - 500 - 1700 - 1200 - 29500)) < 0.01, 'єдиний баланс коректний: ' + wb.bal);

  console.log('7. Вигідні продукти: страва → інгредієнти → магазини (записані реальні відповіді)');
  ok(await p.evaluate(() => priceCity() === 'lviv'), 'місто цін за замовчуванням — з погоди (Львів)');
  await p.evaluate(() => { Keys.set(''); S.prices.city = 'kiev'; save(); U.stack = []; navigate('prices'); }); await p.waitForTimeout(300);
  await p.fill('#dpDish', 'борщ'); await p.click('[data-a=dpBuild]'); await p.waitForTimeout(400);
  const rc = await p.evaluate(() => U.dp.recipe);
  ok(rc.source === 'builtin' && rc.servings === 2 && rc.ingredients.length === 12, 'рецепт без ключа: вбудований, 2 порції');
  ok(rc.ingredients.find(i => i.name === 'Буряк').grams === 250 && rc.ingredients.find(i => /Сіль/.test(i.name)).have, 'кількості масштабовано, спеції позначено «є вдома»');
  await p.click('[data-a=rcSrv][data-d="1"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => U.dp.recipe.ingredients.find(i => i.name === 'Буряк').grams === 375), 'зміна порцій перераховує інгредієнти');
  await p.click('[data-a=rcSrv][data-d="-1"]'); await p.waitForTimeout(100);
  await p.click('[data-a=rcAdd]'); await p.waitForTimeout(350); await p.fill('#iName', 'Хліб'); await p.click('[data-a=rcIngSave]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => $('#sheetWrap').classList.contains('open')), 'валідація: без кількості не додається');
  await p.fill('#iQty', '1'); await p.selectOption('#iUnit', 'шт'); await p.click('[data-a=rcIngSave]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => U.dp.recipe.ingredients.some(i => i.name === 'Хліб')), 'інгредієнт додано');
  await p.evaluate(() => { const r = U.dp.recipe; const n = r.ingredients.findIndex(i => i.name === 'Хліб'); A.rcEdit({ n }); }); await p.waitForTimeout(350);
  await p.click('[data-a=rcDel]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !U.dp.recipe.ingredients.some(i => i.name === 'Хліб')), 'інгредієнт прибрано');
  await p.click('[data-a=rcSave]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => S.recipes.some(r => r.dish === 'Борщ український' && r.id)), 'рецепт збережено');
  await p.screenshot({ path: shots + '09-recipe.png', fullPage: true });
  await p.click('[data-a=rcSearch]');
  await p.waitForFunction(() => !DP.loading && U.dp.recipe.results, null, { timeout: 30000 });
  const an = await p.evaluate(() => { const a = analyze(U.dp.recipe); return { stores: a.perStore.map(x => [x.s.name, x.full, x.complete]), comb: a.combinedTotal, best: a.bestSingle.s.name, bestFull: a.bestSingle.full, saving: a.saving, chosen: a.chosen.map(c => c.o && [c.ing.name, c.store.name, c.o.title, c.o.cost]) }; });
  ok(an.stores.length === 5, 'ціни з 5 магазинів: ' + an.stores.map(x => x[0] + ' ' + x[1]).join(', '));
  ok(an.comb <= an.bestFull && Math.abs(an.saving - (an.bestFull - an.comb)) < 0.01, `комбіновано ${an.comb} ≤ один магазин ${an.best} ${an.bestFull}, економія ${an.saving}`);
  ok(an.stores.every((x, i, arr) => i === 0 || arr[i - 1][1] <= x[1]), 'магазини відсортовано за повною вартістю (з докупівлею відсутнього)');
  const garlic = an.chosen.find(c => c && c[0] === 'Часник'); ok(garlic && /^Часник/.test(garlic[2]) && !/гранул/i.test(garlic[2]), 'зіставлення товару: ' + (garlic && garlic[2]));
  const pork = an.chosen.find(c => c && /Свинина/.test(c[0])); ok(pork && /свин/i.test(pork[2]), 'свинина: ' + (pork && pork[2]));
  const kpi = await p.evaluate(() => $('.kpis').getBoundingClientRect().height); ok(kpi < 110, 'компактні показники результату');
  await p.screenshot({ path: shots + '10-results.png', fullPage: true });
  await p.click('[data-a=dpView][data-v=stores]'); await p.waitForTimeout(150); await p.screenshot({ path: shots + '10b-stores.png', fullPage: true });
  await p.evaluate(() => { const a = analyze(U.dp.recipe); A.dpUseStore({ k: a.perStore[1].s.key }); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const a = analyze(U.dp.recipe); return Math.abs(a.planTotal - a.perStore[1].full) < 0.02; }), 'план «купувати в одному магазині» + докупити відсутнє');
  await p.click('[data-a=dpView][data-v=items]'); await p.waitForTimeout(150); await p.screenshot({ path: shots + '10c-items.png', fullPage: true });
  await p.evaluate(() => { A.dpReset(); DP.view = 'combined'; render(); });
  await p.click('[data-a=dpSelect]'); await p.waitForTimeout(350);
  await p.click('#dpSel .item >> nth=0'); await p.click('[data-a=dpSelAdd]'); await p.waitForTimeout(250);
  const sh = await p.evaluate(() => S.shop.filter(i => i.dish === 'Борщ український'));
  ok(sh.length === 10 && sh.every(i => i.store && i.url && i.price > 0), `вибрані продукти додано до покупок (${sh.length}) з магазином і посиланням`);

  // AI path: Gemini only builds the recipe; it is never asked for prices
  let geminiBody = '';
  await p.route('**/generativelanguage.googleapis.com/**', r => { geminiBody = r.request().postData() || ''; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(geminiRecipe) }); });
  await p.evaluate(() => { Keys.set('AIzaTestKey1234567890123'); U.stack = []; U.dp.dish = ''; navigate('prices'); }); await p.waitForTimeout(200);
  await p.fill('#dpDish', 'сирники'); await p.click('[data-a=dpBuild]'); await p.waitForTimeout(400);
  const ai = await p.evaluate(() => U.dp.recipe);
  ok(ai.source === 'ai' && ai.ingredients.length === 2 && ai.ingredients[1].have && ai.ingredients[0].must.join() === 'сир,кисломол', 'рецепт від Gemini: інгредієнти, пошукові ознаки, спеції «є вдома»');
  ok(/НЕ вказуй ціни/.test(geminiBody) && !/google_search/.test(geminiBody), 'Gemini не запитують про ціни і не шукає в інтернеті');
  await p.evaluate(() => { Keys.set(''); U.stack = []; render(); });

  console.log('8. Покупки / ще / налаштування / PIN');
  const sl = await p.evaluate(() => { const c = $('.sumline'); return c ? { h: c.getBoundingClientRect().height, t: c.textContent } : null; });
  ok(sl && sl.h < 70 && /До сплати/.test(sl.t) && /Товарів/.test(sl.t) && /У кошику/.test(sl.t) && /Кошик, сума/.test(sl.t), `компактний підсумок покупок (${sl && Math.round(sl.h)}px)`);
  ok(await p.locator('.group-h:has-text("🏪")').count() >= 2, 'покупки згруповано за магазинами');
  await p.screenshot({ path: shots + '11a-shop.png', fullPage: true });
  await p.click('[data-tab=more]'); await p.waitForTimeout(150); await p.screenshot({ path: shots + '11-more.png' });
  await p.click('[data-a=settings]'); await p.waitForTimeout(350); await p.screenshot({ path: shots + '12-settings.png', fullPage: true });
  await p.evaluate(() => closeSheet());
  await p.evaluate(() => Lock.show('set', () => { }));
  for (const k of '1234') await p.click(`[data-a=pinKey][data-k="${k}"]`); await p.waitForTimeout(200);
  for (const k of '1234') await p.click(`[data-a=pinKey][data-k="${k}"]`); await p.waitForTimeout(300);
  ok(await p.evaluate(() => S.settings.pin.length > 10), 'PIN встановлено (хеш)');
  await p.reload(); await p.waitForTimeout(300);
  ok(await p.locator('#lock.show').count() === 1, 'екран блокування після запуску');
  for (const k of '1111') await p.click(`[data-a=pinKey][data-k="${k}"]`); await p.waitForTimeout(300);
  ok(await p.locator('.lock-err:has-text("Невірний")').count() === 1, 'невірний PIN відхилено');
  await p.screenshot({ path: shots + '13-lock.png' });
  for (const k of '1234') await p.click(`[data-a=pinKey][data-k="${k}"]`); await p.waitForTimeout(300);
  ok(await p.locator('#lock.show').count() === 0, 'розблоковано');
  await p.evaluate(() => { S.settings.theme = 'dark'; applyTheme(); go('home'); }); await p.waitForTimeout(200);
  await p.screenshot({ path: shots + '14-dark-home.png', fullPage: true });
  await p.evaluate(() => go('finance')); await p.waitForTimeout(150); await p.screenshot({ path: shots + '15-dark-finance.png' });

  console.log('8b. Улюблені продукти');
  {
    const fx = n => path.join(__dirname, 'fixtures', n);
    const cut = 'data:image/png;base64,' + require('fs').readFileSync(fx('product_cut.png')).toString('base64');
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    // emulate the native ML Kit cutout (the real one runs only inside the Android app)
    await q.addInitScript(c => { window.AndroidBridge = { cutout: (data, id) => setTimeout(() => window.__cutCb(id, c, null), 200) }; }, cut);
    await q.goto(URL);
    await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { S.shop.push({ id: 'b1', name: 'Йогурт грецький', qty: '', price: 54.9, dish: 'Інше', store: 'Сільпо', bought: true }); save(); go('shop'); });
    const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-a=favFromShop]')]); await fc.setFiles(fx('product.jpg'));
    await q.waitForSelector('.ad-preview img', { timeout: 10000 }); await q.waitForTimeout(300);
    ok(await q.evaluate(() => $('#fvName').value === 'Йогурт грецький' && $('#fvStore').value === 'Сільпо' && !!U.favNew.cut), 'куплений товар → фото → фон вирізано, поля заповнено');
    await q.click('[data-a=favStyle][data-v=dark]'); await q.waitForTimeout(400);
    ok(await q.evaluate(() => U.favNew.style === 'dark' && U.favNew.ad.startsWith('data:image/jpeg')), 'рекламна картка в обраному стилі');
    await q.fill('#fvName', ''); await q.click('[data-a=favSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.favs.length === 0), 'валідація: без назви не зберігається');
    await q.fill('#fvName', 'Йогурт грецький'); await q.fill('#fvTag', 'Ніжний смак'); await q.click('.stars [data-v="4"]');
    await q.click('[data-a=favSave]'); await q.waitForTimeout(500);
    const fv = await q.evaluate(() => S.favs[0]);
    ok(fv && fv.rating === 4 && fv.ad && fv.cut && fv.photo && fv.store === 'Сільпо', 'збережено в улюблені (картка, вирізане та оригінальне фото)');
    await q.click('.fav-card'); await q.waitForTimeout(300);
    await q.click('[data-a=favToShop]'); await q.waitForTimeout(100);
    ok(await q.evaluate(() => S.shop.some(i => !i.bought && i.name === 'Йогурт грецький')), '«Купити ще» → у список покупок');
    await q.screenshot({ path: shots + '11b-fav.png', fullPage: true });
    ok(!e2.length, 'без JS-помилок у сценарії улюблених ' + e2.join('; '));
    await q.close();
    // without the native module: framed photo instead of a cutout
    await p.evaluate(() => { U.stack = []; go('home'); });
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => startFavorite())]); await fc2.setFiles(fx('product.jpg'));
    await p.waitForSelector('.ad-preview img', { timeout: 10000 });
    ok(await p.evaluate(() => !U.favNew.cut && !!U.favNew.ad && /Android/.test(U.favNew.cutErr)), 'без модуля вирізання — красива рамка з поясненням');
    await p.evaluate(() => { U.favNew = null; U.stack = []; go('home'); });
  }

  console.log('9. Видалення даних');
  await p.evaluate(() => navigate('cycle')); await p.click('[data-a=cycWipe]'); await p.waitForTimeout(350); await p.click('[data-a=askYes]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => S.cycle.periods.length === 0), 'дані циклу видалено');

  console.log('\nJS-помилки:', errs.length ? errs : 'немає');
  if (errs.length) fails++;
  console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'УСІ ПЕРЕВІРКИ ПРОЙДЕНО');
  await b.close();
})();
