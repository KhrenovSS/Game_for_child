// Короткие синтезированные звуки через WebAudio — без внешних файлов.
let ctx = null;
let enabled = true;

export function setSfxEnabled(v) { enabled = v; }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// iOS требует первого жеста пользователя для звука.
export function unlockAudio() { ac(); }

function tone(freq, dur = 0.12, type = 'sine', gain = 0.18, when = 0) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + when);
  o.stop(c.currentTime + when + dur + 0.02);
}

export const sfx = {
  tap: () => tone(520, 0.06, 'triangle', 0.12),
  step: () => tone(380, 0.07, 'triangle', 0.1),
  bump: () => { tone(140, 0.18, 'sawtooth', 0.15); tone(110, 0.22, 'square', 0.08, 0.02); },
  star: () => { tone(880, 0.1, 'sine', 0.15); tone(1320, 0.14, 'sine', 0.15, 0.08); },
  key: () => { tone(660, 0.08, 'square', 0.08); tone(990, 0.1, 'square', 0.08, 0.07); },
  door: () => { tone(300, 0.15, 'triangle', 0.12); tone(450, 0.2, 'triangle', 0.12, 0.1); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, i * 0.12)),
  sad: () => { tone(330, 0.2, 'sine', 0.12); tone(262, 0.3, 'sine', 0.12, 0.18); },
  remove: () => tone(260, 0.08, 'triangle', 0.1),
};
