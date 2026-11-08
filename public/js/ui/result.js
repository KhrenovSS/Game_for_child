import { sfx } from '../audio/sfx.js';
import { speak } from '../audio/speech.js';

const PRAISE = ['Ура! Получилось!', 'Молодец!', 'Отлично!', 'Вот это да!', 'Путаник в панике!'];

export function showResult(overlay, { stars, cards, par, isLast, hasNext }, { onRetry, onNext, onMap }) {
  const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  const starStr = [1, 2, 3].map((n) => `<span class="${n <= stars ? '' : 'off'}">⭐</span>`).join('');
  let tip = '';
  if (stars < 3 && par != null) tip = `Ты справился за ${cards} 🃏. А можно за ${par}! Попробуешь?`;
  else if (stars === 3) tip = 'Самый короткий путь! 🏆';
  overlay.innerHTML = `<div class="dialog"><div class="big">🎉</div><h2>${praise}</h2><div class="stars">${starStr}</div><p>${tip}</p><div class="row"></div></div>`;
  const row = overlay.querySelector('.row');
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = `btn ${cls}`; b.textContent = label; b.addEventListener('click', () => { sfx.tap(); overlay.classList.add('hidden'); fn(); }); row.appendChild(b); };
  if (stars < 3) mk('Ещё раз 🔁', 'secondary', onRetry);
  mk('Карта 🗺️', 'secondary', onMap);
  if (hasNext) mk(isLast ? 'Дальше 🎬' : 'Дальше ▶', 'green', onNext);
  overlay.classList.remove('hidden');
  speak(praise + (tip ? '. ' + tip.replace('🃏', 'карточек') : ''));
}
