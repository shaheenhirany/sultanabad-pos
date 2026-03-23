import process from "node:process";
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
    args[key.slice(2)] = value;
    if (value) i += 1;
  }
  return args;
}

function initAdmin() {
  if (getApps().length > 0) return;
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
  }
  const json = JSON.parse(readFileSync(credentialPath, "utf8"));
  initializeApp({ credential: cert(json) });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const latestVersion = String(args.latest || "").trim();
  const minSupportedVersion = String(args.min || "").trim();
  const updateUrl = String(args.url || "").trim();
  const updateMessage = String(args.message || "").trim();

  initAdmin();

  const db = getFirestore();
  const ref = db.collection("app_config").doc("pos");

  await ref.set({
    latestVersion,
    minSupportedVersion,
    updateUrl,
    updateMessage,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("Updated app_config/pos");
  console.log({ latestVersion, minSupportedVersion, updateUrl, updateMessage });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
