// Точка входа: загрузка данных, путь по главам, адаптация, математика, прогресс.
import { loadProgress, saveProgress, loadJSON } from './api.js';
import { parseLevel } from './engine/level.js';
import { generateLevel } from './engine/generator.js';
import { nextDifficulty, abandonDifficulty, isStruggle, nextMathLevel, DEFAULT_TARGET_SECONDS } from './engine/adaptive.js';
import { makeMathTask } from './engine/math.js';
import { makeRng, randomSeed } from './engine/rng.js';
import { unlockAudio, setSfxEnabled } from './audio/sfx.js';
import { setVoiceEnabled } from './audio/speech.js';
import { renderHeroSelect } from './ui/heroSelect.js';
import { renderWorldMap } from './ui/worldMap.js';
import { playCutscene } from './ui/cutscene.js';
import { createLevelScreen } from './ui/levelScreen.js';
import { showResult } from './ui/result.js';
import { showMathGate } from './ui/mathGate.js';

const $ = (s) => document.querySelector(s);
const screens = {
  hero: $('#screen-hero'), map: $('#screen-map'), cutscene: $('#screen-cutscene'), level: $('#screen-level'),
};
const overlay = $('#overlay');
const toastEl = $('#toast');
let toastTimer = null;
function showToast(text, ms = 2200) {
  toastEl.textContent = text; toastEl.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

document.addEventListener('pointerdown', unlockAudio, { once: true });

// --- Данные ---------------------------------------------------------------
const story = await loadJSON('/levels/story.json');
const levelsRaw = (await Promise.all(story.chapters.map((c) => loadJSON(`/levels/chapter${c.id}.json`)))).flat();
const handById = new Map(levelsRaw.map((l) => [l.id, l]));

let progress = await loadProgress();
progress.levels ||= {};
progress.cutscenes ||= {};
progress.chapters ||= {};
progress.skills ||= {};
progress.history ||= [];
progress.pendingGen ||= {};
progress.math ||= { level: 2, history: [] };
progress.settings = { targetSeconds: DEFAULT_TARGET_SECONDS, math: true, ...(progress.settings || {}) };

// Начальная сложность навыков. Если глава уже пройдена руками — стартуем повыше.
for (const ch of story.chapters) {
  if (progress.skills[ch.skill] == null) {
    progress.skills[ch.skill] = progress.levels[ch.bossLevel]?.stars > 0 ? 8 : 2;
  }
}
setVoiceEnabled(progress.voice !== false);
setSfxEnabled(true);

const heroOf = (id) => story.heroes.find((h) => h.id === id) || story.heroes[0];
const skillD = (skill) => progress.skills[skill] ?? 2;
async function persist() { await saveProgress(progress); }

// --- Путь главы -------------------------------------------------------------
const chState = (ch) => {
  const st = (progress.chapters[ch.id] ||= { genDone: 0 });
  st.gen ||= {};
  return st;
};
const handDone = (id) => (progress.levels[id]?.stars || 0) > 0;
const chapterComplete = (ch) => handDone(ch.bossLevel);

function chapterOpen(ch) {
  const i = story.chapters.indexOf(ch);
  return progress.unlockAll || i === 0 || chapterComplete(story.chapters[i - 1]);
}

function chapterNodes(ch) {
  const st = chState(ch);
  const complete = chapterComplete(ch);
  const nodes = [
    ...ch.introLevels.map((id) => ({ kind: 'hand', id, key: id })),
    ...Array.from({ length: ch.genCount }, (_, i) => ({ kind: 'gen', i, key: `${ch.id}-g${i}` })),
    { kind: 'hand', id: ch.bossLevel, boss: true, key: ch.bossLevel },
  ];
  const open = chapterOpen(ch);
  let prevDone = true;
  for (const n of nodes) {
    n.done = n.kind === 'hand' ? handDone(n.id) : (Boolean(st.gen[n.i]) || st.genDone > n.i);
    n.stars = n.kind === 'hand' ? progress.levels[n.id]?.stars || 0 : st.gen[n.i]?.stars || 0;
    n.unlocked = open && (prevDone || complete || progress.unlockAll);
    prevDone = n.done;
  }
  if (complete) {
    // В пройденной главе пустые «?» не показываем — только реально сыгранные лабиринты.
    for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].kind === 'gen' && !nodes[i].done) nodes.splice(i, 1);
  }
  if (complete) nodes.push({ kind: 'endless', key: `${ch.id}-endless`, unlocked: true, done: false, count: st.endless || 0 });
  return nodes;
}

function currentNodeKey() {
  for (const ch of story.chapters) {
    if (!chapterOpen(ch)) break;
    if (chapterComplete(ch)) continue; // пройденные главы не держат «текущий» уровень
    const n = chapterNodes(ch).find((x) => x.unlocked && !x.done && x.kind !== 'endless');
    if (n) return n.key;
  }
  return null;
}

