import {
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
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
  role: string;
  company: string;
  profile: Record<string, unknown>;
  company_dashboard:Record<string,unknown>;
  role_dashboard:Record<string,unknown>|null;
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
    `SELECT u.id,u.company_id,u.team_id,u.role_id,u.email,u.name,u.profile,
    r.name AS role,r.permissions,r.company_scope,r.dashboard_defaults AS role_dashboard,c.dashboard_defaults AS company_dashboard,c.name AS company FROM sessions s
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
    correlationId: randomUUID(),
    session_ref: tokenHash(token).slice(0, 16),
  };
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
  await db.query(
    "INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      actor.company_id,
      actor.team_id,
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
