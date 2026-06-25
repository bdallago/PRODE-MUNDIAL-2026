import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf-8').split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);
Object.assign(process.env, env);

const { adminDb } = await import('../src/lib/firebaseAdmin.ts');

const koSync = await adminDb.doc('results/knockoutSync').get();
console.log('=== knockoutSync ===');
console.log(JSON.stringify(koSync.data(), null, 2));

const actual = await adminDb.doc('results/actual').get();
const d = actual.data();
console.log('\n=== bracketMatchups ===');
console.log(JSON.stringify(d?.bracketMatchups, null, 2));
console.log('\n=== bracketKickoffs (slots) ===');
console.log(Object.keys(d?.bracketKickoffs || {}));