function findNode(key) {
  for (const ch of story.chapters) {
    const node = chapterNodes(ch).find((n) => n.key === key);
    if (node) return { ch, node };
  }
  return null;
}

// Куда ведёт «Дальше»: в незавершённой главе — следующий узел; иначе — к текущему уровню всей игры.
function nextNodeAfter(ch, node) {
  const nodes = chapterNodes(ch);
  if (node.kind === 'endless') return { ch, node: nodes.find((n) => n.kind === 'endless') };
  if (!chapterComplete(ch)) {
    const next = nodes.find((n) => n.unlocked && !n.done && n.kind !== 'endless');
    if (next) return { ch, node: next };
  }
  const key = currentNodeKey();
  return key ? findNode(key) : null;
}

// --- Экраны -------------------------------------------------------------------
function gotoHeroSelect() {
  show('hero');
  renderHeroSelect(screens.hero, story.heroes, async (heroId) => {
    progress.hero = heroId;
    await persist();
    gotoMap();
  });
}

function gotoMap() {
  overlay.classList.add('hidden');
  show('map');
  renderWorldMap(screens.map, {
    chapters: story.chapters.map((ch) => {
      const nodes = chapterNodes(ch);
      return { ch, nodes, open: chapterOpen(ch), complete: chapterComplete(ch), doneCount: nodes.filter((n) => n.done && n.kind !== 'endless').length };
    }),
    hero: heroOf(progress.hero),
    currentKey: currentNodeKey(),
    onPick: (ch, node) => startNode(ch, node),
    onChangeHero: gotoHeroSelect,
  });
}

function runCutscene(key, frames, then) {
  if (!frames || frames.length === 0 || progress.cutscenes[key]) { then(); return; }
  progress.cutscenes[key] = true;
  persist();
  show('cutscene');
  playCutscene(screens.cutscene, frames.map((f) => ({ ...f, text: f.text.replaceAll('{hero}', heroOf(progress.hero).name) })), then);
}

// --- Математический замок ------------------------------------------------------
function requireMath(then) {
  if (!progress.settings.math || !progress.mathPending) { then(); return; }
  const hero = heroOf(progress.hero);
  const ctx = { heroShort: hero.short || hero.name, heroGen: hero.gen || hero.name, found: hero.found || 'нашёл' };
  const ask = (level) => {
    const task = makeMathTask(level, makeRng(randomSeed()), ctx, progress.settings.mathTypes);
    showMathGate(overlay, task, {
      onSolved: ({ firstTry, wrong, seconds }) => {
        progress.math.level = nextMathLevel(progress.math.level, { firstTry, wrong, seconds });
        progress.math.history.push({ type: task.type, expr: task.expr || task.text, answer: task.answer, wrong, seconds, at: new Date().toISOString(), level: Math.floor(level) });
        progress.math.history = progress.math.history.slice(-300);
        progress.mathPending = false;
        persist();
        then();
      },
      onGiveUp: ({ wrong, seconds }) => {
        progress.math.level = nextMathLevel(progress.math.level, { firstTry: false, wrong, seconds });
        progress.math.history.push({ type: task.type, expr: task.expr || task.text, answer: task.answer, wrong, seconds, at: new Date().toISOString(), level: Math.floor(level), gaveUp: true });
        persist();
        ask(Math.max(1, progress.math.level - 1));
      },
    });
  };
  ask(progress.math.level);
}

// --- Уровни ----------------------------------------------------------------------
let levelScreen = null;
let current = null; // { ch, node, json, generated, skill, D }

function pickGenLevel(ch, node) {
  const pending = progress.pendingGen[ch.id];
  if (pending && node.kind !== 'endless') return pending;
  // Если трудно — даём ручной уровень этой главы, который ещё не проходили (они проще и проверены).
  const meta = progress.skills[`${ch.skill}Struggle`];
  if (meta) {
    const pool = levelsRaw.filter((l) => l.chapter === ch.id && !ch.introLevels.includes(l.id) && l.id !== ch.bossLevel && !handDone(l.id));
    if (pool.length) return { ...pool[0], practice: true };
  }
  const json = generateLevel(ch.skill, skillD(ch.skill), randomSeed());
  progress.pendingGen[ch.id] = json;
  return json;
}

function startNode(ch, node) {
  requireMath(() => {
    const go = () => openNode(ch, node);
    const isFirst = chapterNodes(ch)[0].key === node.key;
    if (isFirst) runCutscene(`ch${ch.id}-intro`, ch.intro, go); else go();
  });
}

function openNode(ch, node) {
  overlay.classList.add('hidden');
  const json = node.kind === 'hand' ? handById.get(node.id) : pickGenLevel(ch, node);
  const level = parseLevel({ ...json, chapter: ch.id });
  current = { ch, node, json, generated: Boolean(json.generated), practice: Boolean(json.practice), skill: ch.skill, D: skillD(ch.skill) };
  const hero = heroOf(progress.hero);
  progress.lastLevel = json.id;
  persist();
  show('level');
  if (!levelScreen) {
    levelScreen = createLevelScreen(screens.level, {
      heroEmoji: hero.emoji,
      onExit: onLevelExit,
      onSkip: onLevelSkip,
      onResult: onLevelResult,
      showToast,
    });
  }
  levelScreen.load(level, ch.theme, hero.emoji);
}

