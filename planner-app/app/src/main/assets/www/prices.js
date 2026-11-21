'use strict';
/* =====================================================================
   Пошук вигідних цін — Gemini + Google Search grounding.
   Показуємо ЛИШЕ пропозиції, домен яких підтверджено джерелами пошуку.
   S.prices = {history:[{q,mode,ts}], favs:[{id,q,mode,title,ts,offers,target,track,hit}], last:{...}}
   ===================================================================== */
const Prices = {
  loading: false, err: '', q: '', mode: 'name',
  body(q, mode) {
    const what = mode === 'url' ? `товар за посиланням ${q} (спочатку визнач точну назву й модель товару за цим посиланням)`
      : mode === 'barcode' ? `товар зі штрихкодом EAN/UPC ${q} (спочатку визнач, що це за товар)` : `товар «${q}»`;
    return {
      contents: [{ role: 'user', parts: [{ text: `Знайди через Google Пошук актуальні пропозиції в українських інтернет-магазинах на ${what}.
Правила:
- Використовуй ЛИШЕ дані, які бачиш у результатах пошуку. НЕ вигадуй магазини, ціни, наявність чи посилання.
- Ціна — в гривнях, число, за 1 одиницю саме цього товару. Якщо ціну не видно в джерелі — не включай пропозицію.
- url — пряме посилання на сторінку товару в магазині (домен магазину, не агрегатора-редиректу).
- delivery — вартість доставки числом, лише якщо вона явно вказана; інакше null. 0 — якщо вказано безкоштовну доставку.
- inStock — true/false, якщо видно наявність, інакше null.
- image — пряме посилання на фото товару, лише якщо воно є в джерелі, інакше null.
- До 10 пропозицій із різних магазинів.
Відповідай ЛИШЕ JSON без пояснень:
{"product":"точна назва товару","offers":[{"store":"Назва магазину","title":"назва товару в магазині","url":"https://...","price":12345,"delivery":null,"deliveryNote":"","inStock":true,"image":null}]}
Якщо нічого не знайдено: {"product":"","offers":[]}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 }
    };
  },
  /** Parses a Gemini response; returns {product, offers (verified, sorted), rejected, sources}. */
  parse(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const cand = data.candidates && data.candidates[0];
    if (!cand) throw new Error('Порожня відповідь');
    const text = (cand.content && cand.content.parts || []).map(p => p.text || '').join('');
    const gm = cand.groundingMetadata || {};
    const sources = (gm.groundingChunks || []).map(c => c.web).filter(Boolean).map(w => ({ title: String(w.title || '').toLowerCase().replace(/^www\./, ''), uri: w.uri }));
    const domains = new Set(sources.map(s => s.title).filter(t => /\./.test(t)));
    let j; try { j = extractJson(text); } catch (e) { j = { product: '', offers: [] }; }
    const seen = new Set(); let rejected = 0;
    const offers = (Array.isArray(j.offers) ? j.offers : []).map(o => {
      const url = String(o.url || '').trim(), dom = domainOf(url), price = num(o.price);
      const ok = isUrl(url) && dom && price > 0 && [...domains].some(d => dom === d || dom.endsWith('.' + d) || d.endsWith('.' + dom));
      if (!ok) { rejected++; return null; }
      const key = dom + '|' + price; if (seen.has(key)) return null; seen.add(key);
      const delivery = o.delivery === null || o.delivery === undefined || o.delivery === '' ? null : Math.max(0, num(o.delivery));
      return {
        store: String(o.store || dom).slice(0, 60), title: String(o.title || '').slice(0, 160), url, domain: dom, price: round2(price),
        delivery, deliveryNote: String(o.deliveryNote || '').slice(0, 80), inStock: typeof o.inStock === 'boolean' ? o.inStock : null,
        image: isUrl(o.image) ? String(o.image) : null, total: round2(price + (delivery || 0))
      };
    }).filter(Boolean).sort((a, b) => a.total - b.total);
    return { product: String(j.product || '').slice(0, 160), offers, rejected, sources };
  },
  async search(q, mode) {
    q = q.trim();
    if (!q) { toast('Введіть назву товару'); return; }
    if (mode === 'url' && !isUrl(q)) { toast('Вставте коректне посилання https://…'); return; }
    if (mode === 'barcode' && !/^\d{8,14}$/.test(q)) { toast('Штрихкод — це 8–14 цифр'); return; }
    this.loading = true; this.err = ''; render();
    try {
      const { data } = await gemini(this.body(q, mode));
      const res = this.parse(data);
      S.prices.last = { q, mode, ts: Date.now(), ...res };
      S.prices.history = [{ q, mode, ts: Date.now() }, ...S.prices.history.filter(h => !(h.q === q && h.mode === mode))].slice(0, 20);
      const fav = S.prices.favs.find(f => f.q === q && f.mode === mode);
      if (fav) this.applyToFav(fav, res, Date.now());
      save();
    } catch (e) {
      this.err = e.status === 400 ? 'Пошук Google недоступний для обраної моделі. Оберіть gemini-2.5-flash у налаштуваннях.' : (e.message || String(e));
    }
    this.loading = false; render();
  },
  applyToFav(f, res, ts) {
    f.offers = res.offers.slice(0, 10); f.ts = ts; f.rejected = res.rejected;
    if (res.product) f.title = f.title || res.product;
    const best = res.offers[0];
    f.hit = !!(best && f.target && best.total <= f.target);
  },
  syncWatch() {
    if (!Bridge || !Bridge.setPriceWatch) return;
    const list = S.prices.favs.filter(f => f.track && f.target).map(f => ({ id: f.id, title: f.title || f.q, target: f.target, model: S.settings.model || 'gemini-2.5-flash', body: JSON.stringify(this.body(f.q, f.mode)) }));
    Bridge.setPriceWatch(JSON.stringify(list));
  },
  /** Merge results gathered by the background job. */
  pullBackground() {
    if (!Bridge || !Bridge.takePriceResults) return;
    let res; try { res = JSON.parse(Bridge.takePriceResults() || '{}'); } catch (e) { return; }
    let changed = false, hits = [];
    Object.entries(res).forEach(([id, r]) => {
      const f = S.prices.favs.find(x => x.id === id); if (!f) return;
      try { const p = this.parse(r.raw); const wasHit = f.hit; this.applyToFav(f, p, r.ts); changed = true; if (f.hit && !wasHit) hits.push(f); } catch (e) { }
    });
    if (changed) { save(); render(); }
    if (hits.length) toast(`💰 Ціна знизилась: ${hits[0].title || hits[0].q}`);
  },
  async scan() {
    if (!('BarcodeDetector' in window)) { toast('Сканер недоступний — введіть цифри штрихкоду вручну'); return; }
    const id = await pickPhoto(1600); if (!id) return;
    const src = await Photos.get(id); Photos.del(id);
    const img = new Image(); img.src = src; await img.decode().catch(() => { });
    try {
      const codes = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(img);
      if (!codes.length) { toast('Штрихкод не розпізнано — спробуйте чіткіше фото'); return; }
      this.mode = 'barcode'; this.q = codes[0].rawValue; U.seg.priceMode = 'barcode'; render(); this.search(this.q, 'barcode');
    } catch (e) { toast('Не вдалося розпізнати штрихкод'); }
  }
};
window.__resumeHooks.push(() => Prices.pullBackground());

function offerRow(o, i, best) {
  const fav = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(o.domain)}&sz=64`;
  return `<div class="item offer ${i === 0 ? 'best' : ''}" data-a="openLink" data-url="${esc(o.url)}">
    <div class="thumb">${o.image ? `<img src="${esc(o.image)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=function(){this.style.visibility='hidden'};this.src='${fav}';this.classList.add('fav')">` : `<img class="fav" src="${fav}" alt="" onerror="this.style.visibility='hidden'">`}</div>
    <div class="grow"><div class="title">${esc(o.store)}${i === 0 ? ' <span class="pill green">Найвигідніше</span>' : ''}</div>
      <div class="meta ellipsis">${esc(o.title || o.domain)}</div>
      <div class="meta">${o.delivery === null ? 'Доставка: уточнюйте' : o.delivery === 0 ? '🚚 Безкоштовна доставка' : `🚚 Доставка ${money(o.delivery)}`}${o.inStock === false ? ' · <span class="red">немає в наявності</span>' : o.inStock ? ' · в наявності' : ''}</div></div>
    <div class="right"><div class="amount">${money(o.price)}</div>${o.delivery ? `<div class="small muted">разом ${money(o.total)}</div>` : ''}
      ${i > 0 && best ? `<div class="small red">+${money(o.total - best.total)}</div>` : ''}</div></div>`;
}

PAGES.prices = () => {
  const mode = segOf('priceMode', 'name');
  const L = S.prices.last;
  const hasKey = Keys.has();
  const ph = { name: 'Напр. AirPods Pro 2', url: 'https://rozetka.com.ua/…', barcode: '4820000000000' }[mode];
  let body = '';
  if (Prices.loading) body = `<div class="card empty"><div class="spinner"></div><b style="color:var(--text)">Шукаю пропозиції в магазинах…</b><br><span class="small">Gemini переглядає результати Google Пошуку (до 30 с)</span></div>`;
  else if (Prices.err) body = `<div class="card"><b class="red">Не вдалося виконати пошук</b><div class="small muted" style="margin-top:6px">${esc(Prices.err)}</div></div>`;
  else if (L) {
    const best = L.offers[0];
    const fav = S.prices.favs.find(f => f.q === L.q && f.mode === L.mode);
    body = `
      <div class="row between" style="margin:18px 4px 10px"><div class="grow" style="min-width:0"><h2 style="margin:0" class="ellipsis">${esc(L.product || L.q)}</h2>
        <div class="small muted">Оновлено ${fmtDateTime(L.ts)}</div></div>
        <button class="chip card-bg" data-a="priceFav">${fav ? '★ В обраному' : '☆ В обране'}</button></div>
      ${L.offers.length ? `<div class="list">${L.offers.map((o, i) => offerRow(o, i, best)).join('')}</div>
        ${L.offers.length > 1 ? `<div class="hint ok">Економія до <b>${money(L.offers[L.offers.length - 1].total - best.total)}</b>, якщо купити в «${esc(best.store)}».</div>` : ''}`
      : `<div class="card empty">Не знайдено пропозицій з підтвердженою ціною.</div>`}
      <div class="small muted" style="margin:10px 6px;line-height:1.45">Відсортовано за ціною з доставкою (якщо вказана). Показано лише пропозиції з магазинів, підтверджених джерелами Google Пошуку${L.rejected ? ` · ${L.rejected} ${plural(L.rejected, 'пропозицію', 'пропозиції', 'пропозицій')} відкинуто як неперевірені` : ''}. Перевіряйте ціну на сайті магазину перед покупкою.</div>
      <div class="chips" style="margin:0 2px 12px"><button class="chip card-bg" data-a="openLink" data-url="https://hotline.ua/sr/?q=${encodeURIComponent(L.product || L.q)}">Hotline ↗</button>
        <button class="chip card-bg" data-a="openLink" data-url="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(L.product || L.q)}">Google Покупки ↗</button></div>`;
  }
  const favs = S.prices.favs;
  return {
    title: 'Пошук вигідних цін', html: `
    <div class="hero">
      ${segUI('priceMode', [['name', 'Назва'], ['url', 'Посилання'], ['barcode', 'Штрихкод']], 'flat')}
      <div class="row" style="gap:8px"><input class="input grow" id="priceQ" placeholder="${ph}" value="${esc(Prices.mode === mode ? Prices.q : '')}" ${mode === 'barcode' ? 'inputmode="numeric"' : mode === 'url' ? 'inputmode="url"' : ''} enterkeyhint="search">
        ${mode === 'barcode' && 'BarcodeDetector' in window ? `<button class="btn sm ghost" style="padding:15px" data-a="priceScan" aria-label="Сканувати">${ICONS.camera.replace('<svg', '<svg width="20" height="20"')}</button>` : ''}</div>
      <div class="btns"><button class="btn" data-a="priceGo" ${Prices.loading || !hasKey ? 'disabled' : ''}>Знайти дешевше</button></div>
      ${!hasKey ? `<div class="hint">Для пошуку цін потрібен безкоштовний ключ Gemini. <b class="link" data-a="settings">Додати ключ</b></div>` : ''}
    </div>
    ${body}
    ${favs.length ? `<h2>Обране та відстеження</h2><div class="list">${favs.map(f => {
      const b = f.offers && f.offers[0];
      return `<div class="item" data-a="go" data-page="priceFav" data-id="${f.id}"><div class="emoji sm">${f.hit ? '💰' : f.track ? '🔔' : '★'}</div>
        <div class="grow"><div class="title ellipsis">${esc(f.title || f.q)}</div>
        <div class="meta">${b ? `від ${money(b.total)} · ${esc(b.store)}` : 'немає даних'}${f.target ? ` · ціль ${money(f.target)}` : ''}</div>
        <div class="meta">Оновлено ${f.ts ? fmtDateTime(f.ts) : '—'}</div></div>${f.hit ? '<span class="pill green">Ціль!</span>' : ''}</div>`;
    }).join('')}</div>` : ''}
    ${S.prices.history.length ? `<div class="row between" style="margin:22px 4px 10px"><h2 style="margin:0">Історія пошуку</h2><button class="chip card-bg" data-a="priceHistClear">Очистити</button></div>
      <div class="recent">${S.prices.history.map((h, i) => `<button class="chip" data-a="priceHist" data-i="${i}">${h.mode === 'barcode' ? '▥ ' : h.mode === 'url' ? '🔗 ' : '🔎 '}${esc(h.mode === 'url' ? domainOf(h.q) : h.q)}</button>`).join('')}</div>` : ''}`
  };
};

PAGES.priceFav = p => {
  const f = S.prices.favs.find(x => x.id === p.id); if (!f) return null;
  const best = f.offers && f.offers[0];
  return {
    title: f.title || f.q, html: `
    <div class="card">
      <div class="small muted">${f.mode === 'url' ? 'Пошук за посиланням' : f.mode === 'barcode' ? 'Пошук за штрихкодом ' + esc(f.q) : 'Пошук: ' + esc(f.q)}</div>
      <div style="font-size:28px;font-weight:700;margin:6px 0">${best ? 'від ' + money(best.total) : '—'}</div>
      <div class="small muted">Оновлено ${f.ts ? fmtDateTime(f.ts) : '—'}</div>
      <div class="sep"></div>
      <div class="switch" style="padding:4px 0"><div><b>Відстежувати ціну</b><div class="small muted">Перевірка ~2 рази на добу, сповіщення при досягненні цілі</div></div>${toggleHtml('pfTrack', f.track).replace('data-a="toggle"', `data-a="pfTrack" data-id="${f.id}"`)}</div>
      <div class="kv" data-a="pfTarget" data-id="${f.id}" style="cursor:pointer"><span>Бажана ціна</span><b class="link">${f.target ? money(f.target) : 'Задати'}</b></div>
      ${f.hit ? `<div class="hint ok">💰 Ціль досягнута: ${esc(best.store)} — ${money(best.total)}</div>` : ''}
    </div>
    <div class="btns two"><button class="btn" data-a="pfCheck" data-id="${f.id}" ${Prices.loading ? 'disabled' : ''}>${Prices.loading ? 'Перевіряю…' : '↻ Перевірити зараз'}</button>
      <button class="btn danger" data-a="pfDel" data-id="${f.id}">Прибрати</button></div>
    ${f.offers && f.offers.length ? `<h2>Пропозиції</h2><div class="list">${f.offers.map((o, i) => offerRow(o, i, best)).join('')}</div>` : ''}`
  };
};

Object.assign(A, {
  priceGo: () => { const el = $('#priceQ'); const mode = segOf('priceMode', 'name'); Prices.q = el.value; Prices.mode = mode; el.blur(); Prices.search(el.value, mode); },
  priceScan: () => Prices.scan(),
  priceHist: d => { const h = S.prices.history[+d.i]; U.seg.priceMode = h.mode; Prices.q = h.q; Prices.mode = h.mode; Prices.search(h.q, h.mode); },
  priceHistClear: () => { S.prices.history = []; save(); render(); },
  priceFav: () => {
    const L = S.prices.last; if (!L) return;
    const ex = S.prices.favs.find(f => f.q === L.q && f.mode === L.mode);
    if (ex) { navigate('priceFav', { id: ex.id }); return; }
    const f = { id: uid(), q: L.q, mode: L.mode, title: L.product || L.q, ts: L.ts, offers: L.offers.slice(0, 10), target: 0, track: false, hit: false };
    S.prices.favs.unshift(f); save(); toast('Додано в обране'); navigate('priceFav', { id: f.id });
  },
  pfTrack: async d => {
    const f = S.prices.favs.find(x => x.id === d.id);
    if (!f.track && !f.target) { await A.pfTarget(d); if (!f.target) return; }
    f.track = !f.track; if (f.track) ensureNotifPermission();
    save(); Prices.syncWatch(); render();
    toast(f.track ? 'Відстеження увімкнено' : 'Відстеження вимкнено');
  },
  pfTarget: async d => {
    const f = S.prices.favs.find(x => x.id === d.id); const b = f.offers && f.offers[0];
    const v = await askNumber({ title: 'Бажана ціна', hint: b ? `Зараз найдешевше ${money(b.total)}` : '', value: f.target || '', ok: 'Зберегти', allowZero: true });
    if (v === null) return;
    f.target = v; f.hit = !!(b && v && b.total <= v); if (!v) f.track = false;
    save(); Prices.syncWatch(); render();
  },
  pfCheck: async d => {
    const f = S.prices.favs.find(x => x.id === d.id);
    Prices.loading = true; render();
    try { const { data } = await gemini(Prices.body(f.q, f.mode)); Prices.applyToFav(f, Prices.parse(data), Date.now()); save(); toast(f.hit ? '💰 Ціль досягнута!' : 'Оновлено'); }
    catch (e) { toast(e.message); }
    Prices.loading = false; render();
  },
  pfDel: async d => {
    if (!await ask({ title: 'Прибрати з обраного?', ok: 'Прибрати', danger: true })) return;
    S.prices.favs = S.prices.favs.filter(x => x.id !== d.id); save(); Prices.syncWatch(); back();
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'priceQ') { e.preventDefault(); A.priceGo(); } });
document.addEventListener('input', e => { if (e.target.id === 'priceQ') { Prices.q = e.target.value; Prices.mode = segOf('priceMode', 'name'); } });
