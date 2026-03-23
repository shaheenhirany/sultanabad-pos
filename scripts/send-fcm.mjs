import process from "node:process";
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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
  const title = (args.title || "POS Update").trim();
  const body = (args.body || "Please open POS app for latest updates.").trim();
  const url = (args.url || "").trim();
  const dryRun = (args.dryRun || "false").toLowerCase() === "true";

  initAdmin();

  const db = getFirestore();
  const snapshot = await db.collection("device_tokens").get();
  const tokens = snapshot.docs
    .map((entry) => String(entry.data()?.token || "").trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    console.log("No device tokens found in device_tokens collection.");
    return;
  }

  const messaging = getMessaging();
  let success = 0;
  let failure = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const result = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: {
        ...(url ? { url } : {})
      },
      android: { priority: "high" }
    }, dryRun);
    success += result.successCount;
    failure += result.failureCount;
  }

  console.log(`Sent push notification. Success: ${success}, Failure: ${failure}, Total: ${tokens.length}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
