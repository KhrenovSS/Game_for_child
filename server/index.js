import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const PORT = Number(process.env.PORT) || 8080;

const DEFAULT_PROGRESS = () => ({
  hero: null,
  voice: true,
  unlockAll: false,
  levels: {},
  lastLevel: null,
  updatedAt: null,
});

async function readProgress() {
  try {
    const raw = await fs.readFile(PROGRESS_FILE, 'utf8');
    return { ...DEFAULT_PROGRESS(), ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') return DEFAULT_PROGRESS();
    throw err;
  }
}

// Атомарная запись: сначала во временный файл, затем переименование.
async function writeProgress(progress) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = PROGRESS_FILE + '.tmp';
  progress.updatedAt = new Date().toISOString();
  await fs.writeFile(tmp, JSON.stringify(progress, null, 2), 'utf8');
  await fs.rename(tmp, PROGRESS_FILE);
  return progress;
}

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/progress', async (req, res, next) => {
  try { res.json(await readProgress()); } catch (e) { next(e); }
});

app.put('/api/progress', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || typeof body.levels !== 'object') {
      return res.status(400).json({ error: 'bad progress payload' });
    }
    res.json(await writeProgress({ ...DEFAULT_PROGRESS(), ...body }));
  } catch (e) { next(e); }
});

// Частичное обновление (родительская страница: герой, озвучка, unlockAll).
app.patch('/api/progress', async (req, res, next) => {
  try {
    const current = await readProgress();
    const patch = req.body || {};
    const allowed = ['hero', 'voice', 'unlockAll', 'lastLevel', 'settings', 'skills'];
    for (const key of allowed) if (key in patch) current[key] = patch[key];
    res.json(await writeProgress(current));
  } catch (e) { next(e); }
});

app.post('/api/progress/reset', async (req, res, next) => {
  try {
    const current = await readProgress();
    const fresh = DEFAULT_PROGRESS();
    // Сброс прогресса не трогает выбранного героя и настройки.
    fresh.hero = current.hero;
    fresh.voice = current.voice;
    if (current.settings) fresh.settings = current.settings;
    res.json(await writeProgress(fresh));
  } catch (e) { next(e); }
});

app.get('/parent', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'parent.html')));
app.use(express.static(PUBLIC_DIR, { etag: true, maxAge: 0 }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Путаник запущен: http://0.0.0.0:${PORT}`);
});
