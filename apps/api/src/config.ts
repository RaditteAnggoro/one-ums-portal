export function validateServerEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  for (const name of [
    "DATABASE_URL",
    "REDIS_URL",
    "APP_ORIGIN",
    "APP_ENCRYPTION_KEY",
  ])
    if (!process.env[name])
      throw new Error(`${name} is required in production.`);
  if (Buffer.from(process.env.APP_ENCRYPTION_KEY!, "base64").length !== 32)
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
  const origins = process.env.APP_ORIGIN!.split(",").map((v) => v.trim());
  if (
    origins.some((value) => {
      try {
        return new URL(value).protocol !== "https:";
      } catch {
        return true;
      }
    })
  )
    throw new Error("APP_ORIGIN requires HTTPS origins in production.");
  if (process.env.COOKIE_SECURE === "false")
    throw new Error("Production session cookies require COOKIE_SECURE=true.");
}
