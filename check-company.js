import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const q = query(collection(db, "companies"), where("code", "==", "PC2XQ9"));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("Company PC2XQ9 NOT FOUND");
  } else {
    console.log("Company PC2XQ9 FOUND");
    console.log(snap.docs[0].data());
  }
  process.exit(0);
}

check();
