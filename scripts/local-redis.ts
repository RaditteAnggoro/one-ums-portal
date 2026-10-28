import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const bundled = resolve(".runtime/redis-8.10.3/src/redis-server");
const binary =
  process.env.REDIS_BINARY ?? (existsSync(bundled) ? bundled : "redis-server");
mkdirSync(".data/redis", { recursive: true });
const child = spawn(
  binary,
  [
    "--bind",
    "127.0.0.1",
    "--port",
    "63799",
    "--appendonly",
    "yes",
    "--appendfsync",
    "everysec",
    "--maxmemory",
    "256mb",
    "--maxmemory-policy",
    "noeviction",
    "--dir",
    resolve(".data/redis"),
  ],
  { stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(
    `Redis could not start: ${error.message}. Install Redis, set REDIS_BINARY, or run pnpm infra:prepare-redis.`,
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
