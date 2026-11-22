'use strict';
/* =====================================================================
   • Голосом: «завтра о 10 стоматолог», «витратила 250 на каву», «купити молоко і хліб»
     → Gemini (або простий розбір без ключа) → подія / план / витрата / дохід / покупки.
   • Спільний список: надіслати список покупок у месенджер і вставити список, який надіслали тобі.
   • Автокопія: раз на тиждень зберігати всі дані у вибраний файл (можна на Google Диску).
   ===================================================================== */

/* ---------------- voice ---------------- */
/* full-screen listening (variant C): live text + wave in the logo colours */
function listenOverlay() {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'vc-ov'; ov.id = 'vcOv';
    ov.innerHTML = `<div class="vc-text" id="vcLive">Говоріть…</div><div class="vc-wave">${Array.from({ length: 21 }, () => '<i></i>').join('')}</div>
      <div class="vc-hint" id="vcHint">Я слухаю</div><button class="vc-x" data-a="vcCancel" aria-label="Скасувати">✕</button>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('show'));
    const bars = [...ov.querySelectorAll('.vc-wave i')]; let lvl = 0, raf = 0, t0 = performance.now();
    const draw = now => { bars.forEach((b, i) => { const w = Math.sin(now / 160 + i * .7) * .5 + .5; b.style.transform = `scaleY(${.15 + Math.min(1, lvl) * (.35 + w * .65)})`; }); raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    const done = r => { cancelAnimationFrame(raf); ov.classList.remove('show'); setTimeout(() => ov.remove(), 220); ['__voiceCb', '__voicePartial', '__voiceRms', '__voiceReady'].forEach(k => window[k] = null); res(r); };
    window.__voiceReady = () => { $('#vcHint').textContent = 'Я слухаю'; };
    window.__voiceRms = db => { lvl = lvl * .6 + Math.max(0, (db + 2) / 10) * .4; };
    window.__voicePartial = t => { const el = $('#vcLive'); if (el) el.textContent = `«${t}»`; };
    window.__voiceCb = (t, fail, why) => {
      if (t) { const el = $('#vcLive'); if (el) el.textContent = `«${t}»`; haptic && haptic('tick'); setTimeout(() => done({ text: t }), 120); return; }
      done({ text: '', fail: !!fail, why: why || '' });
    };
    A.vcCancel = () => { try { Bridge.listenStop(true); } catch (e) { } done({ text: '', cancel: true }); };
    Bridge.listenStart();
  });
}
function listen() {
  if (Bridge && Bridge.listenStart) return listenOverlay().then(r => r.why === 'na' && Bridge.voice ? listenSystem() : r);
  return listenSystem();
}
function listenSystem() {
  return new Promise(res => {
    if (Bridge && Bridge.voice) { window.__voiceCb = (t, fail) => { window.__voiceCb = null; res({ text: t || '', fail: !!fail }); }; Bridge.voice(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return res({ text: '', fail: true });
    const r = new SR(); r.lang = 'uk-UA'; r.onresult = e => res({ text: e.results[0][0].transcript }); r.onerror = () => res({ text: '', fail: true }); r.start();
  });
}
const WD_WORDS = { 'понеділ': 1, 'вівтор': 2, 'серед': 3, 'четвер': 4, 'пʼятниц': 5, "п'ятниц": 5, 'пятниц': 5, 'субот': 6, 'неділ': 0 };
/** offline parser — enough for typical phrases when there is no Gemini key */
function parseLocal(t) {
  const s = t.toLowerCase().replace(/’/g, "'"), tdy = today();
  let date = '';
  if (/післязавтра/.test(s)) date = addDays(tdy, 2); else if (/завтра/.test(s)) date = addDays(tdy, 1); else if (/сьогодні/.test(s)) date = tdy;
  const wd = Object.keys(WD_WORDS).find(k => s.includes(k)); if (wd && !date) { const want = WD_WORDS[wd], now = parseYmd(tdy).getDay(); date = addDays(tdy, ((want - now + 7) % 7) || 7); }
  const tm = s.match(/(?:о|на)\s(\d{1,2})(?::|\s|\.)?(\d{2})?\s*(?:год|$|\s)/); const time = tm && +tm[1] < 24 ? `${String(tm[1]).padStart(2, '0')}:${tm[2] || '00'}` : '';
  const amt = s.match(/(\d+(?:[.,]\d+)?)\s*(?:грн|гривень|гривні|₴)?/);
  if (/витрат|заплатил|купила за|купив за|потратил/.test(s) && amt) {
    const what = s.replace(/.*?(?:на|за)\s+/, '').replace(/\d+.*$/, '').trim();
    return { kind: 'expense', amount: num(amt[1]), title: what || t, date: date || tdy };
  }
  if (/отримал|зарплат|дохід|заробил/.test(s) && amt) return { kind: 'income', amount: num(amt[1]), title: t, date: date || tdy };
  if (/^(купити|треба купити|в магазин|додай до покупок)/.test(s)) {
    const items = s.replace(/^(треба купити|купити|в магазин|додай до покупок)\s*/, '').split(/,|\sі\s|\sта\s/).map(x => x.trim()).filter(Boolean);
    return { kind: 'shop', items };
  }
  const title = t.replace(/(післязавтра|завтра|сьогодні)/i, '').replace(/(?:о|на)\s\d{1,2}(?::\d{2})?\s*(?:годині|год\.?)?/i, '').replace(/\s+/g, ' ').trim();
  return { kind: date || time ? 'event' : 'task', title: title.charAt(0).toUpperCase() + title.slice(1), date, time };
}
async function parseVoice(text) {
  if (!Keys.has()) return parseLocal(text);
  const cats = Fin.cats('exp').map(c => c[0]).join(', ');
  const { text: out } = await gemini({
    contents: [{ role: 'user', parts: [{ text: `Сьогодні ${today()} (${WD_FULL[parseYmd(today()).getDay()]}). Користувачка сказала: «${text}». ` +
      'Визнач, що додати в планер, і відповідай ЛИШЕ JSON: {"kind":"event"|"task"|"expense"|"income"|"shop","title":"коротко","date":"YYYY-MM-DD або порожньо","time":"HH:MM або порожньо",' +
      `"amount":число або 0,"cat":"для витрати одна з: ${cats}","items":["для покупок — список товарів"]}. ` +
      'event — подія/зустріч з датою; task — справа без конкретного часу; expense — витратила гроші; income — отримала гроші; shop — що купити.' }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 200 }
  }, { fast: true, timeout: 8000 });
  const j = extractJson(out);
  return { kind: ['event', 'task', 'expense', 'income', 'shop'].includes(j.kind) ? j.kind : 'task', title: String(j.title || text).slice(0, 200),
    date: isDate(j.date) ? j.date : '', time: /^\d\d:\d\d$/.test(j.time || '') ? j.time : '', amount: round2(num(j.amount)),
    cat: Fin.cats('exp').some(c => c[0] === j.cat) ? j.cat : 'other', items: (Array.isArray(j.items) ? j.items : []).map(String).slice(0, 30) };
}
U.vc = null;
const VC_LBL = { event: '📅 Подія', task: '📝 План', expense: '💸 Витрата', income: '💰 Дохід', shop: '🛒 У покупки' };
function voiceSheet() {
  const v = U.vc; if (!v) return;
  if (v.loading) { openSheet(`<h2>Голосом</h2><div class="vc-said">«${esc(v.text)}»</div><div class="sf-load"><div class="spinner"></div><span>Розбираю…</span></div>`); return; }
  const r = v.r;
  const what = r.kind === 'shop' ? r.items.map(esc).join(', ') : esc(r.title);
  const when = [r.date ? dateLabel(r.date) : '', r.time].filter(Boolean).join(' о ');
  openSheet(`<h2>Голосом${v.refining ? ' <span class="vc-ai" title="Gemini уточнює"></span>' : ''}</h2><div class="vc-said">«${esc(v.text)}»</div>
    <div class="card" style="margin:0 0 12px"><div class="small muted">${VC_LBL[r.kind]}</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">${what || '—'}</div>
      ${r.amount ? `<div style="font-size:22px;font-weight:800;margin-top:4px">${money(r.amount)}</div>` : ''}
      ${when ? `<div class="small muted" style="margin-top:4px">${esc(when)}</div>` : ''}</div>
    <div class="chips" style="margin-bottom:12px">${Object.entries(VC_LBL).map(([k, l]) => `<button class="chip ${k === r.kind ? 'on' : ''}" data-a="vcKind" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="btns two"><button class="btn ghost card-btn" data-a="vcAgain">🎙 Ще раз</button><button class="btn" data-a="vcSave">Додати</button></div>`);
}
async function startVoice(typed) {
  let text = typed;
  if (!text) {
    const r = await listen(); if (r.cancel) return;
    if (r.fail && !r.text) { if (r.why === 'mic') toast('Потрібен дозвіл на мікрофон'); else if (/^e(6|7)$/.test(r.why)) toast('Нічого не почула — спробуйте ще раз'); else voiceTypeSheet(); return; }
    text = r.text;
  }
  if (!text.trim()) return;
  const vc = U.vc = { text, loading: false, r: parseLocal(text), refining: Keys.has(), touched: false };
  voiceSheet();
  if (!vc.refining) return;
  try {
    const r = await parseVoice(text);
    if (U.vc === vc && !vc.touched && $('#sheetWrap').classList.contains('open')) { vc.r = r; }
  } catch (e) { }
  if (U.vc === vc) { vc.refining = false; if ($('#sheetWrap').classList.contains('open') && $('[data-a=vcSave]')) voiceSheet(); }
}
function voiceTypeSheet() {
  openSheet(`<h2>Що додати?</h2><div class="small muted" style="margin-bottom:10px">Голосове введення недоступне — напишіть так, як сказали б: «завтра о 10 стоматолог», «витратила 250 на каву», «купити молоко, хліб».</div>
    <div class="field"><input class="input" id="vcText" maxlength="200" placeholder="Напишіть фразу"></div>
    <div class="btns"><button class="btn" data-a="vcTyped">Розібрати</button></div>`, r => setTimeout(() => $('#vcText', r).focus(), 300));
}

