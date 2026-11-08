// Проверка уровней: решаемость (BFS), корректность par, preset и solution.
import { parseLevel, key } from '../public/js/engine/level.js';
import { run, normalizeProgram, countCards, flatten } from '../public/js/engine/interpreter.js';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// Минимальное число шагов стрелками (с учётом звёзд, ключей и дверей).
export function shortestMoves(level) {
  const starIdx = new Map(level.stars.map((s, i) => [key(s.x, s.y), i]));
  const keyIdx = new Map(level.keys.map((s, i) => [key(s.x, s.y), i]));
  const doorIdx = new Map(level.doors.map((s, i) => [key(s.x, s.y), i]));
  const allStars = (1 << level.stars.length) - 1;
  const start = { x: level.start.x, y: level.start.y, stars: 0, keysTaken: 0, held: 0, doors: 0 };
  const enc = (s) => `${s.x},${s.y},${s.stars},${s.keysTaken},${s.held},${s.doors}`;
  const seen = new Set([enc(start)]);
  let frontier = [start];
  let dist = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (s.x === level.goal.x && s.y === level.goal.y && s.stars === allStars) return dist;
      for (const [dx, dy] of DIRS) {
        const nx = s.x + dx, ny = s.y + dy;
        if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
        const k = key(nx, ny);
        if (level.walls.has(k)) continue;
        const n = { ...s, x: nx, y: ny };
        if (doorIdx.has(k) && !(s.doors & (1 << doorIdx.get(k)))) {
          if (s.held === 0) continue;
          n.held -= 1; n.doors |= 1 << doorIdx.get(k);
        }
        if (starIdx.has(k)) n.stars |= 1 << starIdx.get(k);
        if (keyIdx.has(k) && !(s.keysTaken & (1 << keyIdx.get(k)))) { n.keysTaken |= 1 << keyIdx.get(k); n.held += 1; }
        const e = enc(n);
        if (!seen.has(e)) { seen.add(e); next.push(n); }
      }
    }
    frontier = next;
    dist += 1;
  }
  return Infinity;
}

export function checkLevel(json) {
  const problems = [];
  let level;
  try { level = parseLevel(json); } catch (e) { return [e.message]; }
  const id = level.id;
  const min = shortestMoves(level);
  if (!Number.isFinite(min)) problems.push(`${id}: уровень нерешаем`);

  if (!level.solution) problems.push(`${id}: нет solution`);
  else {
    const sol = normalizeProgram(level.solution);
    const r = run(level, sol);
    if (r.outcome !== 'success') problems.push(`${id}: solution не проходит (${r.outcome}${r.reason ? '/' + r.reason : ''})`);
    const cards = countCards(sol);
    if (level.par != null && cards !== level.par) problems.push(`${id}: par=${level.par}, а solution занимает ${cards} карточек`);
    if (level.maxCommands != null && cards > level.maxCommands) problems.push(`${id}: solution (${cards}) больше maxCommands (${level.maxCommands})`);
    for (const st of flatten(sol)) {
      if (st.cmd !== 'noop' && !level.commands.includes(st.cmd) && !(st.path.length > 1 && level.commands.includes('repeat'))) {
        problems.push(`${id}: solution использует команду ${st.cmd}, которой нет в палитре`);
        break;
      }
    }
    if (sol.some((n) => n.type === 'repeat') && !level.commands.includes('repeat')) problems.push(`${id}: solution использует repeat без карточки repeat`);
  }

  const arrowsOnly = !level.commands.includes('repeat') && !level.commands.includes('forward');
  if (arrowsOnly && level.par != null && Number.isFinite(min) && level.par !== min) {
    problems.push(`${id}: par=${level.par}, но кратчайший путь = ${min}`);
  }
  if (level.commands.includes('repeat') && level.maxCommands != null && Number.isFinite(min) && min <= level.maxCommands) {
    problems.push(`${id}: предупреждение — можно пройти стрелками за ${min} ≤ maxCommands=${level.maxCommands}, repeat не обязателен`);
  }
  if (level.preset) {
    const r = run(level, normalizeProgram(level.preset));
    if (r.outcome === 'success') problems.push(`${id}: preset уже проходит уровень — чинить нечего`);
  }
  if (level.maxCommands != null && Number.isFinite(min) && arrowsOnly && min > level.maxCommands) {
    problems.push(`${id}: maxCommands=${level.maxCommands} меньше кратчайшего пути ${min}`);
  }
  return problems;
}
