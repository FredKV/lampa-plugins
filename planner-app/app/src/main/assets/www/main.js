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
    ['wishes', '🐷', 'Мої хотілки', act.length ? `${act.length} ${plural(act.length, 'ціль', 'цілі', 'цілей')} · ${money(act.reduce((a, x) => a + Wishes.saved(x), 0))}` : 'Цілі накопичення'],
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
function settingsSheet() {
  const s = S.settings, hint = Keys.hint();
  openSheet(`
    <h2>Налаштування</h2>
    <div class="field"><label>Як до вас звертатися</label><input class="input" id="stName" maxlength="30" placeholder="Імʼя" value="${esc(s.name)}"></div>
    <div class="field"><label>Тема</label>${seg('theme', [['light', 'Світла'], ['dark', 'Темна'], ['auto', 'Як у системі']], s.theme)}</div>

    <h3 class="st-h">🔔 Нагадування</h3>
    <div class="switch"><div><b>Сповіщення</b><div class="small muted">Дні народження, цикл, події, ціни</div></div>${toggleHtml('stNotif', s.notif)}</div>

    <h3 class="st-h">🔒 Захист даних</h3>
    <div class="switch"><div><b>PIN-код при вході</b><div class="small muted">Захищає фінанси, цикл та інші особисті дані</div></div>${toggleHtml('stPin', !!s.pin).replace('data-a="toggle"', 'data-a="pinToggle"')}</div>

    <h3 class="st-h">✨ Gemini AI <span class="ai-badge" style="vertical-align:middle">безкоштовно</span></h3>
    <div class="small muted" style="margin:0 0 12px;line-height:1.45">Потрібен, щоб складати рецепт і список продуктів у «Вигідних продуктах» (самі ціни беруться з магазинів). Ключ зберігається в захищеному сховищі застосунку на телефоні й не потрапляє в експорт.
      <br><b class="link" data-a="openKey">Отримати ключ → aistudio.google.com/apikey</b></div>
    <div class="field"><label>API ключ ${hint ? `<span class="pill green" style="margin-left:6px">збережено: ${esc(hint)}</span>` : ''}</label>
      <input class="input" id="stKey" type="password" autocomplete="off" placeholder="${hint ? 'Введіть новий, щоб замінити' : 'AIza…'}"></div>
    <div class="field"><label>Модель</label><input class="input" id="stModel" placeholder="gemini-2.5-flash" value="${esc(s.model)}">
      <div class="chips" style="margin-top:8px">${['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].map(m => `<button class="chip" data-a="pickModel" data-m="${m}">${m}</button>`).join('')}</div></div>
    <div class="btns two"><button class="btn ghost" data-a="testKey">Перевірити ключ</button>${hint ? `<button class="btn danger" data-a="keyDel">Видалити ключ</button>` : '<span></span>'}</div>
    <div class="btns"><button class="btn" data-a="settingsSave">Зберегти</button></div>

    <h3 class="st-h">💾 Дані</h3>
    <div class="small muted" style="margin:0 0 12px">Усі дані зберігаються лише на цьому телефоні.</div>
    <div class="btns two" style="margin-top:0"><button class="btn ghost" data-a="exportData">Експорт</button><button class="btn ghost" data-a="importData">Імпорт</button></div>
    <div class="btns"><button class="btn danger" data-a="resetData">Видалити всі дані</button></div>
    <div class="small muted" style="text-align:center;margin-top:18px">Танічка🦝 · схема даних v${SCHEMA}</div>`);
}
function readSettingsForm() {
  const r = $('#sheetBody');
  return {
    name: $('#stName', r).value.trim().slice(0, 30), theme: segVal(r, 'theme') || 'auto',
    model: $('#stModel', r).value.trim() || 'gemini-2.5-flash',
    notif: $('#stNotif', r).classList.contains('on')
  };
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
  pickModel: d => { $('#stModel').value = d.m; },
  settingsSave: () => {
    const f = readSettingsForm();
    const key = $('#stKey').value.trim();
    if (key && !/^[\w-]{20,}$/.test(key)) return invalid('stKey', 'Схоже, ключ некоректний');
    if (key) Keys.set(key);
    const notifOn = f.notif && !S.settings.notif;
    S.settings = { ...S.settings, ...f }; save(); applyTheme(); closeSheet(); render();
    if (notifOn) ensureNotifPermission();
    syncReminders();
    toast('Збережено');
  },
  keyDel: async () => {
    if (!await ask({ title: 'Видалити ключ Gemini?', text: 'Складання рецептів для «Вигідних продуктів» перестане працювати, доки не додасте новий.', ok: 'Видалити', danger: true })) return;
    Keys.set(''); toast('Ключ видалено'); render();
  },
  testKey: async (d, el) => {
    const key = $('#stKey').value.trim();
    if (key) Keys.set(key);
    if (!Keys.has()) { toast('Введіть ключ'); return; }
    S.settings.model = $('#stModel').value.trim() || 'gemini-2.5-flash';
    el.textContent = 'Перевіряю…'; el.setAttribute('disabled', '');
    try { await gemini({ contents: [{ parts: [{ text: 'Відповідай одним словом: працює' }] }] }); toast('✅ Ключ працює!'); }
    catch (e) { toast('❌ ' + e.message); }
    el.textContent = 'Перевірити ключ'; el.removeAttribute('disabled');
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
  setInterval(() => { if (!U.stack.length && !$('#sheetWrap').classList.contains('open')) renderHeader(); }, 60000);
})();
