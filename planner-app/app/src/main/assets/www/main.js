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
    ['goals', '🏆', 'Цілі та звички', S.goals.length ? (Goals.pending().length ? `${Goals.pending().length} чекає сьогодні` : 'Сьогодні все відмічено ✓') : 'Звички, кинути курити…'],
    ['favs', '❤️', 'Улюблені продукти', S.favs.length ? `${S.favs.length} ${plural(S.favs.length, 'товар', 'товари', 'товарів')}` : 'Сфотографуй — і в улюблені'],
    ['wishes', '🎯', 'Мої хотілки', act.length ? `${act.length} ${plural(act.length, 'ціль', 'цілі', 'цілей')} · ${money(act.reduce((a, x) => a + Wishes.saved(x), 0))}` : 'Цілі накопичення'],
    ['weather', '🌤', 'Погода', w ? `${Math.round(w.data.current.temperature_2m)}° · ${Weather.place().name}` : 'Прогноз на 7 днів'],
    ['prices', '🧺', 'Вигідні продукти', S.recipes.length ? `${S.recipes.length} ${plural(S.recipes.length, 'рецепт', 'рецепти', 'рецептів')} · ${cityName(priceCity())}` : 'Страва → де купити дешевше'],
    ['week', '🗓', 'Підсумок тижня', 'Витрати, цілі, що далі'],
    ['cycle', '🌸', 'Мій цикл', cyc && !S.cycle.hide ? cyc.line : 'Відстеження циклу']
  ];
  // the red dot on «Ще» comes from goals waiting for today — the same mark sits on their tile
  const nag = { goals: S.goals.length ? Goals.pending().length : 0 };
  return `<div class="tiles">${tiles.map(t => `<button class="tile ${nag[t[0]] ? 'has-nag' : ''}" data-a="go" data-page="${t[0]}">
      ${nag[t[0]] ? `<i class="tile-badge">${nag[t[0]]}</i>` : ''}<span class="tile-ic">${t[1]}</span><b>${t[2]}</b><span class="small ${nag[t[0]] ? 'red' : 'muted'} ellipsis">${esc(t[3])}</span></button>`).join('')}</div>
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
/* ---------------- settings: one clean list, details open on tap ---------------- */
U.stSub = '';
const GEMINI_IC = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><defs><linearGradient id="gemG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4796E3"/><stop offset=".55" stop-color="#9177C7"/><stop offset="1" stop-color="#CA6673"/></linearGradient></defs><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" fill="url(#gemG)"/></svg>`;
const ST_IC = {
  theme: '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', finger: '<path d="M8 20c-1-2-1.5-4-1.5-7a5.5 5.5 0 0 1 11 0"/><path d="M12 13v3c0 2 .5 3.5 1.2 5"/><path d="M9.5 13a2.5 2.5 0 0 1 5 0v2"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/><path d="M12 11v5M9.8 13.6L12 16l2.2-2.4"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const stSvg = (k, s = 18, c = 'currentColor') => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ST_IC[k]}</svg>`;
const stBox = (bg, inner) => `<span class="st-ic" style="background:${bg}">${inner}</span>`;
const stChev = val => `<span class="st-val">${val || ''}${stSvg('chev', 16)}</span>`;
const stRow = (icon, label, right, attrs = '') => `<div class="st-row" ${attrs}>${icon}<span class="st-lbl">${label}</span>${right}</div>`;
const THEMES = [['light', 'Світла'], ['dark', 'Темна'], ['auto', 'Як у системі']];
const miniIcon = id => { const ic = APP_ICONS.find(x => x[0] === id) || APP_ICONS[0]; return `<span class="st-mini" style="background:${ic[2]}">${LAD_SIGN.replace('stroke="#000"', `stroke="${ic[3]}"`)}</span>`; };
const stHead = title => `<button class="st-back" data-a="stOpen" data-v="">${stSvg('chev', 16).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6')} Налаштування</button><h2>${title}</h2>`;

function settingsSheet(sub) {
  if (sub !== undefined) U.stSub = sub;
  const s = S.settings, k = U.stSub;
  const onClose = () => { const n = $('#stName'); if (n && n.value.trim() !== S.settings.name) { S.settings.name = n.value.trim().slice(0, 30); save(); render(); } };
  if (k) { openSheet(stHead(ST_SUB[k].title) + ST_SUB[k].html(s), null, onClose); return; }
  const notifOk = !Bridge || !Bridge.notificationsAllowed || Bridge.notificationsAllowed();
  openSheet(`<div class="st-list">
    <div class="st-group">${stRow(`<span class="st-avawrap">${avatarHtml(46)}</span>`, `<b class="st-name">${esc(s.name || 'Ваше імʼя')}</b>`, stChev(), 'data-a="stOpen" data-v="profile"')}</div>
    <div class="st-group">
      ${stRow(stBox('#5b5bd6', stSvg('theme', 18, '#fff')), 'Тема', stChev(THEMES.find(t => t[0] === s.theme)[1]), 'data-a="stOpen" data-v="theme"')}
      ${Bridge && Bridge.setIcon ? stRow(miniIcon(curIcon()), 'Ярлик', stChev(), 'data-a="stOpen" data-v="icon"') : ''}</div>
    <div class="st-group">
      ${stRow(stBox('#ff6b4a', stSvg('bell', 18, '#fff')), `<span data-a="stOpen" data-v="notif">Сповіщення${s.notif && !notifOk ? ' <span class="red">!</span>' : ''}</span>`, toggleHtml('stNotif', s.notif).replace('data-a="toggle"', 'data-a="notifToggle"'))}
      ${stRow(stBox('#34a853', stSvg('lock', 18, '#fff')), 'PIN-код', toggleHtml('stPin', !!s.pin).replace('data-a="toggle"', 'data-a="pinToggle"'))}
      ${s.pin && Bio.available() ? stRow(stBox('#2a78d6', stSvg('finger', 18, '#fff')), 'Відбиток', toggleHtml('stBio', !!s.bio).replace('data-a="toggle"', 'data-a="bioToggle"')) : ''}</div>
    <div class="st-group">
      ${stRow(`<span class="st-ic" style="background:var(--chip)">${GEMINI_IC}</span>`, 'Gemini', stChev(Keys.hint() ? `<span class="green">${stSvg('check', 16)}</span>` : 'Додати'), 'data-a="stOpen" data-v="gemini"')}
      ${Bridge && Bridge.pickBackup ? stRow(stBox('#0ea5e9', stSvg('cloud', 18, '#fff')), 'Автокопія', stChev(Bridge.hasBackup() ? 'Щотижня' : 'Вимк.'), 'data-a="stOpen" data-v="backup"') : ''}
      ${stRow(stBox('#8e8e93', stSvg('data', 18, '#fff')), 'Дані', stChev(), 'data-a="stOpen" data-v="data"')}</div>
  </div>`, null, onClose);
}
SEG_HOOKS.stGender = v => { S.settings.gender = v; save(); render(); toast(v === 'f' ? 'Звертатимусь до вас як до неї 🌸' : 'Звертатимусь до вас як до нього 💪'); };
const ST_SUB = {
  profile: { title: 'Профіль', html: s => `<div class="prof-card">
      <button class="st-ava-btn" data-a="avatarMenu" aria-label="Фото профілю">${avatarHtml(64)}<span class="st-cam">${ICONS.camera.replace('<svg', '<svg width="14" height="14"')}</span></button>
      <div class="grow" style="min-width:0"><input class="name-input" id="stName" maxlength="30" placeholder="Ваше імʼя" value="${esc(s.name)}"></div></div>
    <div class="field" style="margin-top:14px"><label>Звертатися до мене</label>${seg('stGender', [['m', 'Він'], ['f', 'Вона']], userGender())}</div>` },
  theme: { title: 'Тема', html: s => `<div class="st-group">${THEMES.map(([v, l]) => stRow('', l, s.theme === v ? `<span class="green">${stSvg('check', 20)}</span>` : '', `data-a="themeSet" data-v="${v}"`)).join('')}</div>` },
  icon: { title: 'Ярлик', html: () => `<div class="icon-pick">${APP_ICONS.map(([id, label, bg, line]) => `<button data-a="iconPick" data-v="${id}" class="${curIcon() === id ? 'on' : ''}" aria-label="${label}">
        <span style="background:${bg}">${LAD_SIGN.replace('stroke="#000"', `stroke="${line}"`)}</span></button>`).join('')}</div>` },
  notif: { title: 'Сповіщення', html: s => `<div class="st-group">${stRow('', 'Сповіщення', toggleHtml('stNotif', s.notif).replace('data-a="toggle"', 'data-a="notifToggle"'))}</div>
      ${s.notif && Bridge && Bridge.notificationsAllowed ? (Bridge.notificationsAllowed()
        ? `<div class="st-group">${stRow('', 'Тестове зараз', stChev(), 'data-a="notifTest"')}${Bridge.testAlarm ? stRow('', 'Нагадування через 1 хв', stChev(), 'data-a="alarmTest"') : ''}</div>`
        : `<div class="st-group">${stRow('', '<span class="red">Заборонені на телефоні</span>', stChev('Дозволити'), 'data-a="notifFix"')}</div>`) : ''}` },
  gemini: { title: 'Gemini', html: () => Keys.hint()
      ? `<div class="st-group">${stRow(`<span class="st-ic" style="background:var(--chip)">${GEMINI_IC}</span>`, 'Ключ додано', `<span class="green">${stSvg('check', 18)}</span>`)}${stRow('', 'Перевірити', stChev(), 'data-a="testKey"')}${stRow('', '<span class="red">Видалити ключ</span>', `<button class="del-btn" data-a="keyDel" aria-label="Видалити ключ">${ICONS.trash}</button>`)}</div>`
      : `<div class="row" style="gap:8px"><input class="input grow" id="stKey" type="password" autocomplete="off" placeholder="Вставте ключ Gemini">
          <button class="btn btn-inline" data-a="keySave">OK</button></div>
        <div style="margin:10px 4px 0"><b class="link small" data-a="openKey">Отримати безкоштовний ключ ↗</b></div>` },
  backup: { title: 'Автокопія', html: () => typeof backupCard === 'function' ? backupCard() : '' },
  data: { title: 'Дані', html: () => `<div class="st-group">${stRow('', 'Експорт', stChev(), 'data-a="exportData"')}${stRow('', 'Імпорт', stChev(), 'data-a="importData"')}${stRow('', '<span class="red">Видалити всі дані</span>', stChev(), 'data-a="resetData"')}</div>
      <div class="small muted" style="text-align:center;margin-top:12px">Дані зберігаються лише на цьому телефоні</div>` }
};

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
  settings: () => settingsSheet(''),
  stOpen: d => settingsSheet(d.v || ''),
  themeSet: d => { S.settings.theme = d.v; save(); applyTheme(); settingsSheet(); },
  closeSheet: () => closeSheet(),
  fab: () => { const top = U.stack[U.stack.length - 1]; const f = FABS[top ? top.page : U.tab]; if (f) f(); },

  openKey: () => openUrl('https://aistudio.google.com/apikey'),
  notifTest: () => { try { Bridge.notifyNow('', 'Сповіщення працюють! Так виглядатимуть нагадування.'); toast('Надіслано — подивись у шторку'); } catch (e) { toast('Не вдалося'); } },
  notifFix: () => { if (Bridge.requestNotifications) Bridge.requestNotifications(); setTimeout(() => { if (!Bridge.notificationsAllowed() && Bridge.openNotifSettings) Bridge.openNotifSettings(); }, 1500); },
  alarmTest: () => { try { Bridge.testAlarm(60); toast('Через хвилину прийде нагадування — можна заблокувати телефон'); } catch (e) { toast('Не вдалося'); } },
  notifToggle: (d, el) => {
    S.settings.notif = !S.settings.notif; el.classList.toggle('on', S.settings.notif); save();
    if (S.settings.notif) ensureNotifPermission();
    syncReminders();
  },
  keySave: () => {
    const key = $('#stKey').value.replace(/\s+/g, '').replace(/^["'«“]+|["'»”]+$/g, '');
    if (!key) return invalid('stKey', 'Вставте ключ');
    if (key.length < 20 || key.length > 300 || /[<>"'\\]/.test(key)) return invalid('stKey', 'Схоже, це не ключ — скопіюйте його повністю');
    Keys.set(key); toast('Ключ збережено'); settingsSheet();
  },
  avatarMenu: () => {
    if (!S.settings.avatar) return A.avatarPick();
    openSheet(`<h2>Фото профілю</h2><div style="display:flex;justify-content:center;margin-bottom:14px">${avatarHtml(110)}</div>
      <div class="btns"><button class="btn" data-a="avatarPick">Обрати інше фото</button><button class="btn ghost" data-a="avatarCrop">Змінити масштаб</button>
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
    if (!await ask({ title: 'Видалити ключ Gemini?', text: 'Після цього можна буде вставити інший ключ. Без ключа складання рецептів не працюватиме.', ok: 'Видалити', danger: true })) return;
    Keys.set(''); toast('Ключ видалено'); render(); settingsSheet();
  },
  testKey: async () => {
    if (!Keys.has()) { toast('Спершу додайте ключ'); return; }
    toast('Перевіряю…');
    try { await gemini({ contents: [{ parts: [{ text: 'Відповідай одним словом: працює' }] }] }); toast('✅ Ключ працює!'); }
    catch (e) { toast('❌ ' + e.message); }
  },
  bioToggle: async () => {
    if (S.settings.bio) { S.settings.bio = false; save(); toast('Біометрію вимкнено'); return settingsSheet(); }
    if (!await Bio.ask('Увімкнути вхід за біометрією')) return toast('Не вдалося підтвердити');
    S.settings.bio = true; save(); toast('Біометрію увімкнено'); settingsSheet();
  },
  iconPick: d => {
    if (curIcon() === d.v) return;
    try { Bridge.setIcon(d.v); } catch (e) { toast('Не вдалося змінити ярлик'); return; }
    $$('.icon-pick button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v));
    toast('Ярлик змінено — на робочому столі він оновиться за кілька секунд');
  },
  pinToggle: async (d, el) => {
    if (S.settings.pin) {
      if (!await ask({ title: 'Вимкнути PIN-код?', ok: 'Вимкнути' })) return;
      S.settings.pin = ''; S.settings.bio = false; save(); LockNative.sync(); toast('PIN-код вимкнено'); settingsSheet();
    } else {
      closeSheet();
      const ok = await new Promise(res => Lock.show('set', res));
      if (ok && Bio.available() && await ask({ title: 'Входити за відбитком?', text: 'Замість PIN-коду можна розблоковувати відбитком пальця або обличчям', ok: 'Увімкнути' }) && await Bio.ask('Увімкнути вхід за біометрією')) { S.settings.bio = true; save(); toast('Біометрію увімкнено'); }
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
    if (!d || typeof d !== 'object' || !Array.isArray(d.tasks)) return invalid('impText', 'Це не схоже на експорт ЛАД');
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
  LockNative.sync(); LockNative.ready();
  Dir.load().catch(() => { });
  syncReminders();
  if (S.settings.notif && Bridge && Bridge.notificationsAllowed && !Bridge.notificationsAllowed() && !S.settings.notifAsked) { S.settings.notifAsked = true; save(); ensureNotifPermission(); }
  setInterval(() => { if (!U.stack.length && U.tab === 'home' && !$('#sheetWrap').classList.contains('open')) renderHeader(); }, 60000);
})();

TAB_HEADERS.finance = () => ({ title: 'Фінанси' });
TAB_HEADERS.shop = () => ({ title: 'Покупки', actions: `<button class="icon-btn" data-a="shopPaste" aria-label="Вставити список">${ICONS.inbox}</button><button class="icon-btn" data-a="shopShare" aria-label="Надіслати список">${ICONS.share}</button>` });
TAB_HEADERS.more = () => ({ title: 'Ще', actions: `<button class="icon-btn" data-a="settings" aria-label="Налаштування">${ICONS.gear}</button>` });
