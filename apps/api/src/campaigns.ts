import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import type { PoolClient } from "pg";
import { DateTime, IANAZone } from "luxon";
import { Decimal } from "decimal.js";
import { runtimeId } from "./runtime.js";
import { providerPrice } from "./providers.js";
import { releaseUndispatched } from "./budget-release.js";
import { transaction } from "./db.js";
import {
  type Actor,
  audit,
  campaignFor,
  scope,
  scopeValues,
} from "./context.js";
import {
  destination,
  render,
  billableUnits,
  demoRates,
  type Channel,
  type DataRow,
} from "../../../packages/domain/src/rules.js";

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  templateIds: z.array(z.uuid()).min(1).max(3),
  datasetId: z.uuid(),
  providerAccountId: z.uuid().optional(),
  costCentreId: z.uuid(),
  spendingCeiling: z.string().regex(/^\d{1,12}(\.\d{1,4})?$/),
  mode: z.enum(["immediate", "once", "recurring"]),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().default("Asia/Jakarta"),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().int().min(1).max(12),
      count: z.number().int().min(1).max(1000),
    })
    .optional(),
  fieldMap: z.record(z.string(), z.string()).default({}),
});
export type Definition = z.infer<typeof schema>;
type Snapshot = {
  recipient: string;
  channel: Channel;
  body: string;
  cost: string;
  outcome: string;
  accountVersionId?: string;
  rateId?: string;
}[];
type Stage = { name: string; roleIds: string[] }[];
function parseDefinition(input: unknown) {
  const definition = schema.parse(input);
  if (!IANAZone.isValidZone(definition.timeZone))
    throw new BadRequestException("Zona waktu tidak valid.");
  if (definition.mode !== "immediate" && !definition.scheduledAt)
    throw new BadRequestException("Waktu jadwal wajib diisi.");
  if (definition.mode === "recurring" && !definition.recurrence)
    throw new BadRequestException("Pola pengulangan wajib diisi.");
  return definition;
}
export async function createCampaign(actor: Actor, input: unknown) {
  const definition = parseDefinition(input);
  return transaction(async (db) => {
    await makeSnapshot(db, actor, definition);
    const campaign = (
      await db.query(
        "INSERT INTO campaigns(company_id,team_id,created_by,name,definition) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          actor.company_id,
          actor.team_id,
          actor.id,
          definition.name,
          JSON.stringify(definition),
        ],
      )
    ).rows[0];
    await audit(db, actor, "campaign.created", "campaign", campaign.id, {
      version: 1,
    });
    return campaign;
  });
}

