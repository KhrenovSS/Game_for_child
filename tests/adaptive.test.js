import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDifficulty, abandonDifficulty, createActiveTimer, nextMathLevel } from '../public/js/engine/adaptive.js';
import { makeMathTask, MATH_TYPES } from '../public/js/engine/math.js';
import { makeRng } from '../public/js/engine/rng.js';

test('быстро → сложнее, медленно → проще, в цель → почти без изменений', () => {
  assert.ok(nextDifficulty(5, { activeSec: 30, targetSec: 90 }) > 6);
  assert.ok(nextDifficulty(5, { activeSec: 250, targetSec: 90 }) < 4);
  assert.ok(Math.abs(nextDifficulty(5, { activeSec: 90, targetSec: 90 }) - 5) < 0.01);
  assert.ok(nextDifficulty(5, { activeSec: 40, fails: 4, targetSec: 90 }) < 5);
  assert.equal(nextDifficulty(20, { activeSec: 5 }), 20);
  assert.equal(nextDifficulty(1, { activeSec: 999 }), 1);
  assert.ok(abandonDifficulty(5) < 5);
});

test('активный таймер не считает простой', () => {
  let t = 0;
  const timer = createActiveTimer({ idleMs: 40000, now: () => t });
  t = 10000; timer.touch();
  t = 20000;
  assert.equal(timer.seconds(), 20);
  t = 200000; // ушёл на 3 минуты
  assert.equal(timer.seconds(), 50); // активные 20 с + 30 с до порога простоя (касание в 10 с + 40 с)
});

test('уровень математики растёт и падает', () => {
  assert.ok(nextMathLevel(2, { firstTry: true, seconds: 5 }) > 2);
  assert.ok(nextMathLevel(2, { firstTry: false, wrong: 2 }) < 2);
});

test('все задания в пределах 0–10', () => {
  const rng = makeRng(7);
  const ctx = { heroShort: 'Бип', heroGen: 'Бипа', found: 'нашёл' };
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const L = 1 + (i % 5);
    const t = makeMathTask(L, rng, ctx);
    seen.add(t.type);
    assert.ok(Number.isInteger(t.answer) && t.answer >= 0 && t.answer <= 10, `${t.type}: ${t.expr} = ${t.answer}`);
    const nums = (t.expr || '').match(/\d+/g) || [];
    nums.forEach((n) => assert.ok(+n <= 10, `${t.type}: число ${n} > 10 в ${t.expr}`));
    (t.pics || []).forEach((p) => p.n != null && assert.ok(p.n <= 10, `${t.type}: картинок ${p.n}`));
  }
  assert.deepEqual([...seen].sort(), Object.keys(MATH_TYPES).sort());
});
