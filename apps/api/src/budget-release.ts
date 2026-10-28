import type { PoolClient } from "pg";

// Callers lock the run (and campaign for operator actions) before changing undispatched work.
export async function releaseUndispatched(
  db: PoolClient,
  runIds: string[],
  reason: string,
  actorId: string | null = null,
  status: "CANCELLED" | "SUPPRESSED" = "CANCELLED",
) {
  if (!runIds.length) return;
  const released = (
    await db.query(
      `WITH cancelled AS (
    UPDATE messages m SET status=$4,updated_at=now() FROM runs r WHERE m.run_id=r.id AND r.id=ANY($1::uuid[]) AND m.status='QUEUED' RETURNING m.*,r.budget_id
  ), events AS (
    INSERT INTO message_events(company_id,message_id,event_key,status,detail) SELECT company_id,id,'release:'||id::text,$4,$2 FROM cancelled ON CONFLICT(event_key) DO NOTHING
  ), entries AS (
    INSERT INTO ledger(company_id,budget_id,run_id,message_id,kind,amount,idempotency_key,reason,actor_id)
    SELECT company_id,budget_id,run_id,id,'RELEASE',unit_cost,'settle:'||id::text,$2,$3 FROM cancelled ON CONFLICT(idempotency_key) DO NOTHING RETURNING budget_id,amount
  ) SELECT budget_id,sum(amount) AS amount FROM entries GROUP BY budget_id`,
      [runIds, reason, actorId, status],
    )
  ).rows;
  for (const entry of released)
    await db.query(
      "UPDATE budgets SET reserved=reserved-$2::numeric WHERE id=$1",
      [entry.budget_id, entry.amount],
    );
}
