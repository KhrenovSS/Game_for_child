import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLevel } from './level-check.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'levels');
const files = readdirSync(dir).filter((f) => /^chapter\d+\.json$/.test(f)).sort();
let total = 0, bad = 0;
const ids = new Set();
for (const f of files) {
  const levels = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  for (const lv of levels) {
    total += 1;
    if (ids.has(lv.id)) { console.log(`✗ ${lv.id}: дублируется id`); bad += 1; }
    ids.add(lv.id);
    const problems = checkLevel(lv);
    const warnings = problems.filter((p) => p.includes('предупреждение'));
    const errors = problems.filter((p) => !p.includes('предупреждение'));
    if (errors.length) { bad += 1; errors.forEach((p) => console.log('✗', p)); }
    warnings.forEach((p) => console.log('⚠', p));
  }
}
console.log(`\nУровней: ${total}, с ошибками: ${bad}`);
process.exit(bad ? 1 : 0);
