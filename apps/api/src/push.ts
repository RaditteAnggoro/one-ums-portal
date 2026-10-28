import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { lookup } from "node:dns/promises";
import { Agent } from "node:https";
import { ECDH, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { pool, transaction } from "./db.js";
import { actorFor, audit, scope, scopeValues, type Actor } from "./context.js";
import { sessionToken, tokenHash } from "./security.js";
import { encryptSecret, decryptSecret } from "./secrets.js";
import { publicAddress } from "./network.js";
import { translate, type Locale } from "../../../packages/domain/src/i18n.js";
const base64 = z.string().regex(/^[A-Za-z0-9_-]+$/);
export const subscriptionSchema = z.object({
  endpoint: z.url().max(3000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ auth: base64, p256dh: base64 }),
});
export function pushConfiguration() {
  const enabled = process.env.PUSH_ENABLED === "true";
  const publicKey = process.env.VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT;
  return {
    enabled: enabled && !!publicKey && !!privateKey && !!subject,
    publicKey,
    privateKey,
    subject,
  };
}
export function validPushEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  const allowed = (
    process.env.PUSH_ALLOWED_HOSTS ??
    "fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com"
  )
    .split(",")
    .map((s) => s.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !allowed.includes(url.hostname)
  )
    throw new BadRequestException("Endpoint push tidak didukung.");
  return url;
}
function validateSubscription(input: unknown) {
  const v = subscriptionSchema.parse(input);
  validPushEndpoint(v.endpoint);
  try {
    if (Buffer.from(v.keys.auth, "base64url").length !== 16) throw new Error();
    ECDH.convertKey(Buffer.from(v.keys.p256dh, "base64url"), "prime256v1");
  } catch {
    throw new BadRequestException("Kunci langganan push tidak valid.");
  }
  return v;
}
export function pushDevice(req: Request, res?: Response) {
  let value = req.cookies?.ums_device;
  if (typeof value !== "string" || !/^[-_A-Za-z0-9]{43}$/.test(value)) {
    if (!res) return undefined;
    value = sessionToken();
    res.cookie("ums_device", value, {
      httpOnly: true,
      sameSite: "strict",
      secure:
        process.env.COOKIE_SECURE === "true" ||
        process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 86400000,
    });
    req.cookies = { ...req.cookies, ums_device: value };
  }
  return tokenHash(value);
}
export async function deactivateDevice(deviceHash: string, userId?: string) {
  await transaction(async (db) => {
    const result = await db.query(
      "UPDATE push_subscriptions SET active=false,updated_at=now() WHERE device_hash=$1 AND active AND ($2::uuid IS NULL OR user_id=$2) RETURNING id",
      [deviceHash, userId ?? null],
    );
    if (result.rowCount)
      await db.query(
        "UPDATE push_deliveries SET status='CANCELLED',updated_at=now() WHERE subscription_id=ANY($1::uuid[]) AND status='QUEUED'",
        [result.rows.map((r) => r.id)],
      );
  });
}
function canReceive(a: Actor, notification: Record<string, any>) {
  const category =
    notification.category === "budget"
      ? "budget"
      : notification.event_key?.startsWith("run:")
        ? "delivery"
        : "approval";
  const preferences = a.profile.pushPreferences as
    Record<string, boolean> | undefined;
  return (
    preferences?.[category] !== false &&
    a.company_id === notification.company_id &&
    (a.company_scope || a.team_id === notification.team_id) &&
    a.permissions.includes("campaigns:read") &&
    (notification.category !== "budget" ||
      a.permissions.includes("budgets:read"))
  );
}
@Controller("push")
export class PushController {
  @Get("configuration") async configuration(@Req() req: Request) {
    await actorFor(req);
    const config = pushConfiguration();
    return {
      enabled: config.enabled,
      publicKey: config.enabled ? config.publicKey : null,
    };
  }
  @Get("subscriptions") async subscriptions(@Req() req: Request) {
    const a = await actorFor(req);
    return (
      await pool.query(
        "SELECT id,active,created_at,updated_at FROM push_subscriptions WHERE company_id=$1 AND user_id=$2 ORDER BY created_at DESC",
        [a.company_id, a.id],
      )
    ).rows;
  }
  @Post("subscribe") async subscribe(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req);
    if (!pushConfiguration().enabled)
      throw new BadRequestException(
        "Administrator belum mengaktifkan notifikasi perangkat.",
      );
    const v = validateSubscription(input),
      device = pushDevice(req, res)!;
    return transaction(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [a.id]);
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        v.endpoint,
      ]);
      const old = (
        await db.query(
          "SELECT * FROM push_subscriptions WHERE endpoint_hash=$1 AND active FOR UPDATE",
          [tokenHash(v.endpoint)],
        )
      ).rows[0];
      if (old && (old.user_id !== a.id || old.company_id !== a.company_id)) {
        if (old.device_hash !== device)
          throw new ForbiddenException(
            "Langganan perangkat masih terhubung ke akun lain.",
          );
        await db.query(
          "UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=$1",
          [old.id],
        );
      }
      const same = old?.user_id === a.id && old.company_id === a.company_id;
      if (
        !same &&
        (
          await db.query(
            "SELECT count(*)::int AS n FROM push_subscriptions WHERE company_id=$1 AND user_id=$2 AND active",
            [a.company_id, a.id],
          )
        ).rows[0].n >= 10
      )
        throw new BadRequestException(
          "Maksimal 10 perangkat aktif per pengguna.",
        );
      const record = (
        await db.query(
          same
            ? "UPDATE push_subscriptions SET credentials_cipher=$3,device_hash=$4,updated_at=now() WHERE company_id=$1 AND id=$2 RETURNING id,active"
            : `INSERT INTO push_subscriptions(company_id,user_id,credentials_cipher,device_hash,endpoint_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,active`,
          same
            ? [
                a.company_id,
                old.id,
                encryptSecret({ subscription: JSON.stringify(v) }),
                device,
              ]
            : [
                a.company_id,
                a.id,
                encryptSecret({ subscription: JSON.stringify(v) }),
                device,
                tokenHash(v.endpoint),
              ],
        )
      ).rows[0];
      await db.query(
        "UPDATE users SET profile=jsonb_set(profile,'{pushEnabled}','true') WHERE id=$1",
        [a.id],
      );
      await audit(db, a, "push.subscribed", "push_subscription", record.id);
      return record;
    });
  }
  @Post("subscriptions/:id/revoke") async revoke(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req);
    z.uuid().parse(id);
    return transaction(async (db) => {
      const result = await db.query(
        "UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=$1 AND company_id=$2 AND user_id=$3 RETURNING id",
        [id, a.company_id, a.id],
      );
      if (!result.rowCount) throw new NotFoundException();
      await db.query(
        "UPDATE push_deliveries SET status='CANCELLED',updated_at=now() WHERE subscription_id=$1 AND status='QUEUED'",
        [id],
      );
      await audit(db, a, "push.revoked", "push_subscription", id);
      return { ok: true };
    });
  }
  @Post("preferences") async preferences(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req);
    const v = z
      .object({
        enabled: z.boolean(),
        approval: z.boolean(),
        budget: z.boolean(),
        delivery: z.boolean(),
      })
      .parse(input);
    await transaction(async (db) => {
      await db.query(
        "UPDATE users SET profile=jsonb_set(jsonb_set(profile,'{pushEnabled}',to_jsonb($2::boolean)),'{pushPreferences}',$3::jsonb) WHERE id=$1",
        [
          a.id,
          v.enabled,
          JSON.stringify({
            approval: v.approval,
            budget: v.budget,
            delivery: v.delivery,
          }),
        ],
      );
      await audit(db, a, "push.preferences_updated", "user", a.id, v);
    });
    return { ok: true };
  }
  @Post("test") async test(@Req() req: Request) {
    const a = await actorFor(req);
    if (!pushConfiguration().enabled)
      throw new BadRequestException(
        "Administrator belum mengaktifkan notifikasi perangkat.",
      );
    const count = (
      await pool.query(
        "SELECT count(*)::int AS n FROM push_subscriptions WHERE company_id=$1 AND user_id=$2 AND active",
        [a.company_id, a.id],
      )
    ).rows[0].n;
    if (!count)
      throw new BadRequestException(
        "Aktifkan notifikasi pada perangkat terlebih dahulu.",
      );
    return transaction(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [a.id]);
      const recent = await db.query(
        "SELECT 1 FROM audit WHERE company_id=$1 AND actor_id=$2 AND action='push.test_requested' AND created_at>now()-interval '30 seconds'",
        [a.company_id, a.id],
      );
      if (recent.rowCount)
        throw new BadRequestException(
          "Tunggu 30 detik sebelum mencoba kembali.",
        );
      const n = (
        await db.query(
          "INSERT INTO notifications(company_id,team_id,title,body,resource_id,event_key) VALUES($1,$2,'Uji notifikasi','Notifikasi perangkat Anda berhasil terhubung.',$3,$4) RETURNING id",
          [a.company_id, a.team_id, a.id, `push-test:${sessionToken()}`],
        )
      ).rows[0];
      await enqueueNotification(db, n.id, a.id);
      await audit(db, a, "push.test_requested", "notification", n.id);
      return { id: n.id, status: "QUEUED" };
    });
  }
  @Get("deliveries/:id") async authorize(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const a = await actorFor(req);
    if (!pushConfiguration().enabled) throw new NotFoundException();
    z.uuid().parse(id);
    const row = (
      await pool.query(
        "SELECT d.*,n.team_id,n.category,n.event_key,n.title,n.body,n.resource_id,s.active FROM push_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN push_subscriptions s ON s.id=d.subscription_id WHERE d.id=$1 AND d.company_id=$2 AND d.user_id=$3",
        [id, a.company_id, a.id],
      )
    ).rows[0];
    const provided = tokenHash(String(req.headers["x-push-token"] ?? ""));
    if (
      !row ||
      !row.active ||
      a.profile.pushEnabled !== true ||
      !canReceive(a, row) ||
      row.expires_at < new Date() ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(row.receipt_hash))
    )
      throw new NotFoundException();
    const locale: Locale = a.profile.locale === "en" ? "en" : "id";
    return {
      title: translate(row.title, locale),
      body: translate(row.body, locale),
      url:
        row.title === "Uji notifikasi"
          ? "/help?topic=notifications"
          : `/workflows?campaign=${row.resource_id}`,
      tag: row.id,
    };
  }
  @Post("deliveries/:id/receipt") async receipt(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const a = await actorFor(req);
    z.uuid().parse(id);
    const v = z.object({ token: z.string().max(100) }).parse(input);
    if (!pushConfiguration().enabled) throw new NotFoundException();
    await transaction(async (db) => {
      const row = (
        await db.query(
          "SELECT d.*,n.team_id,n.category,n.event_key,s.active FROM push_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN push_subscriptions s ON s.id=d.subscription_id WHERE d.id=$1 AND d.company_id=$2 AND d.user_id=$3 FOR UPDATE OF d",
          [id, a.company_id, a.id],
        )
      ).rows[0];
      if (
        !row ||
        !row.active ||
        a.profile.pushEnabled !== true ||
        !canReceive(a, row) ||
        row.expires_at < new Date() ||
        row.receipt_hash !== tokenHash(v.token) ||
        !["SENDING", "ACCEPTED", "UNKNOWN", "DISPLAYED"].includes(row.status)
      )
        throw new NotFoundException();
      await db.query(
        "UPDATE push_deliveries SET status='DISPLAYED',updated_at=now() WHERE id=$1",
        [id],
      );
    });
    return { ok: true };
  }
  @Get("deliveries") async deliveries(@Req() req: Request) {
    const a = await actorFor(req);
    return (
      await pool.query(
        "SELECT id,status,last_error,created_at,updated_at FROM push_deliveries WHERE company_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 25",
        [a.company_id, a.id],
      )
    ).rows;
  }
}
async function enqueueNotification(
  db: import("pg").PoolClient,
  notificationId: string,
  onlyUser?: string,
) {
  const recipients = (
    await db.query(
      `SELECT s.id,s.company_id,s.user_id,n.id AS notification_id FROM notifications n JOIN users u ON u.company_id=n.company_id AND u.active JOIN roles r ON r.id=u.role_id JOIN push_subscriptions s ON s.user_id=u.id AND s.company_id=u.company_id AND s.active WHERE n.id=$1 AND u.profile->>'pushEnabled'='true' AND r.permissions ? 'campaigns:read' AND (r.company_scope OR u.team_id=n.team_id) AND (n.category<>'budget' OR r.permissions ? 'budgets:read') AND n.created_at>=s.created_at AND NOT(n.read_by ? u.id::text) AND (coalesce(n.event_key,'') NOT LIKE 'push-test:%' OR n.resource_id=u.id) AND coalesce((u.profile->'pushPreferences'->>(CASE WHEN n.category='budget' THEN 'budget' WHEN coalesce(n.event_key,'') LIKE 'run:%' THEN 'delivery' ELSE 'approval' END))::boolean,true) AND ($2::uuid IS NULL OR u.id=$2) AND NOT EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=n.id AND d.subscription_id=s.id) LIMIT 100`,
      [notificationId, onlyUser ?? null],
    )
  ).rows;
  for (const s of recipients) {
    const token = sessionToken();
    await db.query(
      "INSERT INTO push_deliveries(company_id,user_id,notification_id,subscription_id,receipt_hash,receipt_cipher) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(notification_id,subscription_id) DO NOTHING",
      [
        s.company_id,
        s.user_id,
        s.notification_id,
        s.id,
        tokenHash(token),
        encryptSecret({ token }),
      ],
    );
  }
}
export async function enqueuePushNotifications() {
  await transaction(async (db) => {
    const notifications = (
      await db.query(
        `SELECT DISTINCT n.id FROM notifications n JOIN users u ON u.company_id=n.company_id AND u.active JOIN roles r ON r.id=u.role_id JOIN push_subscriptions s ON s.company_id=u.company_id AND s.user_id=u.id AND s.active WHERE n.created_at>now()-interval '1 hour' AND n.created_at>=s.created_at AND u.profile->>'pushEnabled'='true' AND r.permissions ? 'campaigns:read' AND (r.company_scope OR u.team_id=n.team_id) AND (n.category<>'budget' OR r.permissions ? 'budgets:read') AND NOT(n.read_by ? u.id::text) AND (coalesce(n.event_key,'') NOT LIKE 'push-test:%' OR n.resource_id=u.id) AND coalesce((u.profile->'pushPreferences'->>(CASE WHEN n.category='budget' THEN 'budget' WHEN coalesce(n.event_key,'') LIKE 'run:%' THEN 'delivery' ELSE 'approval' END))::boolean,true) AND NOT EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=n.id AND d.subscription_id=s.id) ORDER BY n.id LIMIT 100`,
      )
    ).rows;
    for (const n of notifications) await enqueueNotification(db, n.id);
  });
}
export async function sendBrowserPush(
  subscription: webpush.PushSubscription,
  payload: string,
) {
  const config = pushConfiguration();
  if (!config.enabled) throw new Error("Push is not configured");
  const url = validPushEndpoint(subscription.endpoint);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Blocked push address");
  const pinned = addresses[0];
  const agent = new Agent({
    lookup: ((_host: string, options: any, callback: any) =>
      options?.all
        ? callback(null, [pinned])
        : callback(null, pinned.address, pinned.family)) as any,
  });
  const deadline = setTimeout(() => agent.destroy(), 15000);
  try {
    return await webpush.sendNotification(subscription, payload, {
      agent,
      timeout: 10000,
      TTL: 300,
      vapidDetails: {
        subject: config.subject!,
        publicKey: config.publicKey!,
        privateKey: config.privateKey!,
      },
    });
  } finally {
    clearTimeout(deadline);
    agent.destroy();
  }
}
export async function dispatchPushBatch(
  send: typeof sendBrowserPush = sendBrowserPush,
) {
  await pool.query(
    "UPDATE push_deliveries SET status='UNKNOWN',last_error='INTERRUPTED_SEND',updated_at=now() WHERE status='SENDING' AND locked_until<now()",
  );
  const jobs = await transaction(async (db) => {
    const rows = (
      await db.query(
        `SELECT d.id FROM push_deliveries d WHERE d.status='QUEUED' ORDER BY d.created_at FOR UPDATE SKIP LOCKED LIMIT 3`,
      )
    ).rows;
    const jobs = [];
    for (const row of rows) {
      const d = (
        await db.query(
          `UPDATE push_deliveries SET status='SENDING',attempt_count=attempt_count+1,locked_until=now()+interval '30 seconds' WHERE id=$1 RETURNING *`,
          [row.id],
        )
      ).rows[0];
      jobs.push(d);
    }
    return jobs;
  });
  await Promise.all(
    jobs.map(async (job) => {
      const state = (
        await pool.query(
          `SELECT d.*,s.credentials_cipher,s.active,u.active AS user_active,u.profile,u.team_id,r.permissions,r.company_scope,n.team_id AS notification_team,n.category,n.event_key FROM push_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id JOIN users u ON u.id=d.user_id JOIN roles r ON r.id=u.role_id JOIN notifications n ON n.id=d.notification_id WHERE d.id=$1`,
          [job.id],
        )
      ).rows[0];
      const preferenceKey =
        state?.category === "budget"
          ? "budget"
          : state?.category === "delivery" ||
              state?.event_key?.startsWith("run:")
            ? "delivery"
            : "approval";
      if (
        !state ||
        !state.active ||
        !state.user_active ||
        state.profile.pushEnabled !== true ||
        state.profile.pushPreferences?.[preferenceKey] === false ||
        state.expires_at < new Date() ||
        !state.permissions.includes("campaigns:read") ||
        (!state.company_scope && state.team_id !== state.notification_team) ||
        (state.category === "budget" &&
          !state.permissions.includes("budgets:read"))
      ) {
        await pool.query(
          "UPDATE push_deliveries SET status='CANCELLED',updated_at=now() WHERE id=$1 AND status='SENDING'",
          [job.id],
        );
        return;
      }
      try {
        const subscription = JSON.parse(
          decryptSecret(state.credentials_cipher).subscription,
        );
        const token = decryptSecret(state.receipt_cipher).token;
        const response = await send(
          subscription,
          JSON.stringify({ id: job.id, token }),
        );
        if (response.statusCode < 200 || response.statusCode >= 300)
          throw { statusCode: response.statusCode };
        await pool.query(
          "UPDATE push_deliveries SET status='ACCEPTED',updated_at=now() WHERE id=$1 AND status='SENDING'",
          [job.id],
        );
      } catch (error) {
        const code =
          Number((error as { statusCode?: number })?.statusCode) || 0;
        await transaction(async (db) => {
          await db.query(
            "UPDATE push_deliveries SET status=$2,last_error=$3,updated_at=now() WHERE id=$1 AND status='SENDING'",
            [
              job.id,
              code >= 400 && code < 500 ? "FAILED" : "UNKNOWN",
              code ? `PUSH_HTTP_${code}` : "PUSH_NETWORK_UNCERTAIN",
            ],
          );
          if ([404, 410].includes(code))
            await db.query(
              "UPDATE push_subscriptions SET active=false,updated_at=now() WHERE id=$1",
              [job.subscription_id],
            );
        });
      }
    }),
  );
  return jobs.length;
}
export function startPushWorker() {
  let busy = false;
  const tick = async () => {
    if (busy || !pushConfiguration().enabled) return;
    busy = true;
    try {
      await enqueuePushNotifications();
      await dispatchPushBatch();
    } catch {
      console.error(
        "Push notification processing failed; durable records retained.",
      );
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 2000);
  void tick();
  return async () => {
    clearInterval(timer);
    while (busy) await new Promise((r) => setTimeout(r, 25));
  };
}