async function makeSnapshot(
  db: PoolClient,
  actor: Actor,
  d: Definition,
  targetTeam = actor.team_id,
): Promise<Snapshot> {
  const dataset = (
    await db.query(`SELECT * FROM datasets WHERE ${scope(actor)} AND id=$4`, [
      ...scopeValues(actor),
      d.datasetId,
    ])
  ).rows[0];
  const templates = (
    await db.query(
      `SELECT * FROM templates WHERE ${scope(actor)} AND id=ANY($4::uuid[])`,
      [...scopeValues(actor), d.templateIds],
    )
  ).rows;
  const centre = (
    await db.query(
      `SELECT * FROM cost_centres WHERE ${scope(actor)} AND id=$4`,
      [...scopeValues(actor), d.costCentreId],
    )
  ).rows[0];
  if (!dataset || !centre || templates.length !== new Set(d.templateIds).size)
    throw new NotFoundException(
      "Sumber, template, atau pusat biaya tidak tersedia.",
    );
  if ([dataset, ...templates, centre].some((x) => x.team_id !== targetTeam))
    throw new BadRequestException(
      "Pilih sumber, template, dan pusat biaya dari tim aktif Anda.",
    );
  if (new Set(templates.map((t) => t.channel)).size !== templates.length)
    throw new BadRequestException("Pilih satu template per kanal.");
  const max = Number(process.env.MAX_SNAPSHOT_MESSAGES ?? 50000);
  if (dataset.rows.length * templates.length > max)
    throw new BadRequestException(
      `Batas sumber daya lokal saat ini ${max} pesan. Administrator dapat menyesuaikannya setelah mengukur kapasitas.`,
    );
  const snapshot: Snapshot = [];
  let snapshotBytes = 0;
  const byteLimit = Number(process.env.MAX_SNAPSHOT_BYTES ?? 33554432);
  const prices = new Map<Channel, Awaited<ReturnType<typeof providerPrice>>>();
  if (d.providerAccountId)
    for (const template of templates)
      prices.set(
        template.channel,
        await providerPrice(
          db,
          actor.company_id,
          d.providerAccountId,
          template.channel,
        ),
      );
  const seen = new Set<string>();
  for (const original of dataset.rows as DataRow[])
    for (const t of templates) {
      const row = { ...original };
      for (const [key, column] of Object.entries(d.fieldMap))
        row[key] = original[column];
      const channel = t.channel as Channel;
      let recipient: string;
      let body: string;
      try {
        recipient = destination(
          channel,
          original[channel === "email" ? "email" : "phone"] ?? "",
        );
        body = render(t.body, row);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
      if (
        Buffer.byteLength(body, "utf8") >
        Number(process.env.MAX_RENDERED_MESSAGE_BYTES ?? 262144)
      )
        throw new BadRequestException(
          "Isi pesan hasil penggabungan melampaui batas sumber daya lokal.",
        );
      const key = `${channel}:${recipient}`;
      if (seen.has(key))
        throw new BadRequestException(`Penerima duplikat: ${recipient}`);
      seen.add(key);
      const message: Snapshot[number] = {
        recipient,
        channel,
        body,
        cost: new Decimal(prices.get(channel)?.price ?? demoRates[channel])
          .times(billableUnits(channel, body))
          .toFixed(4),
        outcome: original.demo_outcome ?? "delivered",
        accountVersionId: prices.get(channel)?.versionId,
        rateId: prices.get(channel)?.rateId,
      };
      snapshotBytes += Buffer.byteLength(JSON.stringify(message), "utf8");
      if (snapshotBytes > byteLimit)
        throw new BadRequestException(
          "Ukuran total pesan melampaui kapasitas snapshot lokal. Bagi kampanye atau sesuaikan kapasitas setelah pengukuran.",
        );
      snapshot.push(message);
    }
  if (!snapshot.length) throw new BadRequestException("Sumber data kosong.");
  const total = snapshot.reduce((s, m) => s.plus(m.cost), new Decimal(0));
  if (total.gt(d.spendingCeiling))
    throw new BadRequestException(
      `Estimasi Rp ${total.toFixed(0)} melampaui batas yang akan disetujui.`,
    );
  return snapshot;
}

export async function submitCampaign(actor: Actor, id: string) {
  return transaction(async (db) => {
    const c = await campaignFor(db, actor, id, true);
    if (c.status !== "DRAFT")
      throw new ConflictException("Hanya draf yang dapat diajukan.");
    const snapshot = await makeSnapshot(db, actor, c.definition, c.team_id);
    const policy = (
      await db.query("SELECT * FROM approval_policies WHERE company_id=$1", [
        actor.company_id,
      ])
    ).rows[0];
    if (!policy?.stages?.length)
      throw new BadRequestException(
        "Administrator perlu mengatur persetujuan.",
      );
    await db.query(
      "UPDATE campaigns SET status='PENDING_APPROVAL',snapshot=$2,approval_policy=$3,updated_at=now() WHERE id=$1",
      [id, JSON.stringify(snapshot), JSON.stringify(policy)],
    );
    await db.query(
      "INSERT INTO campaign_versions(company_id,campaign_id,version,definition,snapshot,approval_policy,submitted_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        actor.company_id,
        id,
        c.version,
        JSON.stringify(c.definition),
        JSON.stringify(snapshot),
        JSON.stringify(policy),
        actor.id,
      ],
    );
    await notify(
      db,
      c,
      "Persetujuan diperlukan",
      `Kampanye ${c.name} menunggu persetujuan tingkat pertama.`,
    );
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      "campaign.submitted",
      "campaign",
      id,
      {
        version: c.version,
        messages: snapshot.length,
        policyVersion: policy.version,
      },
    );
    return { status: "PENDING_APPROVAL" };
  });
}
export async function decideCampaign(actor: Actor, id: string, input: unknown) {
  const value = z
    .object({
      decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
      version: z.number().int().positive(),
      stage: z.number().int().min(0),
      reason: z.string().trim().max(1000).default(""),
    })
    .parse(input);
  return transaction(async (db) => {
    const c = await campaignFor(db, actor, id, true);
    if (c.status !== "PENDING_APPROVAL")
      throw new ConflictException(
        "Kampanye tidak sedang menunggu persetujuan.",
      );
    if (c.version !== value.version || c.approval_stage !== value.stage)
      throw new ConflictException(
        "Versi atau tingkat persetujuan sudah berubah. Muat ulang dan tinjau kembali.",
      );
    if (c.created_by === actor.id || c.revised_by === actor.id)
      throw new ForbiddenException(
        "Pembuat tidak dapat menyetujui kampanyenya sendiri.",
      );
    const stages = c.approval_policy.stages as Stage;
    if (!stages[c.approval_stage]?.roleIds.includes(actor.role_id))
      throw new ForbiddenException(
        "Peran Anda tidak sesuai dengan tingkat persetujuan saat ini.",
      );
    if (value.decision !== "APPROVE" && !value.reason)
      throw new BadRequestException("Alasan wajib diisi.");
    await db.query(
      "INSERT INTO approvals(company_id,campaign_id,version,stage,actor_id,decision,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        actor.company_id,
        id,
        c.version,
        c.approval_stage,
        actor.id,
        value.decision,
        value.reason,
      ],
    );
    const stage = c.approval_stage + 1;
    let status =
      value.decision === "REJECT"
        ? "REJECTED"
        : value.decision === "RETURN"
          ? "RETURNED"
          : stage < stages.length
            ? "PENDING_APPROVAL"
            : "APPROVED";
    await db.query(
      "UPDATE campaigns SET status=$2,approval_stage=$3,updated_at=now() WHERE id=$1",
      [id, status, stage],
    );
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      `approval.${value.decision.toLowerCase()}`,
      "campaign",
      id,
      { stage: c.approval_stage + 1, version: c.version, reason: value.reason },
    );
    if (status === "APPROVED" && c.definition.mode === "immediate")
      await createRun(db, { ...c, status }, new Date());
    else if (status === "APPROVED")
      await db.query("UPDATE campaigns SET status='SCHEDULED' WHERE id=$1", [
        id,
      ]);
    await notify(
      db,
      c,
      status === "APPROVED" ? "Kampanye disetujui" : "Persetujuan diperbarui",
      `${c.name}: ${status}.`,
    );
    return { status };
  });
}
async function notify(
  db: PoolClient,
  c: { company_id: string; team_id: string; id: string },
  title: string,
  body: string,
  category = "campaign",
) {
  await db.query(
    "INSERT INTO notifications(company_id,team_id,title,body,resource_id,category) VALUES($1,$2,$3,$4,$5,$6)",
    [c.company_id, c.team_id, title, body, c.id, category],
  );
}

