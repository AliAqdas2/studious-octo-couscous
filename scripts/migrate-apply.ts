import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresOptions, resolveDatabaseUrl } from "../server/db/config.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(databaseUrl, getPostgresOptions(databaseUrl));

  try {
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const names = new Set(tables.map((row) => String(row.table_name)));

    if (!names.has("users")) {
      console.log("Applying initial schema (0000)...");
      const initial = readFileSync(
        join(__dirname, "../drizzle/0000_open_omega_flight.sql"),
        "utf8"
      );
      for (const statement of initial.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed) {
          await sql.unsafe(trimmed);
        }
      }
      console.log("Initial schema applied");
    } else {
      console.log("Base tables already present");
    }

    const columns = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
    `;
    const userCols = new Set(columns.map((row) => String(row.column_name)));

    if (!names.has("refresh_tokens") || !userCols.has("password_hash")) {
      console.log("Applying auth migration (0001)...");
      const authSql = readFileSync(
        join(__dirname, "../drizzle/0001_chunky_songbird.sql"),
        "utf8"
      );
      for (const statement of authSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("Auth migration applied");
    } else {
      console.log("Auth columns and refresh_tokens already present");
    }

    if (!names.has("gmail_connections")) {
      console.log("Applying gmail_connections migration (0002)...");
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "gmail_connections" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid,
          "email" varchar(255) NOT NULL,
          "access_token" text NOT NULL,
          "refresh_token" text,
          "expires_at" timestamptz,
          "created_date" timestamptz DEFAULT now() NOT NULL,
          "updated_date" timestamptz DEFAULT now() NOT NULL
        );
      `);
      try {
        await sql.unsafe(`
          ALTER TABLE "gmail_connections"
          ADD CONSTRAINT "gmail_connections_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
          ON DELETE set null ON UPDATE no action;
        `);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          !message.includes("already exists") &&
          !message.includes("duplicate")
        ) {
          throw err;
        }
        console.log(`Skipping FK (already applied): ${message.split("\n")[0]}`);
      }
      console.log("gmail_connections migration applied");
    } else {
      console.log("gmail_connections already present");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(() => {
    console.log("migrate-apply complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("migrate-apply failed:", err);
    process.exit(1);
  });