function logHistory(entry) {
  progress.history.push({ at: new Date().toISOString(), ...entry });
  progress.history = progress.history.slice(-500);
}

function onLevelExit(stats) {
  if (current && !stats.solved && (stats.fails >= 2 || isStruggle({ ...stats, targetSec: progress.settings.targetSeconds }))) {
    // Бросил трудный уровень: тихо упрощаем следующий.
    progress.skills[current.skill] = abandonDifficulty(skillD(current.skill));
    progress.skills[`${current.skill}Struggle`] = true;
    if (current.generated) delete progress.pendingGen[current.ch.id];
    logHistory({ id: current.json.id, title: current.json.title, skill: current.skill, generated: current.generated, D: current.D, outcome: 'abandon', ...stats });
    persist();
  }
  gotoMap();
}

function onLevelSkip(stats) {
  const { ch, node } = current;
  progress.skills[current.skill] = abandonDifficulty(skillD(current.skill));
  delete progress.pendingGen[ch.id];
  logHistory({ id: current.json.id, title: current.json.title, skill: current.skill, generated: true, D: current.D, outcome: 'skip', ...stats });
  persist();
  openNode(ch, node);
}

function onLevelResult(r) {
  const { ch, node, json } = current;
  const isHand = !current.generated;
  const replay = isHand && handDone(json.id); // повтор уже пройденного ручного уровня
  if (isHand) {
    const rec = progress.levels[json.id] || { stars: 0, attempts: 0, bestLength: null, completedAt: null, lastOutcome: null };
    rec.attempts += 1;
    rec.lastOutcome = r.outcome;
    rec.lastAt = new Date().toISOString();
    if (r.outcome === 'success') {
      rec.stars = Math.max(rec.stars, r.stars);
      rec.bestLength = rec.bestLength == null ? r.cards : Math.min(rec.bestLength, r.cards);
      rec.completedAt ||= rec.lastAt;
      if (r.first) rec.lastTimeSec = r.activeSec;
    }
    progress.levels[json.id] = rec;
  }
  if (r.outcome !== 'success') { persist(); return; }

  if (r.first) {
    const targetSec = progress.settings.targetSeconds;
    const before = skillD(current.skill);
    const after = replay ? before : nextDifficulty(before, { activeSec: r.activeSec, fails: r.fails, hints: r.hints, targetSec, weight: current.generated ? 1 : 0.5 });
    progress.skills[current.skill] = after;
    if (replay) { /* повторы на сложность не влияют */ }
    else if (isStruggle({ ...r, targetSec })) progress.skills[`${current.skill}Struggle`] = true;
    else if (r.fails <= 1) delete progress.skills[`${current.skill}Struggle`];
    logHistory({ id: json.id, title: json.title, skill: current.skill, generated: current.generated, practice: current.practice, replay, D: before, newD: after, outcome: 'success', stars: r.stars, cards: r.cards, par: json.par, activeSec: r.activeSec, fails: r.fails, hints: r.hints });
    const st = chState(ch);
    if (node.kind === 'gen') {
      if (current.generated) delete progress.pendingGen[ch.id];
      if (!chapterComplete(ch)) st.genDone = Math.max(st.genDone, node.i + 1);
      st.gen[node.i] = { stars: Math.max(st.gen[node.i]?.stars || 0, r.stars), at: new Date().toISOString() };
    } else if (node.kind === 'endless') {
      st.endless = (st.endless || 0) + 1;
    }
    progress.mathPending = true;
  }
  persist();

  const wasComplete = node.boss;
  const next = nextNodeAfter(ch, node);
  const chIdx = story.chapters.indexOf(ch);
  const nextCh = story.chapters[chIdx + 1];
  setTimeout(() => {
    showResult(overlay, { stars: r.stars, cards: r.cards, par: json.par, isLast: wasComplete, hasNext: true }, {
      onRetry: () => levelScreen.softReset(),
      onMap: gotoMap,
      onNext: () => {
        if (wasComplete) {
          runCutscene(`ch${ch.id}-outro`, ch.outro, () => {
            if (nextCh) startNode(nextCh, chapterNodes(nextCh)[0]);
            else finale();
          });
        } else if (next) startNode(next.ch, next.node);
        else gotoMap();
      },
    });
  }, 900);
}

function finale() {
  runCutscene('finale', story.finale, gotoMap);
  delete progress.cutscenes.finale;
  persist();
}

// --- Старт ---------------------------------------------------------------------
if (!progress.hero) gotoHeroSelect(); else gotoMap();
window.addEventListener('orientationchange', () => setTimeout(() => levelScreen?.fit(), 300));
