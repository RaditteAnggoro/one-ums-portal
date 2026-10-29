import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Req,
  Query,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import sharp from "sharp";
import { pool, transaction } from "./db.js";
import { actorFor, audit, scope, scopeValues } from "./context.js";
import { passwordHash } from "./security.js";
import { dashboardSchema } from "../../../packages/domain/src/dashboard.js";

export const permissions = [
  "campaigns:read",
  "campaigns:create",
  "campaigns:approve",
  "campaigns:manage",
  "messages:payload",
  "budgets:read",
  "budgets:write",
  "sources:write",
  "templates:write",
  "audit:read",
  "admin:write",
] as const;
const workDetails = z.object({
  employeeId: z.string().trim().max(60).default(""),
  department: z.string().trim().max(100).default(""),
  jobTitle: z.string().trim().max(100).default(""),
  workPhone: z.string().trim().max(40).default(""),
});
const roleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  permissions: z.array(z.enum(permissions)).min(1),
  companyScope: z.boolean().default(false),
  level: z.coerce.number().int().min(1).max(99).default(1),
});
@Controller("admin")
export class AdminController {
  @Put("dashboard-default") async dashboardDefault(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = dashboardSchema.parse(input);
    await transaction(async (db) => {
      await db.query("UPDATE companies SET dashboard_defaults=$2 WHERE id=$1", [
        a.company_id,
        JSON.stringify(v),
      ]);
      await audit(
        db,
        a,
        "dashboard.company_default_updated",
        "company",
        a.company_id,
        { layout: v },
      );
    });
    return { ok: true };
  }
  @Put("roles/:id/dashboard-default") async roleDashboard(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = dashboardSchema.parse(input);
    await transaction(async (db) => {
      const changed = await db.query(
        "UPDATE roles SET dashboard_defaults=$3 WHERE company_id=$1 AND id=$2 RETURNING id",
        [a.company_id, id, JSON.stringify(v)],
      );
      if (!changed.rowCount) throw new NotFoundException();
      await audit(db, a, "dashboard.role_default_updated", "role", id, {
        layout: v,
      });
    });
    return { ok: true };
  }
  @Get("diagnostics") async diagnostics(@Req() req: Request) {
    const a = await actorFor(req, "admin:write");
    const messages = (
      await pool.query(
        `SELECT m.status,count(*)::int AS count FROM messages m JOIN runs r ON r.id=m.run_id JOIN campaigns c ON c.id=r.campaign_id WHERE ${scope(a, "c")} GROUP BY m.status`,
        scopeValues(a),
      )
    ).rows;
    return {
      messages,
      apiRssBytes: process.memoryUsage().rss,
      workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
      mode: "simulation",
    };
  }
  @Get("workspace") async workspace(
    @Req() req: Request,
    @Query() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
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
        search: z.string().trim().max(100).default(""),
      })
      .parse(input);
    const [users, teams, roles, costCentres, company] = await Promise.all([
      pool.query(
        "SELECT u.id,u.name,u.email,u.team_id,u.role_id,u.active,u.employee_id,u.department,u.job_title,u.work_phone,t.name AS team,r.name AS role,r.level AS role_level,count(*) OVER()::int AS total_count FROM users u JOIN teams t ON t.id=u.team_id AND t.company_id=u.company_id JOIN roles r ON r.id=u.role_id AND r.company_id=u.company_id WHERE u.company_id=$1 AND (u.name ILIKE $2 OR u.email ILIKE $2 OR u.employee_id ILIKE $2) ORDER BY u.name,u.id LIMIT $3 OFFSET $4",
        [
          a.company_id,
          "%" + v.search.replace(/[\\%_]/g, "\\$&") + "%",
          v.limit,
          (v.page - 1) * v.limit,
        ],
      ),
      pool.query(
        "SELECT id,name FROM teams WHERE company_id=$1 ORDER BY name",
        [a.company_id],
      ),
      pool.query(
        "SELECT id,name,permissions,company_scope,level FROM roles WHERE company_id=$1 ORDER BY name",
        [a.company_id],
      ),
      pool.query(
        "SELECT id,name,team_id FROM cost_centres WHERE company_id=$1 ORDER BY name",
        [a.company_id],
      ),
      pool.query("SELECT id,name,corporate_id FROM companies WHERE id=$1", [
        a.company_id,
      ]),
    ]);
    return {
      users: users.rows,
      company: company.rows[0],
      userTotal: users.rows[0]?.total_count ?? 0,
      userPage: v.page,
      userLimit: v.limit,
      teams: teams.rows,
      roles: roles.rows,
      costCentres: costCentres.rows,
      permissionCatalog: permissions,
    };
  }
  @Post("teams") async team(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "admin:write");
    const v = z
      .object({ name: z.string().trim().min(2).max(100) })
      .parse(input);
    return transaction(async (db) => {
      const t = (
        await db.query(
          "INSERT INTO teams(company_id,name) VALUES($1,$2) RETURNING id,name",
          [a.company_id, v.name],
        )
      ).rows[0];
      await audit(db, a, "team.created", "team", t.id, { name: v.name });
      return t;
    });
  }
  @Post("roles") async role(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "admin:write");
    const v = roleSchema.parse(input);
    return transaction(async (db) => {
      const r = (
        await db.query(
          "INSERT INTO roles(company_id,name,permissions,company_scope,level) VALUES($1,$2,$3,$4,$5) RETURNING id,name,level",
          [
            a.company_id,
            v.name,
            JSON.stringify([...new Set(v.permissions)]),
            v.companyScope,
            v.level,
          ],
        )
      ).rows[0];
      await audit(db, a, "role.created", "role", r.id, {
        permissions: v.permissions,
        companyScope: v.companyScope,
        level: v.level,
      });
      return r;
    });
  }
  @Post("users") async user(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "admin:write");
    const v = workDetails
      .extend({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        password: z.string().min(12).max(256),
        teamId: z.uuid(),
        roleId: z.uuid(),
      })
      .parse(input);
    return transaction(async (db) => {
      const team = await db.query(
        "SELECT 1 FROM teams WHERE company_id=$1 AND id=$2",
        [a.company_id, v.teamId],
      );
      const role = await db.query(
        "SELECT 1 FROM roles WHERE company_id=$1 AND id=$2",
        [a.company_id, v.roleId],
      );
      if (!team.rowCount || !role.rowCount)
        throw new BadRequestException(
          "Tim dan peran harus berasal dari perusahaan Anda.",
        );
      const user = (
        await db.query(
          "INSERT INTO users(company_id,team_id,role_id,email,name,password_hash,employee_id,department,job_title,work_phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,email,name",
          [
            a.company_id,
            v.teamId,
            v.roleId,
            v.email.toLowerCase(),
            v.name,
            passwordHash(v.password),
            v.employeeId,
            v.department,
            v.jobTitle,
            v.workPhone,
          ],
        )
      ).rows[0];
      await audit(db, a, "user.created", "user", user.id, {
        teamId: v.teamId,
        roleId: v.roleId,
      });
      return user;
    });
  }
  @Put("users/:id/details") async details(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = workDetails
      .extend({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
      })
      .parse(input);
    return transaction(async (db) => {
      const old = (
        await db.query(
          "SELECT name,email,employee_id,department,job_title,work_phone FROM users WHERE company_id=$1 AND id=$2 FOR UPDATE",
          [a.company_id, id],
        )
      ).rows[0];
      if (!old) throw new NotFoundException();
      const email = v.email.toLowerCase();
      if (a.id === id && old.email !== email)
        throw new BadRequestException(
          "Gunakan administrator lain untuk mengubah email akun Anda.",
        );
      await db.query(
        "UPDATE users SET name=$3,email=$4,employee_id=$5,department=$6,job_title=$7,work_phone=$8 WHERE company_id=$1 AND id=$2",
        [
          a.company_id,
          id,
          v.name,
          email,
          v.employeeId,
          v.department,
          v.jobTitle,
          v.workPhone,
        ],
      );
      if (email !== old.email)
        await db.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(db, a, "user.details_updated", "user", id, {
        changedFields: Object.entries({
          name: v.name,
          email,
          employee_id: v.employeeId,
          department: v.department,
          job_title: v.jobTitle,
          work_phone: v.workPhone,
        })
          .filter(([k, value]) => old[k] !== value)
          .map(([k]) => k),
        emailChanged: email !== old.email,
      });
      return { ok: true };
    });
  }
  @Put("roles/:id") async editRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    if (id === a.role_id)
      throw new BadRequestException(
        "Gunakan administrator lain untuk mengubah peran Anda.",
      );
    const v = roleSchema.parse(input);
    return transaction(async (db) => {
      const old = (
        await db.query(
          "SELECT id FROM roles WHERE company_id=$1 AND id=$2 FOR UPDATE",
          [a.company_id, id],
        )
      ).rows[0];
      if (!old) throw new NotFoundException();
      await db.query(
        "UPDATE roles SET name=$3,permissions=$4,company_scope=$5,level=$6 WHERE company_id=$1 AND id=$2",
        [
          a.company_id,
          id,
          v.name,
          JSON.stringify([...new Set(v.permissions)]),
          v.companyScope,
          v.level,
        ],
      );
      await db.query(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id=$1 AND role_id=$2)",
        [a.company_id, id],
      );
      await audit(db, a, "role.updated", "role", id, {
        permissions: v.permissions,
        companyScope: v.companyScope,
        level: v.level,
      });
      return { ok: true };
    });
  }
  @Put("users/:id") async updateUser(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = z
      .object({ active: z.boolean(), teamId: z.uuid(), roleId: z.uuid() })
      .parse(input);
    if (id === a.id)
      throw new BadRequestException(
        "Gunakan administrator lain untuk mengubah akses akun Anda.",
      );
    return transaction(async (db) => {
      const t = await db.query(
        "SELECT 1 FROM teams WHERE company_id=$1 AND id=$2",
        [a.company_id, v.teamId],
      );
      const r = await db.query(
        "SELECT 1 FROM roles WHERE company_id=$1 AND id=$2",
        [a.company_id, v.roleId],
      );
      if (!t.rowCount || !r.rowCount)
        throw new BadRequestException("Tim/peran tidak valid.");
      const updated = await db.query(
        "UPDATE users SET active=$3,team_id=$4,role_id=$5 WHERE company_id=$1 AND id=$2 RETURNING id",
        [a.company_id, id, v.active, v.teamId, v.roleId],
      );
      if (!updated.rowCount) throw new NotFoundException();
      await db.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(db, a, "user.access_changed", "user", id, v);
      return { ok: true };
    });
  }
  @Post("cost-centres") async centre(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = z
      .object({ name: z.string().trim().min(2).max(100), teamId: z.uuid() })
      .parse(input);
    return transaction(async (db) => {
      const t = await db.query(
        "SELECT 1 FROM teams WHERE company_id=$1 AND id=$2",
        [a.company_id, v.teamId],
      );
      if (!t.rowCount) throw new NotFoundException();
      const c = (
        await db.query(
          "INSERT INTO cost_centres(company_id,team_id,name) VALUES($1,$2,$3) RETURNING *",
          [a.company_id, v.teamId, v.name],
        )
      ).rows[0];
      await audit(db, a, "cost_centre.created", "cost_centre", c.id, {
        teamId: v.teamId,
      });
      return c;
    });
  }
}
@Controller("profile")
export class ProfileController {
  @Put("picture") async picture(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req);
    const v = z.object({ base64: z.string().max(2_800_000) }).parse(input);
    const data = Buffer.from(v.base64, "base64");
    if (data.length > 2_000_000)
      throw new BadRequestException("Ukuran foto maksimal 2 MB.");
    let image: Buffer;
    try {
      const source = sharp(data, {
        limitInputPixels: 8_000_000,
        animated: false,
      });
      const meta = await source.metadata();
      if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
        throw new Error("format");
      image = await source
        .resize(160, 160, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        "Gunakan gambar PNG, JPEG, atau WebP yang valid (maksimal 8 megapiksel).",
      );
    }
    await transaction(async (db) => {
      await db.query(
        "UPDATE users SET profile=jsonb_set(profile,'{picture}',to_jsonb($2::text)) WHERE id=$1",
        [a.id, `data:image/webp;base64,${image.toString("base64")}`],
      );
      await audit(db, a, "profile.picture_updated", "user", a.id, {
        format: "webp",
      });
    });
    return { ok: true };
  }
}
