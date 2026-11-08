// Редактор программы: список карточек, блоки «повтори», курсор вставки, подсветка.
import { countCards } from '../engine/interpreter.js';

export const CARD_ICON = {
  up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️',
  forward: '⏫', turnLeft: '↩️', turnRight: '↪️', repeat: '🔁',
};
export const CARD_NAME = {
  up: 'вверх', down: 'вниз', left: 'влево', right: 'вправо',
  forward: 'шаг вперёд', turnLeft: 'повернись налево', turnRight: 'повернись направо', repeat: 'повтори',
};

const samePath = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

export function createProgramEditor(container, { onChange, onLimit, sfx }) {
  let program = [];
  let cursor = { container: [], index: 0 };
  let maxCommands = null;
  let editable = true;
  let highlight = { active: null, error: null, loops: [] };
  const history = [];

  function getContainer(path) {
    let arr = program;
    for (const i of path) arr = arr[i].body;
    return arr;
  }

  function setProgram(p) {
    program = p;
    cursor = { container: [], index: program.length };
    history.length = 0;
    render();
  }
  function getProgram() { return program; }

  function pushHistory() {
    history.push(JSON.stringify(serialize(program)));
    if (history.length > 50) history.shift();
  }
  function serialize(p) {
    return p.map((n) => (n.type === 'repeat' ? { repeat: n.count, body: serialize(n.body) } : n.type));
  }
  function deserialize(j) {
    return j.map((n) => (typeof n === 'string' ? { type: n } : { type: 'repeat', count: n.repeat, body: deserialize(n.body) }));
  }
  function undo() {
    if (!editable || history.length === 0) return;
    program = deserialize(JSON.parse(history.pop()));
    cursor = { container: [], index: program.length };
    render();
    onChange?.();
  }

  function insert(cmd) {
    if (!editable) return;
    if (maxCommands != null && countCards(program) >= maxCommands) {
      onLimit?.();
      return;
    }
    pushHistory();
    let arr;
    try { arr = getContainer(cursor.container); } catch { cursor = { container: [], index: program.length }; arr = program; }
    const node = cmd === 'repeat' ? { type: 'repeat', count: 2, body: [] } : { type: cmd };
    const idx = Math.min(cursor.index, arr.length);
    arr.splice(idx, 0, node);
    if (cmd === 'repeat') {
      cursor = { container: [...cursor.container, idx], index: 0 };
    } else {
      cursor = { container: cursor.container, index: idx + 1 };
    }
    sfx?.tap();
    render();
    onChange?.();
  }

  function removeAt(path) {
    if (!editable) return;
    pushHistory();
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    const arr = getContainer(parentPath);
    arr.splice(idx, 1);
    cursor = { container: parentPath, index: idx };
    sfx?.remove();
    render();
    onChange?.();
  }

  function changeCount(path, delta) {
    if (!editable) return;
    const node = getContainer(path.slice(0, -1))[path[path.length - 1]];
    const next = Math.max(1, Math.min(9, node.count + delta));
    if (next === node.count) return;
    pushHistory();
    node.count = next;
    sfx?.tap();
    render();
    onChange?.();
  }

  function setCursor(containerPath, index) {
    cursor = { container: containerPath, index };
    render();
  }

  function setHighlight(h) {
    highlight = { active: null, error: null, loops: [], ...h };
    render();
  }

  function setEditable(v) { editable = v; render(); }
  function setMax(m) { maxCommands = m; render(); }

  function loopIter(path) {
    const l = highlight.loops.find((x) => samePath(x.path, path));
    return l ? `${l.iter} из ${l.count}` : '';
  }

  function renderList(arr, basePath, target) {
    const isCursorHere = editable && samePath(cursor.container, basePath);
    arr.forEach((node, i) => {
      const path = [...basePath, i];
      if (isCursorHere && cursor.index === i) target.appendChild(cursorEl());
      if (node.type === 'repeat') {
        const block = document.createElement('div');
        block.className = 'repeat-block';
        if (samePath(highlight.active, path)) block.classList.add('active');
        if (samePath(highlight.error, path)) block.classList.add('error');
        const isActiveLoop = highlight.loops.some((l) => samePath(l.path, path));
        if (isActiveLoop) block.classList.add('active');

        const head = document.createElement('button');
        head.className = 'repeat-head';
        head.innerHTML = `<span class="icon">🔁</span><span class="count">×${node.count}</span><span class="iter">${loopIter(path)}</span>`;
        head.addEventListener('click', (e) => { e.stopPropagation(); removeAt(path); });
        block.appendChild(head);

        const ctrl = document.createElement('div');
        ctrl.className = 'repeat-ctrl';
        const plus = document.createElement('button'); plus.textContent = '+';
        const minus = document.createElement('button'); minus.textContent = '−';
        plus.addEventListener('click', (e) => { e.stopPropagation(); changeCount(path, +1); });
        minus.addEventListener('click', (e) => { e.stopPropagation(); changeCount(path, -1); });
        ctrl.append(plus, minus);
        block.appendChild(ctrl);

        const body = document.createElement('div');
        body.className = 'repeat-body';
        if (editable && samePath(cursor.container, path)) body.classList.add('target');
        body.addEventListener('click', (e) => { e.stopPropagation(); if (editable) setCursor(path, node.body.length); });
        renderList(node.body, path, body);
        block.appendChild(body);
        target.appendChild(block);
      } else {
        const card = document.createElement('button');
        card.className = `card ${node.type}`;
        card.textContent = CARD_ICON[node.type] || node.type;
        card.setAttribute('aria-label', CARD_NAME[node.type] || node.type);
        if (samePath(highlight.active, path)) card.classList.add('active');
        if (samePath(highlight.error, path)) card.classList.add('error');
        card.addEventListener('click', (e) => { e.stopPropagation(); removeAt(path); });
        target.appendChild(card);
      }
    });
    if (isCursorHere && cursor.index >= arr.length) target.appendChild(cursorEl());
  }

  function cursorEl() { const c = document.createElement('div'); c.className = 'cursor'; return c; }

  function render() {
    container.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'program-head';
    const n = countCards(program);
    const limit = maxCommands != null ? ` из ${maxCommands}` : '';
    head.innerHTML = `<span>Программа</span><span class="count ${maxCommands != null && n >= maxCommands ? 'over' : ''}">${n}${limit} 🃏</span>`;
    container.appendChild(head);

    const list = document.createElement('div');
    list.className = 'program';
    if (program.length === 0) list.classList.add('empty-hint');
    renderList(program, [], list);
    const end = document.createElement('div');
    end.className = 'endzone';
    list.appendChild(end);
    list.addEventListener('click', () => { if (editable) setCursor([], program.length); });
    container.appendChild(list);

    // держим активную карточку на виду
    const act = list.querySelector('.card.active, .card.error, .repeat-block.error');
    act?.scrollIntoView?.({ block: 'nearest' });
  }

  return { setProgram, getProgram, insert, undo, setHighlight, setEditable, setMax, render, canUndo: () => history.length > 0 };
}
