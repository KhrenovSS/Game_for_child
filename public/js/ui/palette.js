import { CARD_ICON, CARD_NAME } from './program.js';

export function renderPalette(container, commands, onPick) {
  container.innerHTML = '';
  for (const cmd of commands) {
    const b = document.createElement('button');
    b.className = `card palette ${cmd}`;
    b.textContent = CARD_ICON[cmd] || cmd;
    b.setAttribute('aria-label', CARD_NAME[cmd] || cmd);
    b.addEventListener('click', () => onPick(cmd));
    container.appendChild(b);
  }
}