/* ---------------- shared shopping list ---------------- */
function shopListText() {
  const toBuy = S.shop.filter(i => !i.bought); if (!toBuy.length) return '';
  return ['🛒 Список покупок', ...toBuy.map(i => `☐ ${i.name}${i.qty ? ' — ' + i.qty : ''}`), '', 'Надіслано з ЛАД'].join('\n');
}
function parseListText(t) {
  return String(t || '').split(/\n/).map(l => l.replace(/^[\s☐☑✅✓•\-*\d.)]+/, '').trim()).filter(l => l && !/^(🛒|список|надіслано з)/i.test(l))
    .map(l => { const [name, qty] = l.split(/\s[—–-]\s/); return { name: name.trim().slice(0, 80), qty: (qty || '').trim().slice(0, 40) }; }).filter(x => x.name.length > 1);
}

/* ---------------- auto-backup ---------------- */
const BK_DAYS = 7;
async function backupNow(silent) {
  if (!Bridge || !Bridge.writeBackup || !Bridge.hasBackup()) return false;
  const photos = await Photos.all().catch(() => ({}));
  const ok = Bridge.writeBackup(JSON.stringify({ app: 'tanichka', exported: new Date().toISOString(), data: S, photos }));
  if (ok) { S.settings.lastBackup = Date.now(); save(); }
  if (!silent) toast(ok ? '✓ Копію збережено' : 'Не вдалося записати копію — оберіть файл ще раз');
  return ok;
}
function backupCard() {
  if (!Bridge || !Bridge.pickBackup) return '';
  const on = Bridge.hasBackup(), last = S.settings.lastBackup;
  return `<div class="card st-card">
    <div class="row between" style="align-items:center"><div><b>💾 Автокопія</b><div class="small muted" style="margin-top:2px">${on
      ? `${esc(Bridge.backupName())} · ${last ? 'остання ' + shortDate(ymd(new Date(last))) : 'ще не було'} · щотижня`
      : 'Раз на тиждень зберігати всі дані у файл — можна на Google Диску'}</div></div>
      ${on ? `<button class="del-btn" data-a="bkOff" aria-label="Вимкнути автокопію">${ICONS.trash}</button>` : ''}</div>
    <div class="row" style="gap:8px;margin-top:10px">${on ? `<button class="chip card-bg grow" data-a="bkNow">Зберегти зараз</button>` : `<button class="chip card-bg grow" data-a="bkPick">Обрати місце для копії</button>`}
      <button class="chip card-bg grow" data-a="bkRestore">Відновити з файлу</button></div></div>`;
}
window.__bkPicked = async ok => { if (ok) { await backupNow(true); toast('✓ Автокопію увімкнено — перша копія вже збережена'); if ($('#sheetWrap').classList.contains('open')) settingsSheet(); } };
window.__bkOpened = text => {
  if (!text) { toast('Файл не прочитано'); return; }
  A.importData(); setTimeout(() => { const t = $('#impText'); if (t) t.value = text; }, 50);
};
// weekly copy when the app opens
setTimeout(() => { const l = S.settings.lastBackup || 0; if (Bridge && Bridge.hasBackup && Bridge.hasBackup() && Date.now() - l > BK_DAYS * 86400000) backupNow(true); }, 4000);

