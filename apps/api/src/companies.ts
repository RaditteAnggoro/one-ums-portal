import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { pool, transaction } from "./db.js";
import { actorFor, audit, type Actor } from "./context.js";
import { passwordHash } from "./security.js";
import { permissions } from "./admin.js";
import { periodEnd } from "../../../packages/domain/src/rules.js";
export async function platformActor(req: Request) {
  const a = await actorFor(req);
  if (!a.platform_admin) {
    await transaction((db) =>
      audit(db, a, "authorization.denied", "permission", "platform:companies"),
    );
    throw new ForbiddenException(
      "Hanya admin platform yang dapat mengelola perusahaan.",
    );
  }
  return a;
}
export const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z
    .string()
    .min(2)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Zona waktu tidak valid."),
  language: z.enum(["id", "en"]).default("id"),
  teamName: z.string().trim().min(2).max(100).default("Operations"),
  costCentreName: z.string().trim().min(2).max(100).default("General"),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.email().max(254),
  adminPassword: z.string().min(12).max(256),
});
export async function provisionCompany(
  input: z.infer<typeof companySchema>,
  actor?: Actor,
) {
  const hashed = passwordHash(input.adminPassword);
  return transaction(async (db) => {
    const c = (
      await db.query(
        "INSERT INTO companies(name,timezone) VALUES($1,$2) RETURNING id,name,timezone",
        [input.name, input.timezone],
      )
    ).rows[0];
    const team = (
      await db.query(
        "INSERT INTO teams(company_id,name) VALUES($1,$2) RETURNING id",
        [c.id, input.teamName],
      )
    ).rows[0].id;
    const roles: Record<string, string> = {};
    for (const [name, allowed, scope] of [
      ["Administrator", [...permissions], true],
      [
        "Creator",
        [
          "campaigns:read",
          "campaigns:create",
          "campaigns:manage",
          "sources:write",
          "templates:write",
          "budgets:read",
        ],
        false,
      ],
      ["Approver", ["campaigns:read", "campaigns:approve"], false],
      [
        "Finance",
        [
          "campaigns:read",
          "campaigns:approve",
          "budgets:read",
          "budgets:write",
          "audit:read",
        ],
        true,
      ],
      ["Viewer", ["campaigns:read"], false],
    ] as const) {
      roles[name] = (
        await db.query(
          "INSERT INTO roles(company_id,name,permissions,company_scope) VALUES($1,$2,$3,$4) RETURNING id",
          [c.id, name, JSON.stringify(allowed), scope],
        )
      ).rows[0].id;
    }
    const owner = (
      await db.query(
        "INSERT INTO users(company_id,team_id,role_id,email,name,password_hash,profile) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email",
        [
          c.id,
          team,
          roles.Administrator,
          input.adminEmail.toLowerCase(),
          input.adminName,
          hashed,
          JSON.stringify({ locale: input.language }),
        ],
      )
    ).rows[0];
    await db.query(
      "INSERT INTO approval_policies(company_id,stages) VALUES($1,$2)",
      [
        c.id,
        JSON.stringify([
          {
            name: "Team approval",
            roleIds: [roles.Approver, roles.Administrator],
          },
          {
            name: "Finance approval",
            roleIds: [roles.Finance, roles.Administrator],
          },
        ]),
      ],
    );
    const centre = (
      await db.query(
        "INSERT INTO cost_centres(company_id,team_id,name) VALUES($1,$2,$3) RETURNING id",
        [c.id, team, input.costCentreName],
      )
    ).rows[0].id;
    const start = new Intl.DateTimeFormat("en-CA", {
      timeZone: input.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const budget = (
      await db.query(
        "INSERT INTO budgets(company_id,cost_centre_id,starts_on,ends_on,months,allocated) VALUES($1,$2,$3,$4,12,0) RETURNING id",
        [c.id, centre, start, periodEnd(start, 12)],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO ledger(company_id,budget_id,kind,amount,idempotency_key,reason,actor_id) VALUES($1,$2,'ALLOCATE',0,$3,'Initial company budget',$4)",
      [c.id, budget, `company:${c.id}:initial-budget`, owner.id],
    );
    if (actor)
      await audit(db, actor, "company.created", "company", c.id, {
        ownerId: owner.id,
        timezone: input.timezone,
        locale: input.language,
      });
    const target: Actor = actor
      ? { ...actor, company_id: c.id, team_id: team, id: actor.id }
      : {
          id: owner.id,
          company_id: c.id,
          team_id: team,
          role_id: roles.Administrator,
          email: owner.email,
          name: owner.name,
          permissions: [...permissions],
          company_scope: true,
          platform_admin: false,
          role: "Administrator",
          company: c.name,
          profile: {},
          company_dashboard: {},
          role_dashboard: null,
          ip: "bootstrap",
          correlationId: crypto.randomUUID(),
        };
    await audit(db, target, "company.provisioned", "company", c.id, {
      ownerId: owner.id,
      initialBudget: "0.0000",
      approvalLevels: 2,
    });
    return {
      ...c,
      owner,
      teamId: team,
      costCentreId: centre,
      setupRequired: ["users", "budget", "providers", "templates", "data"],
    };
  });
}
@Controller("platform/companies")
export class CompaniesController {
  @Get() async list(@Req() req: Request) {
    await platformActor(req);
    return (
      await pool.query(
        `SELECT c.id,c.name,c.timezone,(SELECT count(*)::int FROM users u WHERE u.company_id=c.id) AS users,(SELECT count(*)::int FROM teams t WHERE t.company_id=c.id) AS teams FROM companies c ORDER BY c.name`,
      )
    ).rows;
  }
  @Post() async create(@Req() req: Request, @Body() input: unknown) {
    return provisionCompany(
      companySchema.parse(input),
      await platformActor(req),
    );
  }
}
