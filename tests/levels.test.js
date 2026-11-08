import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLevel, shortestMoves } from '../tools/level-check.js';
import { parseLevel } from '../public/js/engine/level.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'levels');

test('BFS учитывает звёзды, ключи и двери', () => {
  assert.equal(shortestMoves(parseLevel({ id: 'a', grid: ['S..G'] })), 3);
  assert.equal(shortestMoves(parseLevel({ id: 'b', grid: ['S.G', '.*.'] })), 4);
  assert.equal(shortestMoves(parseLevel({ id: 'c', grid: ['SDG', 'k..'] })), 4);
  assert.equal(shortestMoves(parseLevel({ id: 'd', grid: ['S#G'] })), Infinity);
});

for (const f of readdirSync(dir).filter((x) => /^chapter\d+\.json$/.test(x)).sort()) {
  test(`уровни ${f} корректны`, () => {
    const levels = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    assert.ok(levels.length > 0);
    const errors = levels.flatMap(checkLevel).filter((p) => !p.includes('предупреждение'));
    assert.deepEqual(errors, []);
  });
}
