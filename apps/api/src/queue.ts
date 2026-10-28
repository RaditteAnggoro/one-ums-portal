import { Queue, Worker, DelayedError } from "bullmq";
import { pool, transaction } from "./db.js";
import { schedulerTick } from "./campaigns.js";
import { advanceState } from "../../../packages/domain/src/rules.js";
import type { PoolClient } from "pg";
import { type Actor, audit, scope, scopeValues } from "./context.js";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { runtimeId } from "./runtime.js";
import { releaseUndispatched } from "./budget-release.js";

async function lockedMessage(db: PoolClient, id: string, actor?: Actor) {
  const values = actor ? [...scopeValues(actor), id] : [id];
  const c = (
    await db.query(
      `SELECT c.id,c.status,c.team_id,c.definition->>'mode' AS mode FROM campaigns c JOIN runs r ON r.campaign_id=c.id JOIN messages m ON m.run_id=r.id WHERE m.id=$${actor ? 4 : 1} ${actor ? `AND ${scope(actor, "c")}` : ""} FOR UPDATE OF c`,
      values,
    )
  ).rows[0];
  if (!c) return;
  const m = (
    await db.query(
      "SELECT m.*,r.budget_id,r.campaign_id,r.started_at,r.intended_at,r.worker_session_id,r.status AS run_status,p.enabled AS provider_enabled,d.adapter AS provider_adapter FROM messages m JOIN runs r ON r.id=m.run_id LEFT JOIN provider_account_versions v ON v.id=m.provider_version_id LEFT JOIN provider_accounts p ON p.id=v.account_id LEFT JOIN provider_definitions d ON d.id=v.definition_id WHERE m.id=$1 FOR UPDATE OF r,m",
      [id],
    )
  ).rows[0];
  return {
    ...m,
    campaign_status: c.status,
    campaign_mode: c.mode,
    resource_team_id: c.team_id,
  };
}

async function settleCost(db: PoolClient, m: any, status: string) {
  if (!["DELIVERED", "FAILED"].includes(status)) return;
  const inserted = await db.query(
    "INSERT INTO ledger(company_id,budget_id,run_id,message_id,kind,amount,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id",
    [
      m.company_id,
      m.budget_id,
      m.run_id,
      m.id,
      status === "FAILED" ? "RELEASE" : "SPEND",
      m.unit_cost,
      `settle:${m.id}`,
    ],
  );
  if (inserted.rowCount)
    await db.query(
      "UPDATE budgets SET reserved=reserved-$2::numeric,spent=spent+$3::numeric WHERE id=$1",
      [m.budget_id, m.unit_cost, status === "DELIVERED" ? m.unit_cost : "0"],
    );
}
async function refreshRunStatus(db: PoolClient, runId: string) {
  const result=await db.query(
    `WITH outcome AS MATERIALIZED (SELECT CASE
    WHEN EXISTS(SELECT 1 FROM messages WHERE run_id=$1 AND status IN ('QUEUED','ACCEPTED','SENT')) THEN 'RUNNING'
    WHEN EXISTS(SELECT 1 FROM messages WHERE run_id=$1 AND status IN ('FAILED','UNKNOWN')) THEN 'COMPLETED_WITH_ERRORS'
    ELSE 'COMPLETED' END AS status)
    UPDATE runs SET status=outcome.status,finished_at=CASE WHEN outcome.status='RUNNING' THEN NULL ELSE COALESCE(runs.finished_at,now()) END FROM outcome
    WHERE runs.id=$1 AND runs.status NOT IN ('CANCELLED','PAUSED','RECOVERY_HOLD','VALIDATION_HOLD') RETURNING runs.status`,
    [runId],
  );
  const status=result.rows[0]?.status;
  if(status?.startsWith('COMPLETED'))await db.query(`INSERT INTO notifications(company_id,team_id,title,body,resource_id,event_key)
    SELECT c.company_id,c.team_id,$2,c.name||': '||$3,c.id,'run:'||r.id::text||':'||$4 FROM runs r JOIN campaigns c ON c.id=r.campaign_id WHERE r.id=$1
    ON CONFLICT(event_key) DO NOTHING`,[runId,status==='COMPLETED'?'Eksekusi selesai':'Eksekusi selesai dengan perhatian',status==='COMPLETED'?'semua pesan selesai.':'periksa hasil gagal atau belum terkonfirmasi.',status]);
}

