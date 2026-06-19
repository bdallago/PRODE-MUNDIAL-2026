// Mergea sectores duplicados dentro de una empresa.
// Renombra usuarios con el sector viejo al sector canónico,
// y limpia el array areas del doc de company.
// Uso: node scripts/merge-sectors.mjs <companyId>
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const companyId = process.argv[2];
if (!companyId) { console.error('Uso: node scripts/merge-sectors.mjs <companyId>'); process.exit(1); }

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
initializeApp({ credential: cert(sa) });
const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)').replace(/"/g, '');
const db = getFirestore(dbId);

// old → canonical
const MERGES = [
  { old: 'ADMINISTRACIÓN Finanzas + Contabilidad', canonical: 'ADMINISTRACIÓN - Finanzas + Contabilidad' },
  { old: 'Directorio + Gerencias',                 canonical: 'Gerencias + Directorio' },
];

// 1. Migrate users
const usersSnap = await db.collection('users').where('companyId', '==', companyId).get();
console.log(`Usuarios en empresa ${companyId}: ${usersSnap.size}\n`);

for (const merge of MERGES) {
  const affected = usersSnap.docs.filter(d => d.data().area === merge.old);
  console.log(`"${merge.old}" → "${merge.canonical}" — ${affected.length} usuario(s)`);
  for (const doc of affected) {
    await doc.ref.set({ area: merge.canonical }, { merge: true });
    console.log(`  ✅ ${doc.data().displayName}`);
  }
}

// 2. Clean up company areas array
const companyRef = db.collection('companies').doc(companyId);
const companySnap = await companyRef.get();
if (!companySnap.exists) { console.log('\nNo se encontró el doc de company.'); process.exit(0); }

const areas = companySnap.data().areas || [];
if (areas.length === 0) { console.log('\nLa company no tiene campo areas; nada que limpiar.'); process.exit(0); }

let newAreas = [...areas];
for (const merge of MERGES) {
  const hasOld = newAreas.includes(merge.old);
  const hasCanonical = newAreas.includes(merge.canonical);
  if (hasOld) {
    newAreas = newAreas.filter(a => a !== merge.old);
    if (!hasCanonical) newAreas.push(merge.canonical);
    console.log(`\nAreas: eliminado "${merge.old}"${!hasCanonical ? `, agregado "${merge.canonical}"` : ''}`);
  }
}

await companyRef.set({ areas: newAreas }, { merge: true });
console.log('\nAreas actualizadas:');
newAreas.forEach(a => console.log(`  - ${a}`));

process.exit(0);
