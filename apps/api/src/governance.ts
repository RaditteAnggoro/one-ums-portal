import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  HttpException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { pool, transaction } from "./db.js";
import { actorFor, audit, scope, scopeValues } from "./context.js";
const status = z.enum(["PLANNED", "DEPLOYED", "ROLLED_BACK"]);
const releaseSchema = z.object({
  version: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(160),
  environment: z.enum(["production", "staging", "development"]),
  deployedAt: z.iso.datetime({ offset: true }),
  status: status.default("DEPLOYED"),
  reference: z.string().trim().max(200).default(""),
  supersedesId: z.uuid().optional(),
  items: z
    .array(
      z.object({
        type: z.enum([
          "FIX",
          "ENHANCEMENT",
          "FEATURE",
          "SECURITY",
          "MAINTENANCE",
          "OTHER",
        ]),
        description: z.string().trim().min(3).max(1500),
        ticket: z.string().trim().max(100).default(""),
      }),
    )
    .min(1)
    .max(50),
});
export function maintenanceError(information = "") {
  return new HttpException(
    {
      message:
        "Perusahaan sedang dalam pemeliharaan. Hubungi administrator perusahaan.",
      code: "COMPANY_MAINTENANCE",
      information: information.slice(0, 500),
    },
    503,
  );
}
@Controller("governance")
export class GovernanceController {
  @Get("maintenance") async maintenance(@Req() req: Request) {
    const a = await actorFor(req, "admin:write");
    return (
      await pool.query(
        "SELECT corporate_id,maintenance_enabled AS enabled,maintenance_message AS message,maintenance_updated_at AS updated_at FROM companies WHERE id=$1",
        [a.company_id],
      )
    ).rows[0];
  }
  @Put("maintenance") async updateMaintenance(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = z
      .object({
        enabled: z.boolean(),
        message: z.string().trim().max(500).default(""),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input);
    return transaction(async (db) => {
      const before = (
        await db.query(
          "SELECT maintenance_enabled,maintenance_message FROM companies WHERE id=$1 FOR UPDATE",
          [a.company_id],
        )
      ).rows[0];
      await db.query(
        "UPDATE companies SET maintenance_enabled=$2,maintenance_message=$3,maintenance_updated_at=now() WHERE id=$1",
        [a.company_id, v.enabled, v.message],
      );
      // Existing sessions remain authenticated but every request is gated by actorFor;
      // this gives a useful maintenance response and permits explicit logout.
      await audit(
        db,
        a,
        "company.maintenance_changed",
        "company",
        a.company_id,
        {
          before: {
            enabled: before.maintenance_enabled,
            message: before.maintenance_message,
          },
          after: { enabled: v.enabled, message: v.message },
          reason: v.reason,
        },
      );
      return { enabled: v.enabled, message: v.message };
    });
  }
  @Get("releases") async releases(
    @Req() req: Request,
    @Query() query: unknown,
  ) {
    const a = await actorFor(req);
    const v = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        search: z.string().trim().max(100).default(""),
      })
      .parse(query);
    const search = "%" + v.search.replace(/[\\%_]/g, "\\$&") + "%";
    const rows = (
      await pool.query(
        `SELECT r.*,u.name AS registered_by,(SELECT coalesce(jsonb_agg(e ORDER BY e.created_at,e.id),'[]') FROM (SELECT re.id,re.status,re.reason,re.created_at,us.name AS actor_name FROM release_events re JOIN users us ON us.id=re.actor_id WHERE re.company_id=r.company_id AND re.release_id=r.id ORDER BY re.created_at DESC,re.id DESC LIMIT 100) e) AS history,count(*) OVER()::int AS total_count FROM releases r JOIN users u ON u.id=r.created_by WHERE r.company_id=$1 AND (r.title ILIKE $2 OR r.version ILIKE $2) ORDER BY r.deployed_at DESC,r.id DESC LIMIT $3 OFFSET $4`,
        [a.company_id, search, v.limit, (v.page - 1) * v.limit],
      )
    ).rows;
    return {
      items: rows,
      total: rows[0]?.total_count ?? 0,
      page: v.page,
      limit: v.limit,
    };
  }
  @Post("releases") async createRelease(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = releaseSchema.parse(input);
    return transaction(async (db) => {
      if (
        v.supersedesId &&
        !(
          await db.query(
            "SELECT 1 FROM releases WHERE company_id=$1 AND id=$2",
            [a.company_id, v.supersedesId],
          )
        ).rowCount
      )
        throw new NotFoundException();
      const r = (
        await db.query(
          "INSERT INTO releases(company_id,version,title,environment,deployed_at,status,items,reference,supersedes_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
          [
            a.company_id,
            v.version,
            v.title,
            v.environment,
            v.deployedAt,
            v.status,
            JSON.stringify(v.items),
            v.reference,
            v.supersedesId ?? null,
            a.id,
          ],
        )
      ).rows[0];
      await db.query(
        "INSERT INTO release_events(company_id,release_id,status,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
        [a.company_id, r.id, v.status, "Registered", a.id],
      );
      await audit(db, a, "release.registered", "release", r.id, {
        version: v.version,
        environment: v.environment,
        itemCount: v.items.length,
        supersedesId: v.supersedesId,
      });
      return r;
    });
  }
  @Post("releases/:id/status") async releaseStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = z
      .object({
        status,
        reason: z.string().trim().min(3).max(500),
        expectedStatus: status,
      })
      .parse(input);
    return transaction(async (db) => {
      const old = (
        await db.query(
          "SELECT status FROM releases WHERE id=$1 AND company_id=$2 FOR UPDATE",
          [id, a.company_id],
        )
      ).rows[0];
      if (!old) throw new NotFoundException();
      if (old.status !== v.expectedStatus)
        throw new HttpException(
          "Status telah berubah. Muat ulang sebelum memperbarui.",
          409,
        );
      const allowed: Record<string, string[]> = {
        PLANNED: ["DEPLOYED"],
        DEPLOYED: ["ROLLED_BACK"],
        ROLLED_BACK: [],
      };
      if (!allowed[old.status].includes(v.status))
        throw new BadRequestException(
          "Transisi status tidak diizinkan. Daftarkan rilis baru untuk perubahan berikutnya.",
        );
      await db.query("UPDATE releases SET status=$2 WHERE id=$1", [
        id,
        v.status,
      ]);
      await db.query(
        "INSERT INTO release_events(company_id,release_id,status,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
        [a.company_id, id, v.status, v.reason, a.id],
      );
      await audit(db, a, "release.status_changed", "release", id, {
        before: old.status,
        after: v.status,
        reason: v.reason,
      });
      return { ok: true };
    });
  }
}
const modules = {
  authentication: { actions: ["auth.", "authorization."], resources: [] },
  delivery: {
    actions: ["message."],
    resources: ["message", "messages", "message_events", "run", "runs"],
  },
  campaigns: {
    actions: ["campaign.", "run."],
    resources: [
      "campaign",
      "campaigns",
      "campaign_versions",
      "approvals",
      "run",
      "runs",
    ],
  },
  templates: { actions: ["template."], resources: ["template", "templates"] },
  sources: {
    actions: ["source.", "dataset.", "ingestion."],
    resources: [
      "datasets",
      "source_connections",
      "source_keys",
      "dataset",
      "source",
    ],
  },
  users: {
    actions: ["user.", "profile.", "role.", "team.", "dashboard."],
    resources: ["users", "roles", "teams", "user", "role", "team"],
  },
  providers: {
    actions: ["provider."],
    resources: [
      "provider_accounts",
      "provider_account_versions",
      "provider_definitions",
      "rate_cards",
      "provider_account",
      "provider_definition",
    ],
  },
  finance: {
    actions: ["budget.", "ledger.", "cost_centre."],
    resources: ["budgets", "cost_centres", "budget", "ledger"],
  },
  governance: {
    actions: ["release.", "company."],
    resources: [
      "companies",
      "releases",
      "release_events",
      "release",
      "company",
    ],
  },
  notifications: {
    actions: ["push.", "notification.", "notifications."],
    resources: ["push_subscription", "notification"],
  },
};
function redact(value: unknown, depth = 0, costs = true): unknown {
  if (depth > 6) return "[bounded]";
  if (Array.isArray(value))
    return value.slice(0, 50).map((v) => redact(v, depth + 1, costs));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([k, v]) => [
          k,
          (!costs &&
            /^(amount|allocated|adjusted|reserved|spent|price|unit_cost|estimated|cost|estimated_cost|ledger_spend|reserved_cost)$/i.test(
              k,
            )) ||
          (/password|secret|token|credential|authorization|cookie|api[_-]?key|(^|_)(body|rows|recipient|content)($|_)/i.test(
            k,
          ) &&
            typeof v !== "boolean")
            ? "[redacted]"
            : redact(v, depth + 1, costs),
        ]),
    );
  return typeof value === "string" ? value.slice(0, 2000) : value;
}
@Controller("audit")
export class AuditController {
  @Get() async list(@Req() req: Request, @Query() input: unknown) {
    const a = await actorFor(req, "audit:read");
    const v = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce
          .number()
          .pipe(
            z.union([
              z.literal(10),
              z.literal(30),
              z.literal(50),
              z.literal(100),
            ]),
          )
          .default(30),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        module: z
          .enum(["all", ...Object.keys(modules)] as [string, ...string[]])
          .default("all"),
        action: z.string().trim().max(100).default(""),
        source: z.enum(["all", "business", "database"]).default("all"),
        search: z.string().trim().max(100).default(""),
        snapshot: z.iso.datetime().optional(),
      })
      .parse(input);
    const zone = (a as any).company_timezone ?? "Asia/Jakarta",
      to = v.to
        ? DateTime.fromISO(v.to, { zone })
        : DateTime.now().setZone(zone).startOf("day"),
      from = v.from
        ? DateTime.fromISO(v.from, { zone })
        : to.minus({ days: 29 });
    if (from && to && (from > to || to.diff(from, "days").days > 366))
      throw new BadRequestException(
        "Rentang tanggal tidak valid atau melebihi 366 hari.",
      );
    const values: unknown[] = scopeValues(a);
    const bind = (value: unknown) => {
      values.push(value);
      return "$" + values.length;
    };
    const snapshot = v.snapshot ?? new Date().toISOString();
    let where = `${scope(a, "au")} AND au.created_at<=${bind(snapshot)}::timestamptz`;
    if (!a.company_scope)
      where += ` AND NOT (au.resource_type IN ('budget','budgets') AND EXISTS(SELECT 1 FROM budgets b JOIN cost_centres cc ON cc.id=b.cost_centre_id WHERE b.company_id=$1 AND b.id::text=au.resource_id AND cc.team_id<>$3)) AND NOT (au.resource_type IN ('user','users') AND EXISTS(SELECT 1 FROM users own WHERE own.company_id=$1 AND own.id::text=au.resource_id AND own.team_id<>$3))`;
    if (from)
      where += ` AND au.created_at>=${bind(from.toUTC().toISO())}::timestamptz`;
    if (to)
      where += ` AND au.created_at<${bind(to.plus({ days: 1 }).toUTC().toISO())}::timestamptz`;
    if (v.action) where += ` AND au.action=${bind(v.action)}`;
    if (v.source === "database")
      where += " AND au.detail->>'source'='database'";
    if (v.source === "business")
      where += " AND coalesce(au.detail->>'source','')<>'database'";
    if (v.module !== "all") {
      const m = modules[v.module as keyof typeof modules];
      const filters = m.actions.map((p) => `au.action LIKE ${bind(p + "%")}`);
      if (m.resources.length)
        filters.push(`au.resource_type=ANY(${bind(m.resources)}::text[])`);
      where += ` AND (${filters.join(" OR ")})`;
    }
    if (v.search) {
      const q = bind("%" + v.search.replace(/[\\%_]/g, "\\$&") + "%");
      where += ` AND (au.action ILIKE ${q} OR au.resource_id ILIKE ${q} OR u.name ILIKE ${q})`;
    }
    const base = `FROM audit au LEFT JOIN users u ON u.id=au.actor_id WHERE ${where}`;
    const total = Number(
      (await pool.query(`SELECT count(*)::int AS total ${base}`, values))
        .rows[0].total,
    );
    const rows = (
      await pool.query(
        `SELECT au.*,u.name AS actor_name ${base} ORDER BY au.created_at DESC,au.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, v.limit, (v.page - 1) * v.limit],
      )
    ).rows;
    return {
      items: rows.map((r) => ({
        ...r,
        detail: redact(r.detail, 0, a.permissions.includes("budgets:read")),
      })),
      total,
      page: v.page,
      limit: v.limit,
      snapshot,
      modules: Object.keys(modules),
    };
  }
}