const redis = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:63799");
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
};
let publishing = false;
export async function processMessage(messageId: string) {
  return transaction(async (db) => {
    const m = await lockedMessage(db, messageId);
    if (!m || m.status !== "QUEUED") return;
    if (
      ["PAUSED", "RECOVERY_HOLD", "VALIDATION_HOLD"].includes(m.run_status) ||
      m.campaign_status === "PAUSED"
    )
      return "deferred";
    if (!["APPROVED", "SCHEDULED"].includes(m.campaign_status))
      return "deferred";
    if (
      !m.started_at &&
      m.campaign_mode !== "immediate" &&
      Date.now() - new Date(m.intended_at).getTime() >
        Number(process.env.SCHEDULE_GRACE_SECONDS ?? 60) * 1000
    ) {
      await releaseUndispatched(
        db,
        [m.run_id],
        "Scheduled execution window expired before the first dispatch",
        null,
        "SUPPRESSED",
      );
      await db.query(
        "UPDATE runs SET status='MISSED',finished_at=now() WHERE id=$1",
        [m.run_id],
      );
      await db.query(
        "INSERT INTO notifications(company_id,team_id,title,body,resource_id) VALUES($1,$2,$3,$4,$5)",
        [
          m.company_id,
          m.resource_team_id,
          "Jadwal terlewat",
          "Antrean tidak dapat memulai eksekusi sebelum batas waktunya. Tentukan jadwal baru.",
          m.campaign_id,
        ],
      );
      return;
    }
    if (
      m.provider_version_id &&
      (!m.provider_enabled || m.provider_adapter !== "SIMULATOR")
    ) {
      const held = await db.query(
        "UPDATE runs SET status='VALIDATION_HOLD' WHERE id=$1 AND status IN ('QUEUED','RUNNING') RETURNING id",
        [m.run_id],
      );
      if (held.rowCount)
        await db.query(
          "INSERT INTO notifications(company_id,team_id,title,body,resource_id) VALUES($1,$2,$3,$4,$5)",
          [
            m.company_id,
            m.resource_team_id,
            "Akun penyedia tidak aktif",
            "Aktifkan kembali akun penyedia dan tinjau eksekusi sebelum melanjutkan.",
            m.campaign_id,
          ],
        );
      return "deferred";
    }
    if (!m.started_at || !m.worker_session_id)
      await db.query(
        "UPDATE runs SET started_at=COALESCE(started_at,now()),worker_session_id=COALESCE(worker_session_id,(SELECT id FROM worker_sessions WHERE id=$2)) WHERE id=$1",
        [m.run_id, runtimeId],
      );
    const outcome = ["delivered", "failed", "unknown"].includes(m.demo_outcome)
      ? m.demo_outcome
      : "delivered";
    const status =
      outcome === "failed"
        ? "FAILED"
        : outcome === "unknown"
          ? "UNKNOWN"
          : "DELIVERED";
    const ref = `sim-${messageId}`;
    await db.query(
      "INSERT INTO attempts(company_id,message_id,status,detail) VALUES($1,$2,$3,$4)",
      [
        m.company_id,
        m.id,
        status,
        "Local simulation. No external message sent.",
      ],
    );
    const events =
      outcome === "delivered" ? ["ACCEPTED", "SENT", "DELIVERED"] : [status];
    for (const event of events)
      await db.query(
        "INSERT INTO message_events(company_id,message_id,event_key,status,detail) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_key) DO NOTHING",
        [
          m.company_id,
          m.id,
          `${m.id}:${event}`,
          event,
          "Simulated provider event",
        ],
      );
    await db.query(
      "UPDATE messages SET status=$2,provider_ref=$3,updated_at=now() WHERE id=$1",
      [m.id, status, ref],
    );
    await settleCost(db, m, status);
    await refreshRunStatus(db, m.run_id);
  });
}

// Verified event ingestion boundary; public vendor callbacks need their own signature adapter before exposure.
export async function applyLocalEvent(
  messageId: string,
  eventKey: string,
  incoming: string,
) {
  await transaction(async (db) => {
    const m = await lockedMessage(db, messageId);
    if (!m) return;
    const inserted = await db.query(
      "INSERT INTO message_events(company_id,message_id,event_key,status) VALUES($1,$2,$3,$4) ON CONFLICT(event_key) DO NOTHING RETURNING id",
      [m.company_id, m.id, eventKey, incoming],
    );
    if (inserted.rowCount) {
      const next = advanceState(m.status, incoming);
      await db.query(
        "UPDATE messages SET status=$2,updated_at=now() WHERE id=$1",
        [m.id, next],
      );
      await settleCost(db, m, next);
      await refreshRunStatus(db, m.run_id);
    }
  });
}

export async function reconcileLocalMessage(
  actor: Actor,
  id: string,
  status: "DELIVERED" | "FAILED",
  reason: string,
) {
  return transaction(async (db) => {
    const m = await lockedMessage(db, id, actor);
    if (!m) throw new NotFoundException("Pesan tidak ditemukan.");
    if (m.status !== "UNKNOWN")
      throw new ConflictException(
        "Hanya hasil simulasi yang belum terkonfirmasi dapat direkonsiliasi.",
      );
    await settleCost(db, m, status);
    await db.query(
      "UPDATE messages SET status=$2,updated_at=now() WHERE id=$1",
      [id, status],
    );
    await db.query(
      "INSERT INTO message_events(company_id,message_id,event_key,status,detail) VALUES($1,$2,$3,$4,$5)",
      [
        actor.company_id,
        id,
        `reconcile:${id}`,
        status,
        "Manual simulation reconciliation",
      ],
    );
    await audit(
      db,
      { ...actor, team_id: m.resource_team_id },
      "message.simulation_reconciled",
      "message",
      id,
      {
        previousStatus: "UNKNOWN",
        status,
        reason,
      },
    );
    await refreshRunStatus(db, m.run_id);
    return { ok: true };
  });
}

