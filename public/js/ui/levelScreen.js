// Экран уровня: поле + редактор программы + палитра + кнопки + проигрывание трассы.
import { run, normalizeProgram, cloneProgram, computeStars, countCards } from '../engine/interpreter.js';
import { createBoard } from './board.js';
import { createProgramEditor, CARD_NAME, CARD_ICON } from './program.js';
import { createActiveTimer } from '../engine/adaptive.js';
import { renderPalette } from './palette.js';
import { sfx } from '../audio/sfx.js';
import { speak } from '../audio/speech.js';

const SPEEDS = [
  { ms: 750, icon: '🐢' },
  { ms: 420, icon: '🐇' },
  { ms: 180, icon: '🚀' },
];

const BUMP_TEXT = {
  wall: ['Ой, стена!', 'Бум! Тут не пройти.', 'Упс, стенка!'],
  edge: ['Дальше края нельзя!', 'Ой, тут обрыв!'],
  lockedDoor: ['Дверь заперта. Нужен ключ 🔑', 'Закрыто! Где ключ?'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createLevelScreen(root, { heroEmoji, onExit, onResult, onSkip, showToast }) {
  root.innerHTML = `
    <div class="level-left">
      <div class="level-top">
        <button class="btn secondary" data-act="exit">🗺️</button>
        <div class="title"></div>
        <button class="btn secondary skip-btn hidden" data-act="skip" aria-label="Другой лабиринт">🎲</button>
        <button class="btn secondary" data-act="hint">💡</button>
      </div>
      <div class="board-wrap"></div>
    </div>
    <div class="level-right">
      <div class="program-panel"></div>
      <div class="palette"></div>
      <div class="controls">
        <button class="btn round green" data-act="run" aria-label="Пуск">▶</button>
        <button class="btn round secondary" data-act="step" aria-label="Один шаг">⏭</button>
        <button class="btn round secondary speed" data-act="speed" aria-label="Скорость">🐢</button>
        <span class="spacer"></span>
        <button class="btn round secondary" data-act="undo" aria-label="Отменить">↩️</button>
        <button class="btn round secondary" data-act="reset" aria-label="Сначала">⟲</button>
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  const titleEl = q('.title');
  const boardWrap = q('.board-wrap');
  const programPanel = q('.program-panel');
  const paletteEl = q('.palette');
  const runBtn = q('[data-act=run]');
  const stepBtn = q('[data-act=step]');
  const speedBtn = q('[data-act=speed]');
  const undoBtn = q('[data-act=undo]');
  const resetBtn = q('[data-act=reset]');

  let level = null;
  let theme = {};
  let board = null;
  let speedIdx = 1;
  let phase = 'idle'; // idle | running | paused | done
  let result = null;
  let playIndex = 0;
  let timer = null;
  let attempts = 0;
  let fails = 0;
  let hints = 0;
  let solved = false;
  let timer2 = createActiveTimer();
  const skipBtn = q('[data-act=skip]');
  root.addEventListener('pointerdown', () => timer2.touch(), { capture: true });

  function stats() {
    return { activeSec: timer2.seconds(), fails, hints, attempts, solved };
  }

  // Тихая помощь: чем больше неудач, тем сильнее подсказка.
  function solutionPreview(n) {
    const sol = level.solution;
    if (!sol) return null;
    const parts = sol.slice(0, n).map((c) => (typeof c === 'string'
      ? CARD_ICON[c]
      : `${CARD_ICON.repeat}×${c.repeat}(${c.body.map((b) => CARD_ICON[b] || '').join('')})`));
    return parts.join(' ');
  }
  function autoHelp() {
    if (fails === 3) {
      hints += 1;
      const text = level.hint || 'Попробуй по шагам: нажми ⏭';
      setTimeout(() => { board.bubble('💡 ' + text, 6000); speak(text); }, 2600);
    } else if (fails >= 5 && level.solution) {
      hints += 1;
      const n = Math.min(fails - 3, level.solution.length);
      const prev = solutionPreview(n);
      const text = level.preset ? `Правильно начинается так: ${prev}` : `Начни так: ${prev}`;
      setTimeout(() => { board.bubble('💡 ' + text, 8000); speak('Подсказка. Посмотри, с чего начать.'); }, 2600);
    }
    if (fails >= 7 && level.raw.generated) skipBtn.classList.remove('hidden');
  }

  const editor = createProgramEditor(programPanel, {
    onChange: () => { if (phase === 'done') softReset(); updateButtons(); },
    onLimit: () => {
      sfx.bump();
      showToast('Карточки кончились! А можно короче? 🤔');
      speak('Карточки кончились. Подумай, можно ли короче?');
    },
    sfx,
  });

  function load(lv, th, heroEmojiNow) {
    level = lv; theme = th || {};
    attempts = 0; fails = 0; hints = 0; solved = false;
    timer2 = createActiveTimer();
    skipBtn.classList.add('hidden');
    if (board) board.destroy();
    board = createBoard(boardWrap, { heroEmoji: heroEmojiNow || heroEmoji, theme });
    board.render(level);
    titleEl.textContent = level.title;
    editor.setMax(level.maxCommands);
    editor.setProgram(level.preset ? normalizeProgram(level.preset) : []);
    renderPalette(paletteEl, level.commands, (cmd) => editor.insert(cmd));
    speedBtn.textContent = SPEEDS[speedIdx].icon;
    phase = 'idle';
    result = null;
    updateButtons();
    setTimeout(() => board.fit(), 50);
    if (level.say) { board.bubble(level.say, 3500); speak(level.say); }
  }

  function updateButtons() {
    runBtn.textContent = phase === 'running' ? '⏸' : '▶';
    stepBtn.disabled = phase === 'done';
    undoBtn.disabled = !editor.canUndo() || phase === 'running';
    editor.setEditable(phase === 'idle' || phase === 'done');
  }

  // Сброс героя без потери программы.
  function softReset() {
    clearTimeout(timer);
    phase = 'idle';
    result = null;
    playIndex = 0;
    board.reset();
    editor.setHighlight({});
    updateButtons();
  }

  function prepareRun() {
    const program = cloneProgram(editor.getProgram());
    result = run(level, program);
    result.program = program;
    playIndex = 0;
    board.reset();
    if (result.outcome === 'empty') {
      board.bubble('Сначала добавь команды 👇', 2500);
      speak('Сначала добавь команды');
      result = null;
      return false;
    }
    attempts += 1;
    return true;
  }

  function doStep() {
    const entry = result.trace[playIndex];
    if (!entry) { finish(); return; }
    const ms = SPEEDS[speedIdx].ms;
    editor.setHighlight({ active: entry.step.path, loops: entry.step.loops });
    board.applyTrace(entry, ms);
    if (!entry.result.ok) sfx.bump();
    else if (entry.result.events.includes('star')) sfx.star();
    else if (entry.result.events.includes('key')) sfx.key();
    else if (entry.result.events.includes('door')) sfx.door();
    else if (entry.result.events.includes('move')) sfx.step();
    playIndex += 1;
    if (playIndex >= result.trace.length) {
      timer = setTimeout(finish, ms + 80);
      return true;
    }
    return false;
  }

  function tick() {
    if (phase !== 'running') return;
    const ended = doStep();
    if (!ended) timer = setTimeout(tick, SPEEDS[speedIdx].ms + 60);
  }

  function finish() {
    clearTimeout(timer);
    phase = 'done';
    updateButtons();
    const program = result.program;
    const stars = computeStars(level, program, result);
    const cards = countCards(program);
    const last = result.trace[result.trace.length - 1];

    if (result.outcome === 'success') {
      editor.setHighlight({});
      board.cheer();
      sfx.win();
      const first = !solved;
      solved = true;
      onResult?.({ outcome: 'success', stars, cards, attempts, program, first, ...stats() });
      return;
    } else if (result.outcome === 'wall') {
      editor.setHighlight({ error: last.step.path, loops: last.step.loops });
      const text = pick(BUMP_TEXT[result.reason] || BUMP_TEXT.wall);
      board.bubble(text, 4000);
      speak(text + '. Посмотри на красную карточку.');
      sfx.sad();
      fails += 1; autoHelp();
      onResult?.({ outcome: 'wall', stars: 0, cards, attempts, program });
    } else if (result.outcome === 'starsLeft') {
      const text = 'Не все звёзды собраны!';
      board.bubble(text, 4000); speak(text + ' Вернись за ними.'); sfx.sad();
      fails += 1; autoHelp();
      onResult?.({ outcome: 'starsLeft', stars: 0, cards, attempts, program });
    } else {
      const text = 'Хм, я ещё не дошёл…';
      board.bubble(text, 4000); speak('Команды кончились, а я ещё не дошёл. Добавь ещё.'); sfx.sad();
      fails += 1; autoHelp();
      onResult?.({ outcome: 'notThere', stars: 0, cards, attempts, program });
    }
  }

  runBtn.addEventListener('click', () => {
    if (phase === 'running') { phase = 'paused'; clearTimeout(timer); updateButtons(); return; }
    if (phase === 'done') softReset();
    if (phase === 'idle' && !prepareRun()) return;
    phase = 'running';
    updateButtons();
    tick();
  });
  stepBtn.addEventListener('click', () => {
    if (phase === 'running') { phase = 'paused'; clearTimeout(timer); }
    if (phase === 'idle' && !prepareRun()) return;
    phase = 'paused';
    updateButtons();
    doStep();
  });
  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speedBtn.textContent = SPEEDS[speedIdx].icon;
    sfx.tap();
  });
  undoBtn.addEventListener('click', () => { if (phase === 'done') softReset(); editor.undo(); updateButtons(); });
  resetBtn.addEventListener('click', () => { softReset(); sfx.remove(); });
  q('[data-act=exit]').addEventListener('click', () => { clearTimeout(timer); onExit?.(stats()); });
  skipBtn.addEventListener('click', () => { clearTimeout(timer); sfx.tap(); onSkip?.(stats()); });
  q('[data-act=hint]').addEventListener('click', () => {
    const text = level.hint || level.say || 'Попробуй по шагам: нажми ⏭';
    hints += 1;
    board.bubble(text, 5000);
    speak(text);
  });

  return { load, softReset, stats, fit: () => board?.fit() };
}
