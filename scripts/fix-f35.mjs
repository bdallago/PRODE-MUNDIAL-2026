// Fix: cargar resultado F-35 (Japón vs Túnez) que la API devuelve invertido
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

// API devuelve: Tunisia 0 - Japan 4
// En data.ts: F-35 home=Japón, away=Túnez → home=4, away=0
const resultsRef = adminDb.doc('results/actual');
await resultsRef.update({
  'matches.F-35': { home: '4', away: '0' },
  updatedAt: new Date().toISOString(),
});
console.log('F-35 cargado: Japón 4 - Túnez 0');

console.log('Recalculando puntos...');
await recalculatePoints();
console.log('Listo.');
process.exit(0);
