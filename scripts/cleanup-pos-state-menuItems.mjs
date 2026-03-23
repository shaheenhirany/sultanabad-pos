// scripts/cleanup-pos-state-menuItems.mjs
// One-time Firestore cleanup for pos_state/shared.menuItems
// Goal: strip large base64 data URLs from `img` fields so the document stays small and
// cloud sync stops failing/reverting local menu changes.
//
// USAGE (recommended):
// 1) Create a Firebase service account JSON for the `canteen-sultanabad` project.
// 2) Set env var:  set GOOGLE_APPLICATION_CREDENTIALS=path\\to\\serviceAccountKey.json
// 3) From the POS Deploy folder, run:
//       node ./scripts/cleanup-pos-state-menuItems.mjs
// 4) Script will:
//       - Read doc pos_state/shared
//       - Strip any img starting with "data:image/" from menuItems
//       - Write the cleaned doc back
//
// NOTE: This script is idempotent: running it multiple times is safe.

import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

// Initialize firebase-admin using a local service account JSON placed in this project.
// Expected path (relative to POS Deploy root):
//   ./serviceAccountKey.json
// You must download this from Firebase Console (service account for `canteen-sultanabad`).
if (admin.apps.length === 0) {
  const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) {
    console.error("serviceAccountKey.json not found in POS Deploy root.");
    console.error("Download a service account key for project 'canteen-sultanabad' and save it as:");
    console.error("  " + keyPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL is optional for Firestore; included for completeness
    databaseURL: "https://canteen-sultanabad-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();

async function cleanupPosStateShared() {
  const docRef = db.collection("pos_state").doc("shared");
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log("pos_state/shared does not exist. Nothing to clean.");
    return;
  }

  const data = snap.data() || {};
  const menuItems = Array.isArray(data.menuItems) ? data.menuItems : [];

  if (menuItems.length === 0) {
    console.log("pos_state/shared.menuItems is empty. Nothing to clean.");
    return;
  }

  let changed = false;
  const cleanedMenuItems = menuItems.map((item, index) => {
    const next = { ...item };
    const img = typeof next.img === "string" ? next.img : "";

    if (img.startsWith("data:image/")) {
      console.log(`Stripping base64 image for menuItems[${index}] (id=${next.id})`);
      next.img = ""; // or set to a small placeholder URL if you prefer
      changed = true;
    }

    return next;
  });

  if (!changed) {
    console.log("No base64 img fields found. No changes written.");
    return;
  }

  const updated = {
    ...data,
    menuItems: cleanedMenuItems,
    // Keep existing updatedAt or let client overwrite it later.
  };

  await docRef.set(updated, { merge: false });
  console.log("Cleanup complete: pos_state/shared.menuItems updated without base64 images.");
}

cleanupPosStateShared().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exitCode = 1;
});
