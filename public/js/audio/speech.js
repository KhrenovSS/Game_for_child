// Озвучка через Web Speech API (на iPad есть русский голос Milena).
let enabled = true;
let voice = null;

export function setVoiceEnabled(v) { enabled = v; if (!v) stop(); }
export function voiceAvailable() { return 'speechSynthesis' in window; }

function pickVoice() {
  if (voice || !voiceAvailable()) return;
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === 'ru-RU') || voices.find((v) => v.lang.startsWith('ru')) || null;
}
if (voiceAvailable()) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text, { rate = 0.95 } = {}) {
  if (!enabled || !voiceAvailable() || !text) return;
  pickVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  if (voice) u.voice = voice;
  u.rate = rate;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}

export function stop() { if (voiceAvailable()) speechSynthesis.cancel(); }
