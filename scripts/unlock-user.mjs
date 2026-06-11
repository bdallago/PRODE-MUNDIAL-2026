// Desbloquea a un usuario puntual: le da una extensión individual de deadline
// (users/{uid}.deadlineOverride) y desfija sus predicciones (isLocked: false).
// Uso: node scripts/unlock-user.mjs <email> [horas]   (default: 24 horas desde ahora)
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
const hours = Number(process.argv[3] || 24);
if (!email) { console.error('Uso: node scripts/unlock-user.mjs <email> [horas]'); process.exit(1); }

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
initializeApp({ credential: cert(sa) });
const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)').replace(/"/g, '');
const db = getFirestore(dbId);

const us = await db.collection('users').where('email', '==', email).get();
if (us.empty) { console.error(`No existe usuario con email ${email}`); process.exit(1); }

const override = Date.now() + hours * 60 * 60 * 1000;
for (const u of us.docs) {
  await u.ref.set({ deadlineOverride: override }, { merge: true });
  const predRef = db.collection('predictions').doc(u.id);
  const pred = await predRef.get();
  if (pred.exists) await predRef.set({ isLocked: false }, { merge: true });
  console.log(`${u.data().displayName} (${email}) desbloqueado hasta ${new Date(override).toISOString()} UTC`);
  console.log(`  predicciones: ${pred.exists ? 'desfijadas' : 'sin doc — puede crearlas'}`);
  console.log(`  IMPORTANTE: avisarle que refresque la página (F5) si tenía la app abierta.`);
}
process.exit(0);
