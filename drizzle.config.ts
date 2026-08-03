import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to mangia-crm/.env (see .env.example)."
    );
  }

  if (url.includes("supabase.co") && !url.includes("sslmode=")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}sslmode=require`;
  }

  return url;
}

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: "./server/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
