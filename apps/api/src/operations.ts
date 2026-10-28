import {
  Controller,
  Get,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import { actorFor, scope, scopeValues, type Actor } from "./context.js";

const filterSchema = z.object({
  channel: z.enum(["all", "email", "sms", "whatsapp"]).default("all"),
  days: z.enum(["all", "1", "7", "30", "90"]).default("7"),
  status: z
    .enum([
      "all",
      "QUEUED",
      "ACCEPTED",
      "SENT",
      "DELIVERED",
      "FAILED",
      "UNKNOWN",
      "CANCELLED",
    ])
    .default("all"),
  search: z.string().trim().max(160).default(""),
  provider: z.uuid().optional(),
  team: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(300).optional(),
});
export function maskRecipient(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}•••@${domain.slice(0, 1)}•••${domain.includes(".") ? "." + domain.split(".").pop() : ""}`;
  }
  return `•••• ${value.slice(-4)}`;
}
function filtered(a: Actor, input: unknown) {
  const v = filterSchema.parse(input),
    values: unknown[] = scopeValues(a);
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  let where = `${scope(a, "c")} AND m.company_id=$1 AND r.company_id=$1`;
  if (v.channel !== "all") where += ` AND m.channel=${bind(v.channel)}`;
  if (v.days !== "all")
    where += ` AND m.created_at>=now()-${bind(Number(v.days))}*interval '1 day'`;
  if (v.status !== "all") where += ` AND m.status=${bind(v.status)}`;
  if (v.provider) where += ` AND av.account_id=${bind(v.provider)}`;
  if (v.team) where += ` AND c.team_id=${bind(v.team)}`;
  if (v.search) {
    const p = bind(v.search);
    where += ` AND (m.id::text=${p} OR m.provider_ref=${p} OR m.run_id::text=${p} OR c.id::text=${p})`;
  }
  return { v, values, where, bind };
}
const joins = `FROM messages m JOIN runs r ON r.id=m.run_id JOIN campaigns c ON c.id=r.campaign_id
 JOIN teams t ON t.id=c.team_id AND t.company_id=c.company_id
 LEFT JOIN provider_account_versions av ON av.id=m.provider_version_id AND av.company_id=m.company_id
 LEFT JOIN provider_accounts pa ON pa.id=av.account_id AND pa.company_id=m.company_id`;
const fields = `m.id,m.channel,m.status,m.created_at,m.updated_at,m.provider_ref,m.run_id,r.campaign_id,c.name AS campaign,t.name AS team,
 COALESCE(pa.name,'Local simulator') AS provider,av.account_id AS provider_id,
 (SELECT count(*)::int FROM attempts a WHERE a.company_id=m.company_id AND a.message_id=m.id) AS attempt_count,
 CASE WHEN m.status='DELIVERED' THEN round(extract(epoch FROM m.updated_at-m.created_at)*1000)::bigint END AS latency_ms`;
function clean(row: Record<string, any>, costs: boolean) {
  const { recipient, unit_cost, ...rest } = row;
  return {
    ...rest,
    recipient_masked: maskRecipient(recipient),
    ...(costs ? { estimated_cost: unit_cost, currency: "IDR" } : {}),
  };
}
@Controller("operations")
export class OperationsController {
  @Get("filters") async filters(@Req() req: Request) {
    const a = await actorFor(req, "campaigns:read");
    const [teams, providers] = await Promise.all([
      pool.query(
        `SELECT id,name FROM teams WHERE company_id=$1 AND ($2::boolean OR id=$3) ORDER BY name`,
        scopeValues(a),
      ),
      pool.query(
        `SELECT DISTINCT pa.id,pa.name ${joins} WHERE ${scope(a, "c")} AND pa.id IS NOT NULL ORDER BY pa.name`,
        scopeValues(a),
      ),
    ]);
    return { teams: teams.rows, providers: providers.rows };
  }
  @Get("messages") async messages(
    @Req() req: Request,
    @Query() input: unknown,
  ) {
    const a = await actorFor(req, "campaigns:read"),
      f = filtered(a, input),
      costs = a.permissions.includes("budgets:read");
    if (f.v.cursor) {
      try {
        const cursor = z
          .object({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
          .parse(JSON.parse(Buffer.from(f.v.cursor, "base64url").toString()));
        f.where += ` AND (m.created_at,m.id)<(${f.bind(cursor.at)}::timestamptz,${f.bind(cursor.id)}::uuid)`;
      } catch {
        throw new BadRequestException("Cursor tidak valid.");
      }
    }
    const rows = (
      await pool.query(
        `SELECT ${fields},m.recipient,${costs ? "m.unit_cost," : ""} to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at ${joins} WHERE ${f.where} ORDER BY m.created_at DESC,m.id DESC LIMIT ${f.bind(f.v.limit + 1)}`,
        f.values,
      )
    ).rows;
    const more = rows.length > f.v.limit,
      items = rows.slice(0, f.v.limit),
      last = items.at(-1);
    return {
      items: items.map(({ cursor_at, ...row }) => clean(row, costs)),
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({ at: last.cursor_at, id: last.id }),
            ).toString("base64url")
          : null,
      limit: f.v.limit,
      mode: "simulation",
    };
  }
  @Get("summary") async summary(@Req() req: Request, @Query() input: unknown) {
    const a = await actorFor(req, "campaigns:read"),
      f = filtered(a, input),
      costs = a.permissions.includes("budgets:read");
    const aggregate = `count(*)::int AS total,count(*) FILTER(WHERE m.status='DELIVERED')::int AS delivered,count(*) FILTER(WHERE m.status='FAILED')::int AS failed,count(*) FILTER(WHERE m.status='UNKNOWN')::int AS unknown,count(*) FILTER(WHERE m.status='QUEUED')::int AS queued`;
    // Each row is one logical message; no attempt/event join may multiply these totals.
    const totals = (
      await pool.query(
        `SELECT ${aggregate}${costs ? ",COALESCE(sum(m.unit_cost),0)::text AS estimated_cost" : ""} ${joins} WHERE ${f.where}`,
        f.values,
      )
    ).rows[0];
    let previous = null;
    if (f.v.days !== "all") {
      const p = filtered(a, { ...f.v, days: "all", cursor: undefined });
      p.where += ` AND m.created_at>=now()-${p.bind(Number(f.v.days) * 2)}*interval '1 day' AND m.created_at<now()-${p.bind(Number(f.v.days))}*interval '1 day'`;
      previous = (
        await pool.query(
          `SELECT ${aggregate}${costs ? ",COALESCE(sum(m.unit_cost),0)::text AS estimated_cost" : ""} ${joins} WHERE ${p.where}`,
          p.values,
        )
      ).rows[0];
    }
    const [trend, channels, failures, queue] = await Promise.all([
      pool.query(
        `SELECT to_char(m.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') AS day,count(*)::int AS total,count(*) FILTER(WHERE m.status='DELIVERED')::int AS delivered,count(*) FILTER(WHERE m.status='FAILED')::int AS failed ${joins} WHERE ${f.where} GROUP BY 1 ORDER BY 1 DESC LIMIT 366`,
        f.values,
      ),
      pool.query(
        `SELECT m.channel,count(*)::int AS total,count(*) FILTER(WHERE m.status='DELIVERED')::int AS delivered,count(*) FILTER(WHERE m.status='FAILED')::int AS failed,count(*) FILTER(WHERE m.status='UNKNOWN')::int AS unknown,count(*) FILTER(WHERE m.status='QUEUED')::int AS queued,min(m.created_at) FILTER(WHERE m.status='QUEUED') AS oldest_queued_at,percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM m.updated_at-m.created_at)*1000) FILTER(WHERE m.status='DELIVERED') AS p95_ms ${joins} WHERE ${f.where} GROUP BY m.channel`,
        f.values,
      ),
      pool.query(
        `SELECT ${fields},m.recipient ${joins} WHERE ${f.where} AND m.status IN ('FAILED','UNKNOWN') ORDER BY m.created_at DESC,m.id DESC LIMIT 6`,
        f.values,
      ),
      pool.query(
        `SELECT min(m.created_at) FILTER(WHERE m.status='QUEUED') AS oldest_queued_at ${joins} WHERE ${f.where}`,
        f.values,
      ),
    ]);
    return {
      totals,
      previous,
      trend: trend.rows.reverse(),
      channels: channels.rows,
      failures: failures.rows.map((r) => clean(r, false)),
      oldestQueuedAt: queue.rows[0].oldest_queued_at,
      observedAt: new Date().toISOString(),
      days: f.v.days,
      timezone: "Asia/Jakarta",
      rateDefinition:
        "Confirmed delivered logical messages / all logical requests in the selected creation period; processing and unknown are included in the denominator.",
      mode: "simulation",
      trendTruncated: trend.rows.length === 366,
    };
  }
  @Get("usage") async usage(@Req() req: Request, @Query() input: unknown) {
    const a = await actorFor(req, "budgets:read"),
      f = filtered(a, input);
    const rows = (
      await pool.query(
        `SELECT COALESCE(pa.name,'Local simulator') AS provider,av.account_id AS provider_id,m.channel,t.name AS team,count(*)::int AS messages,COALESCE(sum(m.unit_cost),0)::text AS estimated_cost,COALESCE(sum((SELECT sum(l.amount) FROM ledger l WHERE l.company_id=m.company_id AND l.message_id=m.id AND l.kind='SPEND')),0)::text AS ledger_spend,COALESCE(sum((SELECT sum(CASE WHEN l.kind='RESERVE' THEN l.amount WHEN l.kind IN ('RELEASE','SPEND') THEN -l.amount ELSE 0 END) FROM ledger l WHERE l.company_id=m.company_id AND l.message_id=m.id)),0)::text AS reserved_cost ${joins} WHERE ${f.where} GROUP BY 1,2,3,4 ORDER BY 1,3,4`,
        f.values,
      )
    ).rows;
    return {
      items: rows.map((r) => ({
        ...r,
        currency: "IDR",
        provider_reported_cost: null,
        invoiced_cost: null,
      })),
      mode: "simulation",
      observedAt: new Date().toISOString(),
      billingNote:
        "Amounts are exact local simulated ledger values. Provider usage, invoices, FX and contract-specific billable quantities are not connected.",
    };
  }
}
