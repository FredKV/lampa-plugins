'use strict';
/* =====================================================================
   Розділ «Ще», налаштування, глобальні дії, запуск
   ===================================================================== */
VIEWS.more = () => {
  const bd = Birthdays.upcoming(30)[0];
  const act = Wishes.active();
  const cyc = Cycle.status();
  const w = Weather.data();
  const tiles = [
    ['birthdays', '🎂', 'Дні народження', bd ? `${bd.p.name} — ${Birthdays.countdown(bd.days)}` : `${S.people.length} ${plural(S.people.length, 'людина', 'людини', 'людей')}`],
    ['favs', '❤️', 'Улюблені продукти', S.favs.length ? `${S.favs.length} ${plural(S.favs.length, 'товар', 'товари', 'товарів')}` : 'Сфотографуй — і в улюблені'],
    ['wishes', '💖', 'Мої хотілки', act.length ? `${act.length} ${plural(act.length, 'ціль', 'цілі', 'цілей')} · ${money(act.reduce((a, x) => a + Wishes.saved(x), 0))}` : 'Цілі накопичення'],
    ['weather', '🌤', 'Погода', w ? `${Math.round(w.data.current.temperature_2m)}° · ${Weather.place().name}` : 'Прогноз на 7 днів'],
    ['prices', '🧺', 'Вигідні продукти', S.recipes.length ? `${S.recipes.length} ${plural(S.recipes.length, 'рецепт', 'рецепти', 'рецептів')} · ${cityName(priceCity())}` : 'Страва → де купити дешевше'],
    ['cycle', '🌸', 'Мій цикл', cyc && !S.cycle.hide ? cyc.line : 'Відстеження циклу']
  ];
  return `<div class="tiles">${tiles.map(t => `<button class="tile" data-a="go" data-page="${t[0]}">
      <span class="tile-ic">${t[1]}</span><b>${t[2]}</b><span class="small muted ellipsis">${esc(t[3])}</span></button>`).join('')}</div>
    <div class="list" style="margin-top:4px">
      <div class="item" data-a="tabSeg" data-tab="finance" data-key="fin" data-val="budget"><div class="emoji sm">📊</div><div class="grow"><div class="title">Бюджет і категорії</div></div><span class="muted">›</span></div>
      <div class="item" data-a="settings"><div class="emoji sm">⚙️</div><div class="grow"><div class="title">Налаштування</div><div class="meta">Тема, Gemini, PIN-код, дані</div></div><span class="muted">›</span></div>
    </div>`;
};