export async function createRun(
  db: PoolClient,
  c: any,
  intended: Date,
  explicitKey?: string,
) {
  const company = (
    await db.query(
      "SELECT maintenance_enabled FROM companies WHERE id=$1 FOR SHARE",
      [c.company_id],
    )
  ).rows[0];
  if (company?.maintenance_enabled) return;

  const key = explicitKey ?? `${c.id}-v${c.version}-${intended.toISOString()}`;
  const created = await db.query(
    "INSERT INTO runs(company_id,campaign_id,version,occurrence_key,intended_at,status) VALUES($1,$2,$3,$4,$5,'PREFLIGHT') ON CONFLICT(occurrence_key) DO NOTHING RETURNING *",
    [c.company_id, c.id, c.version, key, intended],
  );
  if (!created.rows[0]) return;
  const run = created.rows[0];
  const grace = Number(process.env.SCHEDULE_GRACE_SECONDS ?? 60) * 1000;
  if (
    c.definition.mode !== "immediate" &&
    Date.now() - intended.getTime() > grace
  ) {
    await db.query("UPDATE runs SET status='MISSED' WHERE id=$1", [run.id]);
    await notify(
      db,
      c,
      "Jadwal terlewat",
      `${c.name} tidak dikirim. Tentukan jadwal baru secara eksplisit.`,
    );
    return run.id;
  }
  await preflight(db, c, run.id);
  return run.id;
}
export async function preflight(db: PoolClient, c: any, runId: string) {
  if (
    (
      await db.query(
        "SELECT maintenance_enabled FROM companies WHERE id=$1 FOR SHARE",
        [c.company_id],
      )
    ).rows[0]?.maintenance_enabled
  )
    throw new ConflictException("Perusahaan sedang dalam pemeliharaan.");

  if (!["APPROVED", "SCHEDULED"].includes(c.status))
    throw new ConflictException(
      "Kampanye harus aktif dan disetujui sebelum eksekusi.",
    );
  let snapshot = c.snapshot as Snapshot;
  if (c.definition.providerAccountId) {
    try {
      const prices = new Map<
        Channel,
        Awaited<ReturnType<typeof providerPrice>>
      >();
      for (const channel of new Set(snapshot.map((m) => m.channel)))
        prices.set(
          channel,
          await providerPrice(
            db,
            c.company_id,
            c.definition.providerAccountId,
            channel,
          ),
        );
      snapshot = snapshot.map((m) => ({
        ...m,
        rateId: prices.get(m.channel)!.rateId,
        cost: new Decimal(prices.get(m.channel)!.price)
          .times(billableUnits(m.channel, m.body))
          .toFixed(4),
      }));
    } catch (error) {
      await db.query("UPDATE runs SET status='VALIDATION_HOLD' WHERE id=$1", [
        runId,
      ]);
      await notify(
        db,
        c,
        "Konfigurasi penyedia memerlukan tindakan",
        (error as Error).message,
      );
      return;
    }
  }
  const amount = snapshot
    .reduce((sum, m) => sum.plus(m.cost), new Decimal(0))
    .toFixed(4);
  if (new Decimal(amount).gt(c.definition.spendingCeiling)) {
    await db.query(
      "UPDATE runs SET status='VALIDATION_HOLD',estimated=$2 WHERE id=$1",
      [runId, amount],
    );
    await notify(
      db,
      c,
      "Tarif melampaui batas disetujui",
      "Revisi batas biaya dan ajukan persetujuan baru sebelum menjalankan kampanye.",
    );
    return;
  }
  const budget = (
    await db.query(
      `UPDATE budgets b SET reserved=reserved+$3::numeric FROM cost_centres cc
    WHERE b.cost_centre_id=cc.id AND b.company_id=$1 AND cc.company_id=$1 AND cc.id=$2
    AND b.starts_on<=(now() AT TIME ZONE 'Asia/Jakarta')::date AND b.ends_on>(now() AT TIME ZONE 'Asia/Jakarta')::date
    AND b.allocated+b.adjusted-b.reserved-b.spent >= $3::numeric RETURNING b.*`,
      [c.company_id, c.definition.costCentreId, amount],
    )
  ).rows[0];
  if (!budget) {
    await db.query(
      "UPDATE runs SET status='BUDGET_HOLD',estimated=$2 WHERE id=$1",
      [runId, amount],
    );
    await notify(
      db,
      c,
      "Anggaran tidak mencukupi",
      `${c.name} memerlukan Rp ${new Decimal(amount).toFixed(0)}. Tambah alokasi atau hentikan kampanye.`,
      "budget",
    );
    return;
  }
  await db.query(
    "UPDATE runs SET budget_id=$2,estimated=$3,status='QUEUED',worker_session_id=(SELECT id FROM worker_sessions WHERE id=$4) WHERE id=$1",
    [runId, budget.id, amount, runtimeId],
  );
  await db.query(
    "INSERT INTO ledger(company_id,budget_id,run_id,kind,amount,idempotency_key) VALUES($1,$2,$3,'RESERVE',$4,$5)",
    [c.company_id, budget.id, runId, amount, `reserve:${runId}`],
  );
  // One set-based insert keeps the 10k reference workload bounded and avoids one query per recipient.
  await db.query(
    `WITH inserted AS (INSERT INTO messages(company_id,run_id,recipient,channel,body,unit_cost,demo_outcome,provider_version_id,rate_id)
    SELECT $1,$2,x.recipient,x.channel,x.body,x.cost::numeric,x.outcome,x."accountVersionId"::uuid,x."rateId"::uuid FROM jsonb_to_recordset($3::jsonb)
    AS x(recipient text,channel text,body text,cost text,outcome text,"accountVersionId" text,"rateId" text) RETURNING id)
    INSERT INTO outbox(message_id) SELECT id FROM inserted`,
    [c.company_id, runId, JSON.stringify(snapshot)],
  );
}

