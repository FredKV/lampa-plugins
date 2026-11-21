// Live check against the real store catalogues (needs internet + curl). Usage: node tests/live-prices.js борщ
// RECORD=tests/fixtures/x.json also saves trimmed responses as a fixture for ui-test.js.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const stats = {};
  const { execFile } = require('child_process');
  const curl = (url, hdrs) => new Promise(res => execFile('curl', ['-s', '-m', '40', '-w', '\n__STATUS__%{http_code}', ...Object.entries(hdrs).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), url], { maxBuffer: 50e6 }, (e, out) => {
    const i = out.lastIndexOf('\n__STATUS__'); res({ status: i >= 0 ? +out.slice(i + 11) : 0, body: i >= 0 ? out.slice(0, i) : '' });
  }));
  for (const host of ['stores-api.zakaz.ua', 'sf-ecom-api.silpo.ua', 'www.atbmarket.com']) {
    await p.route(`https://${host}/**`, async route => {
      const r = await curl(route.request().url(), { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'uk' });
      stats[host] = (stats[host] || 0) + 1;
      if (global.REC) global.REC.push({ url: route.request().url(), status: r.status, body: r.body });
      await route.fulfill({ status: r.status || 502, body: r.body, headers: { 'access-control-allow-origin': '*', 'content-type': host.includes('atb') ? 'text/html; charset=utf-8' : 'application/json' } });
    });
  }
  if (process.env.RECORD) global.REC = [];
  await p.goto(URL);
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.evaluate(() => navigate('prices'));
  await p.waitForTimeout(3000);
  await p.fill('#dpDish', process.argv[2] || 'борщ'); await p.click('[data-a=dpBuild]'); await p.waitForTimeout(500);
  console.log(await p.evaluate(() => U.dp.recipe.ingredients.map(i => `${i.have ? '[є] ' : ''}${i.name}: ${amountLabel(i)} q=${searchSpec(i).query} must=${searchSpec(i).must}`).join('\n')));
  const t0 = Date.now();
  await p.click('[data-a=rcSearch]');
  await p.waitForFunction(() => !DP.loading && U.dp.recipe.results, null, { timeout: 180000 });
  console.log('search took', (Date.now() - t0) / 1000, 's', stats);
  const out = await p.evaluate(() => {
    const r = U.dp.recipe, a = analyze(r);
    const lines = r.results.stores.map(s => `${s.name}: ok ${s.ok} fail ${s.fail} ${s.err}`);
    lines.push('--- per store'); a.perStore.forEach(x => lines.push(`${x.s.name}: here ${x.total} full ${x.full} found ${x.found.length}/${a.ings.length} missing: ${x.missing.map(i => i.name).join(', ')}`));
    lines.push(`combined ${a.combinedTotal} saving ${a.saving} nowhere: ${a.nowhere.map(i => i.name)}`);
    lines.push('--- chosen'); a.chosen.forEach(c => lines.push(c.o ? `${c.ing.name} → ${c.store.name}: ${c.o.title} | ${c.o.buy} = ${c.o.cost} (${c.o.perKg}${c.o.unitLbl})` : `${c.ing.name} → —`));
    return lines.join('\n');
  });
  console.log(out);
  await p.screenshot({ path: require('os').tmpdir() + '/live.png', fullPage: true });
  await p.evaluate(() => { DP.view = 'stores'; render(); }); await p.screenshot({ path: require('os').tmpdir() + '/live-stores.png', fullPage: true });
  console.log('errors', errs);
  if (global.REC) {
    const trim = x => {
      if (x.url.includes('zakaz.ua') && x.url.includes('/search/')) { const d = JSON.parse(x.body); d.results = d.results.map(r => ({ title: r.title, price: r.price, unit: r.unit, weight: r.weight, volume: r.volume, pack_amount: r.pack_amount, quantity: r.quantity, in_stock: r.in_stock, web_url: r.web_url, img: r.img ? { s150x150: r.img.s150x150 } : null })); return { results: d.results }; }
      if (x.url.includes('zakaz.ua')) return JSON.parse(x.body).map(r => ({ id: r.id, retail_chain: r.retail_chain, city: r.city, name: r.name, is_active: r.is_active }));
      if (x.url.includes('/branches?')) return { items: JSON.parse(x.body).items.map(b => ({ branchId: b.branchId, cityFull: b.cityFull, hasPickup: b.hasPickup })) };
      if (x.url.includes('silpo')) return { items: JSON.parse(x.body).items.map(r => ({ title: r.title, price: r.price, slug: r.slug, weighted: r.weighted, displayRatio: r.displayRatio, addToBasketStep: r.addToBasketStep, stock: r.stock })) };
      const arts = x.body.match(/<article class="\s*catalog-item[\s\S]*?<\/article>/g) || []; return '<html><body>' + arts.join('\n') + '</body></html>';
    };
    const out = {}; global.REC.forEach(x => { out[x.url] = { status: x.status, body: trim(x) }; });
    require('fs').writeFileSync(process.env.RECORD, JSON.stringify({ recorded: new Date().toISOString(), responses: out }));
    console.log('recorded', Object.keys(out).length);
  }
  await b.close();
})();
