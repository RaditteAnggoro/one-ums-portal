import "dotenv/config";
import { Pool,types, type PoolClient } from "pg";
// Calendar dates are not instants; keep budget boundaries independent of the server timezone.
types.setTypeParser(1082,value=>value);
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://messaging:local-development-only@127.0.0.1:54329/messaging",
  max: 10,
});
export async function transaction<T>(
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
