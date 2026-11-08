// Прогресс: сервер (data/progress.json) с запасным вариантом в localStorage.
const LS_KEY = 'putanik-progress';

function fromLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; }
}
function toLocal(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
}

export async function loadProgress() {
  try {
    const r = await fetch('/api/progress', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.statusText);
    const p = await r.json();
    toLocal(p);
    return p;
  } catch (e) {
    console.warn('Сервер недоступен, берём прогресс из localStorage', e);
    return fromLocal() || { hero: null, voice: true, unlockAll: false, levels: {}, lastLevel: null };
  }
}

let saveChain = Promise.resolve();
export function saveProgress(progress) {
  toLocal(progress);
  saveChain = saveChain.then(async () => {
    try {
      await fetch('/api/progress', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(progress),
      });
    } catch (e) { console.warn('Не удалось сохранить на сервер', e); }
  });
  return saveChain;
}

export async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
