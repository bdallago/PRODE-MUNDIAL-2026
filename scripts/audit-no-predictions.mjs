// Encuentra usuarios que NO tienen doc en /predictions (nunca guardaron).
// Uso: node scripts/audit-no-predictions.mjs [companyId]
// Sin companyId busca en todos los usuarios.
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const companyId = process.argv[2] || null;

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
initializeApp({ credential: cert(sa) });
const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)').replace(/"/g, '');
const db = getFirestore(dbId);

let usersQuery = db.collection('users');
if (companyId) usersQuery = usersQuery.where('companyId', '==', companyId);
const usersSnap = await usersQuery.get();

console.log(`Usuarios encontrados: ${usersSnap.size}${companyId ? ` (company: ${companyId})` : ''}\n`);

const missing = [];
for (const userDoc of usersSnap.docs) {
  const predSnap = await db.collection('predictions').doc(userDoc.id).get();
  if (!predSnap.exists) {
    const d = userDoc.data();
    missing.push({ uid: userDoc.id, name: d.displayName, email: d.email, company: d.companyId });
  }
}

if (missing.length === 0) {
  console.log('✅ Todos los usuarios tienen doc de predicciones.');
} else {
  console.log(`❌ ${missing.length} usuario(s) SIN doc de predicciones (afectados por el bug de partidos individuales):\n`);
  for (const u of missing) {
    console.log(`  - ${u.name} <${u.email}>`);
    console.log(`    uid: ${u.uid}  company: ${u.company || '(ninguna)'}`);
  }
}

process.exit(0);