Object.assign(A, {
  voiceStart: () => startVoice(),
  vcTyped: () => { const t = $('#vcText').value.trim(); if (!t) return invalid('vcText', 'Напишіть фразу'); startVoice(t); },
  vcAgain: () => { closeSheet(); setTimeout(() => startVoice(), 250); },
  vcKind: d => { if (!U.vc || !U.vc.r) return; U.vc.touched = true; const r = U.vc.r; r.kind = d.v; if (d.v === 'shop' && !r.items.length) r.items = [r.title]; voiceSheet(); },
  vcSave: () => {
    const r = U.vc && U.vc.r; if (!r) return; let msg = '';
    if (r.kind === 'event') { S.events.push({ id: uid(), title: r.title, date: r.date || today(), time: r.time, note: '', important: false, remind: r.time ? 'hour' : 'day' }); msg = `📅 Подію додано: ${dateLabel(r.date || today())}`; }
    else if (r.kind === 'task') { S.tasks.unshift({ id: uid(), title: r.title, note: '', prio: 2, due: r.date, done: false, created: Date.now() }); msg = '📝 План додано'; }
    else if (r.kind === 'expense' || r.kind === 'income') {
      if (!(r.amount > 0)) { toast('Не почула суму — скажіть, наприклад, «витратила 250 на каву»'); return; }
      Fin.add({ type: r.kind === 'expense' ? 'exp' : 'inc', amount: r.amount, cat: r.kind === 'expense' ? (r.cat || 'other') : 'other', note: r.title, date: r.date || today() });
      msg = `${r.kind === 'expense' ? '💸 Витрату' : '💰 Дохід'} ${money(r.amount)} записано`;
    } else { const items = r.items.length ? r.items : [r.title]; items.forEach(n => S.shop.push({ id: uid(), name: n, qty: '', buy: '', price: 0, dish: 'Інше', store: '', url: '', bought: false })); msg = `🛒 Додано в покупки: ${items.length}`; }
    if (r.kind === 'event') ensureNotifPermission();
    U.vc = null; save(); closeSheet(); render(); toast(msg);
  },
  shopShare: () => { const t = shopListText(); if (!t) { toast('Список порожній'); return; } shareText(t); },
  shopPaste: () => openSheet(`<h2>Вставити список</h2><div class="small muted" style="margin-bottom:10px">Вставте список, який вам надіслали (кожен товар з нового рядка).</div>
    <div class="field"><textarea class="input" id="plText" style="min-height:150px" placeholder="Молоко — 1 л&#10;Хліб&#10;Яйця — 10 шт"></textarea></div>
    <div class="btns"><button class="btn" data-a="shopPasteDo">Додати в покупки</button></div>`, r => setTimeout(() => $('#plText', r).focus(), 300)),
  shopPasteDo: () => {
    const items = parseListText($('#plText').value); if (!items.length) return invalid('plText', 'Не знайшла жодного товару');
    items.forEach(i => S.shop.push({ id: uid(), name: i.name, qty: i.qty, buy: '', price: 0, dish: 'Від когось', store: '', url: '', bought: false }));
    save(); closeSheet(); render(); toast(`🛒 Додано ${items.length} ${plural(items.length, 'товар', 'товари', 'товарів')}`);
  },
  bkPick: () => Bridge.pickBackup(),
  bkNow: () => backupNow(false),
  bkRestore: () => Bridge.openBackup ? Bridge.openBackup() : A.importData(),
  bkOff: async () => { if (!await ask({ title: 'Вимкнути автокопію?', text: 'Файл з копією залишиться на місці.', ok: 'Вимкнути' })) return; Bridge.forgetBackup(); settingsSheet(); }
});