export async function reviseCampaign(actor: Actor, id: string, input: unknown) {
  const definition = parseDefinition(input);
  return transaction(async (db) => {
    const c = await campaignFor(db, actor, id, true);
    if (
      ![
        "DRAFT",
        "RETURNED",
        "REJECTED",
        "APPROVED",
        "SCHEDULED",
        "PAUSED",
      ].includes(c.status)
    )
      throw new ConflictException(
        "Selesaikan atau kembalikan persetujuan sebelum revisi.",
      );
    const active = await db.query(
      "SELECT 1 FROM runs WHERE campaign_id=$1 AND (status IN ('PREFLIGHT','QUEUED','RUNNING','BUDGET_HOLD','PAUSED','RECOVERY_HOLD') OR (status='VALIDATION_HOLD' AND budget_id IS NOT NULL))",
      [id],
    );
    if (active.rowCount)
      throw new ConflictException(
        "Selesaikan eksekusi aktif atau batalkan eksekusi tertahan sebelum merevisi.",
      );
    await makeSnapshot(db, actor, definition, c.team_id);
    const version = c.status === "DRAFT" ? c.version : c.version + 1;
    await db.query(
      "UPDATE runs SET status='CANCELLED' WHERE campaign_id=$1 AND status='PLANNED'",
      [id],
    );
    await db.query(
      "UPDATE campaigns SET name=$2,definition=$3,version=$4,status='DRAFT',snapshot=NULL,approval_policy=NULL,approval_stage=0,revised_by=$5,updated_at=now() WHERE id=$1",
      [id, definition.name, JSON.stringify(definition), version, actor.id],
    );
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      "campaign.revised",
      "campaign",
      id,
      {
        previousVersion: c.version,
        newVersion: version,
        reapprovalRequired: true,
      },
    );
    return { id, version, status: "DRAFT" };
  });
}

