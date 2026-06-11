// Despliega firestore.rules a la base de producción vía API REST de Firebase Rules,
// usando la service account de .env (el firebase CLI no tiene permisos en este proyecto).
// Uso: node scripts/deploy-rules.mjs
import 'dotenv/config';
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
const app = initializeApp({ credential: cert(sa) });
const token = (await app.options.credential.getAccessToken()).access_token;
const project = sa.project_id;
const base = 'https://firebaserules.googleapis.com/v1';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)').replace(/"/g, '');
const relRes = await fetch(`${base}/projects/${project}/releases`, { headers });
const releases = (await relRes.json()).releases || [];
const target = releases.find((r) => r.name.includes(dbId));
if (!target) { console.error(`No se encontró release para la base ${dbId}`); process.exit(1); }

const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf-8');
const rsRes = await fetch(`${base}/projects/${project}/rulesets`, {
  method: 'POST', headers,
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] } }),
});
const ruleset = await rsRes.json();
if (!rsRes.ok) { console.error('Error creando ruleset:', JSON.stringify(ruleset)); process.exit(1); }

const upRes = await fetch(`${base}/${target.name}`, {
  method: 'PATCH', headers,
  body: JSON.stringify({ release: { name: target.name, rulesetName: ruleset.name } }),
});
if (!upRes.ok) { console.error('Error actualizando release:', JSON.stringify(await upRes.json())); process.exit(1); }
console.log(`Reglas desplegadas OK en ${dbId} (ruleset ${ruleset.name.split('/').pop()})`);
process.exit(0);
