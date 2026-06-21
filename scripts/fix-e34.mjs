// Fix: cargar resultado E-34 (Curazao vs Ecuador 0-0) que no se había cargado
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

const { adminDb } = await import('../src/lib/firebaseAdmin.ts');
const { recalculatePoints } = await import('../src/lib/recalculate-points.ts');

// API devuelve: Ecuador 0 - Curazao 0 (swapped)
// En data.ts: E-34 home=Curazao, away=Ecuador → home=0, away=0
const resultsRef = adminDb.doc('results/actual');
await resultsRef.update({
  'matches.E-34': { home: '0', away: '0' },
  updatedAt: new Date().toISOString(),
});
console.log('E-34 cargado: Curazao 0 - Ecuador 0');

console.log('Recalculando puntos...');
await recalculatePoints();
console.log('Listo.');
process.exit(0);
