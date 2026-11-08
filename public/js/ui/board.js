// Поле уровня: клетки, предметы, герой и его анимация.
import { key } from '../engine/level.js';

const ICONS = { goal: '🏁', star: '⭐', key: '🔑', door: '🚪' };

export function createBoard(container, { heroEmoji, theme = {} }) {
  let level = null;
  let boardEl = null;
  let heroEl = null;
  let cell = 64;
  const items = new Map();
  let bubbleEl = null;
  let bubbleTimer = null;

  function fit() {
    if (!level) return;
    const w = container.clientWidth - 16;
    const h = container.clientHeight - 16;
    cell = Math.max(36, Math.min(Math.floor(w / level.width), Math.floor(h / level.height), 110));
    boardEl.style.setProperty('--cell', `${cell}px`);
    placeHero(level.start.x, level.start.y, 0, heroPos.x, heroPos.y);
  }

  const heroPos = { x: 0, y: 0, facing: 'right' };

  function placeHero(x, y, ms = 0, fx = x, fy = y) {
    heroPos.x = fx; heroPos.y = fy;
    heroEl.style.setProperty('--step-ms', `${ms}ms`);
    heroEl.style.setProperty('--tx', `${6 + fx * cell}px`);
    heroEl.style.setProperty('--ty', `${6 + fy * cell}px`);
    heroEl.style.transform = `translate(${6 + fx * cell}px, ${6 + fy * cell}px)`;
  }

  function render(lv) {
    level = lv;
    items.clear();
    container.innerHTML = '';
    boardEl = document.createElement('div');
    boardEl.className = 'board';
    boardEl.style.setProperty('--cols', level.width);
    boardEl.style.setProperty('--rows', level.height);
    if (theme.board) boardEl.style.setProperty('--board-bg', theme.board);
    if (theme.wall) boardEl.style.setProperty('--wall-bg', theme.wall);
    if (theme.floor) boardEl.style.setProperty('--floor', theme.floor);

    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const c = document.createElement('div');
        const k = key(x, y);
        if (level.walls.has(k)) {
          c.className = 'cell wall';
          c.textContent = theme.wallIcon ?? '🪨';
        } else {
          c.className = 'cell floor';
          let kind = null;
          if (level.goal.x === x && level.goal.y === y) { kind = 'goal'; c.classList.add('goal'); }
          else if (level.stars.some((s) => s.x === x && s.y === y)) kind = 'star';
          else if (level.keys.some((s) => s.x === x && s.y === y)) kind = 'key';
          else if (level.doors.some((s) => s.x === x && s.y === y)) kind = 'door';
          if (kind) {
            const it = document.createElement('span');
            it.className = `item ${kind}`;
            it.textContent = ICONS[kind];
            c.appendChild(it);
            items.set(k, it);
          }
        }
        boardEl.appendChild(c);
      }
    }
    heroEl = document.createElement('div');
    heroEl.className = 'hero';
    heroEl.innerHTML = `<span class="sprite">${heroEmoji}</span>`;
    boardEl.appendChild(heroEl);
    container.appendChild(boardEl);
    fit();
    reset();
  }

  function setFacing(f) {
    heroPos.facing = f;
    heroEl.classList.toggle('face-left', f === 'left');
  }

  function reset() {
    hideBubble();
    heroEl.classList.remove('bump', 'cheer');
    placeHero(level.start.x, level.start.y, 0);
    setFacing(level.facing);
    for (const it of items.values()) { it.classList.remove('taken', 'open'); }
  }

  // Применяет один шаг трассы к полю.
  function applyTrace(entry, ms) {
    const { result, after } = entry;
    setFacing(after.facing);
    if (!result.ok) {
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[after.facing] || [0, 0];
      heroEl.style.setProperty('--bx', `${d[0] * cell * 0.25}px`);
      heroEl.style.setProperty('--by', `${d[1] * cell * 0.25}px`);
      heroEl.classList.remove('bump');
      void heroEl.offsetWidth; // перезапуск анимации
      heroEl.classList.add('bump');
      return;
    }
    if (result.events.includes('move')) placeHero(after.x, after.y, ms);
    const k = key(after.x, after.y);
    const it = items.get(k);
    if (it && (result.events.includes('star') || result.events.includes('key'))) {
      setTimeout(() => it.classList.add('taken'), ms * 0.6);
    }
    if (it && result.events.includes('door')) it.classList.add('open');
  }

  function cheer() { heroEl.classList.add('cheer'); }

  function bubble(text, ms = 2500) {
    hideBubble();
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'bubble';
    bubbleEl.textContent = text;
    container.appendChild(bubbleEl);
    if (ms) bubbleTimer = setTimeout(hideBubble, ms);
  }
  function hideBubble() {
    clearTimeout(bubbleTimer);
    if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; }
  }

  window.addEventListener('resize', fit);
  return { render, reset, applyTrace, cheer, bubble, hideBubble, fit, destroy: () => window.removeEventListener('resize', fit) };
}
