import { config } from "dotenv";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getPostgresOptions, resolveDatabaseUrl } from "./config.js";
import * as schema from "./schema/index.js";

config();

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

function databaseHostLabel(databaseUrl: string): string {
  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, "http:");
    const u = new URL(normalized);
    const port = u.port ? `:${u.port}` : "";
    return `${u.hostname}${port}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

export function getDb(): PostgresJsDatabase<typeof schema> | null {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  if (!dbInstance) {
    client = postgres(databaseUrl, getPostgresOptions(databaseUrl));
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}

export function warnIfNoDatabase(): void {
  if (!resolveDatabaseUrl()) {
    console.warn(
      "[db] DATABASE_URL is not set — database features are disabled."
    );
  }
}

/** Probe the DB at startup and log connecting / connected / failed.
 *  Returns true if `select 1` succeeded.
 */
export async function logDatabaseStartup(): Promise<boolean> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.warn("[db] No DATABASE_URL — skipping connection check");
    return false;
  }

  const target = databaseHostLabel(databaseUrl);
  console.log(`[db] Connecting to ${target} …`);

  try {
    const db = getDb();
    if (!db || !client) {
      console.warn("[db] Client not initialized");
      return false;
    }
    await Promise.race([
      client`select 1 as ok`,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Connection timed out after 15s — check VPN, DATABASE_URL, or that Postgres is reachable"
              )
            ),
          15_000
        )
      ),
    ]);
    console.log(`[db] Connected to ${target}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db] Connection failed (${target}): ${message}`);
    return false;
  }
}

export { schema };
