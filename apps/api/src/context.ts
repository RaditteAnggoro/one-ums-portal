import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { requestContext } from "./request-context.js";
import { pool } from "./db.js";
import { tokenHash } from "./security.js";

export type Actor = {
  id: string;
  company_id: string;
  team_id: string;
  role_id: string;
  email: string;
  name: string;
  permissions: string[];
  company_scope: boolean;
  platform_admin: boolean;
  role: string;
  company: string;
  company_timezone?: string;
  profile: Record<string, unknown>;
  company_dashboard: Record<string, unknown>;
  role_dashboard: Record<string, unknown> | null;
  ip: string;
  correlationId: string;
  session_ref?: string;
};
export async function actorFor(
  req: Request,
  permission?: string,
): Promise<Actor> {
  const token = req.cookies?.session;
  if (!token || typeof token !== "string")
    throw new UnauthorizedException("Silakan masuk terlebih dahulu.");
  const { rows } = await pool.query(
    `SELECT u.id,u.company_id,u.team_id,u.role_id,u.email,u.name,u.profile,u.employee_id,u.department,u.job_title,u.work_phone,r.level AS role_level,c.corporate_id,c.maintenance_enabled,c.maintenance_message,c.timezone AS company_timezone,
    EXISTS(SELECT 1 FROM platform_administrators pa WHERE pa.user_id=u.id) AS platform_admin,r.name AS role,r.permissions,r.company_scope,r.dashboard_defaults AS role_dashboard,c.dashboard_defaults AS company_dashboard,c.name AS company FROM sessions s
    JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id AND r.company_id=u.company_id
    JOIN companies c ON c.id=u.company_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [tokenHash(token)],
  );
  if (!rows[0])
    throw new UnauthorizedException(
      "Sesi sudah berakhir. Silakan masuk kembali.",
    );
  const actor: Actor = {
    ...rows[0],
    ip: req.ip ?? "unknown",
    correlationId: requestContext.getStore()?.correlationId ?? randomUUID(),
    session_ref: tokenHash(token).slice(0, 16),
  };
  const context = requestContext.getStore();
  if (context)
    Object.assign(context, {
      actorId: actor.id,
      companyId: actor.company_id,
      teamId: actor.team_id,
      ip: actor.ip,
      correlationId: actor.correlationId,
    });
  if (
    rows[0].maintenance_enabled &&
    !actor.permissions.includes("admin:write") &&
    req.path !== "/api/auth/logout"
  )
    throw new HttpException(
      {
        message:
          "Perusahaan sedang dalam pemeliharaan. Hubungi administrator perusahaan.",
        code: "COMPANY_MAINTENANCE",
        information: String(rows[0].maintenance_message ?? "").slice(0, 500),
      },
      503,
    );
  if (permission && !actor.permissions.includes(permission)) {
    await pool.query(
      "INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        actor.company_id,
        actor.team_id,
        actor.id,
        "authorization.denied",
        "permission",
        permission,
        JSON.stringify({
          method: req.method,
          path: req.path,
          sessionRef: actor.session_ref,
        }),
        actor.ip,
        actor.correlationId,
      ],
    );
    throw new ForbiddenException(
      "Anda tidak memiliki izin untuk tindakan ini.",
    );
  }
  return actor;
}
export function scope(actor: Actor, alias = "") {
  const p = alias ? `${alias}.` : "";
  return `${p}company_id=$1 AND ($2::boolean OR ${p}team_id=$3)`;
}
export function scopeValues(actor: Actor) {
  return [actor.company_id, actor.company_scope, actor.team_id];
}
export async function campaignFor(
  db: PoolClient,
  actor: Actor,
  id: string,
  lock = false,
) {
  const result = await db.query(
    `SELECT * FROM campaigns WHERE ${scope(actor)} AND id=$4 ${lock ? "FOR UPDATE" : ""}`,
    [...scopeValues(actor), id],
  );
  if (!result.rows[0]) throw new NotFoundException("Kampanye tidak ditemukan.");
  return result.rows[0];
}
export async function audit(
  db: PoolClient,
  actor: Actor,
  action: string,
  type: string,
  id: string,
  detail: Record<string, unknown> = {},
) {
  const lookups: Record<string, string> = {
    budget:
      "SELECT cc.team_id FROM budgets b JOIN cost_centres cc ON cc.id=b.cost_centre_id AND cc.company_id=b.company_id WHERE b.company_id=$1 AND b.id::text=$2",
    cost_centre:
      "SELECT team_id FROM cost_centres WHERE company_id=$1 AND id::text=$2",
    user: "SELECT team_id FROM users WHERE company_id=$1 AND id::text=$2",
    campaign:
      "SELECT team_id FROM campaigns WHERE company_id=$1 AND id::text=$2",
    source:
      "SELECT team_id FROM source_connections WHERE company_id=$1 AND id::text=$2",
    dataset: "SELECT team_id FROM datasets WHERE company_id=$1 AND id::text=$2",
    template:
      "SELECT team_id FROM templates WHERE company_id=$1 AND id::text=$2",
  };
  const targetTeam = lookups[type]
    ? (await db.query(lookups[type], [actor.company_id, id])).rows[0]?.team_id
    : undefined;
  await db.query(
    "INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      actor.company_id,
      targetTeam ?? actor.team_id,
      actor.id,
      action,
      type,
      id,
      JSON.stringify({ ...detail, sessionRef: actor.session_ref }),
      actor.ip,
      actor.correlationId,
    ],
  );
}
