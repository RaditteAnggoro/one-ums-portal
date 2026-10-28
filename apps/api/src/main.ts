import "reflect-metadata";
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  Res,
  Module,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { pool, transaction } from "./db.js";
import { actorFor, audit, campaignFor, scope, scopeValues } from "./context.js";
import {
  passwordMatches,
  passwordHash,
  sessionToken,
  tokenHash,
} from "./security.js";
import {
  createCampaign,
  submitCampaign,
  decideCampaign,
  runAction,
  reviseCampaign,
  campaignAction,
  recoverRun,
} from "./campaigns.js";
import { startWorkers, reconcileLocalMessage } from "./queue.js";
import {
  channels,
  periodEnd,
  variables,
} from "../../../packages/domain/src/rules.js";
import { pathToFileURL } from "node:url";
import { AdminController, ProfileController } from "./admin.js";
import { ProvidersController } from "./providers.js";
import { LedgerController } from "./ledger.js";
import { OperationsController, maskRecipient } from "./operations.js";
import {
  dashboardSchema,
  defaultDashboard,
} from "../../../packages/domain/src/dashboard.js";
import {
  SourcesController,
  IncomingController,
  sourceRows,
} from "./sources.js";

const loginAttempts = new Map<string, { count: number; until: number }>();
const dummyPasswordHash = passwordHash(sessionToken());
function costView(record: Record<string, unknown>, allowed: boolean) {
  if (allowed) return record;
  const hidden = new Set([
    "unit_cost",
    "estimated",
    "cost",
    "spendingCeiling",
    "costCentreId",
    "budget_id",
    "rate_id",
  ]);
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !hidden.has(key)),
  );
}
@Controller()
class ApiController {
  @Get("health") async health() {
    await pool.query("SELECT 1");
    return { status: "ok", mode: "simulation" };
  }
  @Post("auth/login") async login(
    @Body() input: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(256),
      })
      .parse(input);
    const key = `${req.ip}:${email.toLowerCase()}`;
    const now = Date.now();
    for (const [k, v] of loginAttempts)
      if (v.until < now) loginAttempts.delete(k);
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.count >= 8)
      throw new HttpException(
        "Terlalu banyak percobaan. Coba kembali dalam 15 menit.",
        429,
      );
    const user = (
      await pool.query("SELECT * FROM users WHERE lower(email)=$1 AND active", [
        email.toLowerCase(),
      ])
    ).rows[0];
    // Spend a password derivation for unknown accounts too.
    const valid = user
      ? passwordMatches(password, user.password_hash)
      : passwordMatches(password, dummyPasswordHash);
    if (!user || !valid) {
      loginAttempts.set(key, {
        count: (attempt?.count ?? 0) + 1,
        until: attempt?.until ?? now + 900000,
      });
      throw new UnauthorizedException("Email atau kata sandi tidak sesuai.");
    }
    loginAttempts.delete(key);
    const token = sessionToken();
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [tokenHash(token), user.id],
    );
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 3600000,
      path: "/",
    });
    req.cookies = { ...req.cookies, session: token };
    const actor = await actorFor(req);
    await transaction((db) => audit(db, actor, "auth.login", "user", user.id));
    return { ok: true };
  }
  @Post("auth/logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = await actorFor(req);
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      tokenHash(req.cookies.session),
    ]);
    res.clearCookie("session", { path: "/" });
    await transaction((db) => audit(db, a, "auth.logout", "user", a.id));
    return { ok: true };
  }
  @Post("auth/password") async changePassword(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req);
    const v = z
      .object({
        currentPassword: z.string().min(1).max(256),
        newPassword: z.string().min(12).max(256),
      })
      .parse(input);
    const key = `password:${a.id}:${req.ip}`;
    const attempt = loginAttempts.get(key);
    const current = attempt && attempt.until > Date.now() ? attempt : undefined;
    if (current && current.count >= 8)
      throw new HttpException(
        "Terlalu banyak percobaan. Coba kembali dalam 15 menit.",
        429,
      );
    await transaction(async (db) => {
      const user = (
        await db.query(
          "SELECT password_hash FROM users WHERE id=$1 AND company_id=$2 AND active FOR UPDATE",
          [a.id, a.company_id],
        )
      ).rows[0];
      if (!user || !passwordMatches(v.currentPassword, user.password_hash)) {
        loginAttempts.set(key, {
          count: (current?.count ?? 0) + 1,
          until: current?.until ?? Date.now() + 900000,
        });
        throw new UnauthorizedException("Kata sandi saat ini tidak sesuai.");
      }
      if (passwordMatches(v.newPassword, user.password_hash))
        throw new BadRequestException(
          "Gunakan kata sandi yang berbeda dari sebelumnya.",
        );
      await db.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        a.id,
        passwordHash(v.newPassword),
      ]);
      const sessions = await db.query(
        "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2",
        [a.id, tokenHash(req.cookies.session)],
      );
      await audit(db, a, "auth.password_changed", "user", a.id, {
        revokedOtherSessions: sessions.rowCount,
      });
    });
    loginAttempts.delete(key);
    return { ok: true };
  }
  @Get("bootstrap") async bootstrap(@Req() req: Request) {
    const a = await actorFor(req);
    const campaignRead = a.permissions.includes("campaigns:read");
    const layout = dashboardSchema.parse(
      a.profile.dashboard ??
        a.role_dashboard ??
        a.company_dashboard ??
        defaultDashboard,
    );
    const values = scopeValues(a);
    const [
      campaigns,
      templates,
      datasets,
      budgets,
      notifications,
      policy,
      roles,
      costCentres,
    ] = await Promise.all([
      pool.query(
        `SELECT c.id,c.name,c.version,c.team_id,c.created_by,c.status,c.created_at,c.updated_at,c.definition,u.name AS creator_name,(SELECT count(*) FROM runs r WHERE r.campaign_id=c.id) AS run_count FROM campaigns c JOIN users u ON u.id=c.created_by WHERE ${scope(a, "c")} ORDER BY c.created_at DESC LIMIT 100`,
        values,
      ),
      pool.query(
        `SELECT * FROM templates WHERE ${scope(a)} ORDER BY created_at DESC LIMIT 100`,
        values,
      ),
      pool.query(
        `SELECT id,name,team_id,version,source,jsonb_array_length(rows) AS row_count,created_at FROM datasets WHERE ${scope(a)} ORDER BY created_at DESC LIMIT 100`,
        values,
      ),
      pool.query(
        `SELECT b.*,cc.name,cc.team_id,b.allocated+b.adjusted-b.reserved-b.spent AS available FROM budgets b JOIN cost_centres cc ON cc.id=b.cost_centre_id WHERE ${scope(a, "cc")} ORDER BY b.starts_on DESC`,
        values,
      ),
      pool.query(
        `SELECT * FROM notifications WHERE ${scope(a)} AND ($4::boolean OR category<>'budget') ORDER BY created_at DESC LIMIT 30`,
        [...values, a.permissions.includes("budgets:read")],
      ),
      pool.query("SELECT * FROM approval_policies WHERE company_id=$1", [
        a.company_id,
      ]),
      pool.query(
        "SELECT id,name,permissions,company_scope FROM roles WHERE company_id=$1",
        [a.company_id],
      ),
      pool.query(
        `SELECT * FROM cost_centres WHERE ${scope(a)} ORDER BY name`,
        values,
      ),
    ]);
    const stats = (
      await pool.query(
        `SELECT m.status,m.channel,count(*)::int AS count FROM messages m JOIN runs r ON r.id=m.run_id JOIN campaigns c ON c.id=r.campaign_id WHERE ${scope(a, "c")} AND ($4='all' OR m.channel=$4) AND ($5::int=0 OR m.created_at>=now()-$5::int*interval '1 day') GROUP BY m.status,m.channel`,
        [
          ...values,
          layout.filters.channel,
          layout.filters.days === "all" ? 0 : Number(layout.filters.days),
        ],
      )
    ).rows;
    const { ip, correlationId, session_ref, ...user } = a;
    return {
      user: { ...user, profile: { ...user.profile, dashboard: layout } },
      campaigns: campaignRead
        ? campaigns.rows.map((c) => ({
            ...c,
            definition: costView(
              c.definition,
              a.permissions.includes("budgets:read"),
            ),
          }))
        : [],
      templates:
        campaignRead || a.permissions.includes("templates:write")
          ? templates.rows
          : [],
      datasets:
        campaignRead || a.permissions.includes("sources:write")
          ? datasets.rows
          : [],
      budgets: a.permissions.includes("budgets:read") ? budgets.rows : [],
      notifications: campaignRead ? notifications.rows : [],
      policy: policy.rows[0],
      roles: roles.rows,
      costCentres: a.permissions.includes("budgets:read")
        ? costCentres.rows
        : [],
      stats: campaignRead ? stats : [],
      mode: "simulation",
    };
  }
  @Post("campaigns") async create(@Req() req: Request, @Body() body: unknown) {
    return createCampaign(await actorFor(req, "campaigns:create"), body);
  }
  @Post("campaigns/:id/submit") async submit(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return submitCampaign(
      await actorFor(req, "campaigns:create"),
      z.uuid().parse(id),
    );
  }
  @Put("campaigns/:id") async revise(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    return reviseCampaign(
      await actorFor(req, "campaigns:create"),
      z.uuid().parse(id),
      input,
    );
  }
  @Post("campaigns/:id/decision") async decision(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return decideCampaign(
      await actorFor(req, "campaigns:approve"),
      z.uuid().parse(id),
      body,
    );
  }
  @Post("campaigns/:id/control") async control(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const value = z
      .object({
        action: z.enum(["pause", "resume", "cancel"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input);
    return campaignAction(
      await actorFor(req, "campaigns:manage"),
      z.uuid().parse(id),
      value.action,
      value.reason,
    );
  }
  @Post("runs/:id/recover") async recover(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const value = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .parse(input);
    return recoverRun(
      await actorFor(req, "campaigns:manage"),
      z.uuid().parse(id),
      value.reason,
    );
  }
  @Get("campaigns/:id") async detail(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("page") page = "0",
  ) {
    const a = await actorFor(req, "campaigns:read");
    z.uuid().parse(id);
    const messagePage = z.coerce.number().int().min(0).max(100000).parse(page);
    return transaction(async (db) => {
      const campaign = await campaignFor(db, a, id);
      const runs = (
        await db.query(
          "SELECT * FROM runs WHERE company_id=$1 AND campaign_id=$2 ORDER BY created_at DESC",
          [a.company_id, id],
        )
      ).rows;
      const approvals = (
        await db.query(
          "SELECT ap.*,u.name AS actor_name FROM approvals ap JOIN users u ON u.id=ap.actor_id WHERE ap.company_id=$1 AND ap.campaign_id=$2 ORDER BY created_at",
          [a.company_id, id],
        )
      ).rows;
      const messages = (
        await db.query(
          "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE m.company_id=$1 AND r.campaign_id=$2 ORDER BY m.created_at,m.id LIMIT 200 OFFSET $3",
          [a.company_id, id, messagePage * 200],
        )
      ).rows;
      const messageTotal = Number(
        (
          await db.query(
            "SELECT count(*) AS n FROM messages m JOIN runs r ON r.id=m.run_id WHERE m.company_id=$1 AND r.campaign_id=$2",
            [a.company_id, id],
          )
        ).rows[0].n,
      );
      const mayPreview = [
        "campaigns:create",
        "campaigns:approve",
        "messages:payload",
        "admin:write",
      ].some((p) => a.permissions.includes(p));
      const messageView = (m: Record<string, unknown>) => {
        const { body, recipient, ...metadata } = m;
        return costView(
          mayPreview
            ? m
            : {
                ...metadata,
                recipient: maskRecipient(String(recipient ?? "")),
              },
          a.permissions.includes("budgets:read"),
        );
      };
      return {
        campaign: {
          ...campaign,
          definition: costView(
            campaign.definition,
            a.permissions.includes("budgets:read"),
          ),
          message_count: campaign.snapshot?.length ?? 0,
          snapshot: campaign.snapshot?.slice(0, 3).map(messageView),
        },
        runs: runs.map((r) =>
          costView(r, a.permissions.includes("budgets:read")),
        ),
        approvals,
        messages: messages.map(messageView),
        messageTotal,
        messagePage,
      };
    });
  }
  @Get("messages/:id") async timeline(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "campaigns:read");
    z.uuid().parse(id);
    const message = (
      await pool.query(
        `SELECT m.*,r.campaign_id FROM messages m JOIN runs r ON r.id=m.run_id JOIN campaigns c ON c.id=r.campaign_id WHERE ${scope(a, "c")} AND m.id=$4`,
        [...scopeValues(a), id],
      )
    ).rows[0];
    if (!message) throw new NotFoundException("Pesan tidak ditemukan.");
    const [events, attempts] = await Promise.all([
      pool.query(
        "SELECT * FROM message_events WHERE company_id=$1 AND message_id=$2 ORDER BY created_at,sequence",
        [a.company_id, id],
      ),
      pool.query(
        "SELECT * FROM attempts WHERE company_id=$1 AND message_id=$2 ORDER BY created_at",
        [a.company_id, id],
      ),
    ]);
    const mayReadPayload =
      a.permissions.includes("messages:payload") ||
      a.permissions.includes("admin:write");
    if (mayReadPayload)
      await transaction((db) =>
        audit(db, a, "message.payload_viewed", "message", id),
      );
    const { body, recipient, ...metadata } = message;
    return {
      message: costView(
        {
          ...metadata,
          recipient: maskRecipient(recipient),
          recipient_masked: maskRecipient(recipient),
          ...(mayReadPayload ? { body } : {}),
        },
        a.permissions.includes("budgets:read"),
      ),
      payloadAvailable: mayReadPayload,
      events: events.rows,
      attempts: attempts.rows,
    };
  }
  @Post("messages/:id/reconcile") async reconcile(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const v = z
      .object({
        status: z.enum(["DELIVERED", "FAILED"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input);
    return reconcileLocalMessage(
      await actorFor(req, "budgets:write"),
      z.uuid().parse(id),
      v.status,
      v.reason,
    );
  }
  @Post("runs/:id/:action") async run(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() input: unknown,
  ) {
    const value = z
      .object({ date: z.iso.datetime({ offset: true }).optional() })
      .parse(input ?? {});
    return runAction(
      await actorFor(req, "campaigns:manage"),
      z.uuid().parse(id),
      z.enum(["retry", "reschedule", "cancel"]).parse(action),
      value.date,
    );
  }
  @Get("templates/:id") async getTemplate(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "campaigns:read");
    z.uuid().parse(id);
    const row = (
      await pool.query(`SELECT * FROM templates WHERE ${scope(a)} AND id=$4`, [
        ...scopeValues(a),
        id,
      ])
    ).rows[0];
    if (!row) throw new NotFoundException("Template tidak ditemukan.");
    return row;
  }
  @Post("templates") async template(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "templates:write");
    const v = z
      .object({
        name: z.string().trim().min(3).max(120),
        channel: z.enum(channels),
        body: z.string().min(1).max(10000),
        parentId: z.uuid().optional(),
      })
      .parse(input);
    return transaction(async (db) => {
      let version = 1;
      if (v.parentId) {
        const parent = (
          await db.query(
            `SELECT * FROM templates WHERE ${scope(a)} AND id=$4`,
            [...scopeValues(a), v.parentId],
          )
        ).rows[0];
        if (!parent) throw new NotFoundException();
        version = parent.version + 1;
      }
      const result = (
        await db.query(
          "INSERT INTO templates(company_id,team_id,name,channel,body,version,parent_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            a.company_id,
            a.team_id,
            v.name,
            v.channel,
            v.body,
            version,
            v.parentId,
            a.id,
          ],
        )
      ).rows[0];
      await audit(db, a, "template.version_created", "template", result.id, {
        version,
        variables: variables(v.body),
      });
      return result;
    });
  }
  @Get("datasets/:id") async dataPreview(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "campaigns:read");
    if (
      ![
        "sources:write",
        "campaigns:create",
        "campaigns:approve",
        "admin:write",
      ].some((p) => a.permissions.includes(p))
    )
      throw new ForbiddenException(
        "Pratinjau data sumber memerlukan izin pengelolaan atau peninjauan kampanye.",
      );
    z.uuid().parse(id);
    const data = (
      await pool.query(`SELECT * FROM datasets WHERE ${scope(a)} AND id=$4`, [
        ...scopeValues(a),
        id,
      ])
    ).rows[0];
    if (!data) throw new NotFoundException("Sumber tidak ditemukan.");
    return {
      ...data,
      row_count: data.rows.length,
      rows: data.rows.slice(0, 20),
    };
  }
  @Post("datasets") async dataset(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "sources:write");
    const v = z
      .object({
        name: z.string().min(3).max(120),
        format: z.enum(["csv", "xlsx", "json"]),
        content: z.string().max(12_000_000),
      })
      .parse(input);
    let rows: Record<string, string>[] = [];
    if (v.format === "csv")
      rows = parse(v.content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
        max_record_size: 100000,
      });
    else if (v.format === "json") rows = sourceRows(JSON.parse(v.content));
    else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(v.content, "base64") as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new BadRequestException("Lembar kerja kosong.");
      const headers = (sheet.getRow(1).values as unknown[])
        .slice(1)
        .map(String);
      if (
        new Set(headers).size !== headers.length ||
        headers.some((h) => !h.trim())
      )
        throw new BadRequestException(
          "Judul kolom harus unik dan tidak kosong.",
        );
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const values: Record<string, string> = {};
        headers.forEach((header, i) => {
          const cell = row.getCell(i + 1);
          if (cell.type === ExcelJS.ValueType.Formula)
            throw new BadRequestException(
              "Gunakan nilai, bukan formula, pada sumber data.",
            );
          values[header] = cell.text;
        });
        rows.push(values);
      });
    }
    rows = sourceRows(rows);
    const max = Number(process.env.MAX_IMPORT_ROWS ?? 50000);
    if (!rows.length || rows.length > max)
      throw new BadRequestException(
        `Unggah 1–${max} baris untuk kapasitas lokal saat ini.`,
      );
    if (
      rows.some(
        (row) =>
          Object.keys(row).length > 100 ||
          Object.values(row).some(
            (value) => typeof value !== "string" || value.length > 10000,
          ),
      )
    )
      throw new BadRequestException(
        "Kolom terlalu banyak atau isi sel terlalu panjang.",
      );
    return transaction(async (db) => {
      const result = (
        await db.query(
          "INSERT INTO datasets(company_id,team_id,name,rows,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,name,version",
          [a.company_id, a.team_id, v.name, JSON.stringify(rows), a.id],
        )
      ).rows[0];
      await audit(db, a, "dataset.imported", "dataset", result.id, {
        rows: rows.length,
        format: v.format,
      });
      return { ...result, row_count: rows.length, preview: rows.slice(0, 5) };
    });
  }
  @Post("budgets/:id/topup") async topup(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "budgets:write");
    z.uuid().parse(id);
    const v = z
      .object({
        amount: z.string().regex(/^[1-9]\d{0,11}(\.\d{1,4})?$/),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input);
    return transaction(async (db) => {
      const b = (
        await db.query(
          `UPDATE budgets b SET adjusted=adjusted+$4::numeric FROM cost_centres cc WHERE b.cost_centre_id=cc.id AND ${scope(a, "cc")} AND b.id=$5 RETURNING b.*,cc.team_id`,
          [...scopeValues(a), v.amount, id],
        )
      ).rows[0];
      if (!b) throw new NotFoundException("Anggaran tidak ditemukan.");
      const key = sessionToken();
      await db.query(
        "INSERT INTO ledger(company_id,budget_id,kind,amount,idempotency_key,reason,actor_id) VALUES($1,$2,'ADJUST',$3,$4,$5,$6)",
        [a.company_id, id, v.amount, key, v.reason, a.id],
      );
      await audit(
        db,
        { ...a, team_id: b.team_id },
        "budget.topup",
        "budget",
        id,
        {
          amount: v.amount,
          reason: v.reason,
        },
      );
      return b;
    });
  }
  @Post("budgets") async newBudget(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "budgets:write");
    const v = z
      .object({
        costCentreId: z.uuid(),
        startsOn: z.string(),
        months: z.number().int(),
        amount: z.string().regex(/^\d{1,12}(\.\d{1,4})?$/),
      })
      .parse(input);
    const end = periodEnd(v.startsOn, v.months);
    return transaction(async (db) => {
      const centre = (
        await db.query(
          `SELECT * FROM cost_centres WHERE ${scope(a)} AND id=$4 FOR UPDATE`,
          [...scopeValues(a), v.costCentreId],
        )
      ).rows[0];
      if (!centre) throw new NotFoundException();
      const overlaps = await db.query(
        "SELECT 1 FROM budgets WHERE cost_centre_id=$1 AND starts_on<$3::date AND ends_on>$2::date",
        [v.costCentreId, v.startsOn, end],
      );
      if (overlaps.rowCount)
        throw new ConflictException("Periode anggaran bertumpang tindih.");
      const b = (
        await db.query(
          "INSERT INTO budgets(company_id,cost_centre_id,starts_on,ends_on,months,allocated) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [a.company_id, v.costCentreId, v.startsOn, end, v.months, v.amount],
        )
      ).rows[0];
      await db.query(
        "INSERT INTO ledger(company_id,budget_id,kind,amount,idempotency_key,reason,actor_id) VALUES($1,$2,'ALLOCATE',$3,$4,$5,$6)",
        [
          a.company_id,
          b.id,
          v.amount,
          `allocate:${b.id}`,
          "Initial period allocation",
          a.id,
        ],
      );
      await audit(
        db,
        { ...a, team_id: centre.team_id },
        "budget.created",
        "budget",
        b.id,
        {
          startsOn: v.startsOn,
          endsOn: end,
          months: v.months,
          amount: v.amount,
        },
      );
      return b;
    });
  }
  @Get("audit") async audits(
    @Req() req: Request,
    @Query("search") search = "",
  ) {
    const a = await actorFor(req, "audit:read");
    return (
      await pool.query(
        `SELECT au.*,u.name AS actor_name FROM audit au LEFT JOIN users u ON u.id=au.actor_id WHERE ${scope(a, "au")} AND (au.action ILIKE $4 OR au.resource_id ILIKE $4) ORDER BY au.created_at DESC LIMIT 200`,
        [...scopeValues(a), `%${search.slice(0, 100)}%`],
      )
    ).rows;
  }
  @Put("profile") async profile(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req);
    const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        bio: z.string().max(500).default(""),
      })
      .parse(input);
    return transaction(async (db) => {
      await db.query(
        "UPDATE users SET name=$2,profile=jsonb_set(profile,'{bio}',to_jsonb($3::text)) WHERE id=$1",
        [a.id, v.name, v.bio],
      );
      await audit(db, a, "profile.updated", "user", a.id, {
        fields: ["name", "bio"],
      });
      return { ok: true };
    });
  }
  @Put("dashboard") async dashboard(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req);
    const v = dashboardSchema.parse(input);
    await pool.query(
      "UPDATE users SET profile=jsonb_set(profile,'{dashboard}', $2::jsonb) WHERE id=$1",
      [a.id, JSON.stringify(v)],
    );
    return { ok: true };
  }
  @Post("dashboard/reset") async resetDashboard(@Req() req: Request) {
    const a = await actorFor(req);
    await pool.query(
      "UPDATE users SET profile=profile-'dashboard' WHERE id=$1",
      [a.id],
    );
    return { ok: true };
  }
  @Post("notifications/:id/read") async readNotification(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "campaigns:read");
    z.uuid().parse(id);
    const changed = await pool.query(
      `UPDATE notifications SET read_by=CASE WHEN read_by ? $4::text THEN read_by ELSE read_by||jsonb_build_array($4::text) END WHERE ${scope(a)} AND id=$5 RETURNING id`,
      [...scopeValues(a), a.id, id],
    );
    if (!changed.rowCount) throw new NotFoundException();
    return { ok: true };
  }
  @Put("admin/approval-policy") async policy(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = z
      .object({
        stages: z
          .array(
            z.object({
              name: z.string().min(2).max(100),
              roleIds: z.array(z.uuid()).min(1).max(20),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(input);
    return transaction(async (db) => {
      const ids = [...new Set(v.stages.flatMap((s) => s.roleIds))];
      const roles = (
        await db.query(
          "SELECT id FROM roles WHERE company_id=$1 AND id=ANY($2::uuid[]) AND permissions ? 'campaigns:approve'",
          [a.company_id, ids],
        )
      ).rows;
      if (roles.length !== ids.length)
        throw new BadRequestException(
          "Semua peran harus berasal dari perusahaan Anda dan memiliki izin persetujuan.",
        );
      const p = (
        await db.query(
          "UPDATE approval_policies SET stages=$2,version=version+1 WHERE company_id=$1 RETURNING *",
          [a.company_id, JSON.stringify(v.stages)],
        )
      ).rows[0];
      await audit(
        db,
        a,
        "approval_policy.updated",
        "approval_policy",
        a.company_id,
        { version: p.version, stages: v.stages },
      );
      return p;
    });
  }
}
@Module({
  controllers: [
    ApiController,
    AdminController,
    ProfileController,
    SourcesController,
    IncomingController,
    ProvidersController,
    LedgerController,
    OperationsController,
  ],
})
class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: () => void) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !/^\/api\/incoming\/datasets\/[a-f0-9-]+$/i.test(req.path)
    ) {
      const origins = (
        process.env.APP_ORIGIN ?? "http://127.0.0.1:3000,http://localhost:3000"
      ).split(",");
      if (
        req.headers["x-requested-with"] !== "MessagingApp" ||
        !req.headers.origin ||
        !origins.includes(req.headers.origin)
      )
        return res.status(403).json({ message: "Permintaan tidak diizinkan." });
    }
    next();
  });
  app.useGlobalFilters({
    catch(error: unknown, host: any) {
      const res = host.switchToHttp().getResponse() as Response;
      const databaseCode = (error as { code?: string })?.code;
      const code =
        error instanceof HttpException
          ? error.getStatus()
          : error instanceof ZodError || error instanceof SyntaxError
            ? 400
            : ["23505", "23P01"].includes(databaseCode ?? "")
              ? 409
              : databaseCode === "23503"
                ? 400
                : 500;
      if (code === 500)
        console.error("Unhandled API error", {
          name: (error as Error)?.name,
          code: databaseCode,
        });
      res.status(code).json({
        message:
          error instanceof ZodError
            ? error.issues
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("; ")
            : error instanceof HttpException
              ? error.message
              : code === 409
                ? "Data sudah ada atau periode bertumpang tindih."
                : code === 400
                  ? "Format data tidak valid."
                  : "Terjadi kesalahan. Coba lagi atau hubungi administrator.",
      });
    },
  });
  // Bound imports; body parsing must precede the default Nest parser.
  const express = await import("express");
  app.use(express.json({ limit: "16mb" }));
  return app;
}
async function main() {
  const app = await createApp();
  const close = await startWorkers();
  await app.listen(Number(process.env.PORT ?? 4100), "127.0.0.1");
  const stop = async () => {
    await close();
    await app.close();
    await pool.end();
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