export async function runAction(
  actor: Actor,
  id: string,
  action: "retry" | "reschedule" | "cancel",
  date?: string,
) {
  return transaction(async (db) => {
    const run = (
      await db.query(
        `SELECT r.* FROM runs r JOIN campaigns c ON c.id=r.campaign_id WHERE ${scope(actor, "c")} AND r.id=$4`,
        [...scopeValues(actor), id],
      )
    ).rows[0];
    if (!run) throw new NotFoundException("Eksekusi tidak ditemukan.");
    const c = await campaignFor(db, actor, run.campaign_id, true);
    Object.assign(
      run,
      (await db.query("SELECT * FROM runs WHERE id=$1 FOR UPDATE", [id]))
        .rows[0],
    );
    if (run.version !== c.version)
      throw new ConflictException(
        "Eksekusi menggunakan versi lama. Gunakan kampanye dengan versi yang telah disetujui.",
      );
    if (action === "retry") {
      if (run.status !== "BUDGET_HOLD")
        throw new ConflictException(
          "Hanya eksekusi tertahan anggaran yang dapat diperiksa ulang.",
        );
      if (
        c.definition.mode !== "immediate" &&
        Date.now() - new Date(run.intended_at).getTime() > 60000
      )
        throw new ConflictException(
          "Jadwal telah lewat. Pilih jadwalkan ulang.",
        );
      await preflight(db, c, id);
    } else if (action === "reschedule") {
      if (!["MISSED", "BUDGET_HOLD"].includes(run.status))
        throw new ConflictException(
          "Eksekusi ini tidak dapat dijadwalkan ulang.",
        );
      const at = new Date(date ?? "");
      if (!Number.isFinite(+at) || +at < Date.now() + 1000)
        throw new BadRequestException("Pilih waktu di masa depan.");
      await db.query("UPDATE runs SET status='RESCHEDULED' WHERE id=$1", [id]);
      await db.query(
        "INSERT INTO runs(company_id,campaign_id,version,occurrence_key,intended_at,status) VALUES($1,$2,$3,$4,$5,'PLANNED')",
        [c.company_id, c.id, c.version, `${id}-reschedule`, at],
      );
    } else {
      if (!["BUDGET_HOLD", "MISSED", "PLANNED"].includes(run.status))
        throw new ConflictException(
          "Pembatalan pekerjaan yang telah masuk antrean belum tersedia.",
        );
      await db.query("UPDATE runs SET status='CANCELLED' WHERE id=$1", [id]);
    }
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      `run.${action}`,
      "run",
      id,
      date ? { intendedAt: date } : {},
    );
    return { ok: true };
  });
}

