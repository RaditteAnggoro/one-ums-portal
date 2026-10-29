import { pool, transaction } from "../apps/api/src/db.js";
import { pathToFileURL } from "node:url";
export async function seedCampaignExamples() {
  await transaction(async (db) => {
    for (const domain of ["demo.local", "other.local"]) {
      const u = (
        await db.query(
          "SELECT id,company_id,team_id FROM users WHERE email=$1",
          ["creator@" + domain],
        )
      ).rows[0];
      if (!u) continue;
      for (const [name, channel, body] of [
        ["Demo · SMS · 1 parameter", "sms", "Reference {{loan_no}}"],
        [
          "Demo · WhatsApp · 2 parameters",
          "whatsapp",
          "Hello {{name}}, reference {{loan_no}}",
        ],
        [
          "Demo · Email · 3 parameters",
          "email",
          "Hello {{name}}, loan {{loan_no}} is due on {{due_date}}.",
        ],
        [
          "Demo · Push · 0 parameters",
          "push",
          "Your monthly statement is ready.",
        ],
        [
          "Demo · Slack · 1 parameter",
          "slack",
          "Report {{reference}} is ready.",
        ],
        [
          "Demo · Telegram · 1 parameter",
          "telegram",
          "Report {{reference}} is ready.",
        ],
      ]) {
        await db.query(
          "INSERT INTO templates(company_id,team_id,name,channel,body,created_by) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM templates WHERE company_id=$1 AND team_id=$2 AND name=$3)",
          [u.company_id, u.team_id, name, channel, body, u.id],
        );
      }
      await db.query(
        "INSERT INTO datasets(company_id,team_id,name,rows,created_by) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM datasets WHERE company_id=$1 AND name=$3)",
        [
          u.company_id,
          u.team_id,
          "Demo · six-channel recipients",
          JSON.stringify([
            {
              name: "Synthetic Demo",
              loan_no: "LOAN-001",
              due_date: "2026-12-01",
              reference: "REF-001",
              email: "recipient@example.test",
              phone: "081200000001",
              slack_id: "C12345678",
              telegram_chat_id: "-10012345678",
              push_token: "synthetic-device-alias",
            },
          ]),
          u.id,
        ],
      );
    }
  });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  void seedCampaignExamples()
    .then(() => console.log("Synthetic campaign examples ready."))
    .finally(() => pool.end());
