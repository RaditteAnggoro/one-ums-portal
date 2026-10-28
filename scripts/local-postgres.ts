import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const directory = resolve(".data/postgres");
  const postgres = new EmbeddedPostgres({
    databaseDir: directory,
    user: "messaging",
    password: "local-development-only",
    port: 54329,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: (message) => console.error(String(message)),
  });
  if (!existsSync(resolve(directory, "PG_VERSION")))
    await postgres.initialise();
  await postgres.start();
  const db = postgres.getPgClient();
  await db.connect();
  const exists = await db.query(
    "SELECT 1 FROM pg_database WHERE datname='messaging'",
  );
  if (!exists.rowCount) await postgres.createDatabase("messaging");
  await db.end();
  console.log(
    "PostgreSQL ready on 127.0.0.1:54329. Keep this process running.",
  );
  const stop = async () => {
    await postgres.stop();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  setInterval(() => {}, 60_000);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