export async function campaignAction(
  actor: Actor,
  id: string,
  action: "pause" | "resume" | "cancel",
  reason: string,
) {
  return transaction(async (db) => {
    const c = await campaignFor(db, actor, id, true);
    if (action === "pause") {
      if (!["APPROVED", "SCHEDULED"].includes(c.status))
        throw new ConflictException("Hanya kampanye aktif yang dapat dijeda.");
      await db.query(
        "UPDATE campaigns SET status='PAUSED',updated_at=now() WHERE id=$1",
        [id],
      );
      await db.query(
        "UPDATE runs SET status='PAUSED' WHERE campaign_id=$1 AND status IN ('QUEUED','RUNNING')",
        [id],
      );
    } else if (action === "resume") {
      if (c.status !== "PAUSED")
        throw new ConflictException("Kampanye tidak sedang dijeda.");
      await db.query(
        "UPDATE campaigns SET status=$2,updated_at=now() WHERE id=$1",
        [id, c.definition.mode === "immediate" ? "APPROVED" : "SCHEDULED"],
      );
      await db.query(
        `WITH resumed AS (UPDATE runs SET status='QUEUED',worker_session_id=(SELECT id FROM worker_sessions WHERE id=$2)
        WHERE campaign_id=$1 AND status='PAUSED' RETURNING id)
        INSERT INTO outbox(message_id) SELECT m.id FROM messages m JOIN resumed r ON r.id=m.run_id WHERE m.status='QUEUED'`,
        [id, runtimeId],
      );
    } else {
      if (c.status === "CANCELLED") return { ok: true };
      const runIds = (
        await db.query("SELECT id FROM runs WHERE campaign_id=$1 FOR UPDATE", [
          id,
        ])
      ).rows.map((r) => r.id);
      await releaseUndispatched(db, runIds, reason, actor.id);
      await db.query(
        "UPDATE campaigns SET status='CANCELLED',updated_at=now() WHERE id=$1",
        [id],
      );
      await db.query(
        "UPDATE runs SET status='CANCELLED' WHERE campaign_id=$1 AND status IN ('QUEUED','RUNNING','PAUSED','RECOVERY_HOLD','BUDGET_HOLD','VALIDATION_HOLD','PLANNED')",
        [id],
      );
    }
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      `campaign.${action}`,
      "campaign",
      id,
      { reason, version: c.version },
    );
    return { ok: true };
  });
}

