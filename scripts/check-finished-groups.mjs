import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf-8').split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);
Object.assign(process.env, env);
const { adminDb } = await import('../src/lib/firebaseAdmin.ts');
const snap = await adminDb.doc('results/actual').get();
const d = snap.data();
console.log('finishedGroups:', d.finishedGroups);
console.log('\ngroups:');
for (const [g, teams] of Object.entries(d.groups || {})) {
  console.log(` ${g}:`, teams);
}
