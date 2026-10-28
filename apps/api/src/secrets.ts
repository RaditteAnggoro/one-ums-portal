import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
let cached: Buffer | undefined;
function masterKey() {
  if (cached) return cached;
  if (process.env.APP_ENCRYPTION_KEY) {
    cached = Buffer.from(process.env.APP_ENCRYPTION_KEY, "base64");
  } else {
    const dir = resolve(".data/secrets");
    const path = resolve(dir, "master.key");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!existsSync(path)) {
      try {
        writeFileSync(path, randomBytes(32), { flag: "wx", mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    cached = readFileSync(path);
  }
  if (cached.length !== 32)
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
  return cached;
}
export function encryptSecret(value: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptSecret(value: string | null): Record<string, string> {
  if (!value) return {};
  const [iv, tag, data] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8"),
  );
}
