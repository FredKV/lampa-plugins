'use strict';
/* =====================================================================
   Автовиправлення слів (офлайн). Порівнює слова зі словником продуктів, страв і частих слів планера
   + словами з ваших рецептів і списків. Виправляє лише очевидні описки (1–2 літери) і дає «Повернути».
   ===================================================================== */
const SPELL_WORDS = `
майонез кетчуп гірчиця соус хрін олія олива оливкова соняшникова масло вершкове маргарин сало
молоко кефір ряжанка йогурт сметана вершки сир сирок бринза моцарела пармезан фета творог масло
яйця яйце борошно цукор сіль перець пудра крохмаль дріжджі розпушувач сода ваніль ванілін кориця какао шоколад
хліб батон багет лаваш булка булочка тісто листкове бісквіт печиво вафлі сухарі пластівці мюслі
гречка рис пшоно булгур кускус перловка вівсянка манка макарони спагеті локшина вермішель лазанья
квасоля горох сочевиця нут кукурудза горошок
картопля буряк морква цибуля часник капуста броколі цвітна кабачок баклажан гарбуз огірок огірки помідор помідори томат томати
перець болгарський редиска редис шпинат салат рукола кріп петрушка кінза базилік селера щавель зелень зелена цибулька
гриби печериці шампіньйони гливи лимон лайм апельсин мандарин мандарини грейпфрут банан банани яблуко яблука груша груші
виноград слива сливи персик персики абрикос абрикоси вишня черешня полуниця малина чорниця смородина ківі ананас манго гранат
диня кавун родзинки курага чорнослив горіхи волоські фундук мигдаль арахіс насіння кунжут мак мед варення джем згущене згущенка
мʼясо мясо свинина яловичина телятина курятина курка курячі куряче філе стегно стегна крильця гомілка індичка качка кролик фарш
ковбаса сосиски сардельки шинка бекон буженина паштет печінка серце шлунки
риба лосось сьомга форель скумбрія оселедець хек минтай тунець креветки кальмари мідії ікра крабові палички
вода сік компот чай кава квас пиво вино лимонад мінеральна
сосиски пельмені вареники сирники млинці налисники котлети голубці деруни борщ суп юшка солянка розсольник окрошка
плов рагу гуляш піца паста карбонара лазанья олівʼє вінегрет шуба цезар запіканка омлет яєчня каша пюре торт пиріг
кекс шарлотка тірамісу морозиво
лавровий лист паприка куркума імбир мускатний горіх гвоздика розмарин орегано чебрець тимʼян
папір туалетний серветки рушники губки мило шампунь гель зубна паста щітка порошок пральний засіб посуду пакети фольга плівка
батарейки лампочка
купити оплатити зателефонувати записатися забрати віднести відправити замовити прибрати помити приготувати подзвонити
зустріч зустрітися день народження лікар стоматолог перукар манікюр робота звіт нарада тренування спортзал йога басейн
школа садок університет екзамен квитки поїздка подорож відпустка ремонт сантехнік оренда квартира комуналка інтернет
кредит податки страховка аптека пошта посилка магазин ринок супермаркет подарунок подарунки свято вечеря обід сніданок
телефон ноутбук навушники годинник кросівки куртка пальто сукня джинси футболка сумка взуття
мама тато бабуся дідусь сестра брат подруга друг доньці сину дитині
`;
const Spell = {
  base: null, learned: null,
  words() {
    if (!this.base) {
      this.base = new Set();
      SPELL_WORDS.split(/\s+/).filter(w => w.length > 1).map(w => w.toLowerCase().replace(/[ʼ'’]/g, '')).forEach(w => this.forms(w).forEach(f => this.base.add(f)));
    }
    // words from the user's recipes and built-in recipes (spelled correctly by AI/curated)
    const learned = new Set();
    const add = t => String(t || '').toLowerCase().replace(/[ʼ'’]/g, '').split(/[^а-яіїєґ]+/).forEach(w => { if (w.length > 2) this.forms(w).forEach(f => learned.add(f)); });
    (window.BUILTIN_RECIPES || []).forEach(r => { add(r.dish); r.ingredients.forEach(i => add(i.name)); });
    (S.recipes || []).forEach(r => { add(r.dish); r.ingredients.forEach(i => add(i.name)); });
    return new Set([...this.base, ...learned]);
  },
  /** Common case forms, so «до стоматолога», «без цибулі», «з сиром» are recognised too. */
  forms(w) {
    const out = [w];
    if (/[бвгґджзклмнпрстфхцчшщ]$/.test(w)) ['а', 'у', 'ом', 'і', 'ів', 'и', 'ам', 'ами', 'ах'].forEach(e => out.push(w + e));
    else if (/а$/.test(w)) { const b = w.slice(0, -1); ['и', 'і', 'у', 'ою', 'ам', 'ами', 'ах'].forEach(e => out.push(b + e)); }
    else if (/я$/.test(w)) { const b = w.slice(0, -1); ['і', 'ю', 'ею', 'ям', 'ями', 'ях'].forEach(e => out.push(b + e)); }
    else if (/[оо]$/.test(w)) { const b = w.slice(0, -1); ['а', 'у', 'ом', 'і'].forEach(e => out.push(b + e)); }
    else if (/и$/.test(w)) { const b = w.slice(0, -1); ['ів', 'ам', 'ами', 'ах'].forEach(e => out.push(b + e)); }
    return out;
  },
  /** Damerau–Levenshtein distance with an early cut-off. */
  dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  },
  suggest(word, dict) {
    const w = word.toLowerCase().replace(/[ʼ'’]/g, '');
    if (w.length < 4 || dict.has(w)) return null;
    const max = w.length >= 8 ? 2 : 1;
    let best = null, bestD = max + 1, tie = false;
    for (const c of dict) {
      if (Math.abs(c.length - w.length) > max) continue;
      const dd = this.dist(w, c, max);
      if (dd < bestD) { best = c; bestD = dd; tie = false; } else if (dd === bestD && c !== best) tie = true;
    }
    return best && !tie ? best : null; // ambiguous → leave as typed
  },
  /** Returns {text, changes:[[from,to]]} */
  fix(text) {
    const dict = this.words(), changes = [];
    const out = String(text || '').replace(/[А-ЯІЇЄҐа-яіїєґʼ'’]+/g, word => {
      const s = this.suggest(word, dict); if (!s) return word;
      let r = s.replace(/мясо/, 'мʼясо');
      if (word[0] === word[0].toUpperCase()) r = r[0].toUpperCase() + r.slice(1);
      changes.push([word, r]); return r;
    });
    return { text: out, changes };
  }
};
// Fields that get corrected when the user leaves them (people's names are never touched)
const SPELL_FIELDS = ['sName', 'sfName', 'iName', 'tTitle', 'eTitle', 'wTitle', 'fvName', 'gTitle', 'dpDish', 'xNote', 'tNote', 'eNote'];
document.addEventListener('focusout', e => {
  const el = e.target; if (!el || !SPELL_FIELDS.includes(el.id) || !el.value.trim()) return;
  const r = Spell.fix(el.value); if (!r.changes.length) return;
  const before = el.value; el.value = r.text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  let hint = el.parentNode.querySelector('.spell-hint');
  if (!hint) { hint = document.createElement('div'); hint.className = 'spell-hint'; el.insertAdjacentElement('afterend', hint); }
  hint.innerHTML = `✏️ Виправлено: ${r.changes.map(([a, b]) => `${esc(a)} → <b>${esc(b)}</b>`).join(', ')} · <button class="link" data-a="spellUndo">Повернути</button>`;
  hint.__undo = () => { el.value = before; el.dispatchEvent(new Event('input', { bubbles: true })); hint.remove(); };
});
A.spellUndo = (d, btn) => { const h = btn.closest('.spell-hint'); if (h && h.__undo) h.__undo(); };
// let the system keyboard spell-check too
document.addEventListener('focusin', e => { const el = e.target; if (el && (el.tagName === 'INPUT' && el.type === 'text' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' && !el.type)) { el.spellcheck = true; el.setAttribute('autocorrect', 'on'); } });
