// Детерминированный генератор случайных чисел (mulberry32): один seed — один и тот же уровень.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // включительно
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    const a2 = [...arr];
    for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
    return a2;
  };
  return rng;
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
