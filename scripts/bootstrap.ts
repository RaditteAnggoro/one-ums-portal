import "dotenv/config";
import { pool, transaction } from "../apps/api/src/db.js";
import { passwordMatches } from "../apps/api/src/security.js";
import { companySchema, provisionCompany } from "../apps/api/src/companies.js";
import { randomUUID } from "node:crypto";
async function main() {
  const email = process.env.BOOTSTRAP_EMAIL,
    password = process.env.BOOTSTRAP_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (at least 12 characters).",
    );
  const lock = await pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(8765403)");
    if (
      (await lock.query("SELECT 1 FROM platform_administrators LIMIT 1"))
        .rowCount
    )
      throw new Error(
        "A platform administrator already exists; bootstrap is disabled.",
      );
    let user = (
      await pool.query("SELECT * FROM users WHERE lower(email)=$1 AND active", [
        email.toLowerCase(),
      ])
    ).rows[0];
    if (user && !passwordMatches(password, user.password_hash))
      throw new Error("Existing operator credentials do not match.");
    if (!user) {
      const company = await provisionCompany(
        companySchema.parse({
          name: process.env.BOOTSTRAP_COMPANY ?? "UMS Platform",
          timezone: process.env.BOOTSTRAP_TIMEZONE ?? "Asia/Jakarta",
          language: "id",
          adminName: process.env.BOOTSTRAP_NAME ?? "Platform administrator",
          adminEmail: email,
          adminPassword: password,
        }),
      );
      user = (
        await pool.query("SELECT * FROM users WHERE id=$1", [company.owner.id])
      ).rows[0];
    }
    await transaction(async (db) => {
      await db.query(
        "INSERT INTO platform_administrators(user_id) VALUES($1)",
        [user.id],
      );
      await db.query(
        "INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id) VALUES($1,$2,$3::uuid,'platform.bootstrap','user',($3::uuid)::text,'{}','bootstrap',$4)",
        [user.company_id, user.team_id, user.id, randomUUID()],
      );
    });
    console.log(
      "Platform administrator initialized. Sign in using the configured email.",
    );
  } finally {
    await lock.query("SELECT pg_advisory_unlock(8765403)");
    lock.release();
  }
}
void main()
  .catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
