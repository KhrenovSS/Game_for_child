// Модель уровня: превращает JSON-описание в удобную структуру.

export const DEFAULT_LEGEND = {
  '.': 'floor',
  '#': 'wall',
  'S': 'start',
  'G': 'goal',
  '*': 'star',
  'k': 'key',
  'D': 'door',
};

export const ALL_COMMANDS = ['up', 'down', 'left', 'right', 'repeat', 'forward', 'turnLeft', 'turnRight'];

export const key = (x, y) => `${x},${y}`;

export function parseLevel(json) {
  if (!json || !Array.isArray(json.grid) || json.grid.length === 0) {
    throw new Error(`Уровень ${json?.id ?? '?'}: нет grid`);
  }
  const legend = { ...DEFAULT_LEGEND, ...(json.legend || {}) };
  const height = json.grid.length;
  const width = json.grid[0].length;
  const walls = new Set();
  const stars = [];
  const keys = [];
  const doors = [];
  let start = null;
  let goal = null;

  json.grid.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Уровень ${json.id}: строка ${y} другой длины`);
    [...row].forEach((ch, x) => {
      const kind = legend[ch];
      switch (kind) {
        case 'wall': walls.add(key(x, y)); break;
        case 'start': start = { x, y }; break;
        case 'goal': goal = { x, y }; break;
        case 'star': stars.push({ x, y }); break;
        case 'key': keys.push({ x, y }); break;
        case 'door': doors.push({ x, y }); break;
        case 'floor': case undefined: break;
        default: break;
      }
    });
  });
  if (!start) throw new Error(`Уровень ${json.id}: нет старта (S)`);
  if (!goal) throw new Error(`Уровень ${json.id}: нет цели (G)`);

  return {
    id: String(json.id),
    chapter: Number(json.chapter) || 1,
    title: json.title || '',
    width, height, walls, start, goal, stars, keys, doors,
    facing: json.heroFacing || 'right',
    commands: json.commands || ['up', 'down', 'left', 'right'],
    maxCommands: json.maxCommands ?? null,
    par: json.par ?? null,
    preset: json.preset ?? null,
    locked: Boolean(json.locked),
    hint: json.hint || '',
    say: json.say || '',
    solution: json.solution ?? null,
    raw: json,
  };
}

export function isWall(level, x, y) {
  return x < 0 || y < 0 || x >= level.width || y >= level.height || level.walls.has(key(x, y));
}
