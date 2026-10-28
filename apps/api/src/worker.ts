import "reflect-metadata";
import { validateServerEnvironment } from "./config.js";
import { startWorkers } from "./queue.js";
import { startPushWorker } from "./push.js";
import { pool } from "./db.js";
async function main() {
  validateServerEnvironment();
  const close = await startWorkers(),
    closePush = startPushWorker();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await closePush();
    await close();
    await pool.end();
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
void main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
