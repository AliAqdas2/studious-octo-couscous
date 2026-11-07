import { and, asc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  clientCommunicationStageDefs,
  eventClientCommunicationStages,
  events,
} from "../../db/schema/index.js";
import { toApiRecord } from "../entities/serialize.js";
import type { AuthUser } from "../auth/authService.js";
import {
  CLIENT_COMM_STAGE_DEFS,
  type ClientCommEventTypeScope,
} from "./clientCommStageCatalog.js";
import { isFoodTourExperience } from "./experienceMatrix.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function computeDueDate(
  eventDate: Date | null | undefined,
  offsetDays: number | null | undefined,
  anchor: string | null | undefined
): Date | null {
  if (!eventDate || anchor === "none" || offsetDays == null) return null;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  const days = Number(offsetDays) || 0;
  if (anchor === "before_event") {
    d.setDate(d.getDate() - days);
  } else if (anchor === "after_event") {
    d.setDate(d.getDate() + days);
  } else {
    return null;
  }
  return d;
}

function scopeForEventType(eventType: string | null | undefined): ClientCommEventTypeScope[] {
  const scopes: ClientCommEventTypeScope[] = ["all"];
  if (isFoodTourExperience(eventType || "")) {
    scopes.push("food_tour");
  } else if (
    String(eventType || "")
      .toLowerCase()
      .includes("cooking")
  ) {
    scopes.push("cooking");
  }
  return scopes;
}

/** Upsert catalog rows from CLIENT_COMM_STAGE_DEFS (idempotent). */
export async function ensureClientCommStageDefs() {
  const db = requireDb();
  const now = new Date();
  for (const def of CLIENT_COMM_STAGE_DEFS) {
    const [existing] = await db
      .select()
      .from(clientCommunicationStageDefs)
      .where(eq(clientCommunicationStageDefs.slug, def.slug))
      .limit(1);
    if (existing) {
      await db
        .update(clientCommunicationStageDefs)
        .set({
          title: def.title,
          sortOrder: def.sortOrder,
          subject: def.subject,
          body: def.body,
          defaultOwnerRole: def.defaultOwnerRole,
          dueOffsetDays: def.dueOffsetDays,
          dueAnchor: def.dueAnchor,
          eventTypeScope: def.eventTypeScope,
          isActive: true,
          updatedDate: now,
        })
        .where(eq(clientCommunicationStageDefs.id, existing.id));
    } else {
      await db.insert(clientCommunicationStageDefs).values({
        slug: def.slug,
        title: def.title,
        sortOrder: def.sortOrder,
        subject: def.subject,
        body: def.body,
        defaultOwnerRole: def.defaultOwnerRole,
        dueOffsetDays: def.dueOffsetDays,
        dueAnchor: def.dueAnchor,
        eventTypeScope: def.eventTypeScope,
        isActive: true,
        updatedDate: now,
      });
    }
  }
  return { ok: true, count: CLIENT_COMM_STAGE_DEFS.length };
}

/**
 * Materialize missing stage instances for an event (never deletes completed).
 */
export async function materializeClientCommStagesForEvent(eventId: string) {
  const db = requireDb();
  await ensureClientCommStageDefs();

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const scopes = scopeForEventType(event.eventType);
  const defs = await db
    .select()
    .from(clientCommunicationStageDefs)
    .where(
      and(
        eq(clientCommunicationStageDefs.isActive, true),
        inArray(clientCommunicationStageDefs.eventTypeScope, scopes)
      )
    )
    .orderBy(asc(clientCommunicationStageDefs.sortOrder));

  const existing = await db
    .select()
    .from(eventClientCommunicationStages)
    .where(eq(eventClientCommunicationStages.eventId, eventId));
  const have = new Set(existing.map((r) => r.defId));

  const now = new Date();
  let inserted = 0;
  for (const def of defs) {
    if (have.has(def.id)) continue;
    await db.insert(eventClientCommunicationStages).values({
      eventId,
      defId: def.id,
      title: def.title,
      sortOrder: def.sortOrder,
      templateSubject: def.subject,
      templateBody: def.body,
      dueDate: computeDueDate(
        event.eventDate,
        def.dueOffsetDays,
        def.dueAnchor
      ),
      status: "pending",
      updatedDate: now,
    });
    inserted += 1;
  }

  return { ok: true, inserted, totalDefs: defs.length };
}

export async function listEventClientCommStages(eventId: string) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  // Ensure stages exist when panel is opened (idempotent).
  await materializeClientCommStagesForEvent(eventId);

  const rows = await db
    .select()
    .from(eventClientCommunicationStages)
    .where(eq(eventClientCommunicationStages.eventId, eventId))
    .orderBy(asc(eventClientCommunicationStages.sortOrder));

  const stages = rows.map((r) => toApiRecord(r as Record<string, unknown>));
  const pending = rows.find((r) => r.status !== "done");
  const doneCount = rows.filter((r) => r.status === "done").length;

  return {
    stages,
    current: pending
      ? toApiRecord(pending as Record<string, unknown>)
      : null,
    current_title: pending?.title ?? (rows.length ? "Complete" : null),
    done_count: doneCount,
    total_count: rows.length,
    ops_stage: event.stage ?? null,
  };
}

export interface PatchClientCommStagePayload {
  assigned_user?: string | null;
  assignedUser?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  status?: "pending" | "done" | null;
  complete?: boolean;
}

export async function patchEventClientCommStage(
  eventId: string,
  stageId: string,
  payload: PatchClientCommStagePayload,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(eventClientCommunicationStages)
    .where(eq(eventClientCommunicationStages.id, stageId))
    .limit(1);
  if (!existing || existing.eventId !== eventId) {
    throw new AppError("Client communication stage not found", 404);
  }

  const now = new Date();
  const assigned =
    payload.assigned_user !== undefined
      ? payload.assigned_user
      : payload.assignedUser !== undefined
        ? payload.assignedUser
        : undefined;

  let dueDate = existing.dueDate;
  if (payload.due_date !== undefined || payload.dueDate !== undefined) {
    const raw =
      payload.due_date !== undefined ? payload.due_date : payload.dueDate;
    if (raw == null || String(raw).trim() === "") {
      dueDate = null;
    } else {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) {
        throw new AppError("due_date is invalid", 400);
      }
      dueDate = d;
    }
  }

  let status = existing.status;
  let completedAt = existing.completedAt;
  let completedBy = existing.completedBy;

  const markDone =
    payload.complete === true ||
    payload.status === "done";
  const markPending =
    payload.complete === false ||
    payload.status === "pending";

  if (markDone) {
    status = "done";
    completedAt = now;
    completedBy = user?.id ?? existing.completedBy;
  } else if (markPending) {
    status = "pending";
    completedAt = null;
    completedBy = null;
  }

  const [updated] = await db
    .update(eventClientCommunicationStages)
    .set({
      assignedUser:
        assigned !== undefined
          ? assigned
            ? String(assigned)
            : null
          : existing.assignedUser,
      dueDate,
      status,
      completedAt,
      completedBy,
      updatedDate: now,
    })
    .where(eq(eventClientCommunicationStages.id, stageId))
    .returning();

  return {
    stage: toApiRecord((updated || existing) as Record<string, unknown>),
  };
}
