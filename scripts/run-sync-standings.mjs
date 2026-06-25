import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const envContent = readFileSync(join(root, '.env'), 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);
Object.assign(process.env, env);

const { syncStandings } = await import('../src/lib/sync-standings.ts');
const { recalculatePoints } = await import('../src/lib/recalculate-points.ts');

const apiKey = process.env.FOOTBALL_API_KEY;
if (!apiKey) throw new Error('FOOTBALL_API_KEY not set');

console.log('--- sync-standings ---');
await syncStandings(apiKey);
console.log('sync done');

console.log('--- recalculate ---');
await recalculatePoints();
console.log('recalculate done');
