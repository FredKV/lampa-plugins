'use strict';
/* =====================================================================
   Погода — Open-Meteo (безкоштовно, без API-ключа). Кешування 30 хв.
   S.weather = {mode:'auto'|'city', place:{name,lat,lon,admin}, auto:{name,lat,lon}}
   ===================================================================== */
const WMO = {
  0: ['☀️', 'Ясно'], 1: ['🌤', 'Переважно ясно'], 2: ['⛅', 'Мінлива хмарність'], 3: ['☁️', 'Хмарно'],
  45: ['🌫', 'Туман'], 48: ['🌫', 'Туман з інеєм'], 51: ['🌦', 'Легка мряка'], 53: ['🌦', 'Мряка'], 55: ['🌧', 'Сильна мряка'],
  56: ['🌧', 'Крижана мряка'], 57: ['🌧', 'Крижана мряка'], 61: ['🌦', 'Невеликий дощ'], 63: ['🌧', 'Дощ'], 65: ['🌧', 'Сильний дощ'],
  66: ['🌧', 'Крижаний дощ'], 67: ['🌧', 'Крижаний дощ'], 71: ['🌨', 'Невеликий сніг'], 73: ['🌨', 'Сніг'], 75: ['❄️', 'Сильний сніг'],
  77: ['🌨', 'Снігові зерна'], 80: ['🌦', 'Короткочасний дощ'], 81: ['🌧', 'Зливи'], 82: ['⛈', 'Сильні зливи'],
  85: ['🌨', 'Снігопад'], 86: ['❄️', 'Сильний снігопад'], 95: ['⛈', 'Гроза'], 96: ['⛈', 'Гроза з градом'], 99: ['⛈', 'Гроза з градом']
};
const WMO_NIGHT = { 0: '🌙', 1: '🌙', 2: '☁️', 51: '🌧', 61: '🌧', 80: '🌧' };
/** icon + text; at night sun icons become moon / clouds */
const wmo = (c, day = true) => { const w = WMO[c] || ['🌡', '—']; return day || !WMO_NIGHT[c] ? w : [WMO_NIGHT[c], w[1]]; };
const pad2 = n => String(n).padStart(2, '0');
const localStamp = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** day/night for a local time stamp "YYYY-MM-DDTHH:MM" using the forecast's sunrise/sunset */
function isDayAt(d, stamp) {
  const dl = d.daily || {}, i = (dl.time || []).indexOf(stamp.slice(0, 10));
  if (i >= 0 && dl.sunrise && dl.sunset) return stamp >= dl.sunrise[i] && stamp < dl.sunset[i];
  const h = d.hourly || {}, k = (h.time || []).findIndex(t => t.slice(0, 13) === stamp.slice(0, 13));
  if (k >= 0 && h.is_day) return !!h.is_day[k];
  return d.current ? !!d.current.is_day : true;
}
const CACHE_KEY = 'tanichka.weather', TTL = 30 * 60 * 1000;

