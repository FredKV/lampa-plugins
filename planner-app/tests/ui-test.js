const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html');
const shots = process.env.SHOTS_DIR || require('os').tmpdir() + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const weather = { current: { time: new Date().toISOString().slice(0, 13) + ':00', temperature_2m: 3.4, apparent_temperature: -1.2, relative_humidity_2m: 81, precipitation: 0.2, weather_code: 61, wind_speed_10m: 5.3, is_day: 1 },
  hourly: { time: [...Array(48)].map((_, i) => { const t = new Date(); t.setMinutes(0,0,0); t.setHours(t.getHours() + i); return new Date(t - t.getTimezoneOffset()*60000).toISOString().slice(0,16); }), temperature_2m: [...Array(48)].map((_, i) => 3 + Math.sin(i / 4) * 3), precipitation_probability: [...Array(48)].map((_, i) => (i * 7) % 90), weather_code: [...Array(48)].map((_, i) => [0, 2, 3, 61][i % 4]) },
  daily: { time: [...Array(7)].map((_, i) => d(i)), weather_code: [61, 3, 0, 2, 71, 95, 1], temperature_2m_max: [5, 6, 8, 4, 1, 7, 9], temperature_2m_min: [0, 1, 2, -1, -4, 2, 3], precipitation_probability_max: [80, 20, 0, 10, 60, 70, 5], precipitation_sum: [3, 0, 0, 0, 2, 5, 0], wind_speed_10m_max: [6, 4, 3, 5, 7, 9, 2] } };
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
  await p.route('**/generativelanguage.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(geminiPrices) }));
  await p.route('**/google.com/s2/**', r => r.fulfill({ status: 404 }));

  console.log('1. Міграція v1 → v2');
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
  ok(st.v === 2, 'схема v2'); ok(st.cc.some(c => c.id === 'home' && c.name === 'Дім'), 'стара категорія «Дім» збережена як власна');
  ok(st.pay.every(x => x === 'card'), 'спосіб оплати проставлено'); ok(!st.key && st.dev === 'AIzaLegacyKey1234567890' && !st.legacy, 'ключ перенесено з даних у захищене сховище');
  ok(st.bak, 'резервна копія v1 створена'); ok(st.tasks === 2 && st.tab === 'home', 'плани збережені, стара вкладка → Головна');
  await p.screenshot({ path: shots + '01-home.png' });

  console.log('2. Фінанси');
  await p.click('[data-tab=finance]'); await p.waitForTimeout(150);
  ok(await p.locator('.donut').count() === 1, 'діаграма категорій'); ok(await p.locator('.bars').count() === 1, 'порівняння місяців');
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
  await p.click('[data-a=cycStart]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!Cycle.ongoing()), 'менструація почалась сьогодні (кнопка в календарі)');
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

  console.log('7. Пошук цін');
  await p.evaluate(() => { U.stack = []; navigate('prices'); }); await p.waitForTimeout(100);
  await p.fill('#priceQ', 'AirPods Pro 2'); await p.click('[data-a=priceGo]'); await p.waitForTimeout(500);
  const pr = await p.evaluate(() => S.prices.last);
  ok(pr.offers.length === 3 && pr.rejected === 1, `пропозиції ${pr.offers.length}, відкинуто ${pr.rejected}`);
  ok(pr.offers[0].store === 'Comfy' && pr.offers[0].total === 8898, 'сортування з доставкою, найвигідніше: ' + pr.offers[0].store);
  ok(await p.locator('text=Оновлено').count() > 0, 'час оновлення показано');
  await p.screenshot({ path: shots + '09-prices.png', fullPage: true });
  await p.click('[data-a=priceFav]'); await p.waitForTimeout(150);
  await p.click('[data-a=pfTrack]'); await p.waitForTimeout(350); await p.fill('#askNum', '9000'); await p.click('[data-a=askNumOk]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => S.prices.favs[0].track && S.prices.favs[0].hit), 'відстеження + ціль досягнута');
  await p.screenshot({ path: shots + '10-pricefav.png', fullPage: true });

  console.log('8. Кухня / покупки / ще / налаштування / PIN');
  await p.evaluate(() => { Keys.set(''); U.stack = []; U.seg.shop = 'kitchen'; U.kitchen = null; U.kError = ''; go('shop'); });
  await p.click('[data-d="Борщ"]'); await p.waitForTimeout(200);
  ok(await p.locator('text=Офлайн-рецепт').count() === 1, 'вбудований рецепт без ключа');
  await p.click('[data-a=kApprove]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => S.shop.length > 5), 'інгредієнти → список покупок');
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

  console.log('9. Видалення даних');
  await p.evaluate(() => navigate('cycle')); await p.click('[data-a=cycWipe]'); await p.waitForTimeout(350); await p.click('[data-a=askYes]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => S.cycle.periods.length === 0), 'дані циклу видалено');

  console.log('\nJS-помилки:', errs.length ? errs : 'немає');
  if (errs.length) fails++;
  console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'УСІ ПЕРЕВІРКИ ПРОЙДЕНО');
  await b.close();
})();
