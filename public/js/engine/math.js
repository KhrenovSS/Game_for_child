// Математические задания в пределах 0–10: сложение и вычитание (+ «поровну» как бонус).
import { MATH_MIN, MATH_MAX } from './adaptive.js';

export function plural(n, [one, few, many]) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

const THINGS = [
  { e: '🍎', f: ['яблоко', 'яблока', 'яблок'] },
  { e: '🍐', f: ['груша', 'груши', 'груш'] },
  { e: '🍬', f: ['конфета', 'конфеты', 'конфет'] },
  { e: '🎈', f: ['шарик', 'шарика', 'шариков'] },
  { e: '🍄', f: ['гриб', 'гриба', 'грибов'] },
  { e: '🥕', f: ['морковка', 'морковки', 'морковок'] },
  { e: '⭐', f: ['звезда', 'звезды', 'звёзд'] },
];
const FLYERS = [
  { e: '🐦', f: ['птичка', 'птички', 'птичек'], go: 'улетели', sit: 'На ветке сидят' },
  { e: '🦋', f: ['бабочка', 'бабочки', 'бабочек'], go: 'улетели', sit: 'На цветке сидят' },
  { e: '🐸', f: ['лягушка', 'лягушки', 'лягушек'], go: 'ускакали', sit: 'На кочке сидят' },
  { e: '🐟', f: ['рыбка', 'рыбки', 'рыбок'], go: 'уплыли', sit: 'В пруду плавают' },
];
const n2 = (n, t) => `${n} ${plural(n, t.f)}`;

// Типы заданий и минимальный уровень, с которого они появляются.
export const MATH_TYPES = {
  count:   { min: 1, title: 'Сколько?' },
  basket:  { min: 1, title: 'Корзинка' },
  flyaway: { min: 2, title: 'Улетели' },
  expr:    { min: 2, title: 'Пример' },
  hero:    { min: 2, title: 'Звёзды героя' },
  house:   { min: 3, title: 'Домик числа' },
  missing: { min: 3, title: 'Пропущенное число' },
  row:     { min: 3, title: 'Числовой ряд' },
  share:   { min: 4, title: 'Поровну' },
  compare: { min: 4, title: 'На сколько больше' },
  twostep: { min: 5, title: 'Два действия' },
};

function maxSum(level) { return level < 2 ? 5 : 10; }

