const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html');
const shots = process.env.SHOTS_DIR || require('os').tmpdir() + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
// finger swipe on the calendar (dx < 0 = next)
const swipe = (page, dx) => page.evaluate(dx => {
  const el = document.querySelector('.wlist, .mgrid-card'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 40;
  const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
  el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x)], changedTouches: [t(x)] }));
  el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx)] }));
}, dx);
const addDaysN = (s, n) => { const x = new Date(s + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
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


// drives the custom wheel picker like a user: open → scroll the wheels → «Готово»
async function pickDate(p, id, v) {
  await p.click(`.pick-btn[data-for="${id}"]`); await p.waitForTimeout(350);
  const [y, m, d] = v.split('-').map(Number);
  const roll = async (wid, i) => { await p.evaluate(([w, k]) => { const el = document.getElementById(w); el.scrollTop = k * 44; el.dispatchEvent(new Event('scroll')); }, [wid, i]); await p.waitForTimeout(220); };
  await roll('pkY', await p.evaluate(y => y - Picker.st.y0, y)); await roll('pkM', m - 1); await roll('pkD', d - 1);
  await p.click('[data-a=pickDone]'); await p.waitForTimeout(300);
}
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
  await p.evaluate(() => { U.calView = 'month'; render(); });
  const grid = await p.evaluate(() => ({ head: $$('.mh').map(x => x.textContent).join(','), cells: $$('.mcell').length, today: $$('.mcell.today').length, we: $$('.mcell.we').length, w: $('.mcell').getBoundingClientRect().width, h: $('.mcell').getBoundingClientRect().height, line: !!$('.mcell.today .mline') }));
  ok(grid.head === 'Пн,Вт,Ср,Чт,Пт,Сб,Нд' && grid.cells % 7 === 0 && grid.today === 1 && grid.we === grid.cells / 7 * 2, `сітка: ${grid.cells} клітинок, тиждень з понеділка, вихідні виділені`);
  ok(grid.w >= 44 && grid.h >= 96 && grid.line, `великі клітинки з назвами справ (${Math.round(grid.w)}×${Math.round(grid.h)})`);
  await p.click('[data-a=calView][data-v=week]'); await p.waitForTimeout(150);
  const wk = await p.evaluate(() => ({ days: $$('.wday').length, strip: $$('.wstrip button').length, txt: $('.wday.today') && $('.wday.today').textContent }));
  ok(wk.days === 7 && wk.strip === 7 && /Стоматолог/.test(wk.txt), 'перемикач «Тиждень»: дні зі справами');
  ok(await p.locator('[data-a=calNav]').count() === 0, 'стрілок у шапці немає');
  await swipe(p, -150); await p.waitForTimeout(100);
  ok(await p.evaluate(() => U.calWeek === addDays(mondayOf(today()), 7) && !!$('.wlist.swap-r')), 'свайп ← — тиждень вперед з анімацією');
  await p.click('[data-a=calToday]'); await p.click('[data-a=calView][data-v=month]'); await p.waitForTimeout(400);
  await p.click('.mcell.today'); await p.waitForTimeout(350);
  const pop = await p.evaluate(() => { const el = $('#dayPop'); if (!el) return null; const r = el.getBoundingClientRect(), c = $('.mcell.today').getBoundingClientRect(); return { txt: el.textContent, above: r.bottom <= c.top + 1 || r.top >= c.bottom - 1, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 }; });
  ok(pop && /10:30 Стоматолог/.test(pop.txt) && pop.above && pop.inView, 'натискання на дату → спливаюча картка з повним текстом над/під днем');
  await p.screenshot({ path: shots + '04b-daypop.png' });
  await p.click('#dayPopBg', { position: { x: 10, y: 10 } }); await p.waitForTimeout(100);
  await p.click('.mcell.other >> nth=0'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!$('#dayPop') && !$('#sheetWrap').classList.contains('open')), 'день сусіднього місяця — така сама спливаюча картка');
  await p.click('#dayPopBg', { position: { x: 10, y: 10 } }); await p.waitForTimeout(100);
  await p.click('.mcell.today'); await p.waitForTimeout(250);
  ok(await p.locator('#dayPop [data-a=popOpen]').count() === 0 && await p.locator('#dayPop [data-a=cycStart]').count() === 0, 'у спливаючій картці немає «Відкрити ›» і кнопок циклу');
  await p.click('#dayPopBg', { position: { x: 10, y: 10 } }); await p.waitForTimeout(100);
  await p.evaluate(() => { A.calView({ v: 'week' }); }); await p.waitForTimeout(400);
  await p.click('.wday:not(.today) .wempty >> nth=0'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!$('#dayPop') && !$('#sheetWrap').classList.contains('open')), 'тиждень: «+ додати» відкриває таку саму спливаючу картку');
  await p.click('#dayPopBg', { position: { x: 10, y: 10 } }); await p.waitForTimeout(100);
  await p.evaluate(() => { A.calView({ v: 'month' }); A.cycStart({ d: today() }); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!Cycle.ongoing() && !!$('.mcell.today .cdrop')), 'дні менструації позначено краплинкою');
  const m0 = await p.evaluate(() => U.cal.m); await swipe(p, -150); await p.waitForTimeout(100);
  ok(await p.evaluate(m => U.cal.m === (m + 1) % 12, m0), 'свайп — наступний місяць');
  await swipe(p, 150); await p.waitForTimeout(100);
  ok(await p.evaluate(m => U.cal.m === m, m0), 'свайп → — попередній місяць');
  await p.evaluate(() => A.calToday()); await p.waitForTimeout(100);
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
  await p.fill('#pName', 'Мама'); await pickDate(p, 'pDate', d(5).replace(/^\d{4}/, '1968'));
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
  await p.evaluate(() => { U.stack = []; go('home'); }); await p.waitForTimeout(150);
  const wd = await p.evaluate(() => { const rows = $$('.w-day .wd-ic'), ts = $$('.w-day .wd-t');
    return { n: rows.length, icX: new Set(rows.map(r => Math.round(r.getBoundingClientRect().left + r.getBoundingClientRect().width / 2))).size, tR: new Set(ts.map(t => Math.round(t.getBoundingClientRect().right))).size, txt: $('.w-day').textContent.replace(/\s+/g, ' ') }; });
  ok(wd.n === 3 && wd.icX === 1 && wd.tR === 1 && /Сьогодні/.test(wd.txt) && /6° \/ 1°/.test(wd.txt), 'погода на головній: сьогодні + 3 дні, значки й температури рівно в колонках');
  let calls = 0; await p.route('**/api.open-meteo.com/**', r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }); });
  await p.evaluate(() => { U.stack = []; go('home'); }); await p.waitForTimeout(300);
  ok(calls === 0, 'кеш: повторний запит не робиться');
  await p.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 503, body: '{"reason":"down"}' }));
  await p.evaluate(() => Weather.load(true)); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!Weather.err && !!Weather.data()), 'помилка API → показано кеш + повідомлення');

  console.log('6. Хотілки');
  await p.evaluate(() => navigate('wishes')); await p.waitForTimeout(100);
  await p.click('#fab'); await p.waitForTimeout(350);
  await p.fill('#wTitle', 'Телефон'); await p.fill('#wPrice', '30000'); await p.fill('#wStart', '8000'); await pickDate(p, 'wDue', d(200));
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
  const sl = await p.evaluate(() => { const c = $('.sum-tiles'); return c ? { h: c.getBoundingClientRect().height, t: c.textContent + $('.sum-acts').textContent, n: $$('.sum-tiles .card').length } : null; });
  ok(sl && sl.n === 2 && sl.h < 120 && /До сплати/.test(sl.t) && /У кошику/.test(sl.t) && /Для страви/.test(sl.t) && /Сканувати цінник/.test(sl.t), `підсумок покупок — дві плитки (${sl && Math.round(sl.h)}px)`);
  await p.evaluate(() => { S.shop.push({ id: 'v1', name: 'Картопля', qty: '800 г', price: 20, dish: 'Вареники з картоплею', store: 'АТБ', bought: false }, { id: 'v2', name: 'Борошно', qty: '500 г', price: 16, dish: 'Вареники з картоплею', bought: false }); save(); U.shopMode = 'dishes'; render(); });
  const dl = await p.evaluate(() => $$('#view [data-page=shopDish]').map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(dl.length >= 3 && dl.some(t => /Борщ український/.test(t) && /\/10 куплено/.test(t)) && dl.some(t => /Вареники/.test(t)), 'страви окремими картками з прогресом: ' + dl.length);
  await p.click('[data-page=shopDish][data-id="Вареники з картоплею"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => U.stack.at(-1).page === 'shopDish' && $$('#view .item [data-a=shopToggle]').length === 2), 'картка страви → її список');
  await p.evaluate(() => { back(); U.shopMode = 'all'; render(); });
  const mg = await p.evaluate(() => { const rows = $$('#view [data-a=shopMergedEdit]').map(e => e.textContent.replace(/\s+/g, ' ')); return { rows, potato: rows.find(r => /Картопля/.test(r)) }; });
  ok(mg.potato && /×2 страви/.test(mg.potato) && /Борщ український · Вареники з картоплею/.test(mg.potato), 'усі продукти: однакові обʼєднано (' + (mg.potato || '').trim().slice(0, 60) + ')');
  await p.click('[data-a=shopToggleMany]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => S.shop.filter(i => /картопл/i.test(i.name)).every(i => i.bought)), 'одна галочка відмічає продукт в усіх стравах');
  await p.click('[data-a=shopMerge]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !U.shopMerge && $$('#view [data-a=shopMergedEdit]').length === 0), 'кнопка вимикає обʼєднання');
  await p.evaluate(() => { U.shopMerge = true; U.shopMode = 'dishes'; render(); });
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

  console.log('8a. Біометрія');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    // emulate the native BiometricPrompt: fails while window.__bioFail is set
    await q.addInitScript(() => { window.__bioCalls = 0; window.AndroidBridge = { canBiometric: () => true, biometric: () => { window.__bioCalls++; const okNow = !window.__bioFail; setTimeout(() => window.__bioCb && window.__bioCb(okNow, !okNow), 100); } }; });
    await q.goto(URL);
    await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { U.stack = []; A.settings && A.settings(); }); await q.waitForTimeout(300);
    ok(await q.locator('#stBio').count() === 0, 'без PIN перемикача біометрії немає');
    await q.evaluate(async () => { S.settings.pin = await hashPin('1234'); save(); settingsSheet(); }); await q.waitForTimeout(200);
    await q.evaluate(() => { window.__bioFail = true; });
    await q.click('#stBio'); await q.waitForTimeout(400);
    ok(await q.evaluate(() => !S.settings.bio), 'скасована біометрія не вмикається');
    await q.evaluate(() => { window.__bioFail = false; });
    await q.click('#stBio'); await q.waitForTimeout(400);
    ok(await q.evaluate(() => S.settings.bio === true), 'біометрію увімкнено після підтвердження');
    await q.reload(); await q.waitForTimeout(150);
    ok(await q.locator('#lock.show .kp-bio').count() === 1, 'на екрані блокування є кнопка відбитка');
    await q.waitForTimeout(700);
    ok(await q.locator('#lock.show').count() === 0, 'розблоковано біометрією автоматично');
    ok(e2.length === 0, 'без JS-помилок (біометрія) ' + e2.join('; '));
    await q.close();
  }

  console.log('8f. Вибір ярлика');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.addInitScript(() => { window.__icon = 'olive'; window.AndroidBridge = { getIcon: () => window.__icon, setIcon: v => { window.__icon = v; } }; });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => settingsSheet('icon')); await q.waitForTimeout(300);
    ok(await q.locator('.icon-pick button').count() === 5 && await q.locator('.icon-pick button.on[data-v=olive]').count() === 1, 'у налаштуваннях 5 ярликів, вибраний поточний');
    await q.click('.icon-pick [data-v=yellow]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => window.__icon === 'yellow' && !!$('.icon-pick button.on[data-v=yellow]')), 'вибір жовтого ярлика передано в Android');
    await q.screenshot({ path: shots + '16-icon-pick.png' });
    ok(e2.length === 0, 'без JS-помилок (ярлик) ' + e2.join('; '));
    await q.close();
  }

  console.log('8g. Повтори, борги, цілі, поділитися');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.addInitScript(() => { window.__shared = []; window.AndroidBridge = { share: t => window.__shared.push(t) }; });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    // repeating plan
    await q.evaluate(() => { go('home'); A.taskNew(); }); await q.waitForTimeout(350);
    await q.fill('#tTitle', 'Оплатити інтернет'); await q.click('#repOn'); await q.click('#repSeg [data-val=month]'); await q.click('[data-a=taskSave]'); await q.waitForTimeout(150);
    const t1 = await q.evaluate(() => ({ ...S.tasks[0], isToday: S.tasks[0].due === today() }));
    ok(t1.repeat === 'month' && t1.isToday, 'план з повтором щомісяця (дата — сьогодні)');
    await q.click(`[data-a=taskToggle][data-id="${t1.id}"]`); await q.waitForTimeout(150);
    ok(await q.evaluate(() => !S.tasks[0].done && S.tasks[0].due === addMonthsYmd(today(), 1) && S.tasks[0].count === 1), 'виконаний повторюваний план переходить на наступний місяць');
    // repeating event
    await q.evaluate(() => { S.events.push({ id: 'ev1', title: 'Басейн', date: today(), time: '19:00', note: '', important: false, remind: 'day', repeat: 'week' }); save(); });
    ok(await q.evaluate(() => dayData(addDays(today(), 14), null).evs.length === 1 && dayData(addDays(today(), 15), null).evs.length === 0), 'подія щотижня зʼявляється кожні 7 днів');
    ok(await q.evaluate(() => REMINDER_PROVIDERS.flatMap(f => f()).filter(r => /^ev-ev1-/.test(r.id)).length >= 5), 'нагадування для повторюваної події на кілька разів уперед');
    // share
    await q.evaluate(() => A.eventShare({ id: 'ev1' })); await q.evaluate(() => A.dayShare({ d: today() }));
    ok(await q.evaluate(() => /Басейн/.test(window.__shared[0]) && /щотижня/.test(window.__shared[0]) && /Басейн/.test(window.__shared[1])), 'поділитися подією і цілим днем');
    // debts
    await q.evaluate(() => { U.seg.fin = 'debts'; go('finance'); }); await q.waitForTimeout(150);
    ok(await q.locator('#view .seg button:has-text("Борги").on').count() === 1, 'вкладка «Борги» у фінансах');
    await q.evaluate(() => A.fab()); await q.waitForTimeout(350);
    await q.fill('#dAmount', '1000'); await q.fill('#dWho', 'Оля'); await q.click('[data-a=debtSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.debts.length === 1 && S.debts[0].dir === 'in' && Debts.total('in') === 1000), 'борг «мені винні» 1000 ₴');
    await q.evaluate(() => { const d = S.debts[0]; d.pays.push({ id: 'p', amount: 400, date: today() }); save(); A.debtShare({ id: d.id }); });
    ok(await q.evaluate(() => Debts.left(S.debts[0]) === 600 && /Оля/.test(window.__shared.at(-1)) && /600/.test(window.__shared.at(-1))), 'часткове повернення і поділитися боргом');
    await q.evaluate(() => navigate('debt', { id: S.debts[0].id })); await q.waitForTimeout(150);
    await q.click('[data-a=debtClose]'); await q.click('.dlg [data-a=dlgOk], #dlg .btn:not(.ghost)').catch(() => {}); await q.waitForTimeout(250);
    // goals
    await q.evaluate(() => { U.stack = []; go('more'); navigate('goals'); }); await q.waitForTimeout(150);
    await q.evaluate(() => A.fab()); await q.waitForTimeout(350);
    await q.fill('#gTitle', 'Читати книжку'); await q.fill('#gMin', '30 хв'); await q.click('[data-a=goalSave]'); await q.waitForTimeout(200);
    ok(await q.locator('.goal-row .nag-dot').count() === 1 && await q.locator('#tabbar [data-tab=more].nag').count() === 1, 'не відмічена звичка — пульсує бубочка і крапка на «Ще»');
    const nags = await q.evaluate(() => REMINDER_PROVIDERS.flatMap(f => f()).filter(r => /^goal-/.test(r.id)));
    ok(nags.length >= 7 && nags.some(n => /долбойоб|ледащо|Диван|совість|понеділка|здуваєшся/.test(n.text)), `жорсткі нагадування, поки не відмічено (${nags.length})`);
    await q.click('[data-a=goalCheck]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => Goals.streak(S.goals[0]) === 1) && await q.locator('#tabbar [data-tab=more].nag').count() === 0, 'відмічено — серія 1, бубочка зникла');
    await q.evaluate(() => { S.goals.push({ id: 'q1', type: 'quit', title: 'Кинути курити', start: addDays(today(), -7), time: '21:00', log: {}, attempts: [], created: Date.now() }); save(); navigate('goal', { id: 'q1' }); });
    await q.waitForTimeout(150);
    ok(await q.evaluate(() => $('.goal-big').textContent.trim() === '7' && $$('.medal.got').length === 3), 'кинути курити: 7 днів, 3 медалі');
    await q.click('.goal-hero [data-a=goalCheck]'); await q.waitForTimeout(100);
    ok(await q.evaluate(() => /днів|Тиждень/.test($('#toast') ? $('#toast').textContent : '') || Goals.doneToday(S.goals[1])), 'відмітка «тримаюсь» з похвалою');
    await q.screenshot({ path: shots + '17-goal.png' });
    // lock screen: no logo
    await q.evaluate(async () => { S.settings.pin = await hashPin('1234'); save(); Lock.show('unlock'); }); await q.waitForTimeout(100);
    ok(await q.locator('#lock .lk-logo').count() === 0, 'на екрані PIN-коду немає логотипу');
    ok(e2.length === 0, 'без JS-помилок (повтори/борги/цілі) ' + e2.join('; '));
    await q.close();
  }

  console.log('8h. Ключ Gemini нового формату');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    let hdr = null, url = '';
    await q.route('**/generativelanguage.googleapis.com/**', r => { hdr = r.request().headers()['x-goog-api-key']; url = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'працює' }] } }] }) }); });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => settingsSheet('gemini')); await q.waitForTimeout(300);
    const newKey = 'AQ.Ab8RN6KzT1x-9_qWeRtYuIoP.asdfGhjkL0987';
    await q.fill('#stKey', ' ' + newKey + '\n'); await q.click('[data-a=keySave]'); await q.waitForTimeout(200);
    ok(await q.evaluate(k => Keys.has() && localStorage.getItem(DEV_KEY) === k, newKey), 'ключ нового формату (AQ.…) прийнято');
    await q.evaluate(() => gemini({ contents: [{ parts: [{ text: 'тест' }] }] })); await q.waitForTimeout(200);
    ok(hdr === newKey && !/key=/.test(url), 'ключ передається в заголовку, не в адресі');
    ok(await q.locator('#sheetBody [data-a=pickModel], #sheetBody .st-more').count() === 0, 'вибору моделі в налаштуваннях немає');
    ok(await q.locator('#stKey').count() === 0 && await q.locator('[data-a=openKey]').count() === 0 && /Ключ додано/.test(await q.textContent('#sheetBody')) && await q.locator('[data-a=keyDel]').count() === 1, 'ключ додано: поля й посилання немає, лише «Ключ додано» і кошик');
    await q.click('[data-a=keyDel]'); await q.click('[data-a=askYes]'); await q.waitForTimeout(400);
    ok(await q.locator('#stKey').count() === 1 && await q.locator('[data-a=openKey]').count() === 1, 'після видалення знову можна вставити інший ключ');
    await q.evaluate(k => Keys.set(k), newKey);
    await q.unroute('**/generativelanguage.googleapis.com/**');
    const asked = [];
    await q.route('**/generativelanguage.googleapis.com/**', r => { const m = r.request().url().match(/models\/([^:]+)/)[1]; asked.push(m);
      if (m === 'gemini-2.5-flash') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"quota"}}' });
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) }); });
    const txt = await q.evaluate(async () => { geminiOk = ''; return (await gemini({ contents: [{ parts: [{ text: 'x' }] }] })).text; });
    await q.evaluate(() => gemini({ contents: [{ parts: [{ text: 'y' }] }] }));
    ok(txt === 'ok' && asked[0] === 'gemini-2.5-flash' && asked[1] === 'gemini-2.5-flash-lite' && asked[2] === 'gemini-2.5-flash-lite', `модель обирається автоматично: ліміт → наступна (${asked.join(' → ')})`);
    await q.close();
  }

  console.log('8i. Додати товар із пошуком ціни');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => {
      enabledStores = () => [{ key: 'atb', name: 'АТБ', kind: 'atb' }, { key: 'silpo', name: 'Сільпо', kind: 'silpo' }];
      fetchOffers = async st => st.key === 'atb'
        ? [{ title: 'Молоко 2,5% 900 г Яготинське', price: 41.9, packG: 900, url: 'https://atb.ua/m' }, { title: 'Йогурт молочний', price: 20, packG: 300 }]
        : [{ title: 'Молоко 2,6% 1 л Галичина', price: 46.5, packG: 1000, vol: true, url: 'https://silpo.ua/m' }];
      go('shop'); A.fab();
    });
    await q.waitForTimeout(350);
    await q.fill('#sfName', 'Молоко'); await q.fill('#sfQty', '1 л'); await q.click('[data-a=shopFind]');
    await q.waitForSelector('.sf-offer', { timeout: 5000 });
    const offers = await q.evaluate(() => $$('.sf-offer').map(o => o.textContent.replace(/\s+/g, ' ')));
    ok(offers.length === 2 && /Сільпо/.test(offers[0]) && /46,5/.test(offers[0]) && /найдешевше/.test(offers[0]) && /АТБ/.test(offers[1]) && /2 ×/.test(offers[1]) && !offers.some(o => /Йогурт/.test(o)), 'пошук по магазинах: найдешевше з урахуванням кількості першим, зайве відкинуто');
    await q.screenshot({ path: shots + '18-add-find.png' });
    await q.click('.sf-offer >> nth=1'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.shop.length === 1 && S.shop[0].store === 'АТБ' && S.shop[0].price === 83.8 && S.shop[0].name === 'Молоко'), 'обраний варіант додано у список з магазином і ціною');
    ok(e2.length === 0, 'без JS-помилок (пошук товару) ' + e2.join('; '));
    await q.close();
  }

  console.log('8j. Сповіщення про дні народження');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    await q.addInitScript(() => { window.__sent = null; window.__now = []; window.AndroidBridge = { setReminders: j => { window.__sent = JSON.parse(j); }, notificationsAllowed: () => true, notifyNow: (t, x) => window.__now.push(t + ' ' + x) }; });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    const r = await q.evaluate(() => {
      const bd = addDays(today(), 20); S.people.push({ id: 'p9', name: 'Оля', bday: '1990' + bd.slice(4), gifts: [], budget: 0 });
      for (let i = 0; i < 6; i++) S.goals.push({ id: 'g' + i, type: 'habit', title: 'Звичка ' + i, time: '08:00', log: {}, attempts: [] });
      save(); syncReminders();
      return window.__sent.filter(x => /^bd/.test(x.id)).map(x => ({ id: x.id.split('-')[0], d: ymd(new Date(x.at)), title: x.title })).concat([{ bd }]);
    });
    const bd = r.pop().bd;
    const want = { bd14: -14, bd7: -7, bd0: 0 };
    ok(r.length === 3 && r.every(x => x.d === (q, addDaysN(bd, want[x.id]))), 'день народження: нагадування за 2 тижні, за тиждень і в день — ' + r.map(x => x.title).join(' / '));
    await q.evaluate(() => settingsSheet('notif')); await q.waitForTimeout(300);
    await q.click('[data-a=notifTest]');
    ok(await q.evaluate(() => window.__now.length === 1 && /^ Сповіщення працюють/.test(window.__now[0])), 'кнопка «надіслати тестове» показує сповіщення');
    await q.close();
  }

  console.log('8k. Gemini: швидкість і зависання');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const bodies = [];
    await q.route('**/generativelanguage.googleapis.com/**', r => { const m = r.request().url().match(/models\/([^:]+)/)[1]; bodies.push({ m, b: JSON.parse(r.request().postData() || '{}') });
      if (m === 'gemini-2.5-flash') return; // hangs — never answers
      r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"overloaded"}}' }); });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    const res = await q.evaluate(async () => {
      Keys.set('AQ.testkey1234567890abcdef'); geminiOk = ''; GEMINI_TIMEOUT = 1500;
      const t0 = Date.now(); let err = '', r = null;
      try { r = await buildRecipe('Карбонара', 2); } catch (e) { err = e.message; }
      return { ms: Date.now() - t0, src: r && r.source, n: r && r.ingredients.length, err };
    });
    ok(bodies[0] && bodies[0].b.generationConfig.thinkingConfig && bodies[0].b.generationConfig.thinkingConfig.thinkingBudget === 0, 'gemini-2.5: «думання» вимкнено — відповідає швидше');
    ok(res.src === 'builtin' && res.n > 3, `Gemini завис/перевантажений → вбудований рецепт карбонари за ${Math.round(res.ms / 1000)} с`);
    await q.close();
  }

  console.log('8l. Сканер цінників');
  {
    const fx = n => path.join(__dirname, 'fixtures', n);
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    const tags = [
      { name: 'Молоко 2,5%', brand: 'Галичина', price: 46.9, oldPrice: 52.5, weighted: false, size: '900 г', store: 'АТБ', ok: true },
      { name: 'Банани', brand: '', price: 64.9, oldPrice: 0, weighted: true, size: '', store: '', ok: true }];
    let k = 0;
    await q.route('**/generativelanguage.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(tags[k++]) }] } }] }) }));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { Keys.set('AQ.testkey1234567890abcdef'); go('shop'); }); await q.waitForTimeout(150);
    const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-a=scanStart]')]); await fc.setFiles(fx('product.jpg'));
    await q.waitForSelector('#scName', { timeout: 8000 }); await q.waitForTimeout(200);
    const f1 = await q.evaluate(() => ({ n: $('#scName').value, p: $('#scPrice').value, st: $('#scStore').value, sale: !!$('#sheetBody .small.green') }));
    ok(/Молоко/.test(f1.n) && f1.p === '46.9' && f1.st === 'АТБ' && f1.sale, 'цінник прочитано: назва, ціна, магазин, акція');
    await q.screenshot({ path: shots + '19-scan.png' });
    const [fc2] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-a=scanAdd][data-more="1"]')]); await fc2.setFiles(fx('product.jpg'));
    await q.waitForSelector('#scName', { timeout: 8000 }); await q.waitForTimeout(200);
    ok(await q.evaluate(() => S.shop.length === 1 && S.shop[0].bought && S.shop[0].price === 46.9 && $('#scStore').value === 'АТБ' && /кг/.test($('#sheetBody').textContent)), '«У кошик і ще» → одразу наступний цінник, магазин запамʼятовано; ваговий товар питає вагу');
    await q.click('[data-a=scanAdd]:not([data-more])'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.shop.length === 1), 'без ваги ваговий товар не додається');
    await q.fill('#scQty', '1,2'); await q.click('[data-a=scanAdd]:not([data-more])'); await q.waitForTimeout(200);
    ok(await q.evaluate(() => S.shop.length === 2 && S.shop[1].price === 77.88 && S.shop[1].qty === '1,2 кг'), 'банани 1,2 кг × 64,90 = 77,88 ₴ у кошику');
    await q.evaluate(() => A.shopToExpense()); await q.waitForTimeout(200);
    ok(await q.evaluate(() => S.tx.some(t => t.amount === 124.78 && /АТБ/.test(t.note)) && !S.shop.length), 'кошик → витрата 124,78 ₴');
    ok(e2.length === 0, 'без JS-помилок (сканер) ' + e2.join('; '));
    await q.close();
  }

  console.log('8m. Цілі: N разів на тиждень / місяць');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { U.stack = []; go('more'); navigate('goals'); A.fab(); }); await q.waitForTimeout(350);
    await q.fill('#gTitle', 'Спортзал'); await q.click('[data-group=gPer][data-val=week]'); await q.waitForTimeout(100);
    ok(await q.locator('#gTimesBox:visible').count() === 1, 'для «на тиждень» зʼявляється «скільки разів»');
    await q.click('[data-a=goalTimes][data-d="-1"]'); await q.click('[data-a=goalSave]'); await q.waitForTimeout(200);
    const g = await q.evaluate(() => S.goals[0]);
    ok(g.per === 'week' && g.times === 2, 'збережено: спортзал 2 рази на тиждень');
    const st = await q.evaluate(() => {
      const g = S.goals[0], mon = mondayOf(today());
      const a = { urgent: Goals.urgent(g), left: Goals.left(g), daysLeft: Goals.daysLeft(g) };
      g.log = { [mon]: 1, [addDays(mon, 1) <= today() ? addDays(mon, 1) : mon]: 1 }; if (Object.keys(g.log).length < 2) g.log[addDays(mon, -7)] = 1;
      g.log = {}; g.log[mon] = 1; g.log[addDays(mon, 2)] = 1; // two visits this week → target met
      save();
      const rem = REMINDER_PROVIDERS.flatMap(f => f()).filter(r => r.id.startsWith('goal-' + g.id) && r.at < parseYmd(addDays(mon, 7)).getTime());
      return { ...a, metLeft: Goals.left(g), pend: Goals.pending().length, rem: rem.length, txt: goalText(g) };
    });
    ok(st.left === 2 && st.urgent === (st.daysLeft <= 2), `без відміток: «треба сьогодні» лише коли днів лишилось ≤ 2 (зараз ${st.daysLeft})`);
    ok(st.metLeft === 0 && st.pend === 0 && st.rem === 0 && /2 з 2/.test(st.txt), 'ціль тижня виконано — без бубочки й нагадувань до наступного тижня');
    await q.evaluate(() => navigate('goal', { id: S.goals[0].id })); await q.waitForTimeout(150);
    ok(await q.evaluate(() => /2\/2/.test($('.goal-big').textContent.replace(/\s/g, '')) && /тижнів поспіль/.test($('#view').textContent)), 'сторінка цілі: 2/2 цього тижня, тижнів поспіль');
    await q.evaluate(() => settingsSheet()); await q.waitForTimeout(200);
    ok(e2.length === 0, 'без JS-помилок (частота цілей) ' + e2.join('; '));
    await q.close();
  }

  console.log('8n. Анімації: вібрація, переходи, свайпи, числа');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.addInitScript(() => { window.__vib = []; window.AndroidBridge = { vibrate: k => window.__vib.push(k) }; });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { S.tasks.push({ id: 't1', title: 'Помити авто', note: '', prio: 2, due: '', done: false }, { id: 't2', title: 'Купити квіти', note: '', prio: 2, due: '', done: false }); save(); go('home'); });
    await q.waitForTimeout(150);
    await q.click('[data-a=taskToggle][data-id=t1]'); await q.waitForTimeout(100);
    ok(await q.evaluate(() => window.__vib[0] === 'tick' && S.tasks.find(t => t.id === 't1').done), 'галочка — легка вібрація');
    const swipe = async (sel, dx) => q.evaluate(([sel, dx]) => {
      const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const t = cx => new Touch({ identifier: 7, target: el, clientX: cx, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x)], changedTouches: [t(x)] }));
      for (let i = 1; i <= 6; i++) el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(x + dx * i / 6)], changedTouches: [t(x + dx * i / 6)] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx)] }));
    }, [sel, dx]);
    await swipe('.item[data-id=t2]', -160); await q.waitForTimeout(400);
    ok(await q.evaluate(() => !S.tasks.some(t => t.id === 't2') && $('#undoBar.show') && window.__vib.includes('heavy')), 'свайп ← видаляє, зʼявляється «Повернути»');
    await q.click('#undoBar [data-a=undoSwipe]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.tasks.some(t => t.id === 't2')), '«Повернути» відновлює запис');
    await swipe('.item[data-id=t2]', 160); await q.waitForTimeout(400);
    ok(await q.evaluate(() => S.tasks.find(t => t.id === 't2').done), 'свайп → позначає виконаним');
    await q.evaluate(() => navigate('goals')); await q.waitForTimeout(60);
    ok(await q.evaluate(() => $('#view').classList.contains('pg-fwd')), 'нова сторінка виїжджає справа');
    await q.evaluate(() => back()); await q.waitForTimeout(60);
    ok(await q.evaluate(() => $('#view').classList.contains('pg-back')), 'назад — зліва');
    await q.evaluate(() => { U.seg.fin = 'overview'; go('finance'); }); await q.waitForTimeout(150);
    await q.evaluate(() => { Fin.add({ type: 'inc', amount: 1000, cat: 'salary', note: '' }); save(); render(); }); await q.waitForTimeout(120);
    const mid = await q.evaluate(() => $('.fin-tiles .ft b').textContent);
    await q.waitForTimeout(700);
    const end = await q.evaluate(() => $('.fin-tiles .ft b').textContent);
    ok(/1\s?000/.test(end.replace(/ /g, ' ')) && mid !== end, `суми «перекручуються» до нового значення (${mid.trim()} → ${end.trim()})`);
    await q.evaluate(() => toast('🎉 Ціль цього тижня виконано'));
    ok(await q.evaluate(() => window.__vib.includes('success')), 'успіх — особлива вібрація (без конфеті)');
    ok(e2.length === 0, 'без JS-помилок (анімації) ' + e2.join('; '));
    await q.close();
  }

  console.log('8o. Платежі, чек, підсумок тижня');
  {
    const fx = n => path.join(__dirname, 'fixtures', n);
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.route('**/generativelanguage.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(
      { ok: true, store: 'Сільпо', date: '', total: 412.6, cat: 'food', items: [{ name: 'Молоко', price: 46.9 }, { name: 'Хліб', price: 32 }, { name: 'Сир', price: 333.7 }] }) }] } }] }) }));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { Keys.set('AQ.testkey1234567890abcdef'); U.seg.fin = 'overview'; go('finance'); }); await q.waitForTimeout(150);
    await q.click('[data-a=billNew]'); await q.waitForTimeout(350);
    await q.fill('#bAmount', '350'); await q.fill('#bName', 'Інтернет'); await q.evaluate(() => { $('#bNext').value = addDays(today(), 2); });
    await q.click('[data-a=billSave]'); await q.waitForTimeout(200);
    const b1 = await q.evaluate(() => ({ n: S.bills.length, cat: S.bills[0].cat, rem: REMINDER_PROVIDERS.flatMap(f => f()).filter(r => /^bill/.test(r.id)).map(r => ({ d: ymd(new Date(r.at)), page: r.page })), card: !!$('#view [data-a=billPay]') }));
    ok(b1.n === 1 && b1.cat === 'utils' && b1.rem.length === 2 && b1.rem.every(r => r.page === 'bills') && b1.card, 'регулярний платіж: картка в «Огляді», нагадування за 3 дні й у день');
    await q.click('#view [data-a=billPay]'); await q.waitForTimeout(200);
    ok(await q.evaluate(() => S.tx.some(t => t.amount === 350 && /Інтернет/.test(t.note)) && S.bills[0].next === addMonthsYmd(addDays(today(), 2), 1)), '«Оплачено» → витрата і наступна дата через місяць');
    const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-a=receiptStart]')]); await fc.setFiles(fx('product.jpg'));
    await q.waitForSelector('#rcTotal', { timeout: 8000 }); await q.waitForTimeout(150);
    ok(await q.evaluate(() => $('#rcTotal').value === '412.6' && $('#rcStore').value === 'Сільпо' && /Позиції в чеку \(3\)/.test($('#sheetBody').textContent)), 'чек прочитано: сума, магазин, 3 позиції');
    await q.click('[data-a=receiptSave]'); await q.waitForTimeout(200);
    ok(await q.evaluate(() => { const t = S.tx.find(x => x.amount === 412.6); return t && t.cat === 'food' && /Сільпо: Молоко, Хліб, Сир/.test(t.note) && !!t.photo; }), 'витрату з чека записано разом із фото чека');
    await q.evaluate(() => { window.__openPage('week'); }); await q.waitForTimeout(200);
    ok(await q.evaluate(() => U.stack.at(-1).page === 'week' && /витрачено/.test($('#view').textContent)), 'сповіщення «Підсумок тижня» відкриває сторінку підсумку');
    ok(await q.evaluate(() => REMINDER_PROVIDERS.flatMap(f => f()).some(r => /^week-/.test(r.id) && new Date(r.at).getDay() === 0 && new Date(r.at).getHours() === 19)), 'підсумок тижня — неділя, 19:00');
    ok(e2.length === 0, 'без JS-помилок (платежі/чек/тиждень) ' + e2.join('; '));
    await q.close();
  }

  console.log('8p. Голос, спільний список, автокопія');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.addInitScript(() => {
      window.__said = ['завтра о 10 стоматолог', 'витратила 250 на каву', 'купити молоко, хліб і яйця'];
      window.__bk = { uri: false, data: '' }; window.__shared = [];
      window.AndroidBridge = {
        listenStart: () => { const t = window.__said.shift() || ''; setTimeout(() => { window.__voiceReady && window.__voiceReady(); window.__voiceRms && window.__voiceRms(6); window.__voicePartial && window.__voicePartial(t.split(' ').slice(0, 2).join(' ')); window.__seenOv = (window.__seenOv || 0) + (document.querySelector('#vcOv .vc-wave') ? 1 : 0); }, 30); setTimeout(() => window.__voiceCb(t), 120); }, listenStop: () => {},
        share: t => window.__shared.push(t),
        pickBackup: () => { window.__bk.uri = true; setTimeout(() => window.__bkPicked(true), 30); }, hasBackup: () => window.__bk.uri, backupName: () => 'LAD-backup.json',
        writeBackup: j => { window.__bk.data = j; return true; }, forgetBackup: () => { window.__bk.uri = false; }, openBackup: () => setTimeout(() => window.__bkOpened(window.__bk.data), 30)
      };
    });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => go('home')); await q.waitForTimeout(150);
    // no Gemini key → offline parser
    await q.click('#top [data-a=voiceStart]'); await q.waitForSelector('[data-a=vcSave]', { timeout: 4000 });
    await q.waitForTimeout(300);
    ok(await q.evaluate(() => window.__seenOv >= 1 && !document.querySelector('#vcOv')), 'власне вікно «Говоріть…» з хвилею показано і закрито після фрази');
    ok(await q.evaluate(() => !!U.vc && U.vc.r.kind === 'event' && U.vc.r.date === addDays(today(), 1) && U.vc.r.time === '10:00' && /Стоматолог/.test(U.vc.r.title)), '«завтра о 10 стоматолог» → подія на завтра о 10:00');
    await q.click('[data-a=vcSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.events.some(e => /Стоматолог/.test(e.title) && e.time === '10:00')), 'подію додано');
    await q.click('#top [data-a=voiceStart]'); await q.waitForSelector('[data-a=vcSave]', { timeout: 4000 });
    await q.click('[data-a=vcSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.tx.some(t => t.type === 'exp' && t.amount === 250)), '«витратила 250 на каву» → витрата 250 ₴');
    await q.click('#top [data-a=voiceStart]'); await q.waitForSelector('[data-a=vcSave]', { timeout: 4000 });
    await q.click('[data-a=vcSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => ['молоко', 'хліб', 'яйця'].every(n => S.shop.some(i => i.name === n))), '«купити молоко, хліб і яйця» → 3 товари в покупки');
    // shared list
    await q.evaluate(() => go('shop')); await q.waitForTimeout(150);
    await q.click('#top [data-a=shopShare]'); await q.waitForTimeout(100);
    const sent = await q.evaluate(() => window.__shared.at(-1));
    ok(/☐ молоко/.test(sent) && /☐ яйця/.test(sent), 'список покупок надіслано текстом');
    await q.click('#top [data-a=shopPaste]'); await q.waitForTimeout(350);
    await q.fill('#plText', '🛒 Список покупок\n☐ Сметана — 300 г\n☐ Кріп\n\nНадіслано з ЛАД'); await q.click('[data-a=shopPasteDo]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.shop.some(i => i.name === 'Сметана' && i.qty === '300 г') && S.shop.some(i => i.name === 'Кріп') && !S.shop.some(i => /Надіслано/.test(i.name))), 'вставлений список додано в покупки');
    // backup
    await q.evaluate(() => settingsSheet('backup')); await q.waitForTimeout(250);
    await q.click('[data-a=bkPick]'); await q.waitForTimeout(400);
    ok(await q.evaluate(() => { const d = JSON.parse(window.__bk.data); return d.app === 'tanichka' && d.data.shop.length >= 5 && !!S.settings.lastBackup; }), 'автокопію увімкнено, перша копія записана у файл');
    await q.evaluate(() => { S.shop = []; save(); closeSheet(); settingsSheet(); }); await q.waitForTimeout(300);
    await q.click('[data-a=bkRestore]'); await q.waitForTimeout(400);
    ok(await q.evaluate(() => $('#impText') && $('#impText').value.length > 100), '«Відновити з файлу» підставляє копію в імпорт');
    ok(e2.length === 0, 'без JS-помилок (голос/список/копія) ' + e2.join('; '));
    await q.close();
  }

  console.log('8q. Віджет');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.addInitScript(() => { window.__w = null; window.__wq = '[]'; window.AndroidBridge = { setWidget: j => { window.__w = JSON.parse(j); }, takeWidgetToggles: () => { const x = window.__wq; window.__wq = '[]'; return x; } }; });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => {
      S.events.push({ id: 'e1', title: 'Стоматолог', date: today(), time: '10:30', note: '', important: true, remind: '' });
      S.tasks.push({ id: 't1', title: 'Купити квіти', note: '', prio: 2, due: today(), done: false });
      S.goals.push({ id: 'g1', type: 'habit', title: 'Читати', per: 'day', log: {}, attempts: [] }); save();
    });
    await q.waitForTimeout(1200);
    const w = await q.evaluate(() => window.__w);
    const t = await q.evaluate(() => today());
    ok(w && w.days[t].items.some(x => /10:30\s+Стоматолог/.test(x)) && w.days[t].items.some(x => /Купити квіти/.test(x)) && w.goals[0].title === 'Читати', 'віджет отримує події, плани й цілі на сьогодні');
    await q.evaluate(d => { window.__wq = JSON.stringify([{ id: 'g1', date: d, on: true }]); window.__onResume && window.__onResume(); }, t); await q.waitForTimeout(300);
    ok(await q.evaluate(() => Goals.doneToday(S.goals[0])), 'галочка, поставлена на віджеті, зʼявляється в додатку');
    ok(e2.length === 0, 'без JS-помилок (віджет) ' + e2.join('; '));
    await q.close();
  }

  console.log('8r. Голос + Gemini: миттєво, потім уточнення');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    let model = '';
    await q.route('**/generativelanguage.googleapis.com/**', async r => { model = r.request().url().match(/models\/([^:]+)/)[1]; await new Promise(x => setTimeout(x, 1500));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ kind: 'expense', title: 'Кава з подругою', amount: 250, cat: 'cafe', date: '', time: '', items: [] }) }] } }] }) }); });
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    const t0 = Date.now();
    await q.evaluate(() => { Keys.set('AQ.testkey1234567890abcdef'); startVoice('витратила 250 на каву з подругою'); });
    await q.waitForSelector('[data-a=vcSave]', { timeout: 3000 }); const first = Date.now() - t0;
    const early = await q.evaluate(() => ({ kind: U.vc.r.kind, amt: U.vc.r.amount, ai: !!$('.vc-ai') }));
    ok(first < 600 && early.kind === 'expense' && early.amt === 250 && early.ai, `результат одразу (${first} мс), Gemini уточнює у фоні`);
    await q.waitForTimeout(2000);
    ok(await q.evaluate(() => U.vc.r.cat === 'cafe' && !$('.vc-ai')) && model === 'gemini-2.5-flash-lite', 'уточнення від найшвидшої моделі (flash-lite) підставлено');
    await q.close();
  }

  console.log('8s. Голос: ключові слова, дата видна й редагується');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    const r = await q.evaluate(() => { const a = parseLocal('запиши у витрати купівлю телевізора за 13890 грн'); const b = parseLocal('післязавтра подія день народження Олі'); return { a, b, d2: addDays(today(), 2) }; });
    ok(r.a.kind === 'expense' && r.a.amount === 13890 && r.a.title === 'Купівлю телевізора', '«запиши у витрати … 13890 грн» → одразу витрата 13 890 ₴');
    ok(r.b.kind === 'event' && r.b.date === r.d2 && r.b.title === 'День народження Олі', '«післязавтра подія …» → подія на післязавтра');
    await q.evaluate(() => startVoice('на 10:00 манікюр')); await q.waitForTimeout(400);
    ok(await q.evaluate(() => $('#vcDate').value === today() && /Сьогодні/.test($('#sheetBody').textContent)), 'дату видно у вікні');
    await q.click('[data-a=vcKind][data-v=income]'); await q.waitForTimeout(150);
    await q.click('[data-a=vcKind][data-v=shop]'); await q.waitForTimeout(150);
    await q.click('[data-a=vcKind][data-v=event]'); await q.waitForTimeout(150);
    await q.evaluate(() => { $('#vcDate').value = addDays(today(), 3); }); await q.click('[data-a=vcSave]'); await q.waitForTimeout(150);
    ok(await q.evaluate(() => S.events.some(e => e.title === 'Манікюр' && e.date === addDays(today(), 3) && e.time === '10:00')), 'тип перемикається без помилок, змінена дата зберігається');
    ok(e2.length === 0, 'без JS-помилок (голос) ' + e2.join('; '));
    await q.close();
  }

  console.log('8t. Головна: перегортання «Цілі» ⇄ «Мої плани»');
  {
    const q = await b.newPage({ viewport: { width: 390, height: 844 } });
    const e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(URL); await q.evaluate(() => { localStorage.clear(); }); await q.reload();
    await q.evaluate(() => { S.goals.push({ id: 'g1', type: 'habit', title: 'Читати', per: 'day', log: {}, attempts: [] }); S.tasks.push({ id: 't1', title: 'Помити авто', prio: 2, due: '', done: false, note: '' }); save(); go('home'); });
    await q.waitForTimeout(300);
    ok(await q.locator('#hpager > section').count() === 2 && await q.locator('#hpTabs button').count() === 2, 'дві сторінки й вкладки над ними');
    await q.click('#hpTabs [data-i="1"]'); await q.waitForTimeout(700);
    ok(await q.evaluate(() => U.hpIdx === 1 && Math.abs($('#hpager').scrollLeft - $('#hpager').clientWidth) < 2), 'натискання на «Мої плани» перегортає сторінку');
    await q.evaluate(() => { const pg = $('#hpager'); pg.scrollLeft = 0; }); await q.waitForTimeout(400);
    ok(await q.evaluate(() => U.hpIdx === 0), 'перегортання назад (свайп) повертає «Цілі»');
    await q.click('[data-a=goalCheck]'); await q.waitForTimeout(200);
    ok(await q.evaluate(() => U.hpIdx === 0 && $('#hpager').scrollLeft < 2), 'після відмітки сторінка не стрибає');
    ok(e2.length === 0, 'без JS-помилок (перегортання) ' + e2.join('; '));
    await q.close();
  }

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
    await q.evaluate(() => { S.shop.push({ id: 'b1', name: 'Йогурт грецький', qty: '', price: 54.9, dish: 'Інше', store: 'Сільпо', bought: true, url: 'https://x.ua/p' }, { id: 'b2', name: 'Кефір', qty: '', price: 40, dish: 'Інше', store: 'АТБ', bought: false, url: 'https://x.ua/k' }); save(); U.shopMode = 'all'; go('shop'); });
    ok(await q.locator('[data-a=favFromShop]').count() === 0 && await q.locator('.go-link').count() === 1, 'у покупках немає «в улюблені», посилання на товар — кнопкою');
    await q.evaluate(() => { U.stack = []; go('more'); navigate('favs'); });
    const [fc] = await Promise.all([q.waitForEvent('filechooser'), q.click('[data-a=favAdd]')]); await fc.setFiles(fx('product.jpg'));
    await q.waitForSelector('.ad-preview img', { timeout: 10000 }); await q.waitForTimeout(300);
    await q.fill('#fvName', 'Йогурт грецький'); await q.fill('#fvStore', 'Сільпо');
    ok(await q.evaluate(() => !!U.favNew.cut), 'Ще → Улюблені → фото → фон вирізано');
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
    await p.evaluate(() => { U.stack = []; S.favs = []; navigate('favs'); });
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-a=favAdd]')]); await fc2.setFiles(fx('product.jpg'));
    await p.waitForSelector('.ad-preview img', { timeout: 10000 });
    ok(await p.evaluate(() => !U.favNew.cut && !!U.favNew.ad && /Android/.test(U.favNew.cutErr)), 'без модуля вирізання — красива рамка з поясненням');
    await p.evaluate(() => { U.favNew = null; U.stack = []; go('home'); });
  }

  console.log('8d. Автовиправлення слів');
  await p.evaluate(() => { U.stack = []; go('shop'); shopSheet(); }); await p.waitForTimeout(400);
  await p.fill('#sfName', 'Маонез'); await p.click('#sfQty'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => $('#sfName').value === 'Майонез' && /Маонез → /.test($('.spell-hint').textContent)), 'описка виправлена: Маонез → Майонез');
  await p.click('[data-a=spellUndo]');
  ok(await p.evaluate(() => $('#sfName').value === 'Маонез'), '«Повернути» скасовує виправлення');
  ok(await p.evaluate(() => Spell.fix('Записатися до стоматолга').text === 'Записатися до стоматолога' && Spell.fix('Подзвонити Олі').text === 'Подзвонити Олі'), 'відмінки враховуються, імена не чіпаються');
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(300);
  await p.evaluate(() => { U.calView = 'week'; go('calendar'); });
  ok(await p.evaluate(() => $$('[data-a=calView]')[0].dataset.v === 'week' && $('[data-a=calView].on').dataset.v === 'week'), 'календар відкривається на тижні, «Тиждень» перший');

  console.log('8e. Вибір дати й часу (барабани)');
  await p.evaluate(() => { U.stack = []; go('calendar'); eventSheet(null, today()); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $('#eDate').type === 'hidden' && !!$('.pick-btn[data-for=eDate]') && !!$('.pick-btn[data-for=eTime]')), 'системні поля дати/часу замінено кнопками');
  await p.click('.pick-btn[data-for=eTime]'); await p.waitForTimeout(350);
  ok(await p.locator('#pickerWrap.open #pkH').count() === 1 && await p.locator('#sheetWrap.open').count() === 1, 'барабани часу відкриваються поверх форми');
  await p.screenshot({ path: shots + '04c-timepicker.png' });
  for (const [w, i] of [['pkH', 19], ['pkMi', 2]]) { await p.evaluate(([w, i]) => { const el = document.getElementById(w); el.scrollTop = i * 44; el.dispatchEvent(new Event('scroll')); }, [w, i]); await p.waitForTimeout(220); }
  await p.click('[data-a=pickDone]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $('#eTime').value === '19:10' && /19:10/.test($('.pick-btn[data-for=eTime]').textContent)), 'час 19:10 обрано барабанами');
  await p.click('.pick-btn[data-for=eDate]'); await p.waitForTimeout(350);
  await p.screenshot({ path: shots + '04d-datepicker.png' });
  await p.evaluate(() => { const el = $('#pkM'); el.scrollTop = 1 * 44; el.dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(250);
  await p.evaluate(() => { const el = $('#pkD'); el.scrollTop = 30 * 44; el.dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(250);
  ok(await p.evaluate(() => $$('#pkD .pk-it').length <= 29 && Picker.st.d <= 29), 'лютий: днів у барабані менше, день обмежено');
  await p.click('.picker button[data-a=pickCancel]'); await p.waitForTimeout(300);
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(300);

  console.log('8c. Налаштування + фото профілю');
  {
    await p.evaluate(() => { S.settings.pin = ''; save(); U.stack = []; go('home'); });
    await p.click('[data-a=settings]'); await p.waitForTimeout(400);
    ok(await p.locator('#sheetBody .st-row').count() >= 6 && await p.locator('#sheetBody .st-ic svg path[fill^="url(#gemG)"]').count() === 1 && await p.locator('#sheetBody input').count() === 0, 'меню: чистий список без зайвого тексту, значок Gemini');
    await p.click('#sheetBody [data-a=stOpen][data-v=profile]'); await p.waitForTimeout(250);
    await p.fill('#stName', 'Танічка'); await p.evaluate(() => closeSheet()); await p.waitForTimeout(300);
    ok(await p.evaluate(() => S.settings.name === 'Танічка'), 'імʼя зберігається без кнопки «Зберегти»');
    await p.click('[data-a=settings]'); await p.waitForTimeout(400); await p.click('#sheetBody [data-a=stOpen][data-v=profile]'); await p.waitForTimeout(250);
    const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-a=avatarMenu]')]); await fc3.setFiles(path.join(__dirname, 'fixtures', 'product.jpg'));
    await p.waitForSelector('#cropWrap img', { timeout: 5000 }); await p.waitForTimeout(300);
    await p.fill('#cropZoom', '2'); await p.evaluate(() => $('#cropZoom').dispatchEvent(new Event('input')));
    const box = await p.locator('#cropWrap').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 }); await p.mouse.up();
    await p.screenshot({ path: shots + '12b-crop.png' });
    await p.click('[data-a=cropDone]'); await p.waitForTimeout(700);
    const av = await p.evaluate(async () => { const d = await Photos.get(S.settings.avatar); const i = new Image(); i.src = d; await i.decode(); return { w: i.width, h: i.height, head: !!$('#top .head-ava') }; });
    ok(av.w === 480 && av.h === 480 && av.head, 'фото обрізано (480×480) і показано в шапці');
    await p.screenshot({ path: shots + '12c-settings.png', fullPage: true });
    await p.evaluate(() => closeSheet());
  }

  console.log('9. Видалення даних');
  await p.evaluate(() => navigate('cycle')); await p.click('[data-a=cycWipe]'); await p.waitForTimeout(350); await p.click('[data-a=askYes]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => S.cycle.periods.length === 0), 'дані циклу видалено');

  console.log('\nJS-помилки:', errs.length ? errs : 'немає');
  if (errs.length) fails++;
  console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'УСІ ПЕРЕВІРКИ ПРОЙДЕНО');
  await b.close();
})();
