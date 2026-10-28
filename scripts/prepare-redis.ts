import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
const version = "8.10.3";
// Pinned archive observed from the official download endpoint; no remote shell execution.
const sha256 =
  "edde778f6bdee7581e42fc139ca9e07e2822212092f7501f99989656e3629d02";
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)),
    );
  });
}
async function main() {
  if (!["darwin", "linux"].includes(process.platform))
    throw new Error(
      "Use Docker Compose or a Redis installation for this platform.",
    );
  mkdirSync(".runtime", { recursive: true });
  const archive = `.runtime/redis-${version}.tar.gz`;
  if (!existsSync(archive)) {
    const response = await fetch(
      `https://download.redis.io/releases/redis-${version}.tar.gz`,
      { redirect: "error" },
    );
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  if (
    createHash("sha256").update(readFileSync(archive)).digest("hex") !== sha256
  )
    throw new Error("Redis archive checksum does not match. Do not build it.");
  await run("tar", ["-xzf", archive, "-C", ".runtime"]);
  await run("make", [
    "-C",
    `.runtime/redis-${version}/src`,
    "-j4",
    "BUILD_TLS=no",
    "MALLOC=libc",
    "redis-server",
    "redis-cli",
  ]);
  console.log(
    "Redis core is ready. Run pnpm infra:redis. Optional Redis modules are not needed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
