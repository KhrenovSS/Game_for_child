import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../public/js/engine/level.js';
import { normalizeProgram, flatten, run, countCards, computeStars, serializeProgram } from '../public/js/engine/interpreter.js';

const lvl = (grid, extra = {}) => parseLevel({ id: 't', grid, ...extra });

test('прямой путь к цели', () => {
  const level = lvl(['S..G']);
  const r = run(level, normalizeProgram(['right', 'right', 'right']));
  assert.equal(r.outcome, 'success');
  assert.equal(r.finalState.x, 3);
});

test('победа сразу при достижении цели, лишние команды не выполняются', () => {
  const level = lvl(['S.G.']);
  const r = run(level, normalizeProgram(['right', 'right', 'right']));
  assert.equal(r.outcome, 'success');
  assert.equal(r.stepsUsed, 2);
  assert.equal(r.trace.length, 2);
});

test('стена останавливает и указывает карточку', () => {
  const level = lvl(['S#G', '...']);
  const r = run(level, normalizeProgram(['right', 'right']));
  assert.equal(r.outcome, 'wall');
  assert.equal(r.reason, 'wall');
  assert.equal(r.failedIndex, 0);
  assert.deepEqual(r.trace[0].step.path, [0]);
});

test('край поля — тоже стена', () => {
  const level = lvl(['S.G']);
  const r = run(level, normalizeProgram(['up']));
  assert.equal(r.outcome, 'wall');
  assert.equal(r.reason, 'edge');
});

test('команды кончились, цель не достигнута', () => {
  const level = lvl(['S..G']);
  const r = run(level, normalizeProgram(['right']));
  assert.equal(r.outcome, 'notThere');
});

test('repeat разворачивается и даёт путь к вложенной карточке', () => {
  const prog = normalizeProgram([{ repeat: 3, body: ['right', 'up'] }, 'left']);
  const steps = flatten(prog);
  assert.equal(steps.length, 7);
  assert.deepEqual(steps[2].path, [0, 0]);
  assert.equal(steps[2].loops[0].iter, 2);
  assert.equal(steps[2].loops[0].count, 3);
  assert.deepEqual(steps[6].path, [1]);
  assert.equal(countCards(prog), 4);
});

test('вложенный repeat', () => {
  const prog = normalizeProgram([{ repeat: 2, body: [{ repeat: 2, body: ['right'] }] }]);
  const steps = flatten(prog);
  assert.equal(steps.length, 4);
  assert.deepEqual(steps[3].path, [0, 0, 0]);
  assert.equal(steps[3].loops.length, 2);
});

test('звёзды нужно собрать все; цель без звёзд — starsLeft', () => {
  const level = lvl(['S*.G', '....']);
  const r1 = run(level, normalizeProgram(['down', 'right', 'right', 'right', 'up']));
  assert.equal(r1.outcome, 'starsLeft');
  const r2 = run(level, normalizeProgram(['right', 'right', 'right']));
  assert.equal(r2.outcome, 'success');
  assert.equal(r2.trace[0].result.events.includes('star'), true);
});

test('дверь без ключа не открывается, с ключом — открывается', () => {
  const level = lvl(['SDG', 'k..']);
  const r1 = run(level, normalizeProgram(['right']));
  assert.equal(r1.outcome, 'wall');
  assert.equal(r1.reason, 'lockedDoor');
  const r2 = run(level, normalizeProgram(['down', 'up', 'right', 'right']));
  assert.equal(r2.outcome, 'success');
  assert.ok(r2.trace[2].result.events.includes('door'));
});

test('forward и повороты используют направление героя', () => {
  const level = lvl(['S..', '..G'], { heroFacing: 'right' });
  const r = run(level, normalizeProgram(['forward', 'forward', 'turnRight', 'forward']));
  assert.equal(r.outcome, 'success');
  assert.equal(r.finalState.facing, 'down');
});

test('звёзды за уровень по par', () => {
  const level = lvl(['S..G'], { par: 3 });
  const ok = (p) => run(level, p);
  const p3 = normalizeProgram(['right', 'right', 'right']);
  assert.equal(computeStars(level, p3, ok(p3)), 3);
  const p5 = normalizeProgram(['up', 'down', 'right', 'right', 'right']);
  // 'up' на краю — стена, поэтому используем обходной вариант на поле побольше
  const level2 = lvl(['....', 'S..G'], { par: 3 });
  assert.equal(computeStars(level2, p5, run(level2, p5)), 2);
  const p7 = normalizeProgram(['up', 'down', 'up', 'down', 'right', 'right', 'right']);
  assert.equal(computeStars(level2, p7, run(level2, p7)), 1);
});

test('serialize ↔ normalize', () => {
  const src = ['up', { repeat: 2, body: ['left', { repeat: 3, body: ['down'] }] }];
  assert.deepEqual(serializeProgram(normalizeProgram(src)), src);
});
