import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pool } from "../apps/api/src/db.js";
export async function migrate() {
  const db = await pool.connect();
  try {
    await db.query("SELECT pg_advisory_lock(8765401)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of readdirSync(resolve("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      await db.query("BEGIN");
      try {
        if (
          !(
            await db.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
              name,
            ])
          ).rowCount
        ) {
          await db.query(readFileSync(resolve("migrations", name), "utf8"));
          await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [
            name,
          ]);
        }
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await db.query("SELECT pg_advisory_unlock(8765401)");
    db.release();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  void migrate()
    .then(() => console.log("Database migrations completed."))
    .catch((error) => {
      console.error((error as Error).message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
