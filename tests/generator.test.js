import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../public/js/engine/generator.js';
import { checkLevel } from '../tools/level-check.js';

for (const skill of ['seq', 'plan', 'fix', 'loop']) {
  test(`генератор ${skill}: уровни корректны на всех сложностях`, () => {
    for (let D = 1; D <= 20; D += 1) {
      for (let s = 0; s < 6; s++) {
        const seed = D * 1000 + s * 7 + skill.length;
        const lv = generateLevel(skill, D, seed);
        const problems = checkLevel(lv).filter((p) => !p.includes('предупреждение'));
        assert.deepEqual(problems, [], `${skill} D=${D} seed=${seed}: ${problems.join('; ')}\n${lv.grid.join('\n')}`);
      }
    }
  });
}

test('один seed — один и тот же уровень', () => {
  const a = generateLevel('plan', 9, 12345);
  const b = generateLevel('plan', 9, 12345);
  assert.deepEqual(a.grid, b.grid);
});

test('сложность растёт с D (длина решения)', () => {
  const avg = (skill, D) => {
    let s = 0;
    for (let i = 0; i < 15; i++) s += generateLevel(skill, D, 500 + i).par;
    return s / 15;
  };
  assert.ok(avg('seq', 15) > avg('seq', 2) + 4);
  assert.ok(avg('plan', 15) > avg('plan', 2) + 4);
});
