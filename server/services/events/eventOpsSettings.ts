import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { automationConfig } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import {
  DEFAULT_EVENT_OPS_FEATURES,
  EVENT_OPS_FEATURE_LABELS,
  mergeEventOpsFeatures,
  type EventOpsFeatures,
} from "./eventOpsFeatures.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export async function getEventOpsFeatures(): Promise<{
  features: EventOpsFeatures;
  labels: typeof EVENT_OPS_FEATURE_LABELS;
  configId: string | null;
}> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(automationConfig)
    .where(eq(automationConfig.key, "default"))
    .limit(1);
  return {
    features: mergeEventOpsFeatures(row?.eventOpsFeatures),
    labels: EVENT_OPS_FEATURE_LABELS,
    configId: row?.id ?? null,
  };
}

export async function updateEventOpsFeatures(
  partial: Partial<EventOpsFeatures>,
  user?: AuthUser | null
): Promise<{ features: EventOpsFeatures }> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(automationConfig)
    .where(eq(automationConfig.key, "default"))
    .limit(1);

  const next = mergeEventOpsFeatures({
    ...(row?.eventOpsFeatures || {}),
    ...partial,
    whatsappMedia: false,
  });

  const nextPayload = { ...next } as unknown as Record<string, boolean>;

  if (row) {
    await db
      .update(automationConfig)
      .set({
        eventOpsFeatures: nextPayload,
        updatedDate: new Date(),
      })
      .where(eq(automationConfig.id, row.id));
  } else {
    await db.insert(automationConfig).values({
      key: "default",
      eventOpsFeatures: nextPayload,
      createdBy: user?.id || null,
    });
  }

  return { features: next };
}

export { DEFAULT_EVENT_OPS_FEATURES };
