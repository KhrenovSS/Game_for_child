import { sfx } from '../audio/sfx.js';

// chapters: [{ ch, nodes: [{ kind:'hand'|'gen'|'endless', id?, i?, boss?, done, unlocked, stars }], open, complete, doneCount }]
export function renderWorldMap(root, { chapters, hero, currentKey, onPick, onChangeHero }) {
  root.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'map-header';
  head.innerHTML = `<h1>🗺️ Светлая страна</h1><button class="btn secondary small hero-badge" aria-label="Сменить героя">${hero.emoji}</button>`;
  head.querySelector('button').addEventListener('click', onChangeHero);
  root.appendChild(head);

  for (const c of chapters) {
    const sec = document.createElement('div');
    sec.className = 'chapter';
    if (!c.open) sec.classList.add('locked');
    const total = c.nodes.filter((n) => n.kind !== 'endless').length;
    sec.innerHTML = `<h2>${c.ch.emoji} ${c.ch.title} <small style="opacity:.7;font-size:18px">${c.complete ? '✅' : `${c.doneCount}/${total}`}</small></h2><div class="level-dots"></div>`;
    const dots = sec.querySelector('.level-dots');
    let handNo = 0;
    c.nodes.forEach((n) => {
      const d = document.createElement('button');
      d.className = 'level-dot';
      if (n.kind === 'hand') handNo += 1;
      if (n.kind === 'gen') d.classList.add('gen');
      if (n.kind === 'endless') d.classList.add('gen', 'endless');
      if (n.boss) d.classList.add('boss');
      if (!n.unlocked) d.classList.add('locked');
      if (n.done) d.classList.add('done');
      if (n.key === currentKey) d.classList.add('current');
      let label;
      if (!n.unlocked) label = '🔒';
      else if (n.kind === 'endless') label = n.count ? `🎲${n.count}` : '🎲';
      else if (n.boss) label = '🌀';
      else if (n.kind === 'gen') label = n.done ? '✓' : '?';
      else label = String(handNo);
      const stars = n.stars ? '⭐'.repeat(n.stars) : '';
      d.innerHTML = `<span>${label}</span><span class="stars">${stars}</span>`;
      if (n.unlocked) d.addEventListener('click', () => { sfx.tap(); onPick(c.ch, n); });
      dots.appendChild(d);
    });
    root.appendChild(sec);
  }
  // Показываем, где продолжать.
  requestAnimationFrame(() => root.querySelector('.level-dot.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}
