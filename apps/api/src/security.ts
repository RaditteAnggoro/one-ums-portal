import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const saved = Buffer.from(hex, "hex");
  const calculated = scryptSync(password, salt, 64);
  return (
    saved.length === calculated.length && timingSafeEqual(saved, calculated)
  );
}
export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function sessionToken() {
  return randomBytes(32).toString("base64url");
}
