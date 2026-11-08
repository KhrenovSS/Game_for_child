// Поиск кратчайшего пути стрелками (BFS) с учётом звёзд, ключей и дверей.
import { key } from './level.js';

const MOVES = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];

// Возвращает массив команд ('up'|'down'|'left'|'right') или null, если решения нет.
export function solve(level, { maxStates = 200000 } = {}) {
  const starIdx = new Map(level.stars.map((s, i) => [key(s.x, s.y), i]));
  const keyIdx = new Map(level.keys.map((s, i) => [key(s.x, s.y), i]));
  const doorIdx = new Map(level.doors.map((s, i) => [key(s.x, s.y), i]));
  const allStars = (1 << level.stars.length) - 1;
  const enc = (s) => `${s.x},${s.y},${s.stars},${s.kt},${s.held},${s.doors}`;
  const start = { x: level.start.x, y: level.start.y, stars: 0, kt: 0, held: 0, doors: 0 };
  const prev = new Map([[enc(start), null]]);
  let queue = [start];
  while (queue.length) {
    const next = [];
    for (const s of queue) {
      if (s.x === level.goal.x && s.y === level.goal.y && s.stars === allStars) {
        const path = [];
        let e = enc(s);
        while (prev.get(e)) { const p = prev.get(e); path.push(p.move); e = p.from; }
        return path.reverse();
      }
      for (const [move, dx, dy] of MOVES) {
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
        if (keyIdx.has(k) && !(s.kt & (1 << keyIdx.get(k)))) { n.kt |= 1 << keyIdx.get(k); n.held += 1; }
        const e = enc(n);
        if (!prev.has(e)) {
          prev.set(e, { from: enc(s), move });
          next.push(n);
          if (prev.size > maxStates) return null;
        }
      }
    }
    queue = next;
  }
  return null;
}

export function countTurns(moves) {
  let t = 0;
  for (let i = 1; i < moves.length; i++) if (moves[i] !== moves[i - 1]) t++;
  return t;
}
