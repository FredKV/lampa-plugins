'use strict';
/* =====================================================================
   Відчуття: вібрація, переходи між сторінками, свайпи в списках, анімовані числа.
   ===================================================================== */

/* ---------- haptics (no confetti — just a pleasant buzz) ---------- */
function haptic(kind = 'tick') {
  try { if (Bridge && Bridge.vibrate) { Bridge.vibrate(kind); return; } } catch (e) { }
  try { navigator.vibrate && navigator.vibrate(kind === 'success' ? [18, 70, 28] : kind === 'heavy' ? 40 : 12); } catch (e) { }
}
const HAPTIC_ACTIONS = new Set(['taskToggle', 'shopToggle', 'shopToggleMany', 'goalCheck', 'toggle', 'seg', 'useg', 'calView', 'shopMode',
  'planFilter', 'finType', 'pinKey', 'repToggle', 'favStar', 'scanAdd', 'shopPick', 'tab', 'notifToggle', 'pinToggle', 'bioToggle', 'goalTone']);
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && HAPTIC_ACTIONS.has(el.dataset.a)) haptic('tick'); }, true);
// celebrate with a stronger pattern when the app says something great
(() => {
  const orig = window.toast;
  window.toast = toast = msg => { if (/🎉|Досягнення|👑|🏆|повністю повернуто|Борг закрито|Ціль .* виконано/.test(String(msg))) haptic('success'); orig(msg); };
})();

/* ---------- page transitions: forward slides in from the right, back from the left ---------- */
U.navDir = '';
(() => {
  const nav = navigate, bk = back, g = go;
  window.navigate = navigate = (page, p) => { U.navDir = 'fwd'; nav(page, p); };
  window.back = back = () => { U.navDir = U.stack.length ? 'back' : ''; return bk(); };
  window.go = go = tab => { U.navDir = tab !== U.tab ? 'tab' : ''; g(tab); };
})();
AFTER_RENDER.push(() => {
  const v = $('#view'); if (!U.navDir) return;
  const cls = { fwd: 'pg-fwd', back: 'pg-back', tab: 'pg-tab' }[U.navDir]; U.navDir = '';
  v.classList.remove('pg-fwd', 'pg-back', 'pg-tab'); void v.offsetWidth; v.classList.add(cls);
});

/* ---------- animated numbers: totals roll to their new value ---------- */
const NumMem = new Map();
const NUM_SEL = ['.fin-tiles .ft b', '.sum-tiles b', '.goal-big', '.goal-num', '.goal-hero .goal-big'];
function parseShown(t) { const m = String(t).replace(/\s/g, '').replace(/−/g, '-').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; }
AFTER_RENDER.push(() => {
  const top = U.stack[U.stack.length - 1], scope = top ? top.page + JSON.stringify(top.p || {}) : 'tab:' + U.tab;
  NUM_SEL.forEach(sel => $$(sel, $('#view')).forEach((el, i) => {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)); if (!node) return;
    const key = scope + sel + i, to = parseShown(node.textContent); if (to == null) return;
    const from = NumMem.get(key); NumMem.set(key, to);
    if (from == null || from === to) return;
    const tpl = node.textContent, isMoney = /₴/.test(tpl), dec = !isMoney && /[.,]\d/.test(tpl);
    const fmt = v => isMoney
      ? tpl.replace(/[−-]?[\d\s  ]+(?:[.,]\d+)?(?=\s?₴)/, money(v).replace(/\s?₴$/, ''))
      : tpl.replace(/-?\d+(?:[.,]\d+)?/, dec ? v.toFixed(1) : String(Math.round(v)));
    const t0 = performance.now(), D = 520;
    const step = now => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      node.textContent = k < 1 ? fmt(from + (to - from) * e) : tpl;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
});

/* ---------- swipes in lists: → done / bought, ← delete (with undo) ---------- */
let undoSnap = null, undoT = 0;
function showUndo(text) {
  let bar = $('#undoBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'undoBar'; bar.className = 'undo-bar'; document.body.appendChild(bar); }
  bar.innerHTML = `<span>${esc(text)}</span><button data-a="undoSwipe">Повернути</button>`;
  bar.classList.add('show'); clearTimeout(undoT); undoT = setTimeout(() => { bar.classList.remove('show'); undoSnap = null; }, 4500);
}
A.undoSwipe = () => {
  if (!undoSnap) return; S = JSON.parse(undoSnap); undoSnap = null; save(); render();
  const bar = $('#undoBar'); if (bar) bar.classList.remove('show'); haptic('tick');
};
(() => {
  let it = null, sx = 0, sy = 0, dx = 0, mode = '';
  document.addEventListener('touchstart', e => {
    const el = e.target.closest('.item[data-swr], .item[data-swl]');
    if (!el || el.closest('#hpager') || e.target.closest('button.check, .go-link, .del-btn, input')) { it = null; return; }
    it = el; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = '';
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!it) return;
    const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (!mode) { if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.4) mode = 'h'; else if (Math.abs(y) > 10) { it = null; return; } else return; }
    if ((x > 0 && !it.dataset.swr) || (x < 0 && !it.dataset.swl)) { dx = 0; } else dx = x;
    it.style.transition = 'none'; it.style.transform = `translateX(${dx}px)`;
    it.classList.toggle('sw-r', dx > 0); it.classList.toggle('sw-l', dx < 0);
    it.classList.toggle('sw-go', Math.abs(dx) > 90);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!it) return; const el = it; it = null;
    el.style.transition = 'transform .22s ease';
    if (mode === 'h' && Math.abs(dx) > 90) {
      const act = dx > 0 ? el.dataset.swr : el.dataset.swl, id = el.dataset.id;
      el.style.transform = `translateX(${dx > 0 ? '110%' : '-110%'})`;
      haptic(dx > 0 ? 'tick' : 'heavy');
      setTimeout(() => {
        if (dx < 0) { undoSnap = JSON.stringify(S); }
        try { A[act]({ id }); } catch (err) { console.error(err); }
        if (dx < 0) showUndo('Видалено');
      }, 180);
    } else { el.style.transform = ''; el.classList.remove('sw-r', 'sw-l', 'sw-go'); }
  });
})();