/* ---------------- home-screen widget ---------------- */
function widgetData() {
  const days = {}, w = typeof Weather !== 'undefined' ? Weather.data() : null;
  for (let k = 0; k < 3; k++) {
    const d = addDays(today(), k), dd = dayData(d, null);
    const items = [...dd.bds.map(b => `🎂 ${b.p.name}`), ...dd.evs.map(e => `${e.time ? e.time + '  ' : '📅 '}${e.title}`), ...dd.tasks.filter(t => !t.done).map(t => `📝 ${t.title}`)];
    let weather = '';
    if (w) { const dl = w.data.daily, i = dl.time.indexOf(d);
      if (i >= 0) weather = k === 0 ? `${wmo(w.data.current.weather_code, Weather.current(w.data).day)[0]} ${Math.round(w.data.current.temperature_2m)}°` : `${wmo(dl.weather_code[i])[0]} ${Math.round(dl.temperature_2m_max[i])}°`; }
    days[d] = { items, weather };
  }
  const goals = (S.goals || []).filter(g => g.type === 'habit' || g.type === 'quit').slice(0, 3).map(g => ({
    id: g.id, title: g.title, per: g.per || 'day', times: g.times || 0, log: Object.keys(g.log || {}).filter(d => d >= addDays(today(), -35)) }));
  return { days, goals, ts: Date.now() };
}
function pushWidget() { try { if (Bridge && Bridge.setWidget) Bridge.setWidget(JSON.stringify(widgetData())); } catch (e) { } }
function applyWidgetTicks() {
  if (!Bridge || !Bridge.takeWidgetToggles) return;
  let q = []; try { q = JSON.parse(Bridge.takeWidgetToggles() || '[]'); } catch (e) { }
  if (!q.length) return;
  q.forEach(t => { const g = S.goals.find(x => x.id === t.id); if (!g) return; g.log = g.log || {}; if (t.on) g.log[t.date] = 1; else delete g.log[t.date]; });
  save(); render();
}
(() => { const s0 = syncReminders; window.syncReminders = syncReminders = () => { s0(); pushWidget(); }; })();
window.__resumeHooks.push(() => { applyWidgetTicks(); pushWidget(); });
setTimeout(() => { applyWidgetTicks(); pushWidget(); }, 1200);
let wPushT = 0; AFTER_RENDER.push(() => { clearTimeout(wPushT); wPushT = setTimeout(pushWidget, 3000); });
