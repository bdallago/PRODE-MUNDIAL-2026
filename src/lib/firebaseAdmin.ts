import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;
  const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)").replace(/^"|"$/g, "");
  let app: App;
  if (getApps().length === 0) {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY!.trim();
    let serviceAccount: any;
    try {
      // Try base64 decode first (expected format)
      serviceAccount = JSON.parse(Buffer.from(rawKey, "base64").toString("utf-8"));
    } catch {
      // Fall back to raw JSON (key stored as plain JSON string in Vercel)
      serviceAccount = JSON.parse(rawKey);
    }
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    app = getApps()[0];
  }
  _db = getFirestore(app, dbId);
  // Non-default Firestore databases fail with gRPC in Vercel serverless — force REST transport
  _db.settings({ preferRest: true });
  return _db;
}

// Lazy proxy — initialization runs at first use, not at module load time.
// This avoids crashing during Next.js build when env vars aren't available.
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

// Auth del Admin SDK sobre la misma app. Se usa para verificar ID tokens de admin
// en endpoints que dispara el cliente (ej. recálculo acoplado al Guardar).
export function getAdminAuth(): Auth {
  getDb(); // asegura que la app esté inicializada
  return getAuth(getApps()[0]);
}
