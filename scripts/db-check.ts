import { config } from "dotenv";
import postgres from "postgres";
import { getPostgresOptions, resolveDatabaseUrl } from "../server/db/config.js";

config();

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to mangia-crm/.env");
  process.exit(1);
}

const sql = postgres(databaseUrl, { ...getPostgresOptions(databaseUrl), max: 1 });

try {
  const result = await sql`select 1 as ok`;
  console.log("Database connection OK:", result[0]);
  await sql.end();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connection failed:", message);
  console.error(
    "Check DATABASE_URL in .env. For Supabase use the URI from Project Settings → Database and ensure the project ref/host is correct."
  );
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
}
