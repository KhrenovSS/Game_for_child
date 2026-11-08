import { sfx } from '../audio/sfx.js';
import { speak } from '../audio/speech.js';

export function renderHeroSelect(root, heroes, onPick) {
  root.innerHTML = `<h1>Привет, Саша! 👋</h1><p>Выбери героя, который пойдёт распутывать дороги</p><div class="hero-grid"></div><button class="btn green" disabled>Поехали! 🚀</button>`;
  const grid = root.querySelector('.hero-grid');
  const go = root.querySelector('.btn');
  let selected = null;
  for (const h of heroes) {
    const c = document.createElement('button');
    c.className = 'hero-card';
    c.innerHTML = `<span class="emoji">${h.emoji}</span><span>${h.name}</span>`;
    c.addEventListener('click', () => {
      selected = h.id;
      grid.querySelectorAll('.hero-card').forEach((el) => el.classList.remove('selected'));
      c.classList.add('selected');
      go.disabled = false;
      sfx.tap();
      speak(h.greeting || `Я ${h.name}!`);
    });
    grid.appendChild(c);
  }
  go.addEventListener('click', () => { if (selected) onPick(selected); });
}