const Weather = {
  loading: false, err: '', cityResults: null, cityQ: '',
  place() { return S.weather.mode === 'city' ? S.weather.place : S.weather.auto || null; },
  cache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; } },
  keyOf(p) { return p ? `${(+p.lat).toFixed(2)},${(+p.lon).toFixed(2)}` : ''; },
  data() { const c = this.cache(), p = this.place(); return c && p && c.key === this.keyOf(p) ? c : null; },
  stale() { const c = this.data(); return !c || Date.now() - c.ts > TTL; },
  async load(force = false) {
    const p = this.place();
    if (!p || this.loading) return;
    if (!force && !this.stale()) return;
    this.loading = true; this.err = ''; render();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day'
      + '&hourly=temperature_2m,precipitation_probability,weather_code,is_day'
      + '&daily=weather_code,sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max'
      + '&timezone=auto&forecast_days=7&wind_speed_unit=ms';
    const r = await http('GET', url);
    this.loading = false;
    let data = null; try { data = JSON.parse(r.text); } catch (e) { }
    if (r.status === 200 && data && data.current) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key: this.keyOf(p), ts: Date.now(), data })); } catch (e) { }
    } else {
      this.err = r.status === 0 ? 'Немає підключення до інтернету' : `Сервіс погоди недоступний (${r.status || 'мережа'})`;
      if (data && data.reason) this.err += `: ${data.reason}`;
    }
    render();
  },
  locate() {
    return new Promise(res => {
      if (Bridge && Bridge.getLocation) { const id = uid(); pendingCb[id] = res; Bridge.getLocation(id); return; }
      if (!navigator.geolocation) return res({ err: 'Геолокація недоступна' });
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude, name: '' }),
        e => res({ err: e.code === 1 ? 'Доступ до геолокації не надано' : 'Не вдалося визначити місцезнаходження' }), { timeout: 15000, maximumAge: 600000 });
    });
  },
  async useAuto() {
    this.loading = true; this.err = ''; render();
    const r = await this.locate();
    this.loading = false;
    if (r.err || r.lat == null) { this.err = r.err || 'Не вдалося визначити місцезнаходження'; render(); return; }
    S.weather.mode = 'auto';
    S.weather.auto = { lat: round2(r.lat), lon: round2(r.lon), name: r.name || 'Моє місцезнаходження' };
    save(); await this.load(true);
  },
  async searchCity(q) {
    this.cityQ = q;
    if (q.trim().length < 2) { this.cityResults = null; render(); return; }
    this.cityResults = 'loading'; render();
    const r = await http('GET', `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=uk&format=json`);
    let d = null; try { d = JSON.parse(r.text); } catch (e) { }
    if (r.status !== 200 || !d) { this.cityResults = { err: r.status === 0 ? 'Немає підключення до інтернету' : 'Пошук міст недоступний' }; }
    else this.cityResults = (d.results || []).map(x => ({ name: x.name, lat: x.latitude, lon: x.longitude, admin: [x.admin1, x.country].filter(Boolean).join(', ') }));
    render();
  },
  current(d) {
    const c = d.current, h = d.hourly, now = localStamp();
    let idx = h.time.findIndex(t => t.slice(0, 13) === now.slice(0, 13));
    if (idx < 0) idx = Math.max(0, h.time.findIndex(t => t.slice(0, 13) === c.time.slice(0, 13)));
    return { ...c, idx, day: isDayAt(d, now), prob: h.precipitation_probability ? h.precipitation_probability[idx] : null };
  },
  mini() {
    const p = this.place();
    if (!p) return `<div class="card w-mini" data-a="go" data-page="weather"><div class="w-ic">🌤</div><div class="grow"><b>Погода</b><div class="small muted">Натисніть, щоб обрати місто</div></div><span class="muted">›</span></div>`;
    if (this.stale() && !this.loading && !this.err) setTimeout(() => this.load(), 0);
    const c = this.data();
    if (!c) return `<div class="card w-mini" data-a="go" data-page="weather"><div class="w-ic">${this.loading ? '⏳' : '⚠️'}</div><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${this.loading ? 'Завантаження…' : esc(this.err || 'Немає даних')}</div></div></div>`;
    const cur = this.current(c.data), dl = c.data.daily;
    return `<div class="card w-mini" data-a="go" data-page="weather"><div class="w-ic">${wmo(cur.weather_code, cur.day)[0]}</div>
      <div class="grow"><b style="font-size:22px">${Math.round(cur.temperature_2m)}°</b> <span class="muted small">${esc(wmo(cur.weather_code)[1])}</span>
      <div class="small muted">${esc(p.name)} · ${Math.round(dl.temperature_2m_min[0])}°…${Math.round(dl.temperature_2m_max[0])}°${cur.prob != null ? ` · 💧${cur.prob}%` : ''}</div></div><span class="muted">›</span></div>`;
  }
};
window.__resumeHooks.push(() => { if (Weather.place() && Weather.stale()) Weather.load(); });

function cityChooser() {
  const p = Weather.place();
  return `
    <div class="btns" style="margin-top:0"><button class="btn ${S.weather.mode === 'auto' && p ? '' : 'ghost'}" data-a="wAuto">📍 Визначити автоматично</button></div>
    <div class="row" style="margin-top:12px;gap:8px"><input class="input grow" id="wCity" placeholder="Або знайдіть місто: Київ, Львів…" value="${esc(Weather.cityQ)}" enterkeyhint="search">
      <button class="btn sm" style="padding:15px 16px" data-a="wSearch" aria-label="Шукати">${ICONS.search.replace('<svg', '<svg width="20" height="20"')}</button></div>
    ${Weather.cityResults === 'loading' ? '<div class="small muted" style="margin-top:10px">Пошук…</div>'
    : Weather.cityResults && Weather.cityResults.err ? `<div class="small red" style="margin-top:10px">${esc(Weather.cityResults.err)}</div>`
    : Array.isArray(Weather.cityResults) ? (Weather.cityResults.length ? `<div class="list flat" style="margin-top:10px">${Weather.cityResults.map((x, i) => `<div class="item" data-a="wPick" data-i="${i}"><div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">${esc(x.admin)}</div></div></div>`).join('')}</div>` : '<div class="small muted" style="margin-top:10px">Нічого не знайдено</div>') : ''}`;
}
function citySheetW() {
  const open = $('#sheetWrap').classList.contains('open') && $('#wCitySheet');
  if (open) { $('#wCitySheet').innerHTML = cityChooser(); return; }
  openSheet(`<h2>Місто</h2><div id="wCitySheet">${cityChooser()}</div>`, null, () => { Weather.cityResults = null; Weather.cityQ = ''; });
}