/* ---------------- settings ---------------- */
function avatarHtml(size = 64) {
  const id = S.settings.avatar;
  return id ? `<div class="st-ava ph-box" style="width:${size}px;height:${size}px"><img data-photo="${esc(id)}" alt=""></div>`
    : `<div class="st-ava" style="width:${size}px;height:${size}px;font-size:${size * .5}px">🦝</div>`;
}
function settingsSheet() {
  const s = S.settings, hint = Keys.hint();
  openSheet(`
    <div class="prof-card">
      <button class="st-ava-btn" data-a="avatarMenu" aria-label="Фото профілю">${avatarHtml(64)}<span class="st-cam">${ICONS.camera.replace('<svg', '<svg width="14" height="14"')}</span></button>
      <div class="grow" style="min-width:0"><input class="name-input" id="stName" maxlength="30" placeholder="Ваше імʼя" value="${esc(s.name)}">
        <div class="small muted">${s.avatar ? 'Натисніть на фото, щоб змінити' : 'Натисніть, щоб додати фото'}</div></div>
    </div>
    <div class="card st-card">
      <div class="seg flat" style="margin:0">${[['light', '☀️ Світла'], ['dark', '🌙 Темна'], ['auto', '📱 Авто']].map(([v, l]) => `<button data-a="seg" data-group="theme" data-val="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="card st-card" style="padding:2px 14px">
      <div class="switch"><b>🔔 Сповіщення</b>${toggleHtml('stNotif', s.notif).replace('data-a="toggle"', 'data-a="notifToggle"')}</div>
      <div class="switch" style="border-top:1px solid var(--line)"><b>🔒 PIN-код</b>${toggleHtml('stPin', !!s.pin).replace('data-a="toggle"', 'data-a="pinToggle"')}</div>
    </div>
    <div class="card st-card">
      <div class="row between"><b>✨ Gemini AI</b><span class="pill ${hint ? 'green' : ''}">${hint ? 'ключ: ' + esc(hint) : 'ключ не додано'}</span></div>
      <div class="row" style="gap:8px;margin-top:10px"><input class="input grow" id="stKey" type="password" autocomplete="off" placeholder="${hint ? 'Новий ключ, щоб замінити' : 'Вставте ключ AIza…'}">
        <button class="btn sm" data-a="keySave">OK</button></div>
      <div class="row between" style="margin-top:8px"><b class="link small" data-a="openKey">Отримати безкоштовний ключ ↗</b>
        ${hint ? `<span class="row" style="gap:12px"><b class="link small" data-a="testKey">Перевірити</b><b class="small red" data-a="keyDel">Видалити</b></span>` : ''}</div>
      <details class="st-more"><summary>Модель: ${esc(s.model)}</summary>
        <div class="chips" style="margin-top:8px">${['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].map(m => `<button class="chip ${s.model === m ? 'on' : ''}" data-a="pickModel" data-m="${m}">${m}</button>`).join('')}</div></details>
    </div>
    <div class="row" style="gap:8px">
      <button class="btn ghost card-btn grow" data-a="exportData">⬆️ Експорт</button>
      <button class="btn ghost card-btn grow" data-a="importData">⬇️ Імпорт</button>
      <button class="btn danger" style="width:64px" data-a="resetData" aria-label="Видалити всі дані">🗑</button>
    </div>
    <div class="small muted" style="text-align:center;margin-top:16px">Усі дані зберігаються лише на цьому телефоні · схема v${SCHEMA}</div>`,
    null, () => { const n = $('#stName'); if (n && n.value.trim() !== S.settings.name) { S.settings.name = n.value.trim().slice(0, 30); save(); render(); } });
}

/* ---------------- photo cropper (zoom · move · circle crop) ---------------- */
function cropPhoto(src, out = 480) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (!done) { done = true; resolve(v); } };
    openSheet(`<h2>Фото профілю</h2>
      <div class="crop-wrap" id="cropWrap"><img id="cropImg" alt="" draggable="false"><div class="crop-mask"></div></div>
      <div class="row" style="gap:10px;margin:14px 2px 0"><span class="muted">−</span><input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1" class="grow"><span class="muted">+</span></div>
      <div class="small muted" style="text-align:center;margin-top:6px">Перетягніть фото, масштабуйте повзунком або двома пальцями</div>
      <div class="btns two"><button class="btn ghost" data-a="cropCancel">Скасувати</button><button class="btn" data-a="cropDone">Готово</button></div>`,
      root => {
        const wrap = $('#cropWrap', root), img = $('#cropImg', root), zoomEl = $('#cropZoom', root);
        const st = { z: 1, x: 0, y: 0, base: 1, w: 0, h: 0, V: 0 };
        const layout = () => {
          const dw = st.w * st.base * st.z, dh = st.h * st.base * st.z;
          st.x = clamp(st.x, -(dw - st.V) / 2, (dw - st.V) / 2); st.y = clamp(st.y, -(dh - st.V) / 2, (dh - st.V) / 2);
          img.style.width = dw + 'px'; img.style.height = dh + 'px';
          img.style.left = (st.V - dw) / 2 + st.x + 'px'; img.style.top = (st.V - dh) / 2 + st.y + 'px';
        };
        img.onload = () => { st.V = wrap.clientWidth; st.w = img.naturalWidth; st.h = img.naturalHeight; st.base = Math.max(st.V / st.w, st.V / st.h); layout(); };
        img.src = src;
        zoomEl.oninput = () => { st.z = +zoomEl.value; layout(); };
        const pts = new Map(); let last = null, pinch = null;
        wrap.addEventListener('pointerdown', e => { wrap.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.z }; } });
        wrap.addEventListener('pointermove', e => {
          if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; st.z = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 1, 4); zoomEl.value = st.z; layout(); return; }
          if (pts.size === 1 && last) { st.x += e.clientX - last[0]; st.y += e.clientY - last[1]; last = [e.clientX, e.clientY]; layout(); }
        });
        const up = e => { pts.delete(e.pointerId); pinch = null; last = pts.size ? [...pts.values()][0] : null; };
        wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
        wrap.addEventListener('wheel', e => { e.preventDefault(); st.z = clamp(st.z * (e.deltaY < 0 ? 1.08 : 0.93), 1, 4); zoomEl.value = st.z; layout(); }, { passive: false });
        root.__cropFinish = finish;
        root.__cropRender = () => {
          if (!st.V) return null;
          const c = document.createElement('canvas'); c.width = out; c.height = out; const k = out / st.V;
          const dw = st.w * st.base * st.z, dh = st.h * st.base * st.z;
          c.getContext('2d').drawImage(img, ((st.V - dw) / 2 + st.x) * k, ((st.V - dh) / 2 + st.y) * k, dw * k, dh * k);
          return c.toDataURL('image/jpeg', .9);
        };
      }, () => finish(null));
  });
}

/* ---------------- global actions ---------------- */
Object.assign(A, {
  tab: d => go(d.tab),
  go: d => navigate(d.page, { id: d.id }),
  back: () => back(),
  tabSeg: d => { U.seg[d.key] = d.val; go(d.tab); },
  useg: d => {
    if (USEG_HOOKS[d.key] && USEG_HOOKS[d.key](d.val)) return;
    U.seg[d.key] = d.val; render();
  },
  seg: (d, el) => {
    $$(`[data-group="${d.group}"]`, el.parentNode).forEach(b => b.classList.toggle('on', b === el));
    if (d.group === 'theme') { S.settings.theme = d.val; save(); applyTheme(); }
    if (SEG_HOOKS[d.group]) SEG_HOOKS[d.group](d.val);
  },
  toggle: (d, el) => el.classList.toggle('on'),
  settings: () => settingsSheet(),
  closeSheet: () => closeSheet(),
  fab: () => { const top = U.stack[U.stack.length - 1]; const f = FABS[top ? top.page : U.tab]; if (f) f(); },

  openKey: () => openUrl('https://aistudio.google.com/apikey'),
  pickModel: d => { S.settings.model = d.m; save(); settingsSheet(); toast('Модель: ' + d.m); },
  notifToggle: (d, el) => {
    S.settings.notif = !S.settings.notif; el.classList.toggle('on', S.settings.notif); save();
    if (S.settings.notif) ensureNotifPermission();
    syncReminders();
  },
  keySave: () => {
    const key = $('#stKey').value.trim();
    if (!key) return invalid('stKey', 'Вставте ключ');
    if (!/^[\w-]{20,}$/.test(key)) return invalid('stKey', 'Схоже, ключ некоректний');
    Keys.set(key); toast('Ключ збережено'); settingsSheet();
  },
  avatarMenu: () => {
    if (!S.settings.avatar) return A.avatarPick();
    openSheet(`<h2>Фото профілю</h2><div style="display:flex;justify-content:center;margin-bottom:14px">${avatarHtml(110)}</div>
      <div class="btns"><button class="btn" data-a="avatarPick">📷 Обрати інше фото</button><button class="btn ghost" data-a="avatarCrop">✂️ Змінити масштаб</button>
      <button class="btn danger" data-a="avatarRemove">Прибрати фото</button></div>`, null, () => setTimeout(() => { if (!$('#sheetWrap').classList.contains('open')) settingsSheet(); }, 0));
  },
  avatarPick: async () => {
    const id = await pickPhoto(1600); if (!id) return;
    const src = await Photos.get(id);
    const cropped = await cropPhoto(src);
    if (cropped) {
      [S.settings.avatar, S.settings.avatarSrc].forEach(x => x && Photos.del(x));
      S.settings.avatar = await Photos.put(cropped); S.settings.avatarSrc = id; save(); render(); toast('Фото оновлено');
    } else Photos.del(id);
    settingsSheet();
  },
  avatarCrop: async () => {
    const src = S.settings.avatarSrc && await Photos.get(S.settings.avatarSrc);
    if (!src) return A.avatarPick();
    const cropped = await cropPhoto(src);
    if (cropped) { Photos.del(S.settings.avatar); S.settings.avatar = await Photos.put(cropped); save(); render(); toast('Фото оновлено'); }
    settingsSheet();
  },
  avatarRemove: () => {
    [S.settings.avatar, S.settings.avatarSrc].forEach(x => x && Photos.del(x));
    S.settings.avatar = ''; S.settings.avatarSrc = ''; save(); render(); closeSheet(); toast('Фото прибрано');
  },
  cropCancel: () => closeSheet(),
  cropDone: () => { const r = $('#sheetBody'); const v = r.__cropRender && r.__cropRender(); const f = r.__cropFinish; r.__cropFinish = null; if (f) f(v); closeSheet(); },
  keyDel: async () => {
    if (!await ask({ title: 'Видалити ключ Gemini?', text: 'Складання рецептів для «Вигідних продуктів» перестане працювати, доки не додасте новий.', ok: 'Видалити', danger: true })) return;
    Keys.set(''); toast('Ключ видалено'); render(); settingsSheet();
  },
  testKey: async () => {
    if (!Keys.has()) { toast('Спершу додайте ключ'); return; }
    toast('Перевіряю…');
    try { await gemini({ contents: [{ parts: [{ text: 'Відповідай одним словом: працює' }] }] }); toast('✅ Ключ працює!'); }
    catch (e) { toast('❌ ' + e.message); }
  },
  pinToggle: async (d, el) => {
    if (S.settings.pin) {
      if (!await ask({ title: 'Вимкнути PIN-код?', ok: 'Вимкнути' })) return;
      S.settings.pin = ''; save(); toast('PIN-код вимкнено'); settingsSheet();
    } else {
      closeSheet();
      const ok = await new Promise(res => Lock.show('set', res));
      if (ok) settingsSheet();
    }
  },
  exportData: async () => {
    const photos = await Photos.all().catch(() => ({}));
    const data = JSON.stringify({ app: 'tanichka', exported: new Date().toISOString(), data: S, photos });
    if (Bridge && Bridge.share) Bridge.share(data);
    else if (navigator.clipboard) navigator.clipboard.writeText(data).then(() => toast('Скопійовано в буфер'));
  },
  importData: () => openSheet(`<h2>Імпорт даних</h2><div class="small muted" style="margin-bottom:12px">Вставте текст, отриманий через «Експорт». Поточні дані буде замінено (ключ Gemini та PIN залишаться).</div>
    <div class="field"><textarea class="input" id="impText" style="min-height:160px" placeholder="{...}"></textarea></div>
    <div class="btns"><button class="btn" data-a="importDo">Імпортувати</button></div>`),
  importDo: async () => {
    let parsed;
    try { parsed = JSON.parse($('#impText').value); } catch (e) { return invalid('impText', 'Невірний формат даних'); }
    const d = parsed && parsed.app === 'tanichka' ? parsed.data : parsed; // v1 exports were the bare state
    if (!d || typeof d !== 'object' || !Array.isArray(d.tasks)) return invalid('impText', 'Це не схоже на експорт Танічки');
    if (!await ask({ title: 'Замінити всі дані?', text: 'Поточні записи буде замінено даними з експорту.', ok: 'Замінити', danger: true })) return;
    const keep = { pin: S.settings.pin };
    if (d.settings) delete d.settings.apiKey;
    S = migrate(d); S.settings.pin = keep.pin;
    if (parsed.photos) for (const [id, v] of Object.entries(parsed.photos)) {
      if (typeof v === 'string' && v.startsWith('data:image/')) { try { const db = await new Promise((res, rej) => { const r = indexedDB.open('tanichka-photos', 1); r.onsuccess = () => res(r.result); r.onerror = rej; }); await new Promise(res => { const t = db.transaction('p', 'readwrite'); t.objectStore('p').put(v, id); t.oncomplete = res; t.onerror = res; }); } catch (e) { } }
    }
    save(); applyTheme(); render(); toast('Дані імпортовано');
  },
  resetData: async () => {
    if (!await ask({ title: 'Видалити ВСІ дані?', text: 'Плани, події, фінанси, цикл, дні народження, хотілки, покупки та фото буде видалено безповоротно.', ok: 'Видалити все', danger: true })) return;
    const keep = S.settings; S = clone(DEF); S.settings = keep;
    await Photos.clear().catch(() => { });
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { }
    U.stack = []; save(); render(); toast('Дані видалено');
  }
});

/* ---------------- event wiring ---------------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.hasAttribute('disabled')) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); e.stopPropagation(); Promise.resolve().then(() => fn(el.dataset, el, e)).catch(err => { console.error(err); toast('Помилка: ' + err.message); }); }
});
document.addEventListener('input', e => { if (e.target.id === 'finSearch') { U.finFilter.q = e.target.value; clearTimeout(window.__fs); window.__fs = setTimeout(() => { render(); const el = $('#finSearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 400); } });
window.onAndroidBack = () => {
  if (typeof Picker !== 'undefined' && Picker.close()) return true;
  if (typeof closeDayPop === 'function' && closeDayPop()) return true;
  if (Lock.locked) return false;
  if ($('#lock').classList.contains('show')) { A.pinCancel(); return true; }
  if (closeSheet()) return true;
  if (back()) return true;
  if (U.tab !== 'home') { go('home'); return true; }
  return false;
};
window.addEventListener('error', e => console.error(e.message));

/* ---------------- boot ---------------- */
(function boot() {
  $('#fab').innerHTML = ICONS.plus;
  paintIcons();
  if (S._legacyKey) { if (!Keys.has()) Keys.set(S._legacyKey); delete S._legacyKey; save(); } // v1 stored the key in web storage
  applyTheme();
  if (S.settings.pin) Lock.show('unlock');
  render();
  Dir.load().catch(() => { });
  syncReminders();
  setInterval(() => { if (!U.stack.length && U.tab === 'home' && !$('#sheetWrap').classList.contains('open')) renderHeader(); }, 60000);
})();

TAB_HEADERS.finance = () => ({ title: 'Фінанси' });
TAB_HEADERS.shop = () => ({ title: 'Покупки' });
TAB_HEADERS.more = () => ({ title: 'Ще', actions: `<button class="icon-btn" data-a="settings" aria-label="Налаштування">${ICONS.gear}</button>` });
