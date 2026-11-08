// «Волшебный замок»: чтобы пройти дальше, нужно решить пример. Ввод — своя клавиатура 0–10.
import { sfx } from '../audio/sfx.js';
import { speak } from '../audio/speech.js';

function picsHtml(pics, { revealGone = true } = {}) {
  if (!pics) return '';
  let html = '<div class="m-pics"><div class="m-row">';
  for (const p of pics) {
    if (p.br) { html += '</div><div class="m-row">'; continue; }
    if (p.op) { html += `<span class="m-op">${p.op}</span>`; continue; }
    let g = '<span class="m-group">';
    if (p.label) g += `<span class="m-label">${p.label}:</span>`;
    for (let i = 0; i < p.n; i++) {
      const gone = (p.gone && i >= p.n - p.gone && revealGone) || p.neg;
      g += `<span class="m-item${gone ? ' gone' : ''}">${p.e}</span>`;
    }
    g += '</span>';
    html += g;
  }
  html += '</div></div>';
  return html;
}

function friendsHtml(f) {
  if (!f) return '';
  const kids = ['🧒', '👧', '👦'];
  return `<div class="m-friends">${kids.slice(0, f.n).map((k) => `<span class="m-plate">${k}<span class="plate">🍽️</span></span>`).join('')}</div>`;
}

// task: из makeMathTask. onSolved({firstTry, wrong, seconds}) вызывается после верного ответа.
export function showMathGate(overlay, task, { onSolved, onGiveUp }) {
  const started = Date.now();
  let wrong = 0;
  let value = '';
  overlay.innerHTML = `
    <div class="dialog math" data-type="${task.type}" data-answer="${task.answer}">
      <div class="m-head"><span class="m-lock">🔒</span><span class="m-title">Открой замок!</span><button class="m-say" aria-label="Прочитать">🔊</button></div>
      <div class="m-text">${task.text}</div>
      <div class="m-visual">${task.showPics ? picsHtml(task.pics) : ''}${friendsHtml(task.friends)}</div>
      ${task.expr ? `<div class="m-expr">${task.expr.replace('?', '<b>?</b>')}</div>` : ''}
      <div class="m-answer"><span class="m-eq">Ответ:</span><span class="m-input"></span></div>
      <div class="m-msg"></div>
      <div class="m-keys"></div>
    </div>`;
  const q = (s) => overlay.querySelector(s);
  const input = q('.m-input');
  const msg = q('.m-msg');
  const visual = q('.m-visual');
  const keys = q('.m-keys');

  const layout = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '10', '⌫'];
  for (const k of layout) {
    const b = document.createElement('button');
    b.className = 'm-key' + (k === '⌫' ? ' erase' : '') + (k === '10' ? ' ten' : '');
    b.textContent = k;
    b.addEventListener('click', () => press(k));
    keys.appendChild(b);
  }
  const ok = document.createElement('button');
  ok.className = 'm-key ok';
  ok.textContent = '✔';
  ok.addEventListener('click', check);
  keys.appendChild(ok);

  function render() {
    input.textContent = value === '' ? '?' : value;
    input.classList.toggle('empty', value === '');
  }
  function press(k) {
    sfx.tap();
    msg.textContent = '';
    if (k === '⌫') value = value.slice(0, -1);
    else if (k === '10') value = '10';
    else if (value === '' || value === '0' || value.length >= 2) value = k;
    else value = value + k;
    if (Number(value) > 10) value = k;
    render();
  }
  function check() {
    if (value === '') { msg.textContent = 'Набери ответ на кнопках 👇'; return; }
    const n = Number(value);
    if (n === task.answer) {
      sfx.win();
      input.classList.add('right');
      msg.innerHTML = '<span class="good">Верно! Замок открыт 🔓</span>';
      q('.m-lock').textContent = '🔓';
      speak('Верно! Замок открыт.');
      keys.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      setTimeout(() => {
        overlay.classList.add('hidden');
        onSolved({ firstTry: wrong === 0, wrong, seconds: Math.round((Date.now() - started) / 1000), answer: n });
      }, 1300);
      return;
    }
    wrong += 1;
    sfx.sad();
    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
    value = '';
    render();
    if (wrong === 1) {
      msg.textContent = 'Почти! Давай посчитаем вместе.';
      speak('Почти! Давай посчитаем вместе. ' + task.text);
      const pics = task.showPics ? null : (task.hintPics || task.pics);
      if (pics) visual.innerHTML = picsHtml(pics) + friendsHtml(task.friends);
    } else if (wrong === 2) {
      msg.textContent = 'Посчитай по картинкам пальчиком 👆';
      speak('Посчитай по картинкам пальчиком.');
      visual.classList.add('pulse');
    } else {
      msg.innerHTML = `Ответ: <b>${task.answer}</b>. Запомни! Сейчас будет похожий пример.`;
      speak(`Правильный ответ: ${task.answer}. Сейчас будет похожий пример.`);
      keys.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      setTimeout(() => onGiveUp({ wrong, seconds: Math.round((Date.now() - started) / 1000) }), 3500);
    }
  }
  q('.m-say').addEventListener('click', () => speak(task.text + (task.expr && !task.text.includes(task.expr) ? '. ' + task.expr.replace('−', 'минус').replace('+', 'плюс').replace('?', 'сколько') : '')));
  render();
  overlay.classList.remove('hidden');
  speak(task.text);
}
