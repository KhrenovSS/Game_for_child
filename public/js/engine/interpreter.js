// Интерпретатор программ: дерево карточек → плоские шаги → симуляция.
// Чистые функции без DOM, чтобы их можно было тестировать в node.

import { isWall, key } from './level.js';

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const TURN_LEFT = { up: 'left', left: 'down', down: 'right', right: 'up' };
const TURN_RIGHT = { up: 'right', right: 'down', down: 'left', left: 'up' };

// --- Нормализация программы ---------------------------------------------
// В JSON программа записывается компактно: "up" или {"repeat":3,"body":[...]}.
// Внутри игры работаем с узлами {type, ...}.

export function normalizeProgram(json) {
  if (!Array.isArray(json)) return [];
  return json.map(normalizeNode).filter(Boolean);
}

function normalizeNode(node) {
  if (typeof node === 'string') return { type: node };
  if (node && typeof node === 'object') {
    if (node.type === 'repeat' || 'repeat' in node) {
      return {
        type: 'repeat',
        count: Number(node.count ?? node.repeat) || 1,
        body: normalizeProgram(node.body || []),
      };
    }
    if (node.type) return { type: node.type };
  }
  return null;
}

export function serializeProgram(program) {
  return program.map((n) =>
    n.type === 'repeat' ? { repeat: n.count, body: serializeProgram(n.body) } : n.type,
  );
}

// Число карточек: «повтори» считается одной карточкой плюс её содержимое.
export function countCards(program) {
  return program.reduce(
    (sum, n) => sum + 1 + (n.type === 'repeat' ? countCards(n.body) : 0),
    0,
  );
}

export function cloneProgram(program) {
  return normalizeProgram(serializeProgram(program));
}

// --- Развёртка в плоские шаги --------------------------------------------
// Шаг: { cmd, path, loops } где path — путь до карточки в дереве ([2] или [2, 1]),
// loops — список {path, iter, count} для всех охватывающих «повтори» (для подсветки «2 из 3»).

export function flatten(program, basePath = [], loops = []) {
  const steps = [];
  program.forEach((node, i) => {
    const path = [...basePath, i];
    if (node.type === 'repeat') {
      for (let iter = 1; iter <= node.count; iter++) {
        const inner = flatten(node.body, path, [...loops, { path, iter, count: node.count }]);
        if (inner.length === 0) {
          // пустой цикл: показываем сам блок, чтобы было видно, что он «крутится»
          steps.push({ cmd: 'noop', path, loops: [...loops, { path, iter, count: node.count }] });
        }
        steps.push(...inner);
      }
    } else {
      steps.push({ cmd: node.type, path, loops });
    }
  });
  return steps;
}

// --- Симуляция ----------------------------------------------------------

export function createState(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    facing: level.facing,
    collected: new Set(), // ключи "x,y" собранных звёзд
    keysHeld: 0,
    keysTaken: new Set(),
    openedDoors: new Set(),
  };
}

export function snapshot(state) {
  return {
    x: state.x, y: state.y, facing: state.facing,
    collected: new Set(state.collected),
    keysHeld: state.keysHeld,
    keysTaken: new Set(state.keysTaken),
    openedDoors: new Set(state.openedDoors),
  };
}

function resolveMove(state, cmd) {
  if (cmd in DIRS) return cmd;
  if (cmd === 'forward') return state.facing;
  return null;
}

// Выполняет одну команду. Возвращает { ok, reason?, events: [] }.
export function applyStep(level, state, cmd) {
  const events = [];
  if (cmd === 'noop') return { ok: true, events };
  if (cmd === 'turnLeft') { state.facing = TURN_LEFT[state.facing]; events.push('turn'); return { ok: true, events }; }
  if (cmd === 'turnRight') { state.facing = TURN_RIGHT[state.facing]; events.push('turn'); return { ok: true, events }; }

  const dir = resolveMove(state, cmd);
  if (!dir) return { ok: false, reason: 'unknown', events };
  state.facing = dir;
  const nx = state.x + DIRS[dir].dx;
  const ny = state.y + DIRS[dir].dy;

  if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) {
    return { ok: false, reason: 'edge', events };
  }
  if (isWall(level, nx, ny)) return { ok: false, reason: 'wall', events };

  const k = key(nx, ny);
  const isDoor = level.doors.some((d) => d.x === nx && d.y === ny);
  if (isDoor && !state.openedDoors.has(k)) {
    if (state.keysHeld > 0) {
      state.keysHeld -= 1;
      state.openedDoors.add(k);
      events.push('door');
    } else {
      return { ok: false, reason: 'lockedDoor', events };
    }
  }

  state.x = nx;
  state.y = ny;
  events.push('move');

  if (level.stars.some((s) => s.x === nx && s.y === ny) && !state.collected.has(k)) {
    state.collected.add(k);
    events.push('star');
  }
  if (level.keys.some((s) => s.x === nx && s.y === ny) && !state.keysTaken.has(k)) {
    state.keysTaken.add(k);
    state.keysHeld += 1;
    events.push('key');
  }
  return { ok: true, events };
}

export function allStarsCollected(level, state) {
  return state.collected.size >= level.stars.length;
}

export function atGoal(level, state) {
  return state.x === level.goal.x && state.y === level.goal.y;
}

// Полный прогон. Возвращает трассу для анимации и исход.
// outcome: 'success' | 'wall' | 'notThere' | 'starsLeft' | 'empty'
export function run(level, program) {
  const steps = flatten(program);
  const state = createState(level);
  const trace = [];
  if (steps.length === 0) {
    return { outcome: 'empty', steps, trace, finalState: snapshot(state), failedIndex: -1 };
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const before = snapshot(state);
    const result = applyStep(level, state, step.cmd);
    const after = snapshot(state);
    trace.push({ index: i, step, result, before, after });
    if (!result.ok) {
      return { outcome: 'wall', reason: result.reason, steps, trace, finalState: after, failedIndex: i };
    }
    if (atGoal(level, state) && allStarsCollected(level, state)) {
      return { outcome: 'success', steps, trace, finalState: after, failedIndex: -1, stepsUsed: i + 1 };
    }
  }
  const outcome = atGoal(level, state) ? 'starsLeft' : 'notThere';
  return { outcome, steps, trace, finalState: snapshot(state), failedIndex: -1 };
}

// Звёзды за уровень: 1 — прошёл, 2 — почти оптимально, 3 — уложился в par.
export function computeStars(level, program, result) {
  if (result.outcome !== 'success') return 0;
  if (level.par == null) return 3;
  const cards = countCards(program);
  if (cards <= level.par) return 3;
  if (cards <= level.par + 2) return 2;
  return 1;
}
