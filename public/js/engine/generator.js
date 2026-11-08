// Генератор уровней. Сложность D — число от 1 (очень легко) до 20 (очень трудно).
// Навыки: seq — шаги, plan — звёзды/ключи/двери, fix — почини программу, loop — «повтори».
import { parseLevel, key } from './level.js';
import { solve, countTurns } from './solver.js';
import { run, normalizeProgram, countCards } from './interpreter.js';
import { makeRng } from './rng.js';

export const D_MIN = 1;
export const D_MAX = 20;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ARROWS = ['up', 'down', 'left', 'right'];
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const TITLES = {
  seq: ['Тропинка', 'Полянка', 'Камушки', 'Ромашки', 'Ручеёк', 'Кочки', 'Одуванчики', 'Травинки'],
  plan: ['Чаща', 'Опушка', 'Грибная поляна', 'Старый дуб', 'Еловая тропа', 'Совиное дупло', 'Ягодник', 'Мшистый пень'],
  fix: ['Сломанный робот', 'Перепутанные карточки', 'Ошибка Путаника', 'Скрипучая дверь', 'Шестерёнка', 'Винтики', 'Ремонт', 'Гаечный ключ'],
  loop: ['Горный перевал', 'Каменная лестница', 'Снежный склон', 'Ущелье', 'Эхо', 'Ледяная тропа', 'Скала', 'Водопад'],
};
const SAY = {
  seq: ['Проведи меня к флажку!', 'Куда идти? Подскажи!', 'Новая тропинка!'],
  plan: ['Не забудь про звёзды!', 'Подумай сначала, куда идти.', 'Собери всё и иди к флажку!'],
  fix: ['Путаник испортил программу! Найди ошибку.', 'Тут что-то не так. Запусти и посмотри.', 'Почини программу!'],
  loop: ['Дорога длинная — ищи, что повторяется!', 'Карточек мало. Используй «повтори»!', 'Что тут повторяется?'],
};
const HINT = {
  seq: 'Посчитай клеточки до флажка. Попробуй по шагам: нажми ⏭.',
  plan: 'Проведи пальцем путь по всем звёздам, а потом набери команды.',
  fix: 'Запусти программу и посмотри, где герой ошибается. Красная карточка — подсказка.',
  loop: 'Найди кусочек дороги, который повторяется, и положи его в «повтори».',
};

function toGrid(w, h, cells) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += cells.get(key(x, y)) || '.';
    rows.push(r);
  }
  return rows;
}

