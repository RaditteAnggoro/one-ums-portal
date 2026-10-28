import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "./db.js";
import { type Actor, actorFor, audit, scope, scopeValues } from "./context.js";
import { sessionToken, tokenHash } from "./security.js";
import { fetchSourceJson, valueAt } from "./network.js";

const rowSchema = z
  .array(
    z.record(
      z
        .string()
        .regex(/^(?!__proto__$|constructor$|prototype$)[A-Za-z_][\w -]{0,99}$/),
      z.union([
        z.string().max(10000),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ]),
    ),
  )
  .min(1)
  .max(50000);
export function sourceRows(input: unknown) {
  const rows = rowSchema.parse(input);
  if (rows.some((row) => Object.keys(row).length > 100))
    throw new BadRequestException("Maksimal 100 kolom per baris.");
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v === null ? "" : String(v)]),
    ),
  );
}
const sourceSchema = z.object({
  name: z.string().trim().min(3).max(120),
  type: z.enum(["REST", "INCOMING"]),
  url: z.url().max(2000).optional(),
  rowsPath: z
    .string()
    .regex(/^[\w.]*$/)
    .max(150)
    .default(""),
  secretEnv: z
    .string()
    .regex(/^SOURCE_[A-Z0-9_]{1,64}$/)
    .optional(),
});
async function ingest(
  actor: Actor,
  sourceId: string,
  key: string,
  rows: ReturnType<typeof sourceRows>,
) {
  const hash = tokenHash(JSON.stringify(rows));
  return transaction(async (db) => {
    const source = (
      await db.query(
        `SELECT * FROM source_connections WHERE ${scope(actor)} AND id=$4 AND active FOR UPDATE`,
        [...scopeValues(actor), sourceId],
      )
    ).rows[0];
    if (!source) throw new NotFoundException("Koneksi sumber tidak tersedia.");
    const previous = (
      await db.query(
        "SELECT * FROM ingestion_requests WHERE source_id=$1 AND idempotency_key=$2",
        [sourceId, key],
      )
    ).rows[0];
    if (previous) {
      if (previous.body_hash !== hash)
        throw new ConflictException(
          "Kunci idempotensi telah digunakan dengan data berbeda.",
        );
      return { id: previous.dataset_id, replayed: true };
    }
    const version = source.last_data_version + 1;
    const dataset = (
      await db.query(
        "INSERT INTO datasets(company_id,team_id,name,rows,version,source,source_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,version",
        [
          actor.company_id,
          source.team_id,
          `${source.name} · v${version}`,
          JSON.stringify(rows),
          version,
          source.type.toLowerCase(),
          sourceId,
          actor.id,
        ],
      )
    ).rows[0];
    await db.query(
      "INSERT INTO ingestion_requests(source_id,idempotency_key,body_hash,dataset_id) VALUES($1,$2,$3,$4)",
      [sourceId, key, hash, dataset.id],
    );
    await db.query(
      "UPDATE source_connections SET last_data_version=$2 WHERE id=$1",
      [sourceId, version],
    );
    await audit(
      db,
      { ...actor, team_id: source.team_id },
      "source.ingested",
      "dataset",
      dataset.id,
      { sourceId, rows: rows.length, version },
    );
    return { ...dataset, row_count: rows.length };
  });
}
@Controller("sources")
export class SourcesController {
  @Get(":id/keys") async keys(@Req() req: Request, @Param("id") id: string) {
    const a = await actorFor(req, "sources:write");
    z.uuid().parse(id);
    const source = (
      await pool.query(
        `SELECT id FROM source_connections WHERE ${scope(a)} AND id=$4`,
        [...scopeValues(a), id],
      )
    ).rows[0];
    if (!source) throw new NotFoundException();
    return (
      await pool.query(
        "SELECT id,created_at,expires_at,revoked_at FROM source_keys WHERE source_id=$1 ORDER BY created_at DESC LIMIT 100",
        [id],
      )
    ).rows;
  }
  @Get() async list(@Req() req: Request) {
    const a = await actorFor(req, "sources:write");
    return (
      await pool.query(
        `SELECT id,name,type,config,version,last_data_version,active FROM source_connections WHERE ${scope(a)} ORDER BY created_at DESC`,
        scopeValues(a),
      )
    ).rows;
  }
  @Post() async create(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "sources:write");
    const v = sourceSchema.parse(input);
    if (v.type === "REST") {
      if (!v.url) throw new BadRequestException("URL sumber wajib diisi.");
      const url = new URL(v.url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new BadRequestException("Gunakan HTTPS tanpa kredensial di URL.");
    }
    return transaction(async (db) => {
      const source = (
        await db.query(
          "INSERT INTO source_connections(company_id,team_id,name,type,config,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,type",
          [
            a.company_id,
            a.team_id,
            v.name,
            v.type,
            JSON.stringify({
              url: v.url,
              rowsPath: v.rowsPath,
              secretEnv: v.secretEnv,
            }),
            a.id,
          ],
        )
      ).rows[0];
      await audit(db, a, "source.created", "source", source.id, {
        type: v.type,
      });
      return source;
    });
  }
  @Post(":id/refresh") async refresh(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "sources:write");
    z.uuid().parse(id);
    const source = (
      await pool.query(
        `SELECT * FROM source_connections WHERE ${scope(a)} AND id=$4 AND type='REST' AND active`,
        [...scopeValues(a), id],
      )
    ).rows[0];
    if (!source) throw new NotFoundException();
    const data = await fetchSourceJson(
      source.config.url,
      source.config.secretEnv,
    );
    const rows = sourceRows(valueAt(data, source.config.rowsPath));
    return ingest(
      a,
      id,
      z.uuid().parse(req.headers["idempotency-key"] ?? randomUUID()),
      rows,
    );
  }
  @Post(":id/keys") async key(@Req() req: Request, @Param("id") id: string) {
    const a = await actorFor(req, "sources:write");
    z.uuid().parse(id);
    const token = `relay_source_${sessionToken()}`;
    return transaction(async (db) => {
      const source = (
        await db.query(
          `SELECT * FROM source_connections WHERE ${scope(a)} AND id=$4 AND type='INCOMING' AND active`,
          [...scopeValues(a), id],
        )
      ).rows[0];
      if (!source) throw new NotFoundException();
      const key = (
        await db.query(
          "INSERT INTO source_keys(source_id,token_hash,created_by,expires_at) VALUES($1,$2,$3,now()+interval '90 days') RETURNING id,expires_at",
          [id, tokenHash(token), a.id],
        )
      ).rows[0];
      await audit(db, a, "source.key_created", "source", id, {
        keyId: key.id,
        expiresAt: key.expires_at,
      });
      return { ...key, token, endpoint: `/api/incoming/datasets/${id}` };
    });
  }
  @Post(":id/keys/:keyId/revoke") async revoke(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("keyId") keyId: string,
  ) {
    const a = await actorFor(req, "sources:write");
    z.uuid().parse(id);
    z.uuid().parse(keyId);
    return transaction(async (db) => {
      const source = (
        await db.query(
          `SELECT id FROM source_connections WHERE ${scope(a)} AND id=$4`,
          [...scopeValues(a), id],
        )
      ).rows[0];
      if (!source) throw new NotFoundException();
      const changed = await db.query(
        "UPDATE source_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE source_id=$1 AND id=$2 RETURNING id",
        [id, keyId],
      );
      if (!changed.rowCount) throw new NotFoundException();
      await audit(db, a, "source.key_revoked", "source", id, { keyId });
      return { ok: true };
    });
  }
}
@Controller("incoming/datasets")
export class IncomingController {
  @Post(":id") async incoming(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    z.uuid().parse(id);
    const key = z.uuid().parse(req.headers["idempotency-key"]);
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException();
    const a = (
      await pool.query(
        `SELECT u.id,u.company_id,s.team_id,u.role_id,u.email,u.name,u.profile,r.permissions,false AS company_scope,r.name AS role,c.name AS company
      FROM source_keys k JOIN source_connections s ON s.id=k.source_id JOIN users u ON u.id=k.created_by JOIN roles r ON r.id=u.role_id JOIN companies c ON c.id=u.company_id
      WHERE k.token_hash=$1 AND k.source_id=$2 AND k.revoked_at IS NULL AND k.expires_at>now() AND s.active AND u.active AND u.company_id=s.company_id AND (r.company_scope OR u.team_id=s.team_id) AND r.permissions ? 'sources:write'`,
        [tokenHash(token), id],
      )
    ).rows[0];
    if (!a)
      throw new UnauthorizedException(
        "Kunci sumber tidak valid atau sudah berakhir.",
      );
    const rows = sourceRows(z.object({ rows: z.unknown() }).parse(input).rows);
    return ingest(
      { ...a, ip: req.ip ?? "unknown", correlationId: randomUUID() },
      id,
      key,
      rows,
    );
  }
}
