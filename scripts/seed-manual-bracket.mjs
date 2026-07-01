// One-shot: siembra el cuadro KO manual en results/actual.
// - Reescribe los 16 slots R32 con el orden correcto (no cambia equipos, solo el slot).
// - Setea bracketKickoffs de R16..F con los horarios confirmados.
// - Reconstruye koSchedule para los slots con ambos equipos definidos.
// - NO toca groups, finishedGroups, specials ni knockouts existentes.
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
const { R32_ACTUAL_MATCHUPS, KO_KICKOFFS, buildManualKoSchedule } =
  await import('../src/lib/bracket/manualBracket.ts');
const { propagateWinners } = await import('../src/lib/bracket/propagate.ts');

const ref = adminDb.doc('results/actual');
const snap = await ref.get();
const data = snap.data() || {};

const winners = data.knockouts || {};

// Base = matchups actuales, pero forzamos los 16 R32 al orden correcto.
const baseMatchups = { ...(data.bracketMatchups || {}), ...R32_ACTUAL_MATCHUPS };
// Propagar ganadores ya cargados para rearmar las rondas siguientes bien ubicadas.
const matchups = propagateWinners(baseMatchups, winners);

const bracketKickoffs = { ...(data.bracketKickoffs || {}), ...KO_KICKOFFS };
const koSchedule = buildManualKoSchedule(matchups, KO_KICKOFFS);

await ref.set({ bracketMatchups: matchups, bracketKickoffs, koSchedule }, { merge: true });

console.log('Seed OK');
console.log('R32 slots:', Object.keys(R32_ACTUAL_MATCHUPS).length);
console.log('koSchedule rows:', Object.keys(koSchedule).length);
console.log('matchups slots:', Object.keys(matchups).length);
process.exit(0);
