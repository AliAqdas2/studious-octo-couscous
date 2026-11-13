import { and, asc, eq, inArray, ne } from "drizzle-orm";
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
  REMOVED_CLIENT_COMM_SLUGS,
  THANK_YOU_COMM_SLUGS,
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

  // Deactivate duplicate extras that were removed from the catalog.
  if (REMOVED_CLIENT_COMM_SLUGS.length > 0) {
    await db
      .update(clientCommunicationStageDefs)
      .set({ isActive: false, updatedDate: now })
      .where(
        inArray(
          clientCommunicationStageDefs.slug,
          [...REMOVED_CLIENT_COMM_SLUGS]
        )
      );
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

  // Cooking: drop pending instances that are inactive or off the simple track.
  // Preserve completed history.
  if (cooking) {
    const stalePending = await db
      .select({
        id: eventClientCommunicationStages.id,
        status: eventClientCommunicationStages.status,
        showInSimpleTrack: clientCommunicationStageDefs.showInSimpleTrack,
        isActive: clientCommunicationStageDefs.isActive,
        defSlug: clientCommunicationStageDefs.slug,
      })
      .from(eventClientCommunicationStages)
      .innerJoin(
        clientCommunicationStageDefs,
        eq(
          eventClientCommunicationStages.defId,
          clientCommunicationStageDefs.id
        )
      )
      .where(eq(eventClientCommunicationStages.eventId, eventId));

    const toDelete = stalePending.filter((r) => {
      if (r.status === "done") return false;
      const onSimple =
        r.showInSimpleTrack ||
        (COOKING_SIMPLE_COMM_SLUGS as readonly string[]).includes(
          r.defSlug || ""
        );
      return !r.isActive || !onSimple;
    });
    if (toDelete.length > 0) {
      await db
        .delete(eventClientCommunicationStages)
        .where(
          inArray(
            eventClientCommunicationStages.id,
            toDelete.map((r) => r.id)
          )
        );
    }
  } else if (REMOVED_CLIENT_COMM_SLUGS.length > 0) {
    // Non-cooking: remove pending instances of deactivated duplicate defs only.
    const removedDefs = await db
      .select({ id: clientCommunicationStageDefs.id })
      .from(clientCommunicationStageDefs)
      .where(
        inArray(clientCommunicationStageDefs.slug, [
          ...REMOVED_CLIENT_COMM_SLUGS,
        ])
      );
    const removedIds = removedDefs.map((d) => d.id);
    if (removedIds.length > 0) {
      await db
        .delete(eventClientCommunicationStages)
        .where(
          and(
            eq(eventClientCommunicationStages.eventId, eventId),
            inArray(eventClientCommunicationStages.defId, removedIds),
            ne(eventClientCommunicationStages.status, "done")
          )
        );
    }
  }

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

function isThankYouSlug(slug: string | null | undefined): boolean {
  return (THANK_YOU_COMM_SLUGS as readonly string[]).includes(String(slug || ""));
}

function isClosedStatus(status: string | null | undefined): boolean {
  return status === "done" || status === "skipped";
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
      defActive: clientCommunicationStageDefs.isActive,
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

  const filtered = rows.filter((r) => {
    if (!r.defActive) return false;
    if (!cooking) return true;
    return (
      r.showInSimpleTrack ||
      (COOKING_SIMPLE_COMM_SLUGS as readonly string[]).includes(
        r.defSlug || ""
      )
    );
  });

  const thankYouRows = filtered.filter((r) => isThankYouSlug(r.defSlug));
  const otherRows = filtered.filter((r) => !isThankYouSlug(r.defSlug));

  const thankYouVariants: Array<Record<string, unknown>> = thankYouRows.map(
    (r) => ({
      ...toApiRecord(r.stage as Record<string, unknown>),
      def_slug: r.defSlug,
    })
  );

  let thankYouSelectedId: string | null = null;
  if (thankYouVariants.length) {
    const doneVar = thankYouVariants.find((v) => v.status === "done");
    const pendingVar = thankYouVariants.find((v) => v.status === "pending");
    thankYouSelectedId =
      String(
        (doneVar || pendingVar || thankYouVariants[0])?.id || ""
      ) || null;
  }

  // Flat list never includes thank-you pair — UI uses thank_you_group (pick-one).
  const listRows = otherRows;

  const stages = listRows.map((r) => ({
    ...toApiRecord(r.stage as Record<string, unknown>),
    def_slug: r.defSlug,
  }));

  // Progress: thank-you pair counts as 1 step.
  const otherClosed = otherRows.filter((r) =>
    isClosedStatus(r.stage.status)
  ).length;
  const thankYouClosed =
    thankYouRows.length > 0 &&
    thankYouRows.some((r) => isClosedStatus(r.stage.status))
      ? 1
      : 0;
  const thankYouTotal = thankYouRows.length > 0 ? 1 : 0;
  const doneCount = otherClosed + thankYouClosed;
  const totalCount = otherRows.length + thankYouTotal;

  const pendingOther = otherRows.find((r) => r.stage.status === "pending");
  const thankYouPending =
    thankYouRows.length > 0 &&
    !thankYouRows.some((r) => isClosedStatus(r.stage.status));
  let current: Record<string, unknown> | null = null;
  let currentTitle: string | null = null;
  if (pendingOther) {
    current = toApiRecord(pendingOther.stage as Record<string, unknown>);
    currentTitle = pendingOther.stage.title;
  } else if (thankYouPending) {
    const sel =
      thankYouRows.find((r) => r.stage.id === thankYouSelectedId) ||
      thankYouRows[0];
    current = sel
      ? toApiRecord(sel.stage as Record<string, unknown>)
      : null;
    currentTitle = "Send Thank You Email";
  } else if (totalCount > 0) {
    currentTitle = "Complete";
  }

  return {
    stages,
    thank_you_group:
      thankYouVariants.length > 0
        ? {
            title: "Send Thank You Email",
            variants: thankYouVariants,
            selected_id: thankYouSelectedId,
          }
        : null,
    current,
    current_title: currentTitle,
    done_count: doneCount,
    total_count: totalCount,
    ops_stage: event.stage ?? null,
    simple_track: cooking,
  };
}

export interface PatchClientCommStagePayload {
  assigned_user?: string | null;
  assignedUser?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  status?: "pending" | "done" | "skipped" | null;
  complete?: boolean;
}

async function skipThankYouSiblings(
  eventId: string,
  keepStageId: string,
  user?: AuthUser | null
) {
  const db = requireDb();
  const siblings = await db
    .select({
      stage: eventClientCommunicationStages,
      defSlug: clientCommunicationStageDefs.slug,
    })
    .from(eventClientCommunicationStages)
    .innerJoin(
      clientCommunicationStageDefs,
      eq(
        eventClientCommunicationStages.defId,
        clientCommunicationStageDefs.id
      )
    )
    .where(eq(eventClientCommunicationStages.eventId, eventId));

  const now = new Date();
  for (const row of siblings) {
    if (!isThankYouSlug(row.defSlug)) continue;
    if (row.stage.id === keepStageId) continue;
    if (row.stage.status === "skipped") continue;
    await db
      .update(eventClientCommunicationStages)
      .set({
        status: "skipped",
        completedAt: now,
        completedBy: user?.id ?? row.stage.completedBy,
        updatedDate: now,
      })
      .where(eq(eventClientCommunicationStages.id, row.stage.id));
  }
}

export async function patchEventClientCommStage(
  eventId: string,
  stageId: string,
  payload: PatchClientCommStagePayload,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [existingRow] = await db
    .select({
      stage: eventClientCommunicationStages,
      defSlug: clientCommunicationStageDefs.slug,
    })
    .from(eventClientCommunicationStages)
    .innerJoin(
      clientCommunicationStageDefs,
      eq(
        eventClientCommunicationStages.defId,
        clientCommunicationStageDefs.id
      )
    )
    .where(eq(eventClientCommunicationStages.id, stageId))
    .limit(1);
  const existing = existingRow?.stage;
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
    payload.complete === true || payload.status === "done";
  const markPending =
    payload.complete === false || payload.status === "pending";
  const markSkipped = payload.status === "skipped";

  if (markDone) {
    status = "done";
    completedAt = now;
    completedBy = user?.id ?? existing.completedBy;
  } else if (markSkipped) {
    status = "skipped";
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

  // Completing a thank-you variant skips the sibling.
  if (markDone && isThankYouSlug(existingRow?.defSlug)) {
    await skipThankYouSiblings(eventId, stageId, user);
  }

  // Reopening a thank-you: clear sibling skipped → pending so user can switch.
  if (markPending && isThankYouSlug(existingRow?.defSlug)) {
    const siblings = await db
      .select({
        stage: eventClientCommunicationStages,
        defSlug: clientCommunicationStageDefs.slug,
      })
      .from(eventClientCommunicationStages)
      .innerJoin(
        clientCommunicationStageDefs,
        eq(
          eventClientCommunicationStages.defId,
          clientCommunicationStageDefs.id
        )
      )
      .where(eq(eventClientCommunicationStages.eventId, eventId));
    for (const row of siblings) {
      if (!isThankYouSlug(row.defSlug)) continue;
      if (row.stage.id === stageId) continue;
      if (row.stage.status !== "skipped") continue;
      await db
        .update(eventClientCommunicationStages)
        .set({
          status: "pending",
          completedAt: null,
          completedBy: null,
          updatedDate: now,
        })
        .where(eq(eventClientCommunicationStages.id, row.stage.id));
    }
  }

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

export interface ClientCommDraftOverrides {
  to?: string | null;
  subject?: string | null;
  body?: string | null;
}

/**
 * Fill stage template from event data and create a Gmail draft to the POC.
 * Optional overrides replace filled to/subject/body (Leads-style edit-before-draft).
 */
export async function createClientCommStageDraft(
  eventId: string,
  stageId: string,
  user?: AuthUser | null,
  overrides?: ClientCommDraftOverrides | null
) {
  const filled = await previewClientCommStage(eventId, stageId);

  const to =
    overrides?.to != null && String(overrides.to).trim()
      ? String(overrides.to).trim()
      : filled.to;
  const subject =
    overrides?.subject != null
      ? String(overrides.subject)
      : filled.subject;
  const body =
    overrides?.body != null ? String(overrides.body) : filled.body;

  if (!to) {
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
    to,
    subject,
    body,
    leadId: event?.leadId || undefined,
    userId: user?.id,
    userName: user?.full_name,
  });

  return {
    ...draft,
    to,
    subject,
    body,
    stage_id: stageId,
    stage_title: filled.stage_title,
  };
}
