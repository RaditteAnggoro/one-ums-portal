import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { platform, arch, availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import { pool } from "../apps/api/src/db.js";

const base = process.env.BENCHMARK_API_ORIGIN ?? "http://127.0.0.1:4100";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error(
    "The portfolio benchmark only runs against a local instance.",
  );
const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  messages: 10000,
  environment: {
    platform: platform(),
    arch: arch(),
    node: process.version,
    parallelism: availableParallelism(),
  },
  mode: "local-simulation",
  sourceFingerprint: createHash("sha256")
    .update(
      [
        "apps/api/src/queue.ts",
        "apps/api/src/campaigns.ts",
        "apps/api/src/budget-release.ts",
        "packages/domain/src/rules.ts",
        "pnpm-lock.yaml",
      ]
        .map((path) => path + "\n" + readFileSync(path, "utf8"))
        .join("\n"),
    )
    .digest("hex"),
};
async function api(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3000",
      "X-Requested-With": "MessagingApp",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${data.message ?? response.status}`);
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(role: string) {
  return (
    await api("auth/login", "POST", {
      email: `${role}@demo.local`,
      password: process.env.DEMO_PASSWORD ?? "LocalDemo123!",
    })
  ).cookie!;
}
async function main() {
  const health = await api("health");
  if (health.data.mode !== "simulation")
    throw new Error("Benchmark requires simulation mode.");
  const cookies: Record<string, string> = {};
  for (const role of ["creator", "approver", "finance", "admin"])
    cookies[role] = await login(role);
  const boot = (await api("bootstrap", "GET", undefined, cookies.creator)).data;
  const template = boot.templates.find(
    (t: any) => t.channel === "email" && t.team_id === boot.user.team_id,
  );
  const budget = boot.budgets.find(
    (b: any) =>
      b.team_id === boot.user.team_id && Number(b.available) >= 100000,
  );
  if (!template || !budget)
    throw new Error(
      "Provide an email template and at least IDR 100,000 in the demo budget before running.",
    );
  const started = performance.now();
  const rows = Array.from({ length: 10000 }, (_, index) => ({
    customer_name: `Synthetic ${index + 1}`,
    reference: `BENCH-${index + 1}`,
    email: `benchmark-${index + 1}@example.test`,
    demo_outcome: "delivered",
  }));
  const source = (
    await api(
      "datasets",
      "POST",
      {
        name: `Benchmark ${report.startedAt}`,
        format: "json",
        content: JSON.stringify(rows),
      },
      cookies.creator,
    )
  ).data;
  const campaign = (
    await api(
      "campaigns",
      "POST",
      {
        name: `10,000-message local benchmark ${report.startedAt}`,
        templateIds: [template.id],
        datasetId: source.id,
        costCentreId: budget.cost_centre_id,
        spendingCeiling: "100000",
        mode: "immediate",
      },
      cookies.creator,
    )
  ).data;
  report.campaignId = campaign.id;
  report.companyId = boot.user.company_id;
  await api(`campaigns/${campaign.id}/submit`, "POST", {}, cookies.creator);
  const dispatchStarted = performance.now();
  for (const [stageIndex, stage] of boot.policy.stages.entries()) {
    const role = ["approver", "finance", "admin"].find((name) =>
      stage.roleIds.includes(
        boot.roles.find((r: any) => r.name.toLowerCase() === name)?.id,
      ),
    );
    if (!role)
      throw new Error(
        "The current demo approval policy has no matching seeded approver.",
      );
    await api(
      `campaigns/${campaign.id}/decision`,
      "POST",
      {
        decision: "APPROVE",
        version: campaign.version,
        stage: stageIndex,
        reason: "Local 10k simulation benchmark",
      },
      cookies[role],
    );
  }
  const deadline = Date.now() + 180000;
  let count = 0;
  let maxApiRssBytes = 0;
  while (Date.now() < deadline) {
    count = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM messages m JOIN runs r ON r.id=m.run_id WHERE r.campaign_id=$1 AND m.status='DELIVERED'",
          [campaign.id],
        )
      ).rows[0].n,
    );
    const diagnostic = (
      await api("admin/diagnostics", "GET", undefined, cookies.admin)
    ).data;
    maxApiRssBytes = Math.max(maxApiRssBytes, diagnostic.apiRssBytes);
    if (count === 10000) break;
    if (Math.round((performance.now() - dispatchStarted) / 1000) % 10 === 0)
      console.log(`${count}/10000 local simulated deliveries`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const elapsed = (performance.now() - dispatchStarted) / 1000;
  const evidence = (
    await pool.query(
      `SELECT count(DISTINCT m.id)::int AS messages,count(DISTINCT a.id)::int AS attempts,count(DISTINCT l.id)::int AS spend_entries
    FROM messages m JOIN runs r ON r.id=m.run_id LEFT JOIN attempts a ON a.message_id=m.id LEFT JOIN ledger l ON l.message_id=m.id AND l.kind='SPEND' WHERE r.campaign_id=$1`,
      [campaign.id],
    )
  ).rows[0];
  const costs = (
    await pool.query(
      "SELECT sum(l.amount) AS spent FROM ledger l JOIN runs r ON r.id=l.run_id WHERE r.campaign_id=$1 AND l.kind='SPEND'",
      [campaign.id],
    )
  ).rows[0];
  Object.assign(report, {
    result: count === 10000 ? "passed" : "bounded-timeout",
    delivered: count,
    dispatchSeconds: Number(elapsed.toFixed(3)),
    totalSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
    messagesPerSecond: Number((count / elapsed).toFixed(2)),
    maxApiRssBytes,
    evidence,
    costs,
    limitations:
      "One local email-simulator campaign; no external vendor latency, real deliverability, or production capacity claim. RSS measures API/worker process, not the whole machine.",
  });
  if (
    count !== 10000 ||
    evidence.messages !== 10000 ||
    evidence.attempts !== 10000 ||
    evidence.spend_entries !== 10000
  )
    throw new Error(
      "Benchmark did not complete with exactly one attempt and simulated spend per message.",
    );
}
main()
  .catch((error) => {
    report.result = "failed";
    report.error = (error as Error).message;
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    report.finishedAt = new Date().toISOString();
    mkdirSync(".agents/artifacts/implementation", { recursive: true });
    writeFileSync(
      ".agents/artifacts/implementation/benchmark.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    await pool.end();
  });
