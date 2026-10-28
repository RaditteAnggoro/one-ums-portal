import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import type { Request } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, transaction } from "./db.js";
import { actorFor, audit } from "./context.js";
import { encryptSecret } from "./secrets.js";
import {
  genericContract,
  mapRequest,
} from "../../../packages/domain/src/provider-contract.js";
import { channels, type Channel } from "../../../packages/domain/src/rules.js";

const money = z.string().regex(/^\d{1,12}(\.\d{1,4})?$/);
const accountSchema = z.object({
  definitionId: z.uuid(),
  sender: z.string().trim().min(1).max(120),
  credentials: z.record(z.string().max(60), z.string().max(2000)).optional(),
});
export async function providerPrice(
  db: PoolClient,
  company: string,
  accountId: string,
  channel: Channel,
  at = new Date(),
) {
  const version = (
    await db.query(
      `SELECT v.*,a.enabled,d.adapter,d.channels,d.config,a.id AS provider_account_id FROM provider_accounts a
    JOIN provider_account_versions v ON v.id=a.current_version_id JOIN provider_definitions d ON d.id=v.definition_id WHERE a.company_id=$1 AND a.id=$2`,
      [company, accountId],
    )
  ).rows[0];
  if (!version || !version.enabled || !version.channels.includes(channel))
    throw new BadRequestException(
      "Akun penyedia tidak aktif atau tidak mendukung kanal ini.",
    );
  if (version.adapter !== "SIMULATOR")
    throw new BadRequestException(
      "Transport vendor nyata belum diaktifkan; gunakan simulator untuk portofolio lokal.",
    );
  const rate = (
    await db.query(
      `SELECT * FROM rate_cards WHERE company_id=$1 AND account_id=$2 AND channel=$3 AND effective_from<=$4 AND (effective_until IS NULL OR effective_until>$4) ORDER BY effective_from DESC LIMIT 1`,
      [company, accountId, channel, at],
    )
  ).rows[0];
  if (!rate)
    throw new BadRequestException(
      `Tarif ${channel} belum tersedia untuk waktu eksekusi.`,
    );
  return {
    versionId: version.id,
    rateId: rate.id,
    price: rate.price,
    simulated: version.simulated,
  };
}
@Controller("providers")
export class ProvidersController {
  @Get() async list(@Req() req: Request) {
    const a = await actorFor(req);
    if (
      !a.permissions.some((p) =>
        ["campaigns:read", "templates:write", "admin:write"].includes(p),
      )
    )
      throw new ForbiddenException();
    const accounts = (
      await pool.query(
        `SELECT a.id,a.name,a.enabled,v.id AS version_id,v.version,v.sender,v.simulated,v.definition_id,d.name AS provider,d.adapter,d.channels,
      (v.credentials_cipher IS NOT NULL) AS credentials_set FROM provider_accounts a JOIN provider_account_versions v ON v.id=a.current_version_id
      JOIN provider_definitions d ON d.id=v.definition_id WHERE a.company_id=$1 ORDER BY a.name`,
        [a.company_id],
      )
    ).rows;
    const definitions = a.permissions.includes("admin:write")
      ? (
          await pool.query(
            "SELECT id,name,adapter,version,parent_id,channels,config,published,validated_at FROM provider_definitions WHERE company_id=$1 ORDER BY created_at DESC",
            [a.company_id],
          )
        ).rows
      : [];
    const rates = a.permissions.some((p) =>
      ["budgets:read", "admin:write"].includes(p),
    )
      ? (
          await pool.query(
            "SELECT * FROM rate_cards WHERE company_id=$1 ORDER BY effective_from DESC",
            [a.company_id],
          )
        ).rows
      : [];
    return { accounts, definitions, rates, realDeliveryEnabled: false };
  }
  @Post("definitions") async definition(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    const v = z
      .object({
        name: z.string().trim().min(3).max(120),
        adapter: z.enum(["SIMULATOR", "GENERIC_HTTP"]),
        channels: z.array(z.enum(channels)).min(1).max(3),
        config: z.unknown().default({}),
        parentId: z.uuid().optional(),
      })
      .parse(input);
    const config =
      v.adapter === "GENERIC_HTTP" ? genericContract.parse(v.config) : {};
    return transaction(async (db) => {
      let version = 1;
      if (v.parentId) {
        const parent = (
          await db.query(
            "SELECT * FROM provider_definitions WHERE company_id=$1 AND id=$2 FOR UPDATE",
            [a.company_id, v.parentId],
          )
        ).rows[0];
        if (!parent) throw new NotFoundException();
        version = parent.version + 1;
      }
      const d = (
        await db.query(
          "INSERT INTO provider_definitions(company_id,name,adapter,channels,config,parent_id,version,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,version",
          [
            a.company_id,
            v.name,
            v.adapter,
            JSON.stringify([...new Set(v.channels)]),
            JSON.stringify(config),
            v.parentId,
            version,
            a.id,
          ],
        )
      ).rows[0];
      await audit(
        db,
        a,
        "provider.definition_created",
        "provider_definition",
        d.id,
        { version, adapter: v.adapter },
      );
      return d;
    });
  }
  @Post("definitions/:id/test") async test(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    return transaction(async (db) => {
      const d = (
        await db.query(
          "SELECT * FROM provider_definitions WHERE company_id=$1 AND id=$2 FOR UPDATE",
          [a.company_id, id],
        )
      ).rows[0];
      if (!d) throw new NotFoundException();
      let preview: unknown = { adapter: "SIMULATOR", channels: d.channels };
      if (d.adapter === "GENERIC_HTTP") {
        const contract = genericContract.parse(d.config);
        try {
          preview = mapRequest(contract.requestBody, {
            recipient: "demo@example.test",
            body: "Synthetic local preview",
            channel: "email",
            message_id: "demo-id",
            sender: "Demo",
            callback_url: "https://example.test/callback",
            template_name: "demo",
            template_language: "id",
            parameters: [],
          });
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }
      await db.query(
        "UPDATE provider_definitions SET validated_at=now() WHERE id=$1",
        [id],
      );
      await audit(
        db,
        a,
        "provider.configuration_validated",
        "provider_definition",
        id,
        { networkContacted: false, version: d.version },
      );
      return {
        valid: true,
        networkContacted: false,
        preview,
        note: "Validasi struktur dan mapping; bukan hasil uji vendor nyata.",
      };
    });
  }
  @Post("definitions/:id/publish") async publish(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    return transaction(async (db) => {
      const d = (
        await db.query(
          "UPDATE provider_definitions SET published=true WHERE company_id=$1 AND id=$2 AND validated_at IS NOT NULL RETURNING id,version",
          [a.company_id, id],
        )
      ).rows[0];
      if (!d)
        throw new BadRequestException(
          "Validasi konfigurasi sebelum publikasi.",
        );
      await audit(
        db,
        a,
        "provider.definition_published",
        "provider_definition",
        id,
        { version: d.version },
      );
      return d;
    });
  }
  @Post("accounts") async account(@Req() req: Request, @Body() input: unknown) {
    const a = await actorFor(req, "admin:write");
    const v = accountSchema
      .extend({
        name: z.string().trim().min(3).max(120),
        rates: z.partialRecord(z.enum(channels), money).default({}),
      })
      .parse(input);
    return transaction(async (db) => {
      const d = (
        await db.query(
          "SELECT * FROM provider_definitions WHERE company_id=$1 AND id=$2 AND published",
          [a.company_id, v.definitionId],
        )
      ).rows[0];
      if (!d)
        throw new BadRequestException(
          "Pilih definisi yang sudah dipublikasikan.",
        );
      if (Object.keys(v.rates).some((channel) => !d.channels.includes(channel)))
        throw new BadRequestException(
          "Tarif memuat kanal yang tidak didukung.",
        );
      const account = (
        await db.query(
          "INSERT INTO provider_accounts(company_id,name,enabled) VALUES($1,$2,$3) RETURNING id,name",
          [a.company_id, v.name, d.adapter === "SIMULATOR"],
        )
      ).rows[0];
      const version = (
        await db.query(
          "INSERT INTO provider_account_versions(company_id,account_id,definition_id,version,sender,credentials_cipher,simulated) VALUES($1,$2,$3,1,$4,$5,$6) RETURNING id",
          [
            a.company_id,
            account.id,
            d.id,
            v.sender,
            v.credentials ? encryptSecret(v.credentials) : null,
            d.adapter === "SIMULATOR",
          ],
        )
      ).rows[0];
      await db.query(
        "UPDATE provider_accounts SET current_version_id=$2 WHERE id=$1",
        [account.id, version.id],
      );
      for (const [channel, price] of Object.entries(v.rates))
        await db.query(
          "INSERT INTO rate_cards(company_id,account_id,channel,price,effective_from) VALUES($1,$2,$3,$4,now())",
          [a.company_id, account.id, channel, price],
        );
      await audit(
        db,
        a,
        "provider.account_created",
        "provider_account",
        account.id,
        {
          version: 1,
          credentialsSet: !!v.credentials,
          simulated: d.adapter === "SIMULATOR",
        },
      );
      return account;
    });
  }
  @Post("accounts/:id/versions") async version(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = accountSchema.parse(input);
    return transaction(async (db) => {
      const account = (
        await db.query(
          "SELECT a.*,v.version,v.credentials_cipher FROM provider_accounts a JOIN provider_account_versions v ON v.id=a.current_version_id WHERE a.company_id=$1 AND a.id=$2 FOR UPDATE OF a",
          [a.company_id, id],
        )
      ).rows[0];
      const d = (
        await db.query(
          "SELECT * FROM provider_definitions WHERE company_id=$1 AND id=$2 AND published",
          [a.company_id, v.definitionId],
        )
      ).rows[0];
      if (!account || !d) throw new NotFoundException();
      const version = (
        await db.query(
          "INSERT INTO provider_account_versions(company_id,account_id,definition_id,version,sender,credentials_cipher,simulated) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version",
          [
            a.company_id,
            id,
            d.id,
            account.version + 1,
            v.sender,
            v.credentials
              ? encryptSecret(v.credentials)
              : account.credentials_cipher,
            d.adapter === "SIMULATOR",
          ],
        )
      ).rows[0];
      await db.query(
        "UPDATE provider_accounts SET current_version_id=$2,enabled=$3 WHERE id=$1",
        [id, version.id, account.enabled && d.adapter === "SIMULATOR"],
      );
      await audit(
        db,
        a,
        "provider.account_version_created",
        "provider_account",
        id,
        {
          version: version.version,
          credentialsChanged: v.credentials !== undefined,
        },
      );
      return version;
    });
  }
  @Post("accounts/:id/status") async status(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = z.object({ enabled: z.boolean() }).parse(input);
    return transaction(async (db) => {
      const current = (
        await db.query(
          "SELECT a.id,d.adapter FROM provider_accounts a JOIN provider_account_versions v ON v.id=a.current_version_id JOIN provider_definitions d ON d.id=v.definition_id WHERE a.company_id=$1 AND a.id=$2 FOR UPDATE OF a",
          [a.company_id, id],
        )
      ).rows[0];
      if (!current) throw new NotFoundException();
      if (v.enabled && current.adapter !== "SIMULATOR")
        throw new BadRequestException(
          "Konfigurasi HTTP dapat disimpan dan divalidasi. Aktivasi transport nyata menunggu adapter serta pengujian vendor.",
        );
      await db.query("UPDATE provider_accounts SET enabled=$2 WHERE id=$1", [
        id,
        v.enabled,
      ]);
      await audit(
        db,
        a,
        "provider.account_status_changed",
        "provider_account",
        id,
        v,
      );
      return { ok: true };
    });
  }
  @Post("accounts/:id/rates") async rate(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req, "admin:write");
    z.uuid().parse(id);
    const v = z
      .object({
        channel: z.enum(channels),
        price: money,
        effectiveFrom: z.iso.datetime({ offset: true }),
        reason: z.string().min(3).max(500),
      })
      .parse(input);
    if (+new Date(v.effectiveFrom) < Date.now() - 60000)
      throw new BadRequestException(
        "Tarif historis tidak dapat ditulis ulang.",
      );
    return transaction(async (db) => {
      const account = (
        await db.query(
          "SELECT a.id,d.channels FROM provider_accounts a JOIN provider_account_versions v ON v.id=a.current_version_id JOIN provider_definitions d ON d.id=v.definition_id WHERE a.company_id=$1 AND a.id=$2 FOR UPDATE OF a",
          [a.company_id, id],
        )
      ).rows[0];
      if (!account || !account.channels.includes(v.channel))
        throw new NotFoundException();
      const future = await db.query(
        "SELECT 1 FROM rate_cards WHERE account_id=$1 AND channel=$2 AND effective_from>=$3",
        [id, v.channel, v.effectiveFrom],
      );
      if (future.rowCount)
        throw new ConflictException(
          "Sudah ada tarif dengan waktu berlaku yang sama atau lebih baru.",
        );
      await db.query(
        "UPDATE rate_cards SET effective_until=$3 WHERE account_id=$1 AND channel=$2 AND effective_until IS NULL",
        [id, v.channel, v.effectiveFrom],
      );
      const rate = (
        await db.query(
          "INSERT INTO rate_cards(company_id,account_id,channel,price,effective_from) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [a.company_id, id, v.channel, v.price, v.effectiveFrom],
        )
      ).rows[0];
      await audit(db, a, "provider.rate_created", "rate", rate.id, {
        accountId: id,
        channel: v.channel,
        price: v.price,
        effectiveFrom: v.effectiveFrom,
        reason: v.reason,
      });
      return rate;
    });
  }
}
