import { and, asc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  clientCommunicationStageDefs,
  eventClientCommunicationStages,
  events,
  leads,
} from "../../db/schema/index.js";
import { toApiRecord } from "../entities/serialize.js";
import type { AuthUser } from "../auth/authService.js";
import { createGmailDraft } from "../gmail/drafts.js";
import {
  CLIENT_COMM_STAGE_DEFS,
  COOKING_SIMPLE_COMM_SLUGS,
  type ClientCommEventTypeScope,
} from "./clientCommStageCatalog.js";
import { fillClientCommSubjectAndBody } from "./fillClientCommTemplate.js";
import { isFoodTourExperience } from "./experienceMatrix.js";

function isCookingEventType(eventType: string | null | undefined): boolean {
  return String(eventType || "")
    .toLowerCase()
    .includes("cooking");
}

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
          showInSimpleTrack: def.showInSimpleTrack,
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
        showInSimpleTrack: def.showInSimpleTrack,
        isActive: true,
        updatedDate: now,
      });
    }
  }
  return { ok: true, count: CLIENT_COMM_STAGE_DEFS.length };
}

/**
 * Materialize missing stage instances for an event (never deletes completed).
 * Cooking events only get the simple 11-step track.
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

  const cooking = isCookingEventType(event.eventType);
  const scopes = scopeForEventType(event.eventType);
  const defsAll = await db
    .select()
    .from(clientCommunicationStageDefs)
    .where(
      and(
        eq(clientCommunicationStageDefs.isActive, true),
        inArray(clientCommunicationStageDefs.eventTypeScope, scopes)
      )
    )
    .orderBy(asc(clientCommunicationStageDefs.sortOrder));

  const defs = cooking
    ? defsAll.filter((d) => d.showInSimpleTrack)
    : defsAll;

  const existing = await db
    .select()
    .from(eventClientCommunicationStages)
    .where(eq(eventClientCommunicationStages.eventId, eventId));
  const have = new Set(existing.map((r) => r.defId));

  const now = new Date();
  let inserted = 0;
  for (const def of defs) {
    if (have.has(def.id)) {
      // Refresh pending snapshots so renames/offsets apply after seed.
      const row = existing.find((r) => r.defId === def.id);
      if (row && row.status !== "done") {
        await db
          .update(eventClientCommunicationStages)
          .set({
            title: def.title,
            sortOrder: def.sortOrder,
            templateSubject: def.subject,
            templateBody: def.body,
            dueDate: computeDueDate(
              event.eventDate,
              def.dueOffsetDays,
              def.dueAnchor
            ),
            updatedDate: now,
          })
          .where(eq(eventClientCommunicationStages.id, row.id));
      }
      continue;
    }
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

  return { ok: true, inserted, totalDefs: defs.length, cooking_simple: cooking };
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

  const cooking = isCookingEventType(event.eventType);
  const rows = await db
    .select({
      stage: eventClientCommunicationStages,
      defSlug: clientCommunicationStageDefs.slug,
      showInSimpleTrack: clientCommunicationStageDefs.showInSimpleTrack,
    })
    .from(eventClientCommunicationStages)
    .innerJoin(
      clientCommunicationStageDefs,
      eq(
        eventClientCommunicationStages.defId,
        clientCommunicationStageDefs.id
      )
    )
    .where(eq(eventClientCommunicationStages.eventId, eventId))
    .orderBy(asc(eventClientCommunicationStages.sortOrder));

  const filtered = cooking
    ? rows.filter(
        (r) =>
          r.showInSimpleTrack ||
          (COOKING_SIMPLE_COMM_SLUGS as readonly string[]).includes(
            r.defSlug || ""
          )
      )
    : rows;

  const stageRows = filtered.map((r) => r.stage);
  const stages = stageRows.map((r) => toApiRecord(r as Record<string, unknown>));
  const pending = stageRows.find((r) => r.status !== "done");
  const doneCount = stageRows.filter((r) => r.status === "done").length;

  return {
    stages,
    current: pending
      ? toApiRecord(pending as Record<string, unknown>)
      : null,
    current_title: pending?.title ?? (stageRows.length ? "Complete" : null),
    done_count: doneCount,
    total_count: stageRows.length,
    ops_stage: event.stage ?? null,
    simple_track: cooking,
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

/**
 * Fill stage template from event data (no Gmail). Used by preview + draft.
 */
export async function previewClientCommStage(
  eventId: string,
  stageId: string
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const [stage] = await db
    .select()
    .from(eventClientCommunicationStages)
    .where(eq(eventClientCommunicationStages.id, stageId))
    .limit(1);
  if (!stage || stage.eventId !== eventId) {
    throw new AppError("Client communication stage not found", 404);
  }

  let company: string | null = null;
  if (event.leadId) {
    const [lead] = await db
      .select({ company: leads.company })
      .from(leads)
      .where(eq(leads.id, event.leadId))
      .limit(1);
    company = lead?.company ?? null;
  }

  const filled = fillClientCommSubjectAndBody(
    stage.templateSubject,
    stage.templateBody,
    {
      eventName: event.eventName,
      eventType: event.eventType,
      eventDate: event.eventDate,
      startTime: event.startTime,
      venue: event.venue,
      venueAddress: event.venueAddress,
      pocName: event.pocName,
      pocEmail: event.pocEmail,
      pocPhone: event.pocPhone,
      depositPaymentUrl: event.depositPaymentUrl,
      company,
    }
  );

  const hasUnfilled =
    /<<[^>]+>>/.test(filled.subject) || /<<[^>]+>>/.test(filled.body);

  return {
    to: filled.to,
    subject: filled.subject,
    body: filled.body,
    stage_id: stageId,
    stage_title: stage.title,
    has_unfilled_placeholders: hasUnfilled,
  };
}

/**
 * Fill stage template from event data and create a Gmail draft to the POC.
 */
export async function createClientCommStageDraft(
  eventId: string,
  stageId: string,
  user?: AuthUser | null
) {
  const filled = await previewClientCommStage(eventId, stageId);

  if (!filled.to) {
    throw new AppError(
      "Event needs a POC email before creating a draft. Set POC email on the event (Deposit / Event details).",
      400
    );
  }

  const db = requireDb();
  const [event] = await db
    .select({ leadId: events.leadId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  const draft = await createGmailDraft({
    to: filled.to,
    subject: filled.subject,
    body: filled.body,
    leadId: event?.leadId || undefined,
    userId: user?.id,
    userName: user?.full_name,
  });

  return {
    ...draft,
    to: filled.to,
    subject: filled.subject,
    body: filled.body,
    stage_id: stageId,
    stage_title: filled.stage_title,
  };
}
