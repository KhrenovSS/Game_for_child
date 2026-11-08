import { speak, stop } from '../audio/speech.js';
import { sfx } from '../audio/sfx.js';

export function playCutscene(root, frames, onDone) {
  let i = 0;
  root.innerHTML = `<div class="cut-frame"><div class="pic"></div><div class="text"></div></div><div class="cut-dots"></div><button class="btn">Дальше ▶</button>`;
  const pic = root.querySelector('.pic');
  const text = root.querySelector('.text');
  const dots = root.querySelector('.cut-dots');
  const btn = root.querySelector('.btn');
  frames.forEach(() => { const s = document.createElement('span'); dots.appendChild(s); });

  function show() {
    const f = frames[i];
    pic.textContent = f.pic;
    text.textContent = f.text;
    dots.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', k === i));
    btn.textContent = i === frames.length - 1 ? 'В путь! 🚀' : 'Дальше ▶';
    speak(f.text);
  }
  btn.addEventListener('click', () => {
    sfx.tap();
    i += 1;
    if (i >= frames.length) { stop(); onDone(); return; }
    show();
  });
  show();
}
