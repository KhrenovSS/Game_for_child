// Подстройка сложности под ребёнка. Цель — примерно одинаковое время на уровень.
import { D_MIN, D_MAX } from './generator.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_TARGET_SECONDS = 90;

// После успешного уровня: быстрее цели → сложнее, медленнее → проще.
// weight < 1 для ручных уровней (их сложность не равна D, сигнал слабее).
export function nextDifficulty(D, { activeSec, fails = 0, hints = 0, targetSec = DEFAULT_TARGET_SECONDS, weight = 1 }) {
  const ratio = clamp(activeSec / targetSec, 0.2, 5);
  let delta = clamp(-1.3 * Math.log2(ratio), -2, 2);
  if (fails >= 2) delta = Math.min(delta, 0); // быстро, но методом тыка — не усложняем
  delta -= 0.45 * Math.max(0, fails - 1);
  delta -= 0.3 * hints;
  delta = clamp(delta, -2.5, 2);
  return Math.round(clamp(D + delta * weight, D_MIN, D_MAX) * 10) / 10;
}

// Бросил уровень, не пройдя (после нескольких неудач).
export function abandonDifficulty(D) {
  return Math.round(clamp(D - 1.5, D_MIN, D_MAX) * 10) / 10;
}

export function isStruggle({ fails = 0, activeSec = 0, targetSec = DEFAULT_TARGET_SECONDS }) {
  return fails >= 4 || activeSec > targetSec * 2.5;
}

// Активное время: часы стоят, если ребёнок ничего не трогает дольше idleMs.
export function createActiveTimer({ idleMs = 40000, now = () => Date.now() } = {}) {
  let total = 0;
  let last = now();
  let lastTouch = now();
  let running = true;
  return {
    touch() { this.tick(); lastTouch = now(); },
    tick() {
      const t = now();
      if (running) total += Math.max(0, Math.min(t - last, lastTouch + idleMs - last));
      last = t;
    },
    pause() { this.tick(); running = false; },
    resume() { last = now(); lastTouch = now(); running = true; },
    seconds() { this.tick(); return Math.round(total / 1000); },
  };
}

// --- Математика ---------------------------------------------------------------
export const MATH_MIN = 1;
export const MATH_MAX = 5;

export function nextMathLevel(level, { firstTry, seconds, wrong }) {
  let d = 0;
  if (firstTry && seconds <= 15) d = 0.35;
  else if (firstTry) d = 0.12;
  else if (wrong === 1) d = -0.25;
  else d = -0.5;
  return Math.round(clamp(level + d, MATH_MIN, MATH_MAX) * 100) / 100;
}
