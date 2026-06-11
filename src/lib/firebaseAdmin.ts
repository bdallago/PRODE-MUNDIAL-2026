import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getDb(): Firestore {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!, "base64").toString("utf-8")
    );
    const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)").replace(/^"|"$/g, "");
    console.log("[firebaseAdmin] projectId:", serviceAccount.project_id, "| dbId:", dbId);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    return getFirestore(dbId);
  }
  const dbId = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)").replace(/^"|"$/g, "");
  return getFirestore(dbId);
}

// Lazy proxy — initialization runs at first use, not at module load time.
// This avoids crashing during Next.js build when env vars aren't available.
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
