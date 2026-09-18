import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  beoScriptTemplates,
  HOST_MC_SCRIPT_SLUG,
} from "../../db/schema/beo-script-templates.js";
import { toApiRecord } from "../entities/serialize.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/** Default host MC script from BEO_System_docs/ScriptforBEO.html (placeholders). */
export const DEFAULT_HOST_MC_SCRIPT_BODY = `OPENING
Hello {{client_name}} – My name is {{host_name}} and I will be your MC today. Welcome to your {{event_name}} brought to you by Mangia DC! We're beyond appreciative to have you join us here.

Do you see this logo on me (gesture to logo on apron)? That's pronounced Mangia (Mahn-Jah) and that means "TO EAT" or "COME TOGETHER" in Italian, and that's exactly what we're going to be doing today!

Mangia DC's specialty is hosting in person food and drink experiences here in Washington DC such as paint and sips, mixology classes, chocolate making and much more. We also host remote experiences delivering materials directly to your door. I want to point out that a portion of every ticket sold to all of our events goes to the local charity S.O.M.E. (So Others Might Eat). Thank you for joining us in giving back so that those less fortunate can eat as well.

Today we have three goals; we want you to have fun, learn something new, and leave with a pleasantly full stomach.

Please enjoy celebrating tonight's event with your peers through the joy and magic of {{experience_activity}}.

INSTRUCTOR INTRO
As we begin would love to introduce you to your instructor for the evening: {{instructor_name}}

{{instructor_bio}}

CLOSING
Before you leave wouldn't this be a perfect time to get a group picture? Now that I have you all gathered here I want to remind you of our three goals. We wanted to have fun, learn something new and leave with pleasantly full stomachs. Did we do it? Great! Mangia on 3…1…2…3! (MANGIA) snap

This is great everyone. Well {{instructor_name}} I believe the saying goes: "all good things must come to an end" is that right? If you want to keep in touch with us you absolutely can at mangiadc.com. Feel free to keep your recipe card from today so you can prepare the {{dish_or_drink}} again at home! {{instructor_name}}, any final words?

Thank you so much everyone!

Event Ends`;

export async function getBeoScriptTemplate(slug: string = HOST_MC_SCRIPT_SLUG) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(beoScriptTemplates)
    .where(eq(beoScriptTemplates.slug, slug))
    .limit(1);
  if (!row) return null;
  return toApiRecord(row as unknown as Record<string, unknown>);
}

export async function upsertBeoScriptTemplate(input: {
  slug?: string;
  title?: string;
  body: string;
}) {
  const db = requireDb();
  const slug = (input.slug || HOST_MC_SCRIPT_SLUG).trim();
  const title = (input.title || "Host MC Script").trim() || "Host MC Script";
  const body = typeof input.body === "string" ? input.body : "";

  const [existing] = await db
    .select()
    .from(beoScriptTemplates)
    .where(eq(beoScriptTemplates.slug, slug))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(beoScriptTemplates)
      .set({
        title,
        body,
        updatedDate: new Date(),
      })
      .where(eq(beoScriptTemplates.id, existing.id))
      .returning();
    return toApiRecord(updated as unknown as Record<string, unknown>);
  }

  const [created] = await db
    .insert(beoScriptTemplates)
    .values({ slug, title, body })
    .returning();
  return toApiRecord(created as unknown as Record<string, unknown>);
}

export async function seedBeoScriptTemplates(): Promise<{ upserted: number }> {
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(beoScriptTemplates)
    .where(eq(beoScriptTemplates.slug, HOST_MC_SCRIPT_SLUG))
    .limit(1);

  if (existing) {
    // Do not overwrite ops edits on re-seed; only ensure row exists.
    return { upserted: 0 };
  }

  await db.insert(beoScriptTemplates).values({
    slug: HOST_MC_SCRIPT_SLUG,
    title: "Host MC Script",
    body: DEFAULT_HOST_MC_SCRIPT_BODY,
  });
  return { upserted: 1 };
}
