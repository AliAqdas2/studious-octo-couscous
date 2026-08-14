import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";

/** Stable int4 key for pg_advisory_lock — one intake at a time. */
const GMAIL_INTAKE_LOCK_KEY = 872314001;

export async function withGmailIntakeLock<T>(
  fn: () => Promise<T>
): Promise<T> {
  const db = getDb();
  if (!db) {
    return fn();
  }
  await db.execute(sql`SELECT pg_advisory_lock(${GMAIL_INTAKE_LOCK_KEY})`);
  try {
    return await fn();
  } finally {
    try {
      await db.execute(
        sql`SELECT pg_advisory_unlock(${GMAIL_INTAKE_LOCK_KEY})`
      );
    } catch (e) {
      console.warn(
        "[gmail-intake] advisory unlock failed:",
        e instanceof Error ? e.message : e
      );
    }
  }
}
