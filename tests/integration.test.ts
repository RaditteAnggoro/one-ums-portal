import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../apps/api/src/main.js";
import { pool, transaction } from "../apps/api/src/db.js";
import { passwordHash } from "../apps/api/src/security.js";
import {
  processMessage,
  applyLocalEvent,
  startWorkers,
  recoverInterruptedRuns,
} from "../apps/api/src/queue.js";
import { schedulerTick } from "../apps/api/src/campaigns.js";
import sharp from "sharp";
import {
  dispatchPushBatch,
  enqueuePushNotifications,
} from "../apps/api/src/push.js";
import { decryptSecret } from "../apps/api/src/secrets.js";

let app: INestApplication;
let base: string;
let stopWorkers: (() => Promise<void>) | undefined;
const fixtures: any[] = [];
const recoveryWorkers: string[] = [];
async function fixture() {
  return transaction(async (db) => {
    const company = (
      await db.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [
        `Integration ${randomUUID()}`,
      ])
    ).rows[0].id;
    const team = (
      await db.query(
        "INSERT INTO teams(company_id,name) VALUES($1,$2) RETURNING id",
        [company, "A"],
      )
    ).rows[0].id;
    const teamB = (
      await db.query(
        "INSERT INTO teams(company_id,name) VALUES($1,$2) RETURNING id",
        [company, "B"],
      )
    ).rows[0].id;
    const permissions = [
      "campaigns:read",
      "campaigns:create",
      "campaigns:approve",
      "campaigns:manage",
      "budgets:read",
      "budgets:write",
      "sources:write",
      "templates:write",
      "audit:read",
      "admin:write",
    ];
    const roles: any = {};
    const users: any = {};
    for (const role of [
      "creator",
      "approver",
      "finance",
      "admin",
      "outsider",
    ]) {
      roles[role] = (
        await db.query(
          "INSERT INTO roles(company_id,name,permissions,company_scope) VALUES($1,$2,$3,$4) RETURNING id",
          [
            company,
            role,
            JSON.stringify(
              role === "creator"
                ? permissions.filter(
                    (p) =>
                      ![
                        "campaigns:approve",
                        "budgets:write",
                        "admin:write",
                        "audit:read",
                      ].includes(p),
                  )
                : permissions,
            ),
            ["admin", "finance"].includes(role),
          ],
        )
      ).rows[0].id;
      const email = `${role}-${randomUUID()}@example.test`;
      users[role] = (
        await db.query(
          "INSERT INTO users(company_id,team_id,role_id,email,name,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,email",
          [
            company,
            role === "outsider" ? teamB : team,
            roles[role],
            email,
            role,
            passwordHash("TestPassword123!"),
          ],
        )
      ).rows[0];
    }
    await db.query(
      "INSERT INTO approval_policies(company_id,stages) VALUES($1,$2)",
      [
        company,
        JSON.stringify([
          { name: "Team", roleIds: [roles.approver, roles.admin] },
          { name: "Finance", roleIds: [roles.finance, roles.admin] },
        ]),
      ],
    );
    const centre = (
      await db.query(
        "INSERT INTO cost_centres(company_id,team_id,name) VALUES($1,$2,$3) RETURNING id",
        [company, team, "Demo"],
      )
    ).rows[0].id;
    const budget = (
      await db.query(
        "INSERT INTO budgets(company_id,cost_centre_id,starts_on,ends_on,months,allocated) VALUES($1,$2,current_date-1,current_date+365,12,1000) RETURNING id",
        [company, centre],
      )
    ).rows[0].id;
    const template = (
      await db.query(
        "INSERT INTO templates(company_id,team_id,name,channel,body,created_by) VALUES($1,$2,'Test','email','Hi {{name}}',$3) RETURNING id",
        [company, team, users.creator.id],
      )
    ).rows[0].id;
    const dataset = (
      await db.query(
        "INSERT INTO datasets(company_id,team_id,name,rows,created_by) VALUES($1,$2,'Test',$3,$4) RETURNING id",
        [
          company,
          team,
          JSON.stringify([{ name: "Demo", email: "demo@example.test" }]),
          users.creator.id,
        ],
      )
    ).rows[0].id;
    const result = {
      company,
      team,
      teamB,
      roles,
      users,
      centre,
      budget,
      template,
      dataset,
      cookies: {} as Record<string, string>,
    };
    fixtures.push(result);
    return result;
  });
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  csrf = true,
  extraHeaders: Record<string, string> = {},
) {
  const res = await fetch(`${base}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(csrf
        ? {
            Origin: "http://127.0.0.1:3000",
            "X-Requested-With": "MessagingApp",
          }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    body: await res.json(),
    cookie:
      res.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ") || undefined,
  };
}
async function login(f: any, role: string) {
  const res = await request("auth/login", "POST", {
    email: f.users[role].email,
    password: "TestPassword123!",
  });
  expect(res.status).toBe(201);
  f.cookies[role] = res.cookie!;
  return res.cookie!;
}
function definition(f: any, more: Record<string, unknown> = {}) {
  return {
    name: "Integration campaign",
    templateIds: [f.template],
    datasetId: f.dataset,
    costCentreId: f.centre,
    spendingCeiling: "100",
    mode: "immediate",
    ...more,
  };
}
async function campaign(
  f: any,
  more: Record<string, unknown> = {},
  role = "creator",
) {
  const res = await request(
    "campaigns",
    "POST",
    definition(f, more),
    f.cookies[role],
  );
  expect(res.status).toBe(201);
  return res.body;
}
async function approve(f: any, id: string) {
  const version = (
    await request(`campaigns/${id}`, "GET", undefined, f.cookies.creator)
  ).body.campaign.version;
  expect(
    (await request(`campaigns/${id}/submit`, "POST", {}, f.cookies.creator))
      .status,
  ).toBe(201);
  expect(
    (
      await request(
        `campaigns/${id}/decision`,
        "POST",
        { decision: "APPROVE", version, stage: 0 },
        f.cookies.approver,
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await request(
        `campaigns/${id}/decision`,
        "POST",
        { decision: "APPROVE", version, stage: 1 },
        f.cookies.finance,
      )
    ).status,
  ).toBe(201);
}
beforeAll(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/api`;
});
afterAll(async () => {
  await stopWorkers?.();
  await app.close();
  await pool.query("DELETE FROM audit WHERE company_id=ANY($1::uuid[])", [
    fixtures.map((f) => f.company),
  ]);
  for (const f of fixtures)
    await transaction(async (db) => {
      await db.query("SELECT set_config('app.audit_disabled','true',true)");
      await db.query(
        "DELETE FROM ingestion_requests WHERE source_id IN (SELECT id FROM source_connections WHERE company_id=$1)",
        [f.company],
      );
      await db.query(
        "DELETE FROM source_keys WHERE source_id IN (SELECT id FROM source_connections WHERE company_id=$1)",
        [f.company],
      );
      await db.query(
        "DELETE FROM outbox WHERE message_id IN (SELECT id FROM messages WHERE company_id=$1)",
        [f.company],
      );
      await db.query(
        "UPDATE provider_accounts SET current_version_id=NULL WHERE company_id=$1",
        [f.company],
      );
      for (const table of [
        "release_events",
        "releases",
        "push_deliveries",
        "push_subscriptions",
        "ledger",
        "message_events",
        "attempts",
        "messages",
        "rate_cards",
        "provider_account_versions",
        "provider_accounts",
        "provider_definitions",
        "runs",
        "approvals",
        "campaign_versions",
        "campaigns",
        "templates",
        "datasets",
        "source_connections",
        "budgets",
        "cost_centres",
        "approval_policies",
        "notifications",
        "audit",
      ])
        await db.query(`DELETE FROM ${table} WHERE company_id=$1`, [f.company]);
      await db.query(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id=$1)",
        [f.company],
      );
      await db.query(
        "DELETE FROM platform_administrators WHERE user_id IN (SELECT id FROM users WHERE company_id=$1)",
        [f.company],
      );
      for (const table of ["users", "roles", "teams"])
        await db.query(`DELETE FROM ${table} WHERE company_id=$1`, [f.company]);
      await db.query("DELETE FROM companies WHERE id=$1", [f.company]);
    });
  for (const id of recoveryWorkers)
    await pool.query("DELETE FROM worker_sessions WHERE id=$1", [id]);
  await pool.end();
});
describe("real PostgreSQL application boundaries", () => {
  let f: any;
  let other: any;
  beforeAll(async () => {
    f = await fixture();
    other = await fixture();
    for (const role of ["creator", "approver", "finance", "admin", "outsider"])
      await login(f, role);
    await login(other, "admin");
  });
  it("restricts platform onboarding and provisions an isolated company without leaking credentials", async () => {
    expect(
      (await request("platform/companies", "GET", undefined, f.cookies.admin))
        .status,
    ).toBe(403);
    await pool.query(
      "INSERT INTO platform_administrators(user_id) VALUES($1)",
      [f.users.admin.id],
    );
    const email = `owner-${randomUUID()}@example.test`;
    const input = {
      name: "Onboarding verification",
      timezone: "Asia/Jakarta",
      language: "en",
      adminName: "Owner",
      adminEmail: email,
      adminPassword: "OnboardingPassword123!",
      teamName: "Operations",
      costCentreName: "General",
    };
    expect(
      (
        await request(
          "platform/companies",
          "POST",
          { ...input, timezone: "Invalid/Zone" },
          f.cookies.admin,
        )
      ).status,
    ).toBe(400);
    const made = await request(
      "platform/companies",
      "POST",
      input,
      f.cookies.admin,
    );
    expect(made.status).toBe(201);
    fixtures.push({ company: made.body.id });
    expect(JSON.stringify(made.body)).not.toContain(input.adminPassword);
    const initialRoles = await pool.query(
      "SELECT name,level FROM roles WHERE company_id=$1",
      [made.body.id],
    );
    expect(
      Object.fromEntries(initialRoles.rows.map((r: any) => [r.name, r.level])),
    ).toEqual({
      Administrator: 99,
      Creator: 10,
      Approver: 20,
      Finance: 30,
      Viewer: 1,
    });
    const owner = await request("auth/login", "POST", {
      email,
      password: input.adminPassword,
    });
    expect(owner.status).toBe(201);
    expect(
      (await request("platform/companies", "GET", undefined, owner.cookie))
        .status,
    ).toBe(403);
    expect(
      (await request("bootstrap", "GET", undefined, owner.cookie)).body.user
        .profile.locale,
    ).toBe("en");
    const b = (
      await pool.query(
        "SELECT allocated,reserved,spent FROM budgets WHERE company_id=$1",
        [made.body.id],
      )
    ).rows[0];
    expect(b).toEqual({
      allocated: "0.0000",
      reserved: "0.0000",
      spent: "0.0000",
    });
    expect(
      (
        await pool.query(
          "SELECT stages FROM approval_policies WHERE company_id=$1",
          [made.body.id],
        )
      ).rows[0].stages,
    ).toHaveLength(2);
    expect(
      (await request("bootstrap", "GET", undefined, f.cookies.admin)).body.user
        .company_id,
    ).toBe(f.company);
    const logs = (
      await pool.query(
        "SELECT detail FROM audit WHERE company_id=$1 OR resource_id=$1::text",
        [made.body.id],
      )
    ).rows;
    expect(JSON.stringify(logs)).not.toContain(input.adminPassword);
  });
  it("persists validated language separately from profile and scopes mark-all-read", async () => {
    expect(
      (
        await request(
          "profile/language",
          "PUT",
          { locale: "fr" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "profile/language",
          "PUT",
          { locale: "en" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("bootstrap", "GET", undefined, f.cookies.creator)).body
        .user.profile.locale,
    ).toBe("en");
    const n = (
      await pool.query(
        "INSERT INTO notifications(company_id,team_id,title,body,resource_id) VALUES($1,$2,'Test','Test',$3) RETURNING id",
        [other.company, other.team, other.users.admin.id],
      )
    ).rows[0];
    expect(
      (await request("notifications/read-all", "POST", {}, f.cookies.creator))
        .status,
    ).toBe(201);
    expect(
      (
        await pool.query("SELECT read_by FROM notifications WHERE id=$1", [
          n.id,
        ])
      ).rows[0].read_by,
    ).not.toContain(f.users.creator.id);
  });
  it("encrypts browser subscriptions, isolates delivery receipts and cancels revoked devices", async () => {
    const old = { ...process.env };
    process.env.PUSH_ENABLED = "true";
    process.env.VAPID_PUBLIC_KEY = "test";
    process.env.VAPID_PRIVATE_KEY = "test";
    process.env.VAPID_SUBJECT = "mailto:test@example.test";
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.generateKeys();
      const payload = {
        endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
        keys: {
          auth: randomBytes(16).toString("base64url"),
          p256dh: ecdh.getPublicKey().toString("base64url"),
        },
      };
      expect(
        (
          await request(
            "push/subscribe",
            "POST",
            { ...payload, endpoint: "http://127.0.0.1/push" },
            f.cookies.creator,
          )
        ).status,
      ).toBe(400);
      const sub = await request(
        "push/subscribe",
        "POST",
        payload,
        f.cookies.creator,
      );
      expect(sub.status).toBe(201);
      expect(
        (await request("push/subscribe", "POST", payload, f.cookies.creator))
          .body.id,
      ).toBe(sub.body.id);
      const cipher = (
        await pool.query(
          "SELECT credentials_cipher FROM push_subscriptions WHERE id=$1",
          [sub.body.id],
        )
      ).rows[0].credentials_cipher;
      expect(cipher).not.toContain(payload.endpoint);
      expect(cipher).not.toContain(payload.keys.auth);
      expect(
        (
          await request(
            `push/subscriptions/${sub.body.id}/revoke`,
            "POST",
            {},
            other.cookies.admin,
          )
        ).status,
      ).toBe(404);
      const test = await request("push/test", "POST", {}, f.cookies.creator);
      expect(test.status).toBe(201);
      expect(
        (await request("push/test", "POST", {}, f.cookies.creator)).status,
      ).toBe(400);
      const job = (
        await pool.query(
          "SELECT * FROM push_deliveries WHERE notification_id=$1",
          [test.body.id],
        )
      ).rows[0];
      const token = decryptSecret(job.receipt_cipher).token;
      const get = (cookie: string, secret = token) =>
        request(`push/deliveries/${job.id}`, "GET", undefined, cookie, true, {
          "X-Push-Token": secret,
        });
      expect((await get(other.cookies.admin)).status).toBe(404);
      expect((await get(f.cookies.creator, "wrong")).status).toBe(404);
      expect((await get(f.cookies.creator)).body.title).toBe(
        "Test notification",
      );
      let calls = 0;
      await dispatchPushBatch(async (_subscription, _body) => {
        calls++;
        return { statusCode: 201, body: "", headers: {} };
      });
      expect(calls).toBe(1);
      expect(
        (
          await pool.query("SELECT status FROM push_deliveries WHERE id=$1", [
            job.id,
          ])
        ).rows[0].status,
      ).toBe("ACCEPTED");
      expect(
        (
          await request(
            `push/deliveries/${job.id}/receipt`,
            "POST",
            { token },
            other.cookies.admin,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            `push/deliveries/${job.id}/receipt`,
            "POST",
            { token },
            f.cookies.creator,
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await pool.query("SELECT status FROM push_deliveries WHERE id=$1", [
            job.id,
          ])
        ).rows[0].status,
      ).toBe("DISPLAYED");
      await pool.query(
        "INSERT INTO notifications(company_id,team_id,title,body,resource_id,event_key) VALUES($1,$2,'New','New',$3,$4)",
        [f.company, f.team, f.users.creator.id, `run:${randomUUID()}`],
      );
      await enqueuePushNotifications();
      await request(
        `push/subscriptions/${sub.body.id}/revoke`,
        "POST",
        {},
        f.cookies.creator,
      );
      expect((await get(f.cookies.creator)).status).toBe(404);
      calls = 0;
      await dispatchPushBatch(async () => {
        calls++;
        throw new Error("should not send");
      });
      expect(calls).toBe(0);
    } finally {
      for (const key of [
        "PUSH_ENABLED",
        "VAPID_PUBLIC_KEY",
        "VAPID_PRIVATE_KEY",
        "VAPID_SUBJECT",
      ])
        if (old[key] === undefined) delete process.env[key];
        else process.env[key] = old[key];
    }
  });
  it("does not retry ambiguous push sends and retires expired endpoints", async () => {
    const personal = await fixture();
    await login(personal, "creator");
    const saved = { ...process.env };
    process.env.PUSH_ENABLED = "true";
    process.env.VAPID_PUBLIC_KEY = "test";
    process.env.VAPID_PRIVATE_KEY = "test";
    process.env.VAPID_SUBJECT = "mailto:test@example.test";
    try {
      const e = createECDH("prime256v1");
      e.generateKeys();
      const subscription = {
        endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
        keys: {
          auth: randomBytes(16).toString("base64url"),
          p256dh: e.getPublicKey().toString("base64url"),
        },
      };
      const sub = await request(
        "push/subscribe",
        "POST",
        subscription,
        personal.cookies.creator,
      );
      expect(sub.status).toBe(201);
      const notify = async () => {
        const n = (
          await pool.query(
            "INSERT INTO notifications(company_id,team_id,title,body,resource_id,event_key) VALUES($1,$2,'Test','Test',$3,$4) RETURNING id",
            [
              personal.company,
              personal.team,
              personal.users.creator.id,
              `run:${randomUUID()}`,
            ],
          )
        ).rows[0];
        await enqueuePushNotifications();
        return (
          await pool.query(
            "SELECT * FROM push_deliveries WHERE notification_id=$1",
            [n.id],
          )
        ).rows[0];
      };
      const first = await notify();
      let calls = 0;
      await dispatchPushBatch(async () => {
        calls++;
        throw new Error("network uncertainty");
      });
      expect(
        (
          await pool.query("SELECT status FROM push_deliveries WHERE id=$1", [
            first.id,
          ])
        ).rows[0].status,
      ).toBe("UNKNOWN");
      await dispatchPushBatch(async () => {
        calls++;
        throw new Error();
      });
      expect(calls).toBe(1);
      const second = await notify();
      await dispatchPushBatch(async () => {
        throw { statusCode: 410 };
      });
      expect(
        (
          await pool.query("SELECT status FROM push_deliveries WHERE id=$1", [
            second.id,
          ])
        ).rows[0].status,
      ).toBe("FAILED");
      expect(
        (
          await pool.query(
            "SELECT active FROM push_subscriptions WHERE id=$1",
            [sub.body.id],
          )
        ).rows[0].active,
      ).toBe(false);
    } finally {
      for (const key of [
        "PUSH_ENABLED",
        "VAPID_PUBLIC_KEY",
        "VAPID_PRIVATE_KEY",
        "VAPID_SUBJECT",
      ])
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
  });
  it("keeps tenant admins available during company maintenance and holds queued dispatch", async () => {
    const tenant = await fixture();
    await login(tenant, "admin");
    await login(tenant, "creator");
    await login(tenant, "approver");
    await login(tenant, "finance");
    const c = await campaign(tenant);
    await approve(tenant, c.id);
    const message = (
      await pool.query(
        "SELECT m.id FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0].id;
    expect(
      (
        await request(
          "governance/maintenance",
          "PUT",
          {
            enabled: true,
            reason: "Planned schema update",
            message: "Scheduled maintenance",
          },
          tenant.cookies.creator,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "governance/maintenance",
          "PUT",
          {
            enabled: true,
            reason: "Planned schema update",
            message: "Scheduled maintenance",
          },
          tenant.cookies.admin,
        )
      ).status,
    ).toBe(200);
    try {
      expect(
        (await request("bootstrap", "GET", undefined, tenant.cookies.creator))
          .body.code,
      ).toBe("COMPANY_MAINTENANCE");
      const denied = await request("auth/login", "POST", {
        email: tenant.users.creator.email,
        password: "TestPassword123!",
      });
      expect(denied.status).toBe(503);
      expect(denied.body.code).toBe("COMPANY_MAINTENANCE");
      expect(
        (
          await request("auth/login", "POST", {
            email: tenant.users.admin.email,
            password: "TestPassword123!",
          })
        ).status,
      ).toBe(201);
      expect(
        (await request("bootstrap", "GET", undefined, other.cookies.admin))
          .status,
      ).toBe(200);
      const before = (
        await pool.query("SELECT reserved,spent FROM budgets WHERE id=$1", [
          tenant.budget,
        ])
      ).rows[0];
      expect(await processMessage(message)).toBe("deferred");
      expect(
        (
          await pool.query("SELECT reserved,spent FROM budgets WHERE id=$1", [
            tenant.budget,
          ])
        ).rows[0],
      ).toEqual(before);
      expect(
        (await request("auth/logout", "POST", {}, tenant.cookies.creator))
          .status,
      ).toBe(201);
    } finally {
      await request(
        "governance/maintenance",
        "PUT",
        { enabled: false, reason: "Maintenance completed", message: "" },
        tenant.cookies.admin,
      );
    }
    expect(
      (
        await request("auth/login", "POST", {
          email: tenant.users.creator.email,
          password: "TestPassword123!",
        })
      ).status,
    ).toBe(201);
    await processMessage(message);
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [message]))
        .rows[0].status,
    ).toBe("DELIVERED");
  });
  it("registers immutable tenant release details and records valid status history", async () => {
    const body = {
      version: "1.2.3",
      title: "Governance release",
      environment: "staging",
      deployedAt: new Date().toISOString(),
      status: "PLANNED",
      items: [
        { type: "FIX", description: "Fix sidebar position" },
        {
          type: "ENHANCEMENT",
          description: "Add company maintenance",
          ticket: "UMS-20",
        },
      ],
    };
    expect(
      (await request("governance/releases", "POST", body, f.cookies.creator))
        .status,
    ).toBe(403);
    const r = await request(
      "governance/releases",
      "POST",
      body,
      f.cookies.admin,
    );
    expect(r.status).toBe(201);
    expect(
      (
        await request(
          "governance/releases",
          "GET",
          undefined,
          f.cookies.creator,
        )
      ).body.items.some((v: any) => v.id === r.body.id),
    ).toBe(true);
    expect(
      (
        await request(
          `governance/releases/${r.body.id}/status`,
          "POST",
          {
            status: "DEPLOYED",
            expectedStatus: "PLANNED",
            reason: "Deployment verified",
          },
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `governance/releases/${r.body.id}/status`,
          "POST",
          {
            status: "DEPLOYED",
            expectedStatus: "PLANNED",
            reason: "Deployment verified",
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          `governance/releases/${r.body.id}/status`,
          "POST",
          {
            status: "DEPLOYED",
            expectedStatus: "PLANNED",
            reason: "Stale update",
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `governance/releases/${r.body.id}/status`,
          "POST",
          {
            status: "ROLLED_BACK",
            expectedStatus: "DEPLOYED",
            reason: "Operational rollback",
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          `governance/releases/${r.body.id}/status`,
          "POST",
          {
            status: "DEPLOYED",
            expectedStatus: "ROLLED_BACK",
            reason: "Invalid reopening",
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(400);
    const latest = (
      await request("governance/releases", "GET", undefined, f.cookies.creator)
    ).body.items.find((v: any) => v.id === r.body.id);
    expect(latest.items[0].description).toBe(body.items[0].description);
    expect(latest.history).toHaveLength(3);
    expect(
      (
        await request(
          "governance/releases",
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).body.items.some((v: any) => v.id === r.body.id),
    ).toBe(false);
  });
  it("captures safe field changes with actor correlation and paginates an audit view with a timestamp cutoff", async () => {
    const tenant = await fixture();
    await login(tenant, "admin");
    for (let i = 0; i < 23; i++)
      expect(
        (
          await request(
            "admin/teams",
            "POST",
            { name: `Audit team ${i}` },
            tenant.cookies.admin,
          )
        ).status,
      ).toBe(201);
    const path = "audit?action=team.created&module=users&limit=10";
    const first = await request(path, "GET", undefined, tenant.cookies.admin);
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(10);
    expect(first.body.total).toBe(23);
    const made = await request(
      "admin/teams",
      "POST",
      { name: "After snapshot" },
      tenant.cookies.admin,
    );
    const second = await request(
      `${path}&page=2&snapshot=${encodeURIComponent(first.body.snapshot)}`,
      "GET",
      undefined,
      tenant.cookies.admin,
    );
    expect(second.body.total).toBe(23);
    expect(
      second.body.items.some((v: any) =>
        first.body.items.some((r: any) => r.id === v.id),
      ),
    ).toBe(false);
    const events = await request(
      `audit?search=${made.body.id}&source=database&limit=10`,
      "GET",
      undefined,
      tenant.cookies.admin,
    );
    expect(events.body.items[0].actor_id).toBe(tenant.users.admin.id);
    expect(events.body.items[0].detail.changedFields).toContain("name");
    expect(events.body.items[0].detail.after.name).toBe("After snapshot");
    const business = await request(
      `audit?search=${made.body.id}&source=business&limit=10`,
      "GET",
      undefined,
      tenant.cookies.admin,
    );
    expect(business.body.items[0].correlation_id).toBe(
      events.body.items[0].correlation_id,
    );
    expect(
      (await request("audit?limit=25", "GET", undefined, tenant.cookies.admin))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "audit?from=2026-12-01&to=2026-01-01",
          "GET",
          undefined,
          tenant.cookies.admin,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `audit?search=${made.body.id}`,
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).body.items,
    ).toEqual([]);
    const source = await request(
      "sources",
      "POST",
      { name: "Audit credential source", type: "INCOMING" },
      tenant.cookies.admin,
    );
    const key = await request(
      `sources/${source.body.id}/keys`,
      "POST",
      {},
      tenant.cookies.admin,
    );
    expect(key.status).toBe(201);
    const logged = await request(
      `audit?search=${key.body.id}&source=database`,
      "GET",
      undefined,
      tenant.cookies.admin,
    );
    expect(logged.body.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged.body)).not.toContain(key.body.token);
  });
  it("scopes budget and ledger audit to the owning team and masks amounts without finance access", async () => {
    const tenant = await fixture();
    await login(tenant, "admin");
    await login(tenant, "creator");
    await pool.query("UPDATE roles SET permissions=$2 WHERE id=$1", [
      tenant.roles.creator,
      JSON.stringify(["campaigns:read", "audit:read"]),
    ]);
    const centre = await request(
      "admin/cost-centres",
      "POST",
      { name: "Team B finance", teamId: tenant.teamB },
      tenant.cookies.admin,
    );
    expect(centre.status).toBe(201);
    const budget = await request(
      "budgets",
      "POST",
      {
        costCentreId: centre.body.id,
        startsOn: new Date().toISOString().slice(0, 10),
        months: 1,
        amount: "123.4567",
      },
      tenant.cookies.admin,
    );
    expect(budget.status).toBe(201);
    const captured = (
      await pool.query(
        "SELECT * FROM audit WHERE company_id=$1 AND (resource_id=$2 OR (resource_type='ledger' AND detail->'after'->>'budget_id'=$2))",
        [tenant.company, budget.body.id],
      )
    ).rows;
    expect(captured.length).toBeGreaterThanOrEqual(3);
    expect(captured.every((e: any) => e.team_id === tenant.teamB)).toBe(true);
    const hidden = await request(
      `audit?search=${budget.body.id}`,
      "GET",
      undefined,
      tenant.cookies.creator,
    );
    expect(hidden.body.items).toEqual([]);
    // Old records tagged with the acting admin's team must also remain hidden.
    await pool.query("UPDATE audit SET team_id=$2 WHERE resource_id=$1", [
      budget.body.id,
      tenant.team,
    ]);
    expect(
      (
        await request(
          `audit?search=${budget.body.id}`,
          "GET",
          undefined,
          tenant.cookies.creator,
        )
      ).body.items,
    ).toEqual([]);
    await request(
      `budgets/${tenant.budget}/topup`,
      "POST",
      { amount: "12.3456", reason: "Audit financial access" },
      tenant.cookies.admin,
    );
    const own = await request(
      `audit?search=${tenant.budget}`,
      "GET",
      undefined,
      tenant.cookies.creator,
    );
    expect(own.body.items.length).toBeGreaterThan(0);
    const change = own.body.items.find(
      (e: any) => e.resource_type === "budgets" && e.action === "data.update",
    );
    expect(change.detail.after.adjusted).toBe("[redacted]");
    const semantic = own.body.items.find(
      (e: any) => e.action === "budget.topup",
    );
    expect(semantic.detail.amount).toBe("[redacted]");
    const finance = await request(
      `audit?search=${tenant.budget}`,
      "GET",
      undefined,
      tenant.cookies.admin,
    );
    expect(
      finance.body.items.find((e: any) => e.action === "budget.topup").detail
        .amount,
    ).toBe("12.3456");
  });
  it("stores work identity and role levels without granting implicit privileges or cross-company membership", async () => {
    const role = await request(
      "admin/roles",
      "POST",
      {
        name: "Read-only manager",
        level: 99,
        permissions: ["campaigns:read"],
        companyScope: false,
      },
      f.cookies.admin,
    );
    expect(role.status).toBe(201);
    expect(role.body.level).toBe(99);
    const email = `staff-${randomUUID()}@example.test`;
    const input = {
      name: "Work identity",
      email,
      password: "TestPassword123!",
      teamId: f.team,
      roleId: role.body.id,
      employeeId: `EMP-${randomUUID()}`,
      department: "Operations",
      jobTitle: "Analyst",
      workPhone: "+62 21 555 0100",
    };
    const user = await request("admin/users", "POST", input, f.cookies.admin);
    expect(user.status).toBe(201);
    const auth = await request("auth/login", "POST", {
      email,
      password: input.password,
    });
    expect(auth.status).toBe(201);
    expect(
      (await request("bootstrap", "GET", undefined, auth.cookie)).body.user
        .role_level,
    ).toBe(99);
    expect(
      (await request("admin/workspace", "GET", undefined, auth.cookie)).status,
    ).toBe(403);
    const current = (
      await request("admin/workspace", "GET", undefined, f.cookies.admin)
    ).body;
    expect(current.company.corporate_id).toMatch(/^UMS-/);
    expect(
      current.users.find((u: any) => u.id === user.body.id).employee_id,
    ).toBe(input.employeeId);
    expect(
      (
        await request(
          `admin/users/${user.body.id}/details`,
          "PUT",
          { ...input, name: "Updated name" },
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "admin/users",
          "POST",
          {
            ...input,
            email: `wrong-${email}`,
            employeeId: "OTHER",
            roleId: other.roles.admin,
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `admin/roles/${role.body.id}`,
          "PUT",
          {
            name: "No implicit powers",
            level: 8,
            permissions: ["campaigns:read"],
            companyScope: false,
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("bootstrap", "GET", undefined, auth.cookie)).status,
    ).toBe(401);
    expect(
      (await request("auth/login", "POST", { email, password: input.password }))
        .status,
    ).toBe(201);
  });
  it("changes passwords without logging secrets and revokes other sessions", async () => {
    const personal = await fixture();
    const first = await login(personal, "creator");
    const current = await login(personal, "creator");
    const newPassword = "ChangedPassword456!";
    expect(
      (
        await request(
          "auth/password",
          "POST",
          { currentPassword: "incorrect", newPassword },
          current,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "auth/password",
          "POST",
          { currentPassword: "TestPassword123!", newPassword: "short" },
          current,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "auth/password",
          "POST",
          {
            currentPassword: "TestPassword123!",
            newPassword: "TestPassword123!",
          },
          current,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "auth/password",
          "POST",
          { currentPassword: "TestPassword123!", newPassword },
          current,
        )
      ).status,
    ).toBe(201);
    expect((await request("bootstrap", "GET", undefined, first)).status).toBe(
      401,
    );
    expect((await request("bootstrap", "GET", undefined, current)).status).toBe(
      200,
    );
    expect(
      (
        await request("auth/login", "POST", {
          email: personal.users.creator.email,
          password: "TestPassword123!",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("auth/login", "POST", {
          email: personal.users.creator.email,
          password: newPassword,
        })
      ).status,
    ).toBe(201);
    const logs = (
      await pool.query(
        "SELECT detail FROM audit WHERE company_id=$1 AND action='auth.password_changed'",
        [personal.company],
      )
    ).rows;
    expect(logs).toHaveLength(1);
    expect(logs[0].detail.revokedOtherSessions).toBe(1);
    expect(JSON.stringify(logs)).not.toContain(newPassword);
    expect(JSON.stringify(logs)).not.toContain("TestPassword123!");
  });
  it("requires a session and rejects state changes without CSRF headers", async () => {
    expect((await request("bootstrap")).status).toBe(401);
    expect(
      (
        await request(
          "campaigns",
          "POST",
          definition(f),
          f.cookies.creator,
          false,
        )
      ).status,
    ).toBe(403);
  });
  it("enforces company and team isolation for guessed identifiers and role permissions", async () => {
    const c = await campaign(f);
    expect(
      (
        await request(
          `campaigns/${c.id}`,
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(`campaigns/${c.id}`, "GET", undefined, f.cookies.outsider))
        .status,
    ).toBe(404);
    expect(
      (await request("audit", "GET", undefined, f.cookies.creator)).status,
    ).toBe(403);
    expect(
      (
        await request(
          `datasets/${f.dataset}`,
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
  });
  it("prevents creator self-approval even with administrator permissions", async () => {
    const c = await campaign(f, {}, "admin");
    await request(`campaigns/${c.id}/submit`, "POST", {}, f.cookies.admin);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 0 },
          f.cookies.admin,
        )
      ).status,
    ).toBe(403);
  });
  it("freezes content and policy and cannot dispatch before both approvals", async () => {
    const c = await campaign(f);
    await request(`campaigns/${c.id}/submit`, "POST", {}, f.cookies.creator);
    await request(
      `campaigns/${c.id}/decision`,
      "POST",
      { decision: "APPROVE", version: 1, stage: 0 },
      f.cookies.approver,
    );
    expect(
      (await pool.query("SELECT 1 FROM runs WHERE campaign_id=$1", [c.id]))
        .rowCount,
    ).toBe(0);
    const wrong = await request(
      `campaigns/${c.id}/decision`,
      "POST",
      { decision: "APPROVE", version: 1, stage: 1 },
      f.cookies.approver,
    );
    expect(wrong.status).toBe(403);
    await request(
      "templates",
      "POST",
      {
        name: "New version",
        channel: "email",
        body: "Changed {{name}}",
        parentId: f.template,
      },
      f.cookies.creator,
    );
    await request(
      `campaigns/${c.id}/decision`,
      "POST",
      { decision: "APPROVE", version: 1, stage: 1 },
      f.cookies.finance,
    );
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    expect(m.body).toBe("Hi Demo");
    await processMessage(m.id);
    await processMessage(m.id);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM attempts WHERE message_id=$1",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await applyLocalEvent(m.id, `late-${m.id}`, "SENT");
    await applyLocalEvent(m.id, `late-${m.id}`, "SENT");
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [m.id]))
        .rows[0].status,
    ).toBe("DELIVERED");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM ledger WHERE message_id=$1 AND kind='SPEND'",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("atomically prevents competing campaigns from reserving the same budget", async () => {
    await pool.query(
      "UPDATE budgets SET allocated=spent+reserved+10-adjusted WHERE id=$1",
      [f.budget],
    );
    const a = await campaign(f),
      b = await campaign(f);
    for (const c of [a, b]) {
      await request(`campaigns/${c.id}/submit`, "POST", {}, f.cookies.creator);
      await request(
        `campaigns/${c.id}/decision`,
        "POST",
        { decision: "APPROVE", version: 1, stage: 0 },
        f.cookies.approver,
      );
    }
    const results = await Promise.all(
      [a, b].map((c) =>
        request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 1 },
          f.cookies.finance,
        ),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    const runs = (
      await pool.query(
        "SELECT status FROM runs WHERE campaign_id=ANY($1::uuid[])",
        [[a.id, b.id]],
      )
    ).rows;
    expect(runs.filter((r) => r.status === "BUDGET_HOLD")).toHaveLength(1);
    expect(runs.filter((r) => r.status === "QUEUED")).toHaveLength(1);
    const available = (
      await pool.query(
        "SELECT allocated+adjusted-reserved-spent AS n FROM budgets WHERE id=$1",
        [f.budget],
      )
    ).rows[0].n;
    expect(Number(available)).toBe(0);
    const held = (
      await pool.query(
        "SELECT id FROM runs WHERE campaign_id=ANY($1::uuid[]) AND status='BUDGET_HOLD'",
        [[a.id, b.id]],
      )
    ).rows[0].id;
    expect(
      (await pool.query("SELECT 1 FROM messages WHERE run_id=$1", [held]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await request(
          `budgets/${f.budget}/topup`,
          "POST",
          { amount: "100", reason: "Test internal allocation" },
          f.cookies.finance,
        )
      ).status,
    ).toBe(201);
    expect(
      (await request(`runs/${held}/retry`, "POST", {}, f.cookies.creator))
        .status,
    ).toBe(201);
  });
  it("marks expired schedules missed and requires a new execution identity to reschedule", async () => {
    const c = await campaign(f, {
      mode: "once",
      scheduledAt: new Date(Date.now() - 3600000).toISOString(),
    });
    await approve(f, c.id);
    await schedulerTick();
    await schedulerTick();
    const run = (
      await pool.query("SELECT * FROM runs WHERE campaign_id=$1", [c.id])
    ).rows;
    expect(run).toHaveLength(1);
    expect(run[0].status).toBe("MISSED");
    expect(
      (await pool.query("SELECT 1 FROM messages WHERE run_id=$1", [run[0].id]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await request(
          `runs/${run[0].id}/reschedule`,
          "POST",
          { date: new Date(Date.now() + 3600000).toISOString() },
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    expect(
      (await pool.query("SELECT * FROM runs WHERE campaign_id=$1", [c.id]))
        .rowCount,
    ).toBe(2);
  });
  it("rejects overlapping budget periods and audits authorized allocation changes", async () => {
    const current = new Date().toISOString().slice(0, 10);
    expect(
      (
        await request(
          "budgets",
          "POST",
          {
            costCentreId: f.centre,
            startsOn: current,
            months: 3,
            amount: "100",
          },
          f.cookies.finance,
        )
      ).status,
    ).toBe(409);
    const audit = await request(
      "audit?search=budget.topup",
      "GET",
      undefined,
      f.cookies.finance,
    );
    expect(audit.status).toBe(200);
    expect(
      audit.body.items.some((r: any) => r.action === "budget.topup" && r.ip),
    ).toBe(true);
  });
  it("pauses and cancels undispatched work without charging or resending it", async () => {
    const c = await campaign(f);
    await approve(f, c.id);
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    expect(
      (
        await request(
          `campaigns/${c.id}/control`,
          "POST",
          { action: "pause", reason: "Operator pause test" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    expect(await processMessage(m.id)).toBe("deferred");
    expect(
      (await pool.query("SELECT 1 FROM attempts WHERE message_id=$1", [m.id]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await request(
          `campaigns/${c.id}/control`,
          "POST",
          { action: "resume", reason: "Operator resume test" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    await processMessage(m.id);
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [m.id]))
        .rows[0].status,
    ).toBe("DELIVERED");
    const cancelled = await campaign(f);
    await approve(f, cancelled.id);
    const cm = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [cancelled.id],
      )
    ).rows[0];
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `campaigns/${cancelled.id}/control`,
            "POST",
            { action: "cancel", reason: "Cancel remaining test" },
            f.cookies.creator,
          )
        ).status,
      ).toBe(201);
    await processMessage(cm.id);
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [cm.id]))
        .rows[0].status,
    ).toBe("CANCELLED");
    expect(
      (await pool.query("SELECT 1 FROM attempts WHERE message_id=$1", [cm.id]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM ledger WHERE message_id=$1 AND kind='RELEASE'",
          [cm.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("holds interrupted execution until an explicit recovery decision", async () => {
    const c = await campaign(f);
    await approve(f, c.id);
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    const old = randomUUID();
    recoveryWorkers.push(old);
    await pool.query(
      "INSERT INTO worker_sessions(id,last_seen) VALUES($1,now()-interval '1 minute')",
      [old],
    );
    await pool.query("UPDATE runs SET worker_session_id=$2 WHERE id=$1", [
      m.run_id,
      old,
    ]);
    await recoverInterruptedRuns();
    expect(
      (await pool.query("SELECT status FROM runs WHERE id=$1", [m.run_id]))
        .rows[0].status,
    ).toBe("RECOVERY_HOLD");
    expect(await processMessage(m.id)).toBe("deferred");
    expect(
      (
        await request(
          `runs/${m.run_id}/recover`,
          "POST",
          { reason: "Continue inspected synthetic remainder" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    await processMessage(m.id);
    await processMessage(m.id);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM attempts WHERE message_id=$1",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("approves a recurring series once and deduplicates concurrent scheduler ticks", async () => {
    const c = await campaign(f, {
      mode: "recurring",
      scheduledAt: new Date(Date.now() - 86400000 - 1000).toISOString(),
      recurrence: { frequency: "daily", interval: 1, count: 2 },
    });
    await approve(f, c.id);
    await Promise.all([schedulerTick(), schedulerTick(), schedulerTick()]);
    const runs = (
      await pool.query(
        "SELECT * FROM runs WHERE campaign_id=$1 ORDER BY intended_at",
        [c.id],
      )
    ).rows;
    expect(runs).toHaveLength(2);
    expect(runs[0].status).toBe("MISSED");
    expect(runs[1].status).toBe("QUEUED");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM approvals WHERE campaign_id=$1",
          [c.id],
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("preserves old submitted definitions and requires fresh approvals after revision", async () => {
    const c = await campaign(f, {
      mode: "once",
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await approve(f, c.id);
    const revised = await request(
      `campaigns/${c.id}`,
      "PUT",
      definition(f, {
        name: "Revised schedule",
        mode: "once",
        scheduledAt: new Date(Date.now() + 7200000).toISOString(),
      }),
      f.cookies.creator,
    );
    expect(revised.status).toBe(200);
    expect(revised.body.version).toBe(2);
    expect(
      (
        await pool.query(
          "SELECT definition FROM campaign_versions WHERE campaign_id=$1 AND version=1",
          [c.id],
        )
      ).rows[0].definition.name,
    ).toBe("Integration campaign");
    expect(
      (await pool.query("SELECT status FROM campaigns WHERE id=$1", [c.id]))
        .rows[0].status,
    ).toBe("DRAFT");
    await approve(f, c.id);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM approvals WHERE campaign_id=$1",
          [c.id],
        )
      ).rows[0].n,
    ).toBe(4);
  });
  it("lets a source-only custom role sign in without exposing campaign sections", async () => {
    const role = await request(
      "admin/roles",
      "POST",
      {
        name: "Source only",
        permissions: ["sources:write"],
        companyScope: false,
      },
      f.cookies.admin,
    );
    const user = await request(
      "admin/users",
      "POST",
      {
        name: "Source operator",
        email: `source-${randomUUID()}@example.test`,
        password: "TestPassword123!",
        teamId: f.team,
        roleId: role.body.id,
      },
      f.cookies.admin,
    );
    expect(user.status).toBe(201);
    const logged = await request("auth/login", "POST", {
      email: user.body.email,
      password: "TestPassword123!",
    });
    const boot = await request("bootstrap", "GET", undefined, logged.cookie);
    expect(boot.status).toBe(200);
    expect(boot.body.campaigns).toEqual([]);
    expect(boot.body.stats).toEqual([]);
    const c = await campaign(f);
    expect(
      (await request(`campaigns/${c.id}`, "GET", undefined, logged.cookie))
        .status,
    ).toBe(403);
  });
  it("keeps provider versions and credentials scoped, and rechecks new rates against approval", async () => {
    const definition = await request(
      "providers/definitions",
      "POST",
      {
        name: "Test multi-channel vendor",
        adapter: "SIMULATOR",
        channels: ["email", "sms", "whatsapp"],
      },
      f.cookies.admin,
    );
    expect(definition.status).toBe(201);
    expect(
      (
        await request(
          `providers/definitions/${definition.body.id}/test`,
          "POST",
          {},
          f.cookies.admin,
        )
      ).body.networkContacted,
    ).toBe(false);
    expect(
      (
        await request(
          `providers/definitions/${definition.body.id}/publish`,
          "POST",
          {},
          f.cookies.admin,
        )
      ).status,
    ).toBe(201);
    const secret = "synthetic-provider-secret";
    const account = await request(
      "providers/accounts",
      "POST",
      {
        name: "Test vendor account",
        definitionId: definition.body.id,
        sender: "Demo sender",
        credentials: { apiKey: secret },
        rates: { email: "5.25", sms: "350", whatsapp: "500" },
      },
      f.cookies.admin,
    );
    expect(account.status).toBe(201);
    const listed = await request(
      "providers",
      "GET",
      undefined,
      f.cookies.admin,
    );
    expect(JSON.stringify(listed.body)).not.toContain(secret);
    expect(JSON.stringify(listed.body)).not.toContain("credentials_cipher");
    expect(
      (
        await request(
          "providers/accounts",
          "POST",
          {
            name: "Cross company account",
            definitionId: definition.body.id,
            sender: "No",
          },
          other.cookies.admin,
        )
      ).status,
    ).toBe(400);
    const c = await campaign(f, { providerAccountId: account.body.id });
    await approve(f, c.id);
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    expect(m.unit_cost).toBe("5.2500");
    expect(m.provider_version_id).toBeTruthy();
    await request(
      `providers/accounts/${account.body.id}/status`,
      "POST",
      { enabled: false },
      f.cookies.admin,
    );
    expect(await processMessage(m.id)).toBe("deferred");
    expect(
      (await pool.query("SELECT status FROM runs WHERE id=$1", [m.run_id]))
        .rows[0].status,
    ).toBe("VALIDATION_HOLD");
    await request(
      `providers/accounts/${account.body.id}/status`,
      "POST",
      { enabled: true },
      f.cookies.admin,
    );
    expect(
      (
        await request(
          `runs/${m.run_id}/recover`,
          "POST",
          { reason: "Provider reactivated after inspection" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    await processMessage(m.id);
    const version = await request(
      `providers/accounts/${account.body.id}/versions`,
      "POST",
      {
        definitionId: definition.body.id,
        sender: "New sender",
        credentials: { apiKey: "synthetic-version-two" },
      },
      f.cookies.admin,
    );
    expect(version.status).toBe(201);
    expect(
      (
        await pool.query(
          "SELECT provider_version_id FROM messages WHERE id=$1",
          [m.id],
        )
      ).rows[0].provider_version_id,
    ).toBe(m.provider_version_id);
    const changed = await campaign(f, { providerAccountId: account.body.id });
    await request(
      `campaigns/${changed.id}/submit`,
      "POST",
      {},
      f.cookies.creator,
    );
    await request(
      `campaigns/${changed.id}/decision`,
      "POST",
      { decision: "APPROVE", version: 1, stage: 0 },
      f.cookies.approver,
    );
    expect(
      (
        await request(
          `providers/accounts/${account.body.id}/rates`,
          "POST",
          {
            channel: "email",
            price: "1000",
            effectiveFrom: new Date().toISOString(),
            reason: "Test effective price change",
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          `campaigns/${changed.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 1 },
          f.cookies.finance,
        )
      ).status,
    ).toBe(201);
    const held = (
      await pool.query("SELECT * FROM runs WHERE campaign_id=$1", [changed.id])
    ).rows[0];
    expect(held.status).toBe("VALIDATION_HOLD");
    expect(
      (await pool.query("SELECT 1 FROM messages WHERE run_id=$1", [held.id]))
        .rowCount,
    ).toBe(0);
  });
  it("does not let an administrator approve their own material revision", async () => {
    const c = await campaign(f, {
      mode: "once",
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await approve(f, c.id);
    expect(
      (
        await request(
          `campaigns/${c.id}`,
          "PUT",
          definition(f, {
            name: "Admin revision",
            mode: "once",
            scheduledAt: new Date(Date.now() + 7200000).toISOString(),
          }),
          f.cookies.admin,
        )
      ).status,
    ).toBe(200);
    await request(`campaigns/${c.id}/submit`, "POST", {}, f.cookies.admin);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 2, stage: 0 },
          f.cookies.admin,
        )
      ).status,
    ).toBe(403);
  });
  it("does not send queued schedules after their first-start window expires", async () => {
    const c = await campaign(f, {
      mode: "once",
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });
    await approve(f, c.id);
    await schedulerTick();
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    expect(m).toBeTruthy();
    // Model elapsed queue downtime without a slow wall-clock sleep.
    await pool.query(
      "UPDATE runs SET intended_at=now()-interval '2 minutes' WHERE id=$1",
      [m.run_id],
    );
    await processMessage(m.id);
    await processMessage(m.id);
    expect(
      (await pool.query("SELECT status FROM runs WHERE id=$1", [m.run_id]))
        .rows[0].status,
    ).toBe("MISSED");
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [m.id]))
        .rows[0].status,
    ).toBe("SUPPRESSED");
    expect(
      (await pool.query("SELECT 1 FROM attempts WHERE message_id=$1", [m.id]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM ledger WHERE message_id=$1 AND kind='RELEASE'",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("persists dashboard order, size and filters without expanding data permissions", async () => {
    const layout = {
      widgets: ["budget", "delivery"],
      sizes: { budget: "full", delivery: "half" },
      filters: { channel: "sms", days: "7" },
    };
    expect(
      (await request("dashboard", "PUT", layout, f.cookies.creator)).status,
    ).toBe(200);
    const boot = await request(
      "bootstrap",
      "GET",
      undefined,
      f.cookies.creator,
    );
    expect(boot.body.user.profile.dashboard).toEqual(layout);
    expect(boot.body.stats).toEqual([]);
    expect(
      (
        await request(
          "dashboard",
          "PUT",
          { widgets: ["arbitrary-query"] },
          f.cookies.creator,
        )
      ).status,
    ).toBe(400);
    const defaults = {
      widgets: ["delivery"],
      sizes: { delivery: "full" },
      filters: { channel: "all", days: "all" },
    };
    expect(
      (
        await request(
          "admin/dashboard-default",
          "PUT",
          defaults,
          f.cookies.creator,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "admin/dashboard-default",
          "PUT",
          defaults,
          f.cookies.admin,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("dashboard/reset", "POST", {}, f.cookies.creator)).status,
    ).toBe(201);
    expect(
      (await request("bootstrap", "GET", undefined, f.cookies.creator)).body
        .user.profile.dashboard.widgets,
    ).toEqual(["delivery"]);
    expect(
      (
        await request(
          `admin/roles/${f.roles.approver}/dashboard-default`,
          "PUT",
          { ...defaults, widgets: ["activity"] },
          f.cookies.admin,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("bootstrap", "GET", undefined, f.cookies.approver)).body
        .user.profile.dashboard.widgets,
    ).toEqual(["activity"]);
    expect(
      (
        await request(
          `admin/roles/${f.roles.approver}/dashboard-default`,
          "PUT",
          defaults,
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
  });
  it("keeps financial details permissioned and scopes ledger/export and notification reads", async () => {
    const c = await campaign(f);
    await approve(f, c.id);
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    await processMessage(m.id);
    await processMessage(m.id);
    const role = await request(
      "admin/roles",
      "POST",
      {
        name: "Campaign viewer",
        permissions: ["campaigns:read"],
        companyScope: false,
      },
      f.cookies.admin,
    );
    const created = await request(
      "admin/users",
      "POST",
      {
        name: "Viewer",
        email: `viewer-${randomUUID()}@example.test`,
        password: "TestPassword123!",
        teamId: f.team,
        roleId: role.body.id,
      },
      f.cookies.admin,
    );
    const cookie = (
      await request("auth/login", "POST", {
        email: created.body.email,
        password: "TestPassword123!",
      })
    ).cookie;
    const detail = await request(`campaigns/${c.id}`, "GET", undefined, cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.messages[0]).not.toHaveProperty("unit_cost");
    expect(detail.body.runs[0]).not.toHaveProperty("estimated");
    expect(detail.body.campaign.definition).not.toHaveProperty(
      "spendingCeiling",
    );
    expect(detail.body.campaign.snapshot[0]).not.toHaveProperty("cost");
    expect(
      (await request(`budgets/${f.budget}/ledger`, "GET", undefined, cookie))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `budgets/${f.budget}/ledger`,
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
    const ledger = await request(
      `budgets/${f.budget}/ledger`,
      "GET",
      undefined,
      f.cookies.finance,
    );
    expect(ledger.status).toBe(200);
    expect(ledger.body.rows.some((r: any) => r.kind === "SPEND")).toBe(true);
    await request(
      `budgets/${f.budget}/topup`,
      "POST",
      { amount: "1", reason: "=1+1" },
      f.cookies.finance,
    );
    const csv = await fetch(`${base}/budgets/${f.budget}/ledger.csv`, {
      headers: { Cookie: f.cookies.finance },
    });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain('"\'=1+1"');
    const dispatchAudit = (
      await pool.query(
        "SELECT detail FROM audit WHERE company_id=$1 AND resource_type='message_events' AND resource_id=$2",
        [f.company, m.id],
      )
    ).rows;
    expect(dispatchAudit.length).toBeGreaterThan(0);
    expect(
      dispatchAudit.every(
        (e: any) =>
          !e.detail.after.body &&
          !e.detail.after.recipient &&
          !e.detail.after.detail,
      ),
    ).toBe(true);
    expect(
      dispatchAudit.some((e: any) => e.detail.after.status === "DELIVERED"),
    ).toBe(true);
    const completion = (
      await pool.query("SELECT * FROM notifications WHERE event_key=$1", [
        `run:${m.run_id}:COMPLETED`,
      ])
    ).rows;
    expect(completion).toHaveLength(1);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `notifications/${completion[0].id}/read`,
            "POST",
            {},
            f.cookies.creator,
          )
        ).status,
      ).toBe(201);
    expect(
      (
        await pool.query("SELECT read_by FROM notifications WHERE id=$1", [
          completion[0].id,
        ])
      ).rows[0].read_by,
    ).toEqual([f.users.creator.id]);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM audit WHERE company_id=$1 AND resource_id=$2 AND action='notification.read'",
          [f.company, completion[0].id],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await request(
          `notifications/${completion[0].id}/read`,
          "POST",
          {},
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
  });
  it("rejects approval of a version or stage that differs from the reviewed context", async () => {
    const c = await campaign(f, {
      mode: "once",
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await request(`campaigns/${c.id}/submit`, "POST", {}, f.cookies.creator);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 2, stage: 0 },
          f.cookies.approver,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 1 },
          f.cookies.approver,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 0 },
          f.cookies.approver,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 0 },
          f.cookies.finance,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `campaigns/${c.id}/decision`,
          "POST",
          { decision: "APPROVE", version: 1, stage: 1 },
          f.cookies.finance,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM approvals WHERE campaign_id=$1",
          [c.id],
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("processes the actual transactional outbox through Redis/BullMQ without duplicate charges", async () => {
    const c = await campaign(f);
    await approve(f, c.id);
    stopWorkers = await startWorkers();
    const until = Date.now() + 10000;
    let status = "";
    while (Date.now() < until) {
      status = (
        await pool.query(
          "SELECT m.status FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
          [c.id],
        )
      ).rows[0].status;
      if (status === "DELIVERED") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(status).toBe("DELIVERED");
    const count = (
      await pool.query(
        "SELECT count(*)::int AS n FROM outbox o JOIN messages m ON m.id=o.message_id JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1 AND o.published_at IS NOT NULL",
        [c.id],
      )
    ).rows[0].n;
    expect(count).toBe(1);
  });
  it("holds uncertain acceptance without retry and reconciles the reservation once", async () => {
    const dataset = (
      await pool.query(
        "INSERT INTO datasets(company_id,team_id,name,rows,created_by) VALUES($1,$2,'Unknown',$3,$4) RETURNING id",
        [
          f.company,
          f.team,
          JSON.stringify([
            {
              name: "Uncertain",
              email: "unknown@example.test",
              demo_outcome: "unknown",
            },
          ]),
          f.users.creator.id,
        ],
      )
    ).rows[0].id;
    const c = await campaign(f, { datasetId: dataset });
    await approve(f, c.id);
    const m = (
      await pool.query(
        "SELECT m.* FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1",
        [c.id],
      )
    ).rows[0];
    await processMessage(m.id);
    await processMessage(m.id);
    expect(
      (await pool.query("SELECT status FROM messages WHERE id=$1", [m.id]))
        .rows[0].status,
    ).toBe("UNKNOWN");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM attempts WHERE message_id=$1",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await request(
          `messages/${m.id}/reconcile`,
          "POST",
          { status: "DELIVERED", reason: "Confirmed synthetic outcome" },
          f.cookies.creator,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `messages/${m.id}/reconcile`,
          "POST",
          { status: "DELIVERED", reason: "Confirmed synthetic outcome" },
          f.cookies.finance,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          `messages/${m.id}/reconcile`,
          "POST",
          { status: "DELIVERED", reason: "Repeated confirmation" },
          f.cookies.finance,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM ledger WHERE message_id=$1 AND kind='SPEND'",
          [m.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("supports scoped administration and validates/normalizes profile pictures", async () => {
    expect(
      (await request("admin/workspace", "GET", undefined, f.cookies.creator))
        .status,
    ).toBe(403);
    const team = await request(
      "admin/teams",
      "POST",
      { name: "New team" },
      f.cookies.admin,
    );
    expect(team.status).toBe(201);
    const role = await request(
      "admin/roles",
      "POST",
      {
        name: "Read only",
        permissions: ["campaigns:read"],
        companyScope: false,
      },
      f.cookies.admin,
    );
    expect(role.status).toBe(201);
    const email = `new-${randomUUID()}@example.test`;
    const created = await request(
      "admin/users",
      "POST",
      {
        name: "New user",
        email,
        password: "NewPassword123!",
        teamId: team.body.id,
        roleId: role.body.id,
      },
      f.cookies.admin,
    );
    expect(created.status).toBe(201);
    expect(
      (
        await request(
          "admin/users",
          "POST",
          {
            name: "Invalid user",
            email: `x-${email}`,
            password: "NewPassword123!",
            teamId: other.team,
            roleId: role.body.id,
          },
          f.cookies.admin,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "profile/picture",
          "PUT",
          { base64: Buffer.from("<svg><script/></svg>").toString("base64") },
          f.cookies.creator,
        )
      ).status,
    ).toBe(400);
    const picture = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#137c73" },
    })
      .png()
      .toBuffer();
    expect(
      (
        await request(
          "profile/picture",
          "PUT",
          { base64: picture.toString("base64") },
          f.cookies.creator,
        )
      ).status,
    ).toBe(200);
    const bootstrap = await request(
      "bootstrap",
      "GET",
      undefined,
      f.cookies.creator,
    );
    expect(bootstrap.body.user.profile.picture).toMatch(
      /^data:image\/webp;base64,/,
    );
  });
  it("ingests scoped incoming data idempotently and supports key revocation", async () => {
    const source = await request(
      "sources",
      "POST",
      { name: "Incoming test", type: "INCOMING" },
      f.cookies.creator,
    );
    expect(source.status).toBe(201);
    const key = await request(
      `sources/${source.body.id}/keys`,
      "POST",
      {},
      f.cookies.creator,
    );
    expect(key.status).toBe(201);
    const headers = {
      Authorization: `Bearer ${key.body.token}`,
      "Idempotency-Key": randomUUID(),
    };
    const path = `incoming/datasets/${source.body.id}`;
    const value = {
      rows: [
        { name: "Incoming demo", email: "api@example.test", reference: 123 },
      ],
    };
    const first = await request(path, "POST", value, undefined, false, headers);
    expect(first.status).toBe(201);
    const again = await request(path, "POST", value, undefined, false, headers);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(first.body.id);
    expect(
      (
        await request(
          path,
          "POST",
          { rows: [{ name: "Changed" }] },
          undefined,
          false,
          headers,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `datasets/${first.body.id}`,
          "GET",
          undefined,
          other.cookies.admin,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(path, "POST", value, undefined, false, {
          "Idempotency-Key": randomUUID(),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          `sources/${source.body.id}/keys/${key.body.id}/revoke`,
          "POST",
          {},
          f.cookies.creator,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(path, "POST", value, undefined, false, {
          ...headers,
          "Idempotency-Key": randomUUID(),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM campaigns WHERE definition->>'datasetId'=$1",
          [first.body.id],
        )
      ).rowCount,
    ).toBe(0);
  });
});

describe("UMS operational read APIs", () => {
  let h: any, isolated: any, id: string, ids: string[];
  beforeAll(async () => {
    h = await fixture();
    isolated = await fixture();
    for (const role of ["creator", "approver", "finance", "admin", "outsider"])
      await login(h, role);
    await login(isolated, "admin");
    await pool.query("UPDATE datasets SET rows=$2 WHERE id=$1", [
      h.dataset,
      JSON.stringify(
        Array.from({ length: 3 }, (_, i) => ({
          name: `Person ${i}`,
          email: `private-${i}@example.test`,
        })),
      ),
    ]);
    id = (await campaign(h)).id;
    await approve(h, id);
    ids = (
      await pool.query(
        "SELECT m.id FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1 ORDER BY m.created_at DESC,m.id DESC",
        [id],
      )
    ).rows.map((r) => r.id);
    await processMessage(ids[0]);
    // Extra attempt evidence must not multiply the logical-message denominator.
    await pool.query(
      "INSERT INTO attempts(company_id,message_id,status,detail) VALUES($1,$2,'REJECTED','Synthetic diagnostic attempt')",
      [h.company, ids[0]],
    );
  });
  it("paginates exact-ID searches without recipient/payload leakage or cross-team/company access", async () => {
    const first = await request(
      `operations/messages?search=${id}&limit=2`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();
    expect(first.body.items[0].recipient_masked).toContain("•••");
    expect(JSON.stringify(first.body)).not.toContain("private-");
    expect(first.body.items[0]).not.toHaveProperty("body");
    const second = await request(
      `operations/messages?search=${id}&limit=2&cursor=${first.body.nextCursor}`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    expect(
      new Set([...first.body.items, ...second.body.items].map((r) => r.id))
        .size,
    ).toBe(3);
    for (const cookie of [h.cookies.outsider, isolated.cookies.admin])
      expect(
        (
          await request(
            `operations/messages?search=${id}`,
            "GET",
            undefined,
            cookie,
          )
        ).body.items,
      ).toEqual([]);
    expect(
      (
        await request(
          "operations/messages?cursor=broken",
          "GET",
          undefined,
          h.cookies.creator,
        )
      ).status,
    ).toBe(400);
    const filters = await request(
      "operations/filters",
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(filters.status).toBe(200);
    expect(filters.body.teams.map((t) => t.id)).toEqual([h.team]);
  });
  it("counts messages separately from attempts and separates unavailable vendor financial measures", async () => {
    const summary = await request(
      `operations/summary?search=${id}&days=7`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.totals.total).toBe(3);
    expect(summary.body.totals.delivered).toBe(1);
    expect(summary.body.totals.queued).toBe(2);
    expect(summary.body.channels[0].total).toBe(3);
    const usage = await request(
      `operations/usage?search=${id}`,
      "GET",
      undefined,
      h.cookies.finance,
    );
    expect(usage.status).toBe(200);
    expect(usage.body.items[0].messages).toBe(3);
    expect(usage.body.items[0].provider_reported_cost).toBeNull();
    expect(usage.body.items[0].invoiced_cost).toBeNull();
    const inaccessible = await request(
      `operations/summary?search=${id}`,
      "GET",
      undefined,
      isolated.cookies.admin,
    );
    expect(inaccessible.body.totals.total).toBe(0);
  });
  it("reports vendor failures and immutable cost-centre attribution with bounded date filters", async () => {
    const summary = await request(
      `operations/summary?search=${id}`,
      "GET",
      undefined,
      h.cookies.finance,
    );
    expect(summary.status).toBe(200);
    expect(
      summary.body.vendors.reduce((n: number, v: any) => n + v.total, 0),
    ).toBe(3);
    expect(summary.body.vendors[0]).toHaveProperty("failure_rate");
    const original = (
      await pool.query("SELECT definition FROM campaigns WHERE id=$1", [id])
    ).rows[0].definition;
    await pool.query(
      "UPDATE campaigns SET definition=jsonb_set(definition,'{costCentreId}',to_jsonb($2::text)) WHERE id=$1",
      [id, randomUUID()],
    );
    try {
      const usage = await request(
        `operations/usage?search=${id}&limit=1&page=1`,
        "GET",
        undefined,
        h.cookies.finance,
      );
      expect(usage.status).toBe(200);
      expect(usage.body.items).toHaveLength(1);
      expect(usage.body.items[0].cost_centre_id).toBe(h.centre);
      expect(usage.body.totals.messages).toBe(3);
      expect(usage.body.totals.reserved_cost).toBe("20.0000");
      expect(usage.body.totalGroups).toBe(1);
      expect(usage.body.hasMore).toBe(false);
      const beyond = await request(
        `operations/usage?search=${id}&limit=1&page=2`,
        "GET",
        undefined,
        h.cookies.finance,
      );
      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.totals.messages).toBe(3);
      expect(
        (
          await request(
            `operations/usage?search=${id}&costCentre=${randomUUID()}`,
            "GET",
            undefined,
            h.cookies.finance,
          )
        ).body.items,
      ).toEqual([]);
      expect(
        (
          await request(
            `operations/usage?search=${id}&from=2000-01-01&to=2000-01-02`,
            "GET",
            undefined,
            h.cookies.finance,
          )
        ).body.items,
      ).toEqual([]);
      expect(
        (
          await request(
            "operations/summary?from=2026-12-01&to=2026-01-01",
            "GET",
            undefined,
            h.cookies.finance,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await request(
            "operations/summary?from=2026-02-31",
            "GET",
            undefined,
            h.cookies.finance,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await request(
            `operations/usage?search=${id}`,
            "GET",
            undefined,
            isolated.cookies.admin,
          )
        ).body.totals.messages,
      ).toBe(0);
    } finally {
      await pool.query("UPDATE campaigns SET definition=$2 WHERE id=$1", [
        id,
        original,
      ]);
    }
  });
  it("restricts and audits payload access and hides costs server-side for a viewer", async () => {
    const limited = await request(
      `messages/${ids[0]}`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(limited.body.payloadAvailable).toBe(false);
    expect(limited.body.message).not.toHaveProperty("body");
    expect(limited.body.message.recipient).toContain("•••");
    const admin = await request(
      `messages/${ids[0]}`,
      "GET",
      undefined,
      h.cookies.admin,
    );
    expect(admin.body.payloadAvailable).toBe(true);
    expect(admin.body.message.body).toContain("Hi Person");
    expect(
      (
        await pool.query(
          "SELECT 1 FROM audit WHERE company_id=$1 AND action='message.payload_viewed' AND resource_id=$2",
          [h.company, ids[0]],
        )
      ).rowCount,
    ).toBe(1);
    await pool.query("UPDATE roles SET permissions=$2 WHERE id=$1", [
      h.roles.creator,
      JSON.stringify(["campaigns:read"]),
    ]);
    const viewer = await request(
      `operations/messages?search=${id}`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(viewer.body.items[0]).not.toHaveProperty("estimated_cost");
    const summary = await request(
      `operations/summary?search=${id}`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(summary.body.totals).not.toHaveProperty("estimated_cost");
    const campaignView = await request(
      `campaigns/${id}`,
      "GET",
      undefined,
      h.cookies.creator,
    );
    expect(campaignView.body.campaign.snapshot[0]).not.toHaveProperty("body");
    expect(campaignView.body.messages[0].recipient).toContain("•••");
    expect(
      (
        await request(
          `datasets/${h.dataset}`,
          "GET",
          undefined,
          h.cookies.creator,
        )
      ).status,
    ).toBe(403);

    expect(
      (await request("operations/usage", "GET", undefined, h.cookies.creator))
        .status,
    ).toBe(403);
  });
});