export async function recoverInterruptedRuns() {
  await transaction(async (db) => {
    const runs = (
      await db.query(`UPDATE runs r SET status='RECOVERY_HOLD' WHERE status IN ('QUEUED','RUNNING') AND (
      (r.worker_session_id IS NULL AND r.created_at<now()-interval '30 seconds') OR
      EXISTS(SELECT 1 FROM worker_sessions w WHERE w.id=r.worker_session_id AND w.last_seen<now()-interval '30 seconds')) RETURNING r.*`)
    ).rows;
    for (const run of runs) {
      const c = (
        await db.query("SELECT * FROM campaigns WHERE id=$1", [run.campaign_id])
      ).rows[0];
      const missed =
        !run.started_at &&
        c.definition.mode !== "immediate" &&
        Date.now() - new Date(run.intended_at).getTime() >
          Number(process.env.SCHEDULE_GRACE_SECONDS ?? 60) * 1000;
      if (missed) {
        await releaseUndispatched(
          db,
          [run.id],
          "Expired unstarted schedule discovered during restart",
          null,
          "SUPPRESSED",
        );
        await db.query(
          "UPDATE runs SET status='MISSED',finished_at=now() WHERE id=$1",
          [run.id],
        );
      }
      await db.query(
        "INSERT INTO notifications(company_id,team_id,title,body,resource_id) VALUES($1,$2,$3,$4,$5)",
        [
          c.company_id,
          c.team_id,
          missed ? "Jadwal terlewat" : "Pemulihan eksekusi diperlukan",
          missed
            ? `${c.name}: tidak dimulai sebelum batas waktu. Jadwalkan ulang secara eksplisit.`
            : `${c.name}: eksekusi terputus. Tinjau sisa pesan sebelum melanjutkan.`,
          c.id,
        ],
      );
      await db.query(
        "INSERT INTO audit(company_id,team_id,action,resource_type,resource_id,detail) VALUES($1,$2,$5,'run',$3,$4)",
        [
          c.company_id,
          c.team_id,
          run.id,
          JSON.stringify({
            system: true,
            previousWorker: run.worker_session_id,
          }),
          missed ? "run.missed" : "run.recovery_required",
        ],
      );
    }
  });
}
export async function startWorkers() {
  await pool.query(
    "INSERT INTO worker_sessions(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET last_seen=now()",
    [runtimeId],
  );
  await recoverInterruptedRuns();
  const queue = new Queue("local-delivery", { connection });
  const worker = new Worker(
    "local-delivery",
    async (job, token) => {
      if ((await processMessage(job.data.messageId)) === "deferred") {
        await job.moveToDelayed(Date.now() + 3000, token);
        throw new DelayedError();
      }
    },
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) },
  );
  let lastError = 0;
  const onError = (error: Error) => {
    if (Date.now() - lastError > 30000) {
      console.error("Queue unavailable:", error.message);
      lastError = Date.now();
    }
  };
  queue.on("error", onError);
  worker.on("error", onError);
  const publish = async () => {
    if (publishing) return;
    publishing = true;
    try {
      await transaction(async (db) => {
        const records = (
          await db.query(
            "SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 200 FOR UPDATE SKIP LOCKED",
          )
        ).rows;
        if (!records.length) return;
        await queue.addBulk(
          records.map((row) => ({
            name: "send",
            data: { messageId: row.message_id },
            opts: {
              jobId: row.id,
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: { count: 10000 },
              removeOnFail: { count: 10000 },
            },
          })),
        );
        await db.query(
          "UPDATE outbox SET published_at=now() WHERE id=ANY($1::uuid[])",
          [records.map((r) => r.id)],
        );
      });
    } catch (error) {
      onError(error as Error);
    } finally {
      publishing = false;
    }
  };
  const publishTimer = setInterval(() => void publish(), 500);
  const scheduleTimer = setInterval(
    () =>
      void (async () => {
        await recoverInterruptedRuns();
        await pool.query(
          "UPDATE worker_sessions SET last_seen=now() WHERE id=$1",
          [runtimeId],
        );
        await schedulerTick();
      })().catch(onError),
    5000,
  );
  void publish();
  void schedulerTick().catch(onError);
  return async () => {
    clearInterval(publishTimer);
    clearInterval(scheduleTimer);
    await worker.close();
    await queue.close();
    await pool.query(
      "UPDATE worker_sessions SET last_seen=now()-interval '1 minute' WHERE id=$1",
      [runtimeId],
    );
  };
}
