'use strict';
/* =====================================================================
   Сканер цінників: зайшла в магазин без списку → фото цінника → Gemini читає
   назву, ціну, вагу/обʼєм, магазин → товар одразу «у кошику» → «Записати у витрати».
   ===================================================================== */
U.scan = null; // {photo, loading, err, r:{name, brand, price, oldPrice, unit, size, weighted, store}}
U.scanStore = '';   // last store — the same for the whole trip

async function readPriceTag(dataUrl) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const b64 = c.toDataURL('image/jpeg', .88).split(',')[1];
  const { text } = await gemini({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text:
      'Це фото цінника в українському супермаркеті. Прочитай його і відповідай ЛИШЕ JSON: ' +
      '{"name":"назва товару українською, коротко, без бренду","brand":"бренд або порожньо","price":ціна до сплати числом (якщо є акційна — акційна),' +
      '"oldPrice":стара ціна числом або 0,"weighted":true якщо ціна за 1 кг (ваговий товар) інакше false,"size":"фасування як на цінику: 900 г, 1 л, 10 шт або порожньо",' +
      '"store":"назва мережі, якщо видно (АТБ, Сільпо, NOVUS…) або порожньо","ok":false якщо це не цінник або ціну не видно}. Не вигадуй — пиши лише те, що видно.' }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });
  const j = extractJson(text);
  return {
    ok: j.ok !== false && num(j.price) > 0,
    name: String(j.name || '').slice(0, 60), brand: String(j.brand || '').slice(0, 40),
    price: round2(num(j.price)), oldPrice: round2(num(j.oldPrice)), weighted: !!j.weighted,
    size: String(j.size || '').slice(0, 20), store: String(j.store || '').slice(0, 30)
  };
}

async function startScan() {
  if (!Keys.has()) { toast('Для сканування цінників додайте ключ Gemini у Налаштуваннях'); settingsSheet('gemini'); return; }
  const id = await pickPhoto(1600); if (!id) return;
  U.scan = { photo: id, loading: true, err: '', r: null };
  scanSheet();
  try {
    const url = await Photos.get(id);
    const r = await readPriceTag(url);
    if (!U.scan || U.scan.photo !== id) return;
    U.scan.r = r; U.scan.loading = false;
    if (!r.ok) U.scan.err = 'Не вдалося прочитати ціну. Сфотографуйте цінник ближче й рівніше або введіть вручну.';
    if (r.store && !U.scanStore) U.scanStore = r.store;
  } catch (e) { if (U.scan) { U.scan.loading = false; U.scan.err = e.message || 'Не вдалося розпізнати'; U.scan.r = U.scan.r || {}; } }
  scanSheet();
}

function scanSheet() {
  const s = U.scan; if (!s) return;
  const photo = `<div class="scan-photo ph-box"><img data-photo="${esc(s.photo)}" alt="Цінник"></div>`;
  if (s.loading) { openSheet(`<h2>Цінник</h2>${photo}<div class="sf-load"><div class="spinner"></div><span>Читаю цінник…</span></div>`); return; }
  const r = s.r || {};
  openSheet(`<h2>Цінник</h2>${photo}
    ${s.err ? `<div class="hint" style="margin-bottom:10px">${esc(s.err)}</div>` : ''}
    <div class="field"><input class="input" id="scName" maxlength="60" placeholder="Що це?" value="${esc([r.name, r.brand].filter(Boolean).join(' '))}"></div>
    <div class="row" style="gap:10px">
      <div class="field grow"><label>${r.weighted ? 'Ціна за 1 кг, ₴' : 'Ціна, ₴'}</label><input class="input" id="scPrice" inputmode="decimal" value="${r.price || ''}"></div>
      <div class="field grow"><label>${r.weighted ? 'Вага, кг' : 'Кількість'}</label><input class="input" id="scQty" inputmode="decimal" value="${r.weighted ? '' : 1}" placeholder="${r.weighted ? '0,5' : '1'}"></div></div>
    ${r.oldPrice > r.price ? `<div class="small green" style="margin:-4px 4px 10px">🏷 Акція: було ${money(r.oldPrice)}, економія ${money(r.oldPrice - r.price)}</div>` : ''}
    <div class="field"><input class="input" id="scStore" maxlength="30" placeholder="Магазин" value="${esc(U.scanStore || r.store || '')}"></div>
    <input type="hidden" id="scWeighted" value="${r.weighted ? 1 : 0}"><input type="hidden" id="scSize" value="${esc(r.size || '')}">
    <div class="btns two"><button class="btn ghost card-btn" data-a="scanAdd" data-more="1">У кошик і ще</button><button class="btn" data-a="scanAdd">У кошик</button></div>`,
    root => { if (!r.weighted) return; const q = $('#scQty', root); if (q) setTimeout(() => q.focus(), 300); });
}

function scanAddFromSheet() {
  const r = $('#sheetBody');
  const name = $('#scName', r).value.trim(); if (!name) return invalid('scName', 'Що це за товар?');
  const price = num($('#scPrice', r).value); if (!(price > 0)) return invalid('scPrice', 'Вкажіть ціну');
  const weighted = $('#scWeighted', r).value === '1', q = num($('#scQty', r).value);
  if (weighted && !(q > 0)) return invalid('scQty', 'Скільки важить? (кг)');
  const qty = weighted ? q : Math.max(1, Math.round(q || 1));
  const store = $('#scStore', r).value.trim(); U.scanStore = store;
  const size = $('#scSize', r).value;
  S.shop.push({ id: uid(), name: name.slice(0, 60), qty: weighted ? `${String(qty).replace('.', ',')} кг` : `${qty > 1 ? qty + ' × ' : ''}${size || 'шт'}`,
    buy: '', price: round2(price * qty), dish: 'У магазині', store, url: '', bought: true });
  if (U.scan) { Photos.del(U.scan.photo); U.scan = null; }
  save(); render();
  return { name, sum: round2(price * qty) };
}

Object.assign(A, {
  scanStart: () => startScan(),
  scanAdd: async d => {
    const res = scanAddFromSheet(); if (!res || res === true) return;
    toast(`🛒 ${res.name} · ${money(res.sum)} — у кошику`);
    if (d.more) { closeSheet(); setTimeout(startScan, 250); } else closeSheet();
  }
});
