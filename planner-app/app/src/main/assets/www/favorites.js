'use strict';
/* =====================================================================
   Улюблені продукти: фото → вирізання фону на телефоні (ML Kit) → рекламна картка → улюблене
   fav: {id, name, brand, tagline, store, price, rating, note, photo (оригінал), ad (картка), style, date}
   ===================================================================== */

/* ---------------- background removal bridge ---------------- */
window.__cutCb = (id, png, err) => { const p = pendingCb[id]; delete pendingCb[id]; if (p) p({ png, err }); };
function cutoutImage(dataUrl) {
  if (!Bridge || !Bridge.cutout) return Promise.resolve({ png: null, err: 'Вирізання фону працює в застосунку на Android' });
  return new Promise(res => {
    const id = uid(); pendingCb[id] = res; Bridge.cutout(dataUrl, id);
    setTimeout(() => { if (pendingCb[id]) { delete pendingCb[id]; res({ png: null, err: 'Вирізання фону триває задовго — спробуйте ще раз' }); } }, 45000);
  });
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ---------------- ad composition (canvas) ---------------- */
const AD_W = 900, AD_H = 1125;
function dominantColor(img) {
  const c = document.createElement('canvas'), n = 48; c.width = n; c.height = n;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data; let r = 0, g = 0, b = 0, k = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const w = 1 + (mx - mn) / 40; // favour saturated pixels (labels, packaging colours)
    r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; k += w;
  }
  return k ? [r / k, g / k, b / k].map(Math.round) : [200, 170, 150];
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c, t, w) => c.map((v, i) => Math.round(v * (1 - w) + t[i] * w));
const AD_STYLES = [['studio', 'Студія'], ['pastel', 'Пастель'], ['dark', 'Преміум'], ['pop', 'Яскравий']];

