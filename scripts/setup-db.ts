import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pool, transaction } from "../apps/api/src/db.js";
import { passwordHash } from "../apps/api/src/security.js";

async function main() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of readdirSync(resolve("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(8765401)");
      if (
        (
          await db.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        return;
      await db.query(readFileSync(resolve("migrations", name), "utf8"));
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    });
  }
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(8765402)");
    if ((await db.query("SELECT 1 FROM companies LIMIT 1")).rowCount) return;
    const hash = passwordHash(process.env.DEMO_PASSWORD ?? "LocalDemo123!");
    const all = [
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
    for (const [companyName, domain] of [
      ["Nusantara Demo", "demo.local"],
      ["Perusahaan Kedua", "other.local"],
    ]) {
      const company = (
        await db.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [
          companyName,
        ])
      ).rows[0].id;
      const team = (
        await db.query(
          "INSERT INTO teams(company_id,name) VALUES($1,$2) RETURNING id",
          [company, "Marketing"],
        )
      ).rows[0].id;
      await db.query("INSERT INTO teams(company_id,name) VALUES($1,$2)", [
        company,
        "Operasional",
      ]);
      const roles: Record<string, string> = {};
      for (const [name, permissions, scope] of [
        ["Admin", all, true],
        [
          "Creator",
          [
            "campaigns:read",
            "campaigns:create",
            "campaigns:manage",
            "budgets:read",
            "sources:write",
            "templates:write",
          ],
          false,
        ],
        [
          "Approver",
          ["campaigns:read", "campaigns:approve", "budgets:read", "audit:read"],
          false,
        ],
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
      ] as const) {
        roles[name] = (
          await db.query(
            "INSERT INTO roles(company_id,name,permissions,company_scope) VALUES($1,$2,$3,$4) RETURNING id",
            [company, name, JSON.stringify(permissions), scope],
          )
        ).rows[0].id;
      }
      await db.query(
        "INSERT INTO approval_policies(company_id,stages) VALUES($1,$2)",
        [
          company,
          JSON.stringify([
            { name: "Persetujuan tim", roleIds: [roles.Approver, roles.Admin] },
            {
              name: "Persetujuan anggaran",
              roleIds: [roles.Finance, roles.Admin],
            },
          ]),
        ],
      );
      const userIds: Record<string, string> = {};
      for (const [name, role] of [
        ["admin", "Admin"],
        ["creator", "Creator"],
        ["approver", "Approver"],
        ["finance", "Finance"],
      ]) {
        userIds[name] = (
          await db.query(
            "INSERT INTO users(company_id,team_id,role_id,email,name,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
            [
              company,
              team,
              roles[role],
              `${name}@${domain}`,
              `${role} Demo`,
              hash,
            ],
          )
        ).rows[0].id;
      }
      const centre = (
        await db.query(
          "INSERT INTO cost_centres(company_id,team_id,name) VALUES($1,$2,$3) RETURNING id",
          [company, team, "Marketing — Simulasi"],
        )
      ).rows[0].id;
      const seededBudget=(await db.query(
        "INSERT INTO budgets(company_id,cost_centre_id,starts_on,ends_on,months,allocated) VALUES($1,$2,date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 year')::date,12,1000000) RETURNING id",
        [company, centre],
      )).rows[0];
      await db.query("INSERT INTO ledger(company_id,budget_id,kind,amount,idempotency_key,reason) VALUES($1,$2,'ALLOCATE',1000000,$3,'Synthetic demo allocation')",[company,seededBudget.id,`allocate:${seededBudget.id}`]);
      for (const channel of ["email", "sms", "whatsapp"])
        await db.query(
          "INSERT INTO templates(company_id,team_id,name,channel,body,created_by) VALUES($1,$2,$3,$4,$5,$6)",
          [
            company,
            team,
            `Pengingat ${channel}`,
            channel,
            "Halo {{customer_name}}, pengingat untuk referensi {{reference}}. Terima kasih.",
            userIds.creator,
          ],
        );
      await db.query(
        "INSERT INTO datasets(company_id,team_id,name,rows,created_by) VALUES($1,$2,$3,$4,$5)",
        [
          company,
          team,
          "Kontak contoh (data sintetis)",
          JSON.stringify([
            {
              customer_name: "Ayu Demo",
              reference: "DEMO-001",
              email: "ayu@example.test",
              phone: "081200000001",
              demo_outcome: "delivered",
            },
            {
              customer_name: "Bima Demo",
              reference: "DEMO-002",
              email: "bima@example.test",
              phone: "081200000002",
              demo_outcome: "failed",
            },
            {
              customer_name: "Citra Demo",
              reference: "DEMO-003",
              email: "citra@example.test",
              phone: "081200000003",
              demo_outcome: "unknown",
            },
          ]),
          userIds.creator,
        ],
      );
    }
  });
  await transaction(async db=>{
    for(const domain of ['demo.local','other.local']){
      const creator=(await db.query('SELECT id,company_id,team_id FROM users WHERE email=$1',[`creator@${domain}`])).rows[0];if(!creator)continue;
      const existingViewer=(await db.query('SELECT 1 FROM users WHERE email=$1',[`viewer@${domain}`])).rowCount;
      if(!existingViewer){
        await db.query('INSERT INTO roles(company_id,name,permissions) VALUES($1,$2,$3) ON CONFLICT(company_id,name) DO NOTHING',[creator.company_id,'Viewer','["campaigns:read"]']);
        const role=(await db.query('SELECT id FROM roles WHERE company_id=$1 AND name=$2',[creator.company_id,'Viewer'])).rows[0].id;
        await db.query('INSERT INTO users(company_id,team_id,role_id,email,name,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[creator.company_id,creator.team_id,role,`viewer@${domain}`,'Viewer Demo',passwordHash(process.env.DEMO_PASSWORD??'LocalDemo123!')]);
      }
      if(!(await db.query('SELECT 1 FROM provider_accounts WHERE company_id=$1',[creator.company_id])).rowCount){
        const definition=(await db.query("INSERT INTO provider_definitions(company_id,name,adapter,channels,published,validated_at,created_by) VALUES($1,'Local demo provider','SIMULATOR','[\"email\",\"sms\",\"whatsapp\"]',true,now(),$2) RETURNING id",[creator.company_id,creator.id])).rows[0].id;
        const account=(await db.query("INSERT INTO provider_accounts(company_id,name) VALUES($1,'Local simulator') RETURNING id",[creator.company_id])).rows[0].id;
        const version=(await db.query("INSERT INTO provider_account_versions(company_id,account_id,definition_id,version,sender,simulated) VALUES($1,$2,$3,1,'Relay Demo',true) RETURNING id",[creator.company_id,account,definition])).rows[0].id;
        await db.query('UPDATE provider_accounts SET current_version_id=$2 WHERE id=$1',[account,version]);
        for(const [channel,price] of [['email','10'],['sms','350'],['whatsapp','500']])await db.query('INSERT INTO rate_cards(company_id,account_id,channel,price,effective_from) VALUES($1,$2,$3,$4,now())',[creator.company_id,account,channel,price]);
      }
    }
  });
  console.log(
    "Database ready. Synthetic demo: creator / approver / finance / admin @demo.local. Password from DEMO_PASSWORD (local default in .env.example).",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
