import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function init() {
  if (getApps().length > 0) return;
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!, "base64").toString("utf-8")
  );
  initializeApp({ credential: cert(serviceAccount) });
}

init();

export const adminDb = getFirestore(
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)"
);
