import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { env } from "../server/config/env.js";
import { getDb } from "../server/db/index.js";
import { automationConfig, users } from "../server/db/schema/index.js";
import { hashPassword } from "../server/services/auth/authService.js";

config();

async function seed(): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const email = env.seedAdminEmail.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.log(`Admin user already exists: ${email}`);
  } else {
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
    console.log(`Created admin user: ${admin.email} (${admin.id})`);
  }

  const [configRow] = await db
    .select()
    .from(automationConfig)
    .where(eq(automationConfig.key, "default"))
    .limit(1);

  if (configRow) {
    console.log("automation_config default already exists");
  } else {
    await db.insert(automationConfig).values({
      key: "default",
    });
    console.log("Created automation_config key=default");
  }
}

seed()
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