function bfsDist(w, h, blocked, from) {
  const dist = new Map([[key(from.x, from.y), 0]]);
  let q = [from];
  while (q.length) {
    const nq = [];
    for (const p of q) {
      for (const [dx, dy] of Object.values(DELTA)) {
        const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || blocked.has(k) || dist.has(k)) continue;
        dist.set(k, dist.get(key(p.x, p.y)) + 1);
        nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return dist;
}

const parseKey = (k) => { const [x, y] = k.split(',').map(Number); return { x, y }; };

// --- Стрелочные уровни (seq / plan) -----------------------------------------

export function arrowParams(skill, D) {
  const d = clamp(D, D_MIN, D_MAX);
  const plan = skill === 'plan';
  return {
    w: Math.min(8, 4 + Math.floor(d / 3.5)),
    h: Math.min(6, 3 + Math.floor(d / 5)),
    density: Math.min(0.36, 0.08 + d * 0.015),
    stars: plan ? (d < 4 ? 1 : d < 9 ? 2 : 3) : 0,
    door: plan && d >= 6,
    target: 2 + d * 1.1,
  };
}

export function arrowScore(moves, level) {
  return moves.length + 0.8 * countTurns(moves) + 1.2 * level.stars.length + 2 * level.doors.length;
}

function tryArrowCandidate(rng, p) {
  const { w, h } = p;
  const cells = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rng() < p.density) cells.set(key(x, y), '#');
  const floor = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!cells.has(key(x, y))) floor.push({ x, y });
  if (floor.length < 4) return null;
  const start = rng.pick(floor);
  const walls = new Set([...cells.keys()]);
  const dist = bfsDist(w, h, walls, start);
  const reach = [...dist.entries()].filter(([, d]) => d > 0);
  if (reach.length < 3) return null;

  const itemCost = 1.2 * p.stars + (p.door ? 2 : 0);
  const tm = Math.max(2, (p.target - itemCost) * 0.75);
  reach.sort((a, b) => (Math.abs(a[1] - tm) + rng() * 1.5) - (Math.abs(b[1] - tm) + rng() * 1.5));
  const goal = parseKey(reach[0][0]);
  cells.set(key(start.x, start.y), 'S');
  cells.set(key(goal.x, goal.y), 'G');

  if (p.door) {
    // Дверь ставим в «узкое место»: без неё до флажка не дойти.
    const candidates = rng.shuffle(reach.map(([k]) => k).filter((k) => !cells.has(k)));
    let placed = false;
    for (const dk of candidates.slice(0, 25)) {
      const blocked = new Set([...walls, dk]);
      const d2 = bfsDist(w, h, blocked, start);
      if (d2.has(key(goal.x, goal.y))) continue;
      const keySpots = [...d2.keys()].filter((k) => !cells.has(k) && k !== dk && d2.get(k) > 0);
      if (!keySpots.length) continue;
      cells.set(dk, 'D');
      cells.set(rng.pick(keySpots), 'k');
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  const free = rng.shuffle(reach.map(([k]) => k).filter((k) => !cells.has(k)));
  for (let i = 0; i < p.stars && i < free.length; i++) cells.set(free[i], '*');

  const grid = toGrid(w, h, cells);
  const level = parseLevel({ id: 'tmp', grid });
  const moves = solve(level);
  if (!moves || moves.length < 2) return null;
  return { grid, moves, score: arrowScore(moves, level) };
}

function generateArrowCore(skill, D, rng, tries = 220) {
  const p = arrowParams(skill, D);
  let best = null;
  for (let i = 0; i < tries; i++) {
    const c = tryArrowCandidate(rng, p);
    if (!c) continue;
    c.diff = Math.abs(c.score - p.target);
    if (!best || c.diff < best.diff) best = c;
    if (best.diff < 0.6) break;
  }
  return best;
}

function generateArrow(skill, D, rng) {
  const core = generateArrowCore(skill, D, rng);
  if (!core) return null;
  const par = core.moves.length;
  const slack = Math.max(2, 6 - Math.floor(D / 4));
  return {
    grid: core.grid,
    commands: [...ARROWS],
    maxCommands: par + slack,
    par,
    solution: core.moves,
  };
}

// --- «Почини программу» (fix) -------------------------------------------------

function corrupt(sol, rng, ops) {
  const p = [...sol];
  const op = rng.pick(ops);
  const i = rng.int(0, p.length - 1);
  switch (op) {
    case 'extra': p.splice(rng.int(0, p.length), 0, rng.pick(ARROWS)); break;
    case 'replace': p[i] = rng.pick(ARROWS.filter((a) => a !== p[i])); break;
    case 'missing': if (p.length > 2) p.splice(i, 1); break;
    case 'swap': {
      const j = p.findIndex((c, idx) => idx < p.length - 1 && c !== p[idx + 1] && idx >= i);
      const at = j >= 0 ? j : p.findIndex((c, idx) => idx < p.length - 1 && c !== p[idx + 1]);
      if (at >= 0) [p[at], p[at + 1]] = [p[at + 1], p[at]];
      break;
    }
    case 'reverse': p[i] = OPPOSITE[p[i]]; break;
    default: break;
  }
  return p;
}

function generateFix(D, rng) {
  const baseSkill = D >= 12 ? 'plan' : 'seq';
  const baseD = clamp(Math.round(2 + D * 0.6), 1, 14);
  for (let attempt = 0; attempt < 12; attempt++) {
    const core = generateArrowCore(baseSkill, baseD, rng, 120);
    if (!core || core.moves.length < 3) continue;
    const level = parseLevel({ id: 'tmp', grid: core.grid });
    const ops = D < 4 ? ['extra', 'replace', 'reverse'] : ['extra', 'replace', 'reverse', 'missing', 'swap'];
    const k = D < 8 ? 1 : 2;
    let preset = core.moves;
    for (let i = 0; i < k; i++) preset = corrupt(preset, rng, ops);
    if (preset.join() === core.moves.join()) continue;
    if (run(level, normalizeProgram(preset)).outcome === 'success') continue;
    return {
      grid: core.grid,
      commands: [...ARROWS],
      maxCommands: Math.max(core.moves.length, preset.length),
      par: core.moves.length,
      preset,
      solution: core.moves,
      errors: k,
    };
  }
  return null;
}

// --- «Повтори» (loop) ----------------------------------------------------------

const perp = (dir) => (dir === 'up' || dir === 'down' ? ['left', 'right'] : ['up', 'down']);

function loopTemplate(D, rng) {
  const A = rng.pick(ARROWS);
  const B = rng.pick(perp(A));
  const C = rng.pick(perp(B).filter((x) => x !== OPPOSITE[A]).concat(A));
  const d = clamp(Math.round(D), D_MIN, D_MAX);
  if (d <= 2) return [{ repeat: rng.int(4, 5 + d), body: [A] }];
  if (d <= 5) return [{ repeat: rng.int(3, 6), body: [A] }, { repeat: rng.int(2, 5), body: [B] }];
  if (d <= 8) return [{ repeat: rng.int(3, 4), body: [A, B] }];
  if (d <= 10) return [{ repeat: rng.int(3, 4), body: [A, B] }, { repeat: rng.int(2, 4), body: [A] }];
  if (d <= 12) return [{ repeat: 3, body: rng() < 0.5 ? [A, A, B] : [A, B, B] }];
  if (d <= 15) return [{ repeat: rng.int(2, 4), body: [A] }, { repeat: 3, body: [B, C] }, { repeat: rng.int(2, 3), body: [B] }];
  if (d <= 17) return [{ repeat: 3, body: [A, A, B] }, { repeat: rng.int(2, 3), body: [A] }];
  return [{ repeat: 2, body: [A, A, B, B] }, { repeat: rng.int(2, 3), body: [A, C] }];
}

function expand(prog) {
  return prog.flatMap((n) => (typeof n === 'string' ? [n] : Array.from({ length: n.repeat }, () => expand(n.body)).flat()));
}

function generateLoop(D, rng) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = loopTemplate(D, rng);
    const moves = expand(solution);
    // Прокладываем путь от (0,0)
    let x = 0, y = 0;
    const path = [{ x, y }];
    const seen = new Set([key(0, 0)]);
    let ok = true;
    for (const m of moves) {
      x += DELTA[m][0]; y += DELTA[m][1];
      if (seen.has(key(x, y))) { ok = false; break; }
      seen.add(key(x, y)); path.push({ x, y });
    }
    if (!ok) continue;
    const xs = path.map((p) => p.x), ys = path.map((p) => p.y);
    const m = rng() < 0.5 ? 1 : 0;
    const minX = Math.min(...xs) - m, minY = Math.min(...ys) - m;
    const w = Math.max(...xs) - minX + 1 + m, h = Math.max(...ys) - minY + 1 + m;
    if (w > 10 || h > 7) continue;
    const cells = new Map();
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) cells.set(key(xx, yy), '#');
    path.forEach((p) => cells.set(key(p.x - minX, p.y - minY), '.'));
    const open = D < 5 ? 0.15 : 0.3;
    for (const [k, v] of cells) if (v === '#' && rng() < open) cells.set(k, '.');
    const s = path[0], g = path[path.length - 1];
    cells.set(key(s.x - minX, s.y - minY), 'S');
    cells.set(key(g.x - minX, g.y - minY), 'G');
    if (D >= 12) {
      const mids = rng.shuffle(path.slice(2, -2));
      mids.slice(0, D >= 16 ? 2 : 1).forEach((p) => cells.set(key(p.x - minX, p.y - minY), '*'));
    }
    const grid = toGrid(w, h, cells);
    const level = parseLevel({ id: 'tmp', grid });
    const prog = normalizeProgram(solution);
    if (run(level, prog).outcome !== 'success') continue;
    const par = countCards(prog);
    const maxCommands = par + (D < 5 ? 1 : 0);
    const arrows = solve(level);
    if (!arrows || arrows.length <= maxCommands) continue; // без «повтори» не пройти
    return { grid, commands: [...ARROWS, 'repeat'], maxCommands, par, solution };
  }
  return null;
}

// --- Публичный API ---------------------------------------------------------------

export function generateLevel(skill, D, seed) {
  const rng = makeRng(seed);
  const d = clamp(D, D_MIN, D_MAX);
  let core = null;
  if (skill === 'fix') core = generateFix(d, rng);
  else if (skill === 'loop') core = generateLoop(d, rng);
  else core = generateArrow(skill, d, rng);
  if (!core) {
    // Запасной вариант: чуть проще.
    if (d > D_MIN) return generateLevel(skill, d - 1, seed + 1);
    throw new Error(`Не удалось сгенерировать уровень ${skill}`);
  }
  return {
    id: `g-${skill}-${seed}`,
    title: rng.pick(TITLES[skill] || TITLES.seq),
    say: rng.pick(SAY[skill] || SAY.seq),
    hint: HINT[skill] || HINT.seq,
    generated: true,
    skill,
    difficulty: Math.round(d * 10) / 10,
    seed,
    ...core,
  };
}
