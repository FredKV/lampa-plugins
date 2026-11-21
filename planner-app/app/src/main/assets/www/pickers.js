'use strict';
/* =====================================================================
   Власні вікна вибору дати й часу (барабани) замість системних вікон Android.
   Кожне <input type="date|time"> стає прихованим полем + кнопкою; значення лишається у форматі
   YYYY-MM-DD / HH:MM, тож решта коду працює як раніше (події input/change теж надсилаються).
   ===================================================================== */
const MONTHS_UA = MONTHS_GEN; // «січня», «лютого»…
const WH = 44; // wheel row height, px

function pickLabel(kind, v) {
  if (!v) return kind === 'date' ? 'Оберіть дату' : 'Без часу';
  if (kind === 'time') return v;
  const d = parseYmd(v);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function enhancePickers(root = document) {
  $$('input[type="date"], input[type="time"]', root).forEach(inp => {
    if (inp.dataset.pk) return;
    const kind = inp.type; inp.dataset.pk = kind;
    if (inp.classList.contains('due-hidden')) { inp.type = 'hidden'; return; } // opened by its own calendar button
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'input pick-btn' + (inp.value ? '' : ' pk-empty');
    btn.dataset.a = 'openPicker'; btn.dataset.for = inp.id;
    btn.innerHTML = `<span>${esc(pickLabel(kind, inp.value))}</span>${kind === 'date' ? '📅' : '🕒'}`;
    inp.type = 'hidden'; inp.after(btn);
  });
}
function syncPickBtn(inp) {
  const btn = inp.parentNode && inp.parentNode.querySelector(`.pick-btn[data-for="${inp.id}"]`);
  if (!btn) return;
  btn.classList.toggle('pk-empty', !inp.value);
  btn.querySelector('span').textContent = pickLabel(inp.dataset.pk, inp.value);
}

/* ---------------- wheel ---------------- */
function wheelHtml(id, items, sel) {
  return `<div class="pk-wheel" id="${id}"><div class="pk-pad"></div>${items.map((t, i) => `<div class="pk-it ${i === sel ? 'on' : ''}" data-i="${i}">${t}</div>`).join('')}<div class="pk-pad"></div></div>`;
}
function wheelIndex(el) { return clamp(Math.round(el.scrollTop / WH), 0, el.querySelectorAll('.pk-it').length - 1); }
function wheelSet(el, i, smooth) { el.scrollTo({ top: i * WH, behavior: smooth ? 'smooth' : 'auto' }); markWheel(el, i); }
function markWheel(el, i) { el.querySelectorAll('.pk-it').forEach((x, k) => x.classList.toggle('on', k === i)); }
function bindWheel(el, onChange) {
  let t;
  el.addEventListener('scroll', () => { markWheel(el, wheelIndex(el)); clearTimeout(t); t = setTimeout(() => { const i = wheelIndex(el); if (Math.abs(el.scrollTop - i * WH) > 1) wheelSet(el, i, true); onChange(i); }, 90); }, { passive: true });
  el.addEventListener('click', e => { const it = e.target.closest('.pk-it'); if (it) { wheelSet(el, +it.dataset.i, true); onChange(+it.dataset.i); } });
}

/* ---------------- picker overlay ---------------- */
const Picker = {
  inp: null, kind: '', st: null,
  close() { const o = $('#pickerWrap'); if (!o) return false; o.classList.remove('open'); setTimeout(() => o.remove(), 220); this.inp = null; return true; },
  open(inp) {
    this.close(); $$('#pickerWrap').forEach(x => x.remove());
    this.inp = inp; this.kind = inp.dataset.pk || inp.type;
    const wrap = document.createElement('div'); wrap.id = 'pickerWrap'; wrap.className = 'picker-wrap';
    const now = new Date();
    if (this.kind === 'date') {
      const d = inp.value ? parseYmd(inp.value) : (inp.dataset.def ? parseYmd(inp.dataset.def) : now);
      const y0 = now.getFullYear() - 100, years = Array.from({ length: 111 }, (_, i) => String(y0 + i));
      this.st = { d: d.getDate(), m: d.getMonth(), y: d.getFullYear(), y0 };
      wrap.innerHTML = `<div class="picker-bg" data-a="pickCancel"></div><div class="picker">
        <div class="grab"></div><h2>Дата</h2><div class="pk-sub" id="pkSub"></div>
        <div class="pk-wheels">${wheelHtml('pkD', this.days(), this.st.d - 1)}${wheelHtml('pkM', MONTHS_UA, this.st.m)}${wheelHtml('pkY', years, this.st.y - y0)}</div>
        <div class="row" style="gap:8px;margin-bottom:12px"><button class="chip grow" data-a="pickQuick" data-v="today">Сьогодні</button><button class="chip grow" data-a="pickQuick" data-v="tomorrow">Завтра</button><button class="chip grow" data-a="pickQuick" data-v="clear">Без дати</button></div>
        <div class="btns two" style="margin:0"><button class="btn ghost" data-a="pickCancel">Скасувати</button><button class="btn" data-a="pickDone">Готово</button></div></div>`;
    } else {
      let [h, m] = (inp.value || `${pad(now.getHours())}:${pad(Math.ceil(now.getMinutes() / 5) * 5 % 60)}`).split(':').map(Number);
      m = Math.round(m / 5) * 5; if (m === 60) { m = 0; h = (h + 1) % 24; }
      this.st = { h, m };
      wrap.innerHTML = `<div class="picker-bg" data-a="pickCancel"></div><div class="picker">
        <div class="grab"></div><h2>Час</h2><div class="pk-sub" id="pkSub"></div>
        <div class="pk-wheels time">${wheelHtml('pkH', Array.from({ length: 24 }, (_, i) => pad(i)), h)}<div class="pk-colon">:</div>${wheelHtml('pkMi', Array.from({ length: 12 }, (_, i) => pad(i * 5)), m / 5)}</div>
        <div class="btns two" style="margin:0"><button class="btn ghost" data-a="pickCancel">Скасувати</button><button class="btn" data-a="pickDone">Готово</button></div></div>`;
    }
    document.body.appendChild(wrap);
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      if (this.kind === 'date') {
        wheelSet($('#pkD'), this.st.d - 1); wheelSet($('#pkM'), this.st.m); wheelSet($('#pkY'), this.st.y - this.st.y0);
        bindWheel($('#pkD'), i => { this.st.d = i + 1; this.sub(); });
        bindWheel($('#pkM'), i => { this.st.m = i; this.fixDays(); this.sub(); });
        bindWheel($('#pkY'), i => { this.st.y = this.st.y0 + i; this.fixDays(); this.sub(); });
      } else {
        wheelSet($('#pkH'), this.st.h); wheelSet($('#pkMi'), this.st.m / 5);
        bindWheel($('#pkH'), i => { this.st.h = i; this.sub(); });
        bindWheel($('#pkMi'), i => { this.st.m = i * 5; this.sub(); });
      }
      this.sub();
    });
  },
  days() { const n = new Date(this.st.y, this.st.m + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => String(i + 1)); },
  fixDays() {
    const n = new Date(this.st.y, this.st.m + 1, 0).getDate(), el = $('#pkD');
    if (el.querySelectorAll('.pk-it').length === n) return;
    this.st.d = Math.min(this.st.d, n);
    el.outerHTML = wheelHtml('pkD', this.days(), this.st.d - 1);
    const nw = $('#pkD'); wheelSet(nw, this.st.d - 1); bindWheel(nw, i => { this.st.d = i + 1; this.sub(); });
  },
  value() { return this.kind === 'date' ? `${this.st.y}-${pad(this.st.m + 1)}-${pad(this.st.d)}` : `${pad(this.st.h)}:${pad(this.st.m)}`; },
  sub() { const el = $('#pkSub'); if (el) el.textContent = this.kind === 'date' ? (() => { const d = parseYmd(this.value()), w = WD_FULL[d.getDay()]; return `${w[0].toUpperCase() + w.slice(1)}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; })() : `О ${this.value()}`; },
  set(v) {
    const inp = this.inp; if (!inp) return;
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    syncPickBtn(inp);
  }
};
Object.assign(A, {
  openPicker: d => { const inp = document.getElementById(d.for); if (inp) Picker.open(inp); },
  pickCancel: () => Picker.close(),
  pickDone: () => {
    const v = Picker.value(), inp = Picker.inp;
    if (inp && Picker.kind === 'date') {
      if (inp.max && v > inp.max) { toast('Дата не може бути пізніше ' + shortDate(inp.max)); return; }
      if (inp.min && v < inp.min) { toast('Дата не може бути раніше ' + shortDate(inp.min)); return; }
    }
    Picker.set(v); Picker.close();
  },
  pickQuick: d => {
    const t = today();
    if (d.v === 'clear') { Picker.set(''); Picker.close(); return; }
    if (d.v === 'today' || d.v === 'tomorrow') { const v = d.v === 'today' ? t : addDays(t, 1), dt = parseYmd(v); Picker.st = { ...Picker.st, d: dt.getDate(), m: dt.getMonth(), y: dt.getFullYear() };
      Picker.fixDays(); wheelSet($('#pkD'), Picker.st.d - 1, true); wheelSet($('#pkM'), Picker.st.m, true); wheelSet($('#pkY'), Picker.st.y - Picker.st.y0, true); Picker.sub(); }
    if (d.v === 'now') { const n = new Date(); Picker.st = { h: n.getHours(), m: Math.floor(n.getMinutes() / 5) * 5 }; wheelSet($('#pkH'), Picker.st.h, true); wheelSet($('#pkMi'), Picker.st.m / 5, true); Picker.sub(); }
  }
});
// keep the visible button in sync when code changes the hidden value (e.g. «Сьогодні/Завтра» chips)
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.pk) syncPickBtn(e.target); });
AFTER_RENDER.push(() => enhancePickers($('#view')));
