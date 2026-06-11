import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getDb(): Firestore {
  const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)").replace(/^"|"$/g, "");
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!, "base64").toString("utf-8")
    );
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    const db = getFirestore(dbId);
    // Force REST transport — avoids gRPC binary parse errors in Vercel serverless
    db.settings({ preferRest: true });
    return db;
  }
  return getFirestore(dbId);
}

// Lazy proxy — initialization runs at first use, not at module load time.
// This avoids crashing during Next.js build when env vars aren't available.
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