PAGES.weather = () => {
  const p = Weather.place(), c = Weather.data();
  if (!p) return { title: 'Погода', html: `${Weather.err ? `<div class="card"><b class="red">${esc(Weather.err)}</b></div>` : ''}${Weather.loading ? '<div class="card empty"><div class="spinner"></div>Визначаю місцезнаходження…</div>' : ''}<div class="card">${cityChooser()}</div>` };
  const actions = `<button class="icon-btn sm ${Weather.loading ? 'spin' : ''}" data-a="wRefresh" aria-label="Оновити" ${Weather.loading ? 'disabled' : ''}>${ICONS.refresh}</button>
    <button class="icon-btn sm" data-a="wCityOpen" aria-label="Змінити місто">${ICONS.pin}</button>`;
  let body = '';
  if (c) {
    const d = c.data, cur = Weather.current(d), dl = d.daily, h = d.hourly;
    const hours = [];
    for (let i = cur.idx; i < Math.min(h.time.length, cur.idx + 24); i++) hours.push(i);
    body = `
      <div class="mono weather-hero ${cur.day ? 'wh-day' : 'wh-night'}">
        <div class="wh-top"><div class="grow" style="min-width:0"><div class="lbl ellipsis">${esc(p.name)}</div>
          <div class="row" style="gap:10px;align-items:center"><div class="w-temp">${Math.round(cur.temperature_2m)}°</div>
            <div><div class="wh-desc">${esc(wmo(cur.weather_code)[1])}</div><div class="wh-feel">Відчувається як ${Math.round(cur.apparent_temperature)}° · ${Math.round(dl.temperature_2m_min[0])}°…${Math.round(dl.temperature_2m_max[0])}°</div></div></div></div>
          <div class="wh-ic">${wmo(cur.weather_code, cur.day)[0]}</div></div>
        <div class="row4">
          <div class="box"><div>Опади</div><div>${cur.precipitation} мм</div></div>
          <div class="box"><div>Дощ</div><div>${cur.prob != null ? cur.prob + '%' : '—'}</div></div>
          <div class="box"><div>Вітер</div><div>${Math.round(cur.wind_speed_10m)} м/с</div></div>
          <div class="box"><div>Вологість</div><div>${cur.relative_humidity_2m}%</div></div>
        </div>
      </div>
      <h2>Найближчі години</h2>
      <div class="card hours">${hours.map((i, k) => `<div class="hour"><div class="small muted">${k === 0 ? 'Зараз' : h.time[i].slice(11, 16)}</div>
        <div style="font-size:22px">${wmo(h.weather_code[i], h.is_day ? !!h.is_day[i] : isDayAt(d, h.time[i]))[0]}</div><b>${Math.round(h.temperature_2m[i])}°</b>
        <div class="small" style="color:var(--blue)">${h.precipitation_probability[i] ? '💧' + h.precipitation_probability[i] + '%' : '&nbsp;'}</div></div>`).join('')}</div>
      <h2>Прогноз на 7 днів</h2>
      <div class="list">${dl.time.map((t, i) => {
        const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max), span = hi - lo || 1;
        return `<div class="item"><div style="width:76px"><b>${i === 0 ? 'Сьогодні' : WD[(parseYmd(t).getDay() + 6) % 7]}</b><div class="small muted">${parseYmd(t).getDate()} ${MONTHS_SHORT[parseYmd(t).getMonth()]}</div></div>
          <div style="font-size:24px;width:34px;text-align:center">${wmo(dl.weather_code[i])[0]}</div>
          <div class="small" style="width:46px;color:var(--blue)">${dl.precipitation_probability_max[i] ? '💧' + dl.precipitation_probability_max[i] + '%' : ''}</div>
          <div class="grow row" style="gap:8px"><span class="small muted">${Math.round(dl.temperature_2m_min[i])}°</span>
            <div class="trange"><div style="left:${(dl.temperature_2m_min[i] - lo) / span * 100}%;right:${(hi - dl.temperature_2m_max[i]) / span * 100}%"></div></div>
            <b class="small">${Math.round(dl.temperature_2m_max[i])}°</b></div></div>`;
      }).join('')}</div>`;
  } else if (Weather.loading) body = '<div class="card empty"><div class="spinner"></div>Завантаження прогнозу…</div>';
  else body = `<div class="card"><b class="red">${esc(Weather.err || 'Немає даних')}</b><div class="btns"><button class="btn" data-a="wRefresh">Спробувати ще</button></div></div>`;
  return { title: 'Погода', actions, html: body };
};
Object.assign(A, {
  wAuto: () => { closeSheet(); Weather.useAuto(); },
  wRefresh: async () => { await Weather.load(true); if (Weather.err && Weather.data()) toast(`${Weather.err} — показано збережені дані`); else if (!Weather.err) toast('Прогноз оновлено'); },
  wCityOpen: () => citySheetW(),
  wPick: d => {
    const x = Weather.cityResults[+d.i];
    S.weather.mode = 'city'; S.weather.place = x; Weather.cityResults = null; Weather.cityQ = ''; Weather.err = '';
    save(); closeSheet(); window.scrollTo(0, 0); Weather.load(true);
  }
});
A.wSearch = () => { const el = $('#wCity'); if (el) { el.blur(); Weather.searchCity(el.value); } };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'wCity') { e.preventDefault(); A.wSearch(); } });
AFTER_RENDER.push(() => { const el = $('#wCitySheet'); if (el && $('#sheetWrap').classList.contains('open')) el.innerHTML = cityChooser(); });