export async function recoverRun(actor: Actor, id: string, reason: string) {
  return transaction(async (db) => {
    const row = (
      await db.query(
        `SELECT r.campaign_id FROM runs r JOIN campaigns c ON c.id=r.campaign_id WHERE ${scope(actor, "c")} AND r.id=$4`,
        [...scopeValues(actor), id],
      )
    ).rows[0];
    if (!row) throw new NotFoundException();
    const c = await campaignFor(db, actor, row.campaign_id, true);
    const run = (
      await db.query("SELECT * FROM runs WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (
      !["RECOVERY_HOLD", "VALIDATION_HOLD"].includes(run.status) ||
      !run.budget_id ||
      run.version !== c.version ||
      !["APPROVED", "SCHEDULED"].includes(c.status)
    )
      throw new ConflictException(
        "Eksekusi tidak tertahan pemulihan atau kampanye belum aktif.",
      );
    if (c.definition.providerAccountId)
      for (const channel of new Set(
        (c.snapshot as Snapshot).map((m) => m.channel),
      ))
        await providerPrice(
          db,
          c.company_id,
          c.definition.providerAccountId,
          channel,
        );
    await db.query(
      "UPDATE runs SET status='QUEUED',worker_session_id=(SELECT id FROM worker_sessions WHERE id=$2) WHERE id=$1",
      [id, runtimeId],
    );
    // A fresh outbox identity can recreate work after queue data loss; the logical message is unchanged and checked atomically.
    await db.query(
      "INSERT INTO outbox(message_id) SELECT id FROM messages WHERE run_id=$1 AND status='QUEUED'",
      [id],
    );
    await audit(
      db,
      { ...actor, team_id: c.team_id },
      "run.recovery_approved",
      "run",
      id,
      { reason },
    );
    return { ok: true };
  });
}

export async function schedulerTick() {
  await transaction(async (db) => {
    if (
      !(await db.query("SELECT pg_try_advisory_xact_lock(8765410) AS locked"))
        .rows[0].locked
    )
      return;
    const campaigns = (
      await db.query(
        "SELECT c.* FROM campaigns c JOIN companies co ON co.id=c.company_id WHERE c.status='SCHEDULED' AND NOT co.maintenance_enabled FOR UPDATE OF c",
      )
    ).rows;
    for (const c of campaigns) {
      const d = c.definition as Definition;
      const start = DateTime.fromISO(d.scheduledAt!, { setZone: true }).setZone(
        d.timeZone,
      );
      const count = d.mode === "recurring" ? d.recurrence!.count : 1;
      for (let i = 0; i < count; i++) {
        const freq = d.recurrence?.frequency;
        const step = i * (d.recurrence?.interval ?? 1);
        const at = start.plus(
          freq === "monthly"
            ? { months: step }
            : freq === "weekly"
              ? { weeks: step }
              : { days: step },
        );
        if (at.toMillis() > Date.now()) break;
        if (freq === "monthly" && at.day !== start.day) continue;
        await createRun(db, c, at.toJSDate());
      }
    }
    const planned = (
      await db.query(
        "SELECT r.* FROM runs r JOIN companies co ON co.id=r.company_id WHERE r.status='PLANNED' AND r.intended_at<=now() AND NOT co.maintenance_enabled FOR UPDATE OF r",
      )
    ).rows;
    for (const run of planned) {
      if (Date.now() - new Date(run.intended_at).getTime() > 60000) {
        await db.query("UPDATE runs SET status='MISSED' WHERE id=$1", [run.id]);
        continue;
      }
      const c = (
        await db.query("SELECT * FROM campaigns WHERE id=$1", [run.campaign_id])
      ).rows[0];
      if (["APPROVED", "SCHEDULED"].includes(c.status))
        await preflight(db, c, run.id);
    }
  });
}