const makers = {
  count(rng, L) {
    const t = rng.pick(THINGS); const n = rng.int(3, L < 2 ? 7 : 10);
    return { text: `Сколько тут ${t.f[2]}?`, pics: [{ e: t.e, n }], answer: n, showPics: true };
  },
  basket(rng, L) {
    const t = rng.pick(THINGS); const s = rng.int(2, maxSum(L)); const a = rng.int(1, s - 1); const b = s - a;
    return { text: `В корзинке ${n2(a, t)}. Положили ещё ${b}. Сколько стало?`, expr: `${a} + ${b}`, pics: [{ e: t.e, n: a }, { op: '+' }, { e: t.e, n: b }], answer: s, showPics: true };
  },
  flyaway(rng) {
    const t = rng.pick(FLYERS); const a = rng.int(3, 10); const b = rng.int(1, a - 1);
    return { text: `${t.sit} ${n2(a, t)}. ${b} ${t.go}. Сколько осталось?`, expr: `${a} − ${b}`, pics: [{ e: t.e, n: a, gone: b }], answer: a - b, showPics: true };
  },
  expr(rng, L) {
    if (rng() < 0.5) { const s = rng.int(2, maxSum(L)); const a = rng.int(0, s); return { text: 'Сколько будет?', expr: `${a} + ${s - a}`, answer: s, hintPics: [{ e: '🔵', n: a }, { op: '+' }, { e: '🔵', n: s - a }] }; }
    const a = rng.int(2, 10); const b = rng.int(0, a);
    return { text: 'Сколько будет?', expr: `${a} − ${b}`, answer: a - b, hintPics: [{ e: '🔵', n: a, gone: b }] };
  },
  hero(rng, L, ctx) {
    const a = rng.int(3, 10); const b = rng.int(1, a - 1);
    if (rng() < 0.5) return { text: `У ${ctx.heroGen} было ${n2(a, THINGS[6])}. Путаник украл ${b}. Сколько звёзд осталось?`, expr: `${a} − ${b}`, pics: [{ e: '⭐', n: a, gone: b }], answer: a - b };
    const s = rng.int(3, 10); const x = rng.int(1, s - 1);
    return { text: `${ctx.heroShort} ${ctx.found} ${n2(x, THINGS[6])}, а потом ещё ${s - x}. Сколько всего?`, expr: `${x} + ${s - x}`, pics: [{ e: '⭐', n: x }, { op: '+' }, { e: '⭐', n: s - x }], answer: s };
  },
  house(rng) {
    const n = rng.int(3, 10); const a = rng.int(0, n);
    return { text: `Домик числа ${n}. На этаже живут ${a} и ?`, expr: `${n} = ${a} + ?`, answer: n - a, hintPics: [{ e: '🔵', n: a }, { op: '+' }, { e: '⚪', n: n - a }], house: { n, a } };
  },
  missing(rng) {
    const c = rng.int(2, 10); const a = rng.int(0, c);
    if (rng() < 0.5) return { text: 'Какое число спряталось?', expr: `${a} + ? = ${c}`, answer: c - a, hintPics: [{ e: '🔵', n: a }, { op: '+' }, { e: '⚪', n: c - a }] };
    const b = rng.int(0, 10 - c); // ? − b = c → ? = b + c
    return { text: 'Какое число спряталось?', expr: `? − ${b} = ${c}`, answer: b + c, hintPics: [{ e: '🔵', n: b + c, gone: b }] };
  },
  row(rng) {
    const up = rng() < 0.6; const len = 5; const start = up ? rng.int(0, 10 - len + 1) : rng.int(len - 1, 10);
    const seq = Array.from({ length: len }, (_, i) => (up ? start + i : start - i));
    const hole = rng.int(1, len - 2);
    const shown = seq.map((v, i) => (i === hole ? '?' : v)).join(', ');
    return { text: 'Какое число пропущено?', expr: shown, answer: seq[hole] };
  },
  share(rng) {
    const friends = rng() < 0.7 ? 2 : 3;
    const each = friends === 2 ? rng.int(1, 5) : rng.int(1, 3);
    const n = each * friends; const t = rng.pick(THINGS.slice(0, 6));
    const who = friends === 2 ? 'двум друзьям' : 'трём друзьям';
    return { text: `Раздели ${n2(n, t)} поровну ${who}. Сколько получит каждый?`, pics: [{ e: t.e, n }], friends: { n: friends }, answer: each, showPics: true };
  },
  compare(rng, L, ctx) {
    const a = rng.int(3, 10); const b = rng.int(1, a - 1); const t = rng.pick(THINGS.slice(0, 6));
    return { text: `У Саши ${n2(a, t)}, а у ${ctx.heroGen} — ${b}. На сколько у Саши больше?`, pics: [{ e: t.e, n: a, label: 'Саша' }, { br: true }, { e: t.e, n: b, label: ctx.heroShort }], answer: a - b, showPics: true };
  },
  twostep(rng) {
    const a = rng.int(1, 8); const b = rng.int(1, 10 - a); const c = rng.int(1, a + b);
    return { text: 'Сосчитай по порядку.', expr: `${a} + ${b} − ${c}`, answer: a + b - c, hintPics: [{ e: '🔵', n: a }, { op: '+' }, { e: '🔵', n: b }, { op: '−' }, { e: '🔵', n: c, neg: true }] };
  },
};

export function availableTypes(level, enabled) {
  return Object.entries(MATH_TYPES)
    .filter(([id, t]) => t.min <= Math.floor(level) && (!enabled || enabled.includes(id)))
    .map(([id]) => id);
}

// ctx: { heroShort: 'Бип', heroGen: 'Бипа', found: 'нашёл' }
export function makeMathTask(level, rng, ctx, enabled) {
  const L = Math.max(MATH_MIN, Math.min(MATH_MAX, level));
  let types = availableTypes(L, enabled);
  if (!types.length) types = ['basket', 'expr'];
  // Новые для уровня типы выпадают чаще.
  const weighted = types.flatMap((t) => (MATH_TYPES[t].min === Math.floor(L) ? [t, t] : [t]));
  const type = rng.pick(weighted);
  const task = makers[type](rng, L, ctx);
  return { type, ...task };
}
