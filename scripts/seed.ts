import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { env } from "../server/config/env.js";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";
import { automationConfig, users } from "../server/db/schema/index.js";
import { hashPassword } from "../server/services/auth/authService.js";

config();

async function seed(): Promise<void> {
  const email = env.seedAdminEmail.toLowerCase();
  const passwordFromEnv = Boolean(process.env.SEED_ADMIN_PASSWORD?.trim());
  console.log("[seed] Starting admin / automation seed");
  console.log(
    `[seed] SEED_ADMIN_EMAIL=${email} SEED_ADMIN_PASSWORD=${
      passwordFromEnv ? "[set from env]" : "[default: changeme]"
    }`
  );

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "[seed] DATABASE_URL is not set — check docker-compose env_file: .env on the server"
    );
  }

  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, "http:");
    const u = new URL(normalized);
    console.log(
      `[seed] DATABASE_URL host=${u.hostname} port=${u.port || "5432"} db=${u.pathname}`
    );
  } catch {
    console.log("[seed] DATABASE_URL present (could not parse host for logging)");
  }

  const db = getDb();
  if (!db) {
    throw new Error(
      "[seed] getDb() returned null — DATABASE_URL missing or invalid"
    );
  }

  try {
    await db.execute(sql`select 1`);
    console.log("[seed] Database connection OK");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[seed] Database unreachable (${message}). Check DATABASE_URL and that the app container can reach Postgres (db_network / Supabase).`
    );
  }

  let userTableOk = false;
  try {
    await db.select({ id: users.id }).from(users).limit(1);
    userTableOk = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[seed] users table not readable (${message}). Run migrations first (RUN_MIGRATIONS=true).`
    );
  }
  if (userTableOk) {
    console.log("[seed] users table OK");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.log(
      `[seed] Admin already exists: ${email} (id=${existing.id}, role=${existing.role}, active=${existing.isActive})`
    );
  } else {
    console.log(`[seed] Admin not found — creating ${email}...`);
    const passwordHash = await hashPassword(env.seedAdminPassword);
    const [admin] = await db
      .insert(users)
      .values({
        email,
        fullName: "Admin",
        role: "admin",
        isActive: true,
        passwordHash,
      })
      .returning();
    console.log(`[seed] Created admin user: ${admin.email} (${admin.id})`);
  }

  const [configRow] = await db
    .select()
    .from(automationConfig)
    .where(eq(automationConfig.key, "default"))
    .limit(1);

  if (configRow) {
    console.log("[seed] automation_config key=default already exists");
  } else {
    await db.insert(automationConfig).values({
      key: "default",
    });
    console.log("[seed] Created automation_config key=default");
  }

  try {
    const { seedOnboardingWorkflows } = await import(
      "../server/services/onboarding/seedWorkflows.js"
    );
    await seedOnboardingWorkflows();
    console.log("[seed] Onboarding workflow templates seeded");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[seed] Onboarding seed skipped (run migrations first if tables missing): ${message}`
    );
  }
}

seed()
  .then(() => {
    console.log("[seed] Seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(
      "[seed] Seed failed:",
      err instanceof Error ? err.message : err
    );
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