/** Draws an advertising-style card. `cut` = transparent PNG (or null → framed photo). */
async function composeAd(photoUrl, cutUrl, style, text = {}) {
  const img = await loadImg(cutUrl || photoUrl);
  const col = dominantColor(img);
  const c = document.createElement('canvas'); c.width = AD_W; c.height = AD_H;
  const x = c.getContext('2d');
  const light = mix(col, [255, 255, 255], .82), deep = mix(col, [0, 0, 0], .35);
  // background
  let g;
  if (style === 'studio') { g = x.createRadialGradient(AD_W / 2, AD_H * .42, 60, AD_W / 2, AD_H * .5, AD_H * .8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e6ec'); }
  else if (style === 'pastel') { g = x.createLinearGradient(0, 0, AD_W, AD_H); g.addColorStop(0, rgb(mix(col, [255, 255, 255], .9))); g.addColorStop(1, rgb(light)); }
  else if (style === 'dark') { g = x.createRadialGradient(AD_W / 2, AD_H * .38, 40, AD_W / 2, AD_H * .45, AD_H * .75); g.addColorStop(0, rgb(mix(col, [40, 40, 48], .55))); g.addColorStop(1, '#0c0c10'); }
  else { g = x.createLinearGradient(0, 0, 0, AD_H); g.addColorStop(0, rgb(mix(col, [255, 255, 255], .15))); g.addColorStop(1, rgb(deep)); }
  x.fillStyle = g; x.fillRect(0, 0, AD_W, AD_H);
  if (style === 'pop') { x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(AD_W / 2, AD_H * .45, AD_W * .38, 0, Math.PI * 2); x.fill(); }
  if (style === 'pastel') { x.fillStyle = rgb(col, .12); x.beginPath(); x.arc(AD_W * .82, AD_H * .16, 220, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(AD_W * .12, AD_H * .86, 260, 0, Math.PI * 2); x.fill(); }
  // product placement
  const hasText = !!(text.name || text.tagline);
  const box = cutUrl ? 0.72 : 0.66, maxW = AD_W * box, maxH = AD_H * box * (hasText ? .7 : .8);
  const k = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * k, h = img.height * k, px = (AD_W - w) / 2, py = AD_H * (hasText ? .4 : .47) - h / 2;
  const floor = py + h;
  // floor shadow
  const sg = x.createRadialGradient(AD_W / 2, floor, 4, AD_W / 2, floor, w * .55);
  sg.addColorStop(0, style === 'dark' ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.28)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  x.save(); x.translate(0, floor); x.scale(1, .16); x.fillStyle = sg; x.beginPath(); x.arc(AD_W / 2, 0, w * .55, 0, Math.PI * 2); x.fill(); x.restore();
  if (cutUrl) {
    if (style === 'dark') { // reflection
      x.save(); x.globalAlpha = .18; x.translate(0, floor * 2); x.scale(1, -1); x.drawImage(img, px, py, w, h); x.restore();
      const fade = x.createLinearGradient(0, floor, 0, floor + h * .5); fade.addColorStop(0, 'rgba(12,12,16,0)'); fade.addColorStop(1, 'rgba(12,12,16,1)');
      x.fillStyle = fade; x.fillRect(0, floor, AD_W, h * .5 + 2);
    }
    x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 40; x.shadowOffsetY = 18; x.drawImage(img, px, py, w, h); x.restore();
  } else {
    const r = 36; x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 50; x.shadowOffsetY = 22;
    x.fillStyle = '#fff'; roundRect(x, px - 16, py - 16, w + 32, h + 32, r + 10); x.fill(); x.restore();
    x.save(); roundRect(x, px, py, w, h, r); x.clip(); x.drawImage(img, px, py, w, h); x.restore();
  }
  // soft highlight
  const hl = x.createRadialGradient(AD_W * .3, AD_H * .12, 10, AD_W * .3, AD_H * .12, AD_W * .6);
  hl.addColorStop(0, style === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hl; x.fillRect(0, 0, AD_W, AD_H);
  if (hasText) {
    const dark = style === 'dark' || style === 'pop', fg = dark ? '#ffffff' : '#111114', sub = dark ? 'rgba(255,255,255,.75)' : 'rgba(17,17,20,.6)';
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    const fit = (t, size, weight, maxw) => { let s = size; do { x.font = `${weight} ${s}px "e-Ukraine", Roboto, system-ui, sans-serif`; s -= 2; } while (x.measureText(t).width > maxw && s > 20); };
    let y = AD_H * .83;
    if (text.brand) { fit(text.brand.toUpperCase(), 26, 600, AD_W * .8); x.fillStyle = sub; x.fillText(text.brand.toUpperCase(), AD_W / 2, y - 62); }
    if (text.name) { fit(text.name, 64, 800, AD_W * .86); x.fillStyle = fg; x.fillText(text.name, AD_W / 2, y); }
    if (text.tagline) { fit(text.tagline, 34, 500, AD_W * .84); x.fillStyle = sub; x.fillText(text.tagline, AD_W / 2, y + 56); }
  }
  return c.toDataURL('image/jpeg', .9);
}
function roundRect(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }

/* ---------------- AI recognition (optional) ---------------- */
async function recognizeProduct(dataUrl) {
  if (!Keys.has()) return null;
  const img = await loadImg(dataUrl), k = Math.min(1, 640 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const b64 = c.toDataURL('image/jpeg', .85).split(',')[1];
  const { text } = await gemini({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: 'Що це за товар на фото? Відповідай ЛИШЕ JSON українською: {"name":"коротка назва товару","brand":"бренд або порожньо","tagline":"коротке рекламне гасло до 6 слів"}. Якщо не впевнений у бренді — залиш порожнім.' }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
  });
  const j = extractJson(text);
  return { name: String(j.name || '').slice(0, 60), brand: String(j.brand || '').slice(0, 40), tagline: String(j.tagline || '').slice(0, 60) };
}

/* ---------------- state + pages ---------------- */
U.favNew = null; // {photo, photoUrl, cut, cutErr, style, ad, step, prefill, ai}

async function startFavorite(prefill = {}) {
  const id = await pickPhoto(1600);
  if (!id) return;
  const photoUrl = await Photos.get(id);
  U.favNew = { photo: id, photoUrl, cut: null, cutErr: '', style: 'studio', ad: '', step: 'cut', prefill, ai: null };
  navigate('favNew');
  const r = await cutoutImage(photoUrl);
  if (!U.favNew || U.favNew.photo !== id) return;
  U.favNew.cut = r.png; U.favNew.cutErr = r.err || '';
  U.favNew.step = 'style';
  await renderAd();
  recognizeProduct(r.png || photoUrl).then(ai => { if (U.favNew && U.favNew.photo === id && ai) { U.favNew.ai = ai; fillFromAi(ai); } }).catch(() => { });
}
async function renderAd() {
  const f = U.favNew; if (!f) return;
  const keep = readFavForm();
  const t = keep || { name: (f.prefill || {}).name || '', brand: '', tagline: '' };
  try { f.ad = await composeAd(f.photoUrl, f.cut, f.style, { name: t.name.trim(), brand: t.brand.trim(), tagline: t.tagline.trim() }); } catch (e) { f.ad = ''; f.cutErr = 'Не вдалося обробити фото'; }
  if (keep && $('#fvName')) { const im = $('.ad-preview img'); if (im && f.ad) { im.src = f.ad; return; } }
  render(); if (keep) writeFavForm(keep);
}
function readFavForm() {
  const n = $('#fvName'); if (!n) return null;
  return { name: n.value, brand: $('#fvBrand').value, tagline: $('#fvTag').value, store: $('#fvStore').value, price: $('#fvPrice').value, note: $('#fvNote').value, rating: +($('.stars').dataset.v || 0) };
}
function writeFavForm(v) {
  if (!$('#fvName')) return;
  $('#fvName').value = v.name; $('#fvBrand').value = v.brand; $('#fvTag').value = v.tagline; $('#fvStore').value = v.store; $('#fvPrice').value = v.price; $('#fvNote').value = v.note;
  setStars(v.rating);
}
function fillFromAi(ai) {
  const set = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v; };
  set('#fvName', ai.name); set('#fvBrand', ai.brand); set('#fvTag', ai.tagline);
  if (ai.name) { toast('✨ Gemini розпізнав товар'); renderAd(); }
}
const starsHtml = v => `<div class="stars" data-v="${v || 0}">${[1, 2, 3, 4, 5].map(i => `<button data-a="favStar" data-v="${i}" class="${i <= v ? 'on' : ''}" aria-label="${i}">★</button>`).join('')}</div>`;
function setStars(v) { const s = $('.stars'); if (!s) return; s.dataset.v = v; $$('button', s).forEach(b => b.classList.toggle('on', +b.dataset.v <= v)); }

PAGES.favNew = () => {
  const f = U.favNew; if (!f) return null;
  const pf = f.prefill || {};
  if (f.step === 'cut') return { title: 'Новий улюблений', html: `<div class="card empty"><div class="spinner"></div><b style="color:var(--text)">✂️ Вирізаю фон…</b><br><span class="small">обробка відбувається на телефоні</span></div>` };
  return {
    title: 'Новий улюблений', html: `
    ${f.ad ? `<div class="ad-preview"><img src="${f.ad}" alt="Рекламна картка товару"></div>` : ''}
    ${f.cutErr ? `<div class="hint" style="margin:0 0 10px">${esc(f.cutErr)}${f.cut ? '' : ' Фото оформлено без вирізання.'}</div>` : ''}
    <div class="chips" style="margin-bottom:12px">${AD_STYLES.map(([v, l]) => `<button class="chip ${f.style === v ? 'on' : 'card-bg'}" data-a="favStyle" data-v="${v}">${l}</button>`).join('')}
      ${!f.cut ? `<button class="chip card-bg" data-a="favRetryCut">↻ Вирізати ще раз</button>` : ''}</div>
    <div class="card">
      <div class="field"><label>Назва</label><input class="input" id="fvName" maxlength="60" placeholder="Напр. Йогурт грецький" value="${esc(pf.name || '')}"></div>
      <div class="row" style="gap:10px"><div class="field grow"><label>Бренд</label><input class="input" id="fvBrand" maxlength="40" value="${esc(pf.brand || '')}"></div>
        <div class="field grow"><label>Ціна, ₴</label><input class="input" id="fvPrice" inputmode="decimal" value="${pf.price || ''}"></div></div>
      <div class="field"><label>Де купувала</label><input class="input" id="fvStore" maxlength="40" placeholder="Сільпо, АТБ…" value="${esc(pf.store || '')}"></div>
      <div class="field"><label>Гасло на картці</label><input class="input" id="fvTag" maxlength="60" placeholder="Напр. Ніжний смак щоранку"></div>
      <div class="field"><label>Оцінка</label>${starsHtml(5)}</div>
      <div class="field"><textarea class="input" id="fvNote" maxlength="300" placeholder="Чим сподобався (смак, розмір, для кого)"></textarea></div>
      <div class="btns"><button class="btn" data-a="favSave">❤️ Додати в улюблені</button></div>
    </div>`
  };
};

PAGES.favs = () => {
  const list = S.favs.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.date || '').localeCompare(a.date || ''));
  return {
    title: 'Улюблені продукти', html: list.length ? `<div class="fav-grid">${list.map(f => `<button class="fav-card" data-a="go" data-page="fav" data-id="${f.id}">
      <div class="ph-box"><img data-photo="${esc(f.ad || f.photo)}" alt=""></div>
      <div class="fav-meta"><b class="ellipsis">${esc(f.name || 'Без назви')}</b><span class="ellipsis">${'★'.repeat(f.rating || 0)}<span class="muted">${'★'.repeat(5 - (f.rating || 0))}</span>${f.price ? ' · ' + money(f.price) : ''}</span></div></button>`).join('')}</div>`
      : emptyCard('❤️', 'Купили щось і сподобалось? Сфотографуйте — Танічка виріже фон і зробить красиву картку.', { label: '📷 Додати товар', attrs: 'data-a="favAdd"' })
  };
};
FABS.favs = () => startFavorite();

PAGES.fav = p => {
  const f = S.favs.find(x => x.id === p.id); if (!f) return null;
  return {
    title: f.name || 'Улюблений', html: `
    <div class="ad-preview"><img data-photo="${esc(f.ad || f.photo)}" alt=""></div>
    <div class="card">
      <div class="row between"><div style="min-width:0"><div style="font-size:21px;font-weight:700">${esc(f.name || 'Без назви')}</div>
        ${f.brand ? `<div class="muted">${esc(f.brand)}</div>` : ''}</div>${starsHtml(f.rating).replace('class="stars"', `class="stars" data-id="${f.id}"`)}</div>
      ${f.tagline ? `<div style="margin-top:8px;font-style:italic">«${esc(f.tagline)}»</div>` : ''}
      <div class="sep"></div>
      ${f.store ? `<div class="kv"><span>Де купувала</span><b>${esc(f.store)}</b></div>` : ''}
      ${f.price ? `<div class="kv"><span>Ціна</span><b>${money(f.price)}</b></div>` : ''}
      <div class="kv"><span>Додано</span><b>${f.date ? shortDate(f.date) : '—'}</b></div>
      ${f.note ? `<div class="small muted" style="margin-top:8px;line-height:1.45">${esc(f.note)}</div>` : ''}
    </div>
    <div class="btns two"><button class="btn" data-a="favToShop" data-id="${f.id}">🛒 Купити ще</button><button class="btn ghost card-btn" data-a="favEdit" data-id="${f.id}">Редагувати</button></div>
    <div class="chips" style="margin:12px 2px">${AD_STYLES.map(([v, l]) => `<button class="chip ${f.style === v ? 'on' : 'card-bg'}" data-a="favRestyle" data-id="${f.id}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="btns"><button class="btn danger" data-a="favDel" data-id="${f.id}">Видалити</button></div>`
  };
};

function favEditSheet(f) {
  openSheet(`<h2>Редагувати</h2>
    <div class="field"><label>Назва</label><input class="input" id="feName" maxlength="60" value="${esc(f.name || '')}"></div>
    <div class="row" style="gap:10px"><div class="field grow"><label>Бренд</label><input class="input" id="feBrand" maxlength="40" value="${esc(f.brand || '')}"></div>
      <div class="field grow"><label>Ціна, ₴</label><input class="input" id="fePrice" inputmode="decimal" value="${f.price || ''}"></div></div>
    <div class="field"><label>Де купувала</label><input class="input" id="feStore" maxlength="40" value="${esc(f.store || '')}"></div>
    <div class="field"><label>Гасло</label><input class="input" id="feTag" maxlength="60" value="${esc(f.tagline || '')}"></div>
    <div class="field"><textarea class="input" id="feNote" maxlength="300">${esc(f.note || '')}</textarea></div>
    <div class="btns"><button class="btn" data-a="favEditSave" data-id="${f.id}">Зберегти</button></div>`);
}

Object.assign(A, {
  favAdd: () => startFavorite(),
  favFromShop: d => { const i = S.shop.find(x => x.id === d.id); closeSheet(); startFavorite(i ? { name: i.name, store: i.store || '', price: i.price || '' } : {}); },
  favStar: (d, el) => {
    const s = el.closest('.stars'); const v = +d.v;
    if (s.dataset.id) { const f = S.favs.find(x => x.id === s.dataset.id); if (f) { f.rating = v; save(); } }
    setStars(v); if (s.dataset.id) render();
  },
  favStyle: async d => { const f = U.favNew; if (!f || f.style === d.v) return; f.style = d.v; await renderAd(); },
  favRetryCut: async () => {
    const f = U.favNew; if (!f) return; const keep = readFavForm();
    f.step = 'cut'; render();
    const r = await cutoutImage(f.photoUrl); f.cut = r.png; f.cutErr = r.err || ''; f.step = 'style';
    await renderAd(); if (keep) writeFavForm(keep);
  },
  favSave: async () => {
    const f = U.favNew, v = readFavForm(); if (!f || !v) return;
    if (!v.name.trim()) return invalid('fvName', 'Введіть назву');
    const price = num(v.price); if (v.price.trim() && (price < 0 || price > 1e7)) return invalid('fvPrice', 'Некоректна ціна');
    clearTimeout(favTxtT);
    try { f.ad = await composeAd(f.photoUrl, f.cut, f.style, { name: v.name.trim(), brand: v.brand.trim(), tagline: v.tagline.trim() }); } catch (e) { }
    let adId = '', cutId = '';
    try { if (f.ad) adId = await Photos.put(f.ad); if (f.cut) cutId = await Photos.put(f.cut); } catch (e) { toast('Не вдалося зберегти картку'); return; }
    S.favs.push({ id: uid(), name: v.name.trim(), brand: v.brand.trim(), tagline: v.tagline.trim(), store: v.store.trim(), price: v.price.trim() ? round2(price) : 0,
      rating: v.rating || 5, note: v.note.trim(), photo: f.photo, cut: cutId, ad: adId, style: f.style, date: today() });
    U.favNew = null; save(); toast('❤️ Додано в улюблені');
    U.stack = U.stack.filter(s => s.page !== 'favNew');
    if (!U.stack.some(s => s.page === 'favs')) U.stack.push({ page: 'favs', p: {} });
    render();
  },
  favRestyle: async d => {
    const f = S.favs.find(x => x.id === d.id); if (!f || f.style === d.v) return;
    const photoUrl = await Photos.get(f.photo); if (!photoUrl) { toast('Оригінальне фото не знайдено'); return; }
    toast('Оформлюю…');
    const cut = f.cut ? await Photos.get(f.cut) : null;
    const ad = await composeAd(photoUrl, cut, d.v, { name: f.name, brand: f.brand, tagline: f.tagline });
    const old = f.ad; f.ad = await Photos.put(ad); f.style = d.v; if (old) Photos.del(old);
    save(); render();
  },
  favEdit: d => favEditSheet(S.favs.find(x => x.id === d.id)),
  favEditSave: d => {
    const f = S.favs.find(x => x.id === d.id); const r = $('#sheetBody');
    const name = $('#feName', r).value.trim(); if (!name) return invalid('feName', 'Введіть назву');
    const pr = $('#fePrice', r).value.trim(), price = num(pr); if (pr && (price < 0 || price > 1e7)) return invalid('fePrice', 'Некоректна ціна');
    const before = [f.name, f.brand, f.tagline].join('|');
    Object.assign(f, { name, brand: $('#feBrand', r).value.trim(), store: $('#feStore', r).value.trim(), tagline: $('#feTag', r).value.trim(), note: $('#feNote', r).value.trim(), price: pr ? round2(price) : 0 });
    save(); closeSheet(); render();
    if (before !== [f.name, f.brand, f.tagline].join('|')) { const st = f.style; f.style = ''; A.favRestyle({ id: f.id, v: st }); }
  },
  favToShop: d => {
    const f = S.favs.find(x => x.id === d.id);
    if (S.shop.some(i => !i.bought && i.name.toLowerCase() === f.name.toLowerCase())) { toast('Вже є у списку покупок'); return; }
    S.shop.push({ id: uid(), name: f.name, qty: '', buy: f.brand || '', price: f.price || 0, dish: 'Улюблене', store: f.store || '', url: '', bought: false });
    save(); toast('Додано до покупок');
  },
  favDel: async d => {
    const f = S.favs.find(x => x.id === d.id);
    if (!await ask({ title: `Видалити «${f.name}»?`, ok: 'Видалити', danger: true })) return;
    [f.photo, f.ad, f.cut].forEach(x => x && Photos.del(x));
    S.favs = S.favs.filter(x => x.id !== d.id); save(); back();
  }
});

// live preview of the card text
let favTxtT;
document.addEventListener('input', e => { if (['fvName', 'fvBrand', 'fvTag'].includes(e.target.id) && U.favNew) { clearTimeout(favTxtT); favTxtT = setTimeout(renderAd, 450); } });
