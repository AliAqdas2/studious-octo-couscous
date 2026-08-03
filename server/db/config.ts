import { config } from "dotenv";

config();

export function resolveDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    return null;
  }

  if (url.includes("supabase.co") && !url.includes("sslmode=")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}sslmode=require`;
  }

  return url;
}

export function getPostgresOptions(databaseUrl: string) {
  return {
    ssl: databaseUrl.includes("supabase.co") ? ("require" as const) : undefined,
    connect_timeout: 10,
  };
}
