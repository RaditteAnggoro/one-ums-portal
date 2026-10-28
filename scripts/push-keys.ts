import webpush from "web-push";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const file = resolve(process.env.PUSH_KEYS_FILE ?? ".data/secrets/webpush.env");
if (existsSync(file))
  throw new Error(
    "Key file exists. Reuse existing keys; do not rotate without resubscribing devices.",
  );
mkdirSync(resolve(file, ".."), { recursive: true, mode: 0o700 });
const keys = webpush.generateVAPIDKeys();
writeFileSync(
  file,
  `PUSH_ENABLED=true\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:replace-with-your-operator-email@example.com\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Web Push keys written to the selected private file. Set VAPID_SUBJECT before loading this file on the server. Keep the private key out of Git.",
);
