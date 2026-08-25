import { and, eq, ilike, ne, or } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  events,
  leads,
  tasks,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { toApiRecord } from "../entities/serialize.js";
import { canViewDepositAmount, redactDepositFields } from "./depositAccess.js";
import { getEventOpsFeatures } from "./eventOpsSettings.js";
import type {
  Email2Answers,
  PostEventPayload,
  PostEventState,
  ThankYouVariant,
} from "./postEventTypes.js";
import { experienceDisplayName } from "./experienceName.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function buildState(event: typeof events.$inferSelect): PostEventState {
  const pe = asRecord(event.postEvent);
  const email2 = asRecord(pe.email2) as Email2Answers;
  return {
    staffHoursNotes: event.staffHoursNotes,
    additionalEventDetails: event.additionalEventDetails,
    laborCost: event.laborCost,
    venueFees: event.venueFees,
    suppliesCost: event.suppliesCost,
    photosUploaded: Boolean(event.photosUploaded),
    photoDownloadUrl:
      typeof pe.photoDownloadUrl === "string" ? pe.photoDownloadUrl : null,
    thankYouVariant: (pe.thankYouVariant as ThankYouVariant) || null,
    thankYouSent: Boolean(pe.thankYouSent),
    eventTrackerNote:
      typeof pe.eventTrackerNote === "string" ? pe.eventTrackerNote : null,
    linkedInRequested: Boolean(pe.linkedInRequested),
    tshirtSize: typeof pe.tshirtSize === "string" ? pe.tshirtSize : null,
    tshirtRequested: Boolean(pe.tshirtRequested),
    receiptTiming:
      pe.receiptTiming === "eom_with_invoice" ||
      pe.receiptTiming === "immediate_after_event"
        ? pe.receiptTiming
        : null,
    invoiceTimingNote:
      typeof pe.invoiceTimingNote === "string" ? pe.invoiceTimingNote : null,
    email2: {
      nextEventPlanned:
        typeof email2.nextEventPlanned === "string"
          ? email2.nextEventPlanned
          : null,
      introThreeIndividuals:
        typeof email2.introThreeIndividuals === "string"
          ? email2.introThreeIndividuals
          : null,
      newsletterInterest:
        typeof email2.newsletterInterest === "boolean"
          ? email2.newsletterInterest
          : null,
      buildAnotherLead:
        typeof email2.buildAnotherLead === "boolean"
          ? email2.buildAnotherLead
          : null,
      newLeadId:
        typeof email2.newLeadId === "string" ? email2.newLeadId : null,
    },
    satisfactionRating: event.satisfactionRating,
    experienceName: experienceDisplayName(event.eventType),
  };
}

async function ensureTaskByTrace(
  eventId: string,
  traceId: string,
  title: string,
  daysAfter: number,
  eventDate: Date,
  role: "Sales" | "Admin" | "Ops" | "Event Host" = "Sales"
) {
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), eq(tasks.traceId, traceId)))
    .limit(1);
  if (existing) return existing;

  const due = new Date(eventDate);
  due.setDate(due.getDate() + daysAfter);
  const [row] = await db
    .insert(tasks)
    .values({
      eventId,
      title,
      category: "Post-Event",
      responsibleRole: role,
      dueDate: due,
      status: "Not Acknowledged",
      workflowPhase: "post",
      traceId,
    })
    .returning();
  return row;
}

async function markTraceDone(eventId: string, traceIds: string[], note: string) {
  const db = requireDb();
  const now = new Date();
  for (const traceId of traceIds) {
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.eventId, eventId),
          eq(tasks.traceId, traceId),
          ne(tasks.status, "Done")
        )
      );
    for (const t of rows) {
      await db
        .update(tasks)
        .set({
          status: "Done",
          completionTimestamp: now,
          progressNotes: [t.progressNotes, note].filter(Boolean).join("\n"),
          updatedDate: now,
        })
        .where(eq(tasks.id, t.id));
    }
  }
}

export async function getPostEventState(
  eventId: string,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const { features } = await getEventOpsFeatures();

  return {
    state: buildState(event),
    features,
    event: redactDepositFields(
      toApiRecord(event as Record<string, unknown>),
      user
    ),
    canViewDepositAmount: canViewDepositAmount(user),
  };
}

export async function savePostEvent(
  eventId: string,
  payload: PostEventPayload,
  user?: AuthUser | null,
  options?: { createLead?: boolean }
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const { features } = await getEventOpsFeatures();
  const prev = asRecord(event.postEvent);
  const prevEmail2 = asRecord(prev.email2) as Email2Answers;
  const nextEmail2: Email2Answers = {
    ...prevEmail2,
    ...(payload.email2 || {}),
  };

  let newLeadId = nextEmail2.newLeadId ?? null;
  if (
    options?.createLead &&
    nextEmail2.buildAnotherLead === true &&
    !newLeadId
  ) {
    const [lead] = await db
      .insert(leads)
      .values({
        name: event.pocName || "Referral from event",
        email:
          event.pocEmail ||
          `referral+${event.id.slice(0, 8)}@mangiadc.placeholder`,
        phone: event.pocPhone || null,
        company: event.venue || null,
        eventTypeInterest: event.eventType,
        source: "Referral",
        notes: [
          `Created from EMAIL 2 / post-event on ${event.eventName}`,
          nextEmail2.introThreeIndividuals
            ? `Intros note: ${nextEmail2.introThreeIndividuals}`
            : null,
          nextEmail2.nextEventPlanned
            ? `Next event: ${nextEmail2.nextEventPlanned}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        stage: "New Inquiry",
        clientId: event.clientId || null,
      })
      .returning();
    newLeadId = lead?.id ?? null;
    nextEmail2.newLeadId = newLeadId;
    await markTraceDone(
      eventId,
      ["C118"],
      "New lead created from post-event EMAIL 2"
    );
  }

  const nextPostEvent = {
    ...prev,
    photoDownloadUrl:
      payload.photoDownloadUrl !== undefined
        ? payload.photoDownloadUrl
        : prev.photoDownloadUrl ?? null,
    thankYouVariant:
      payload.thankYouVariant !== undefined
        ? payload.thankYouVariant
        : prev.thankYouVariant ?? null,
    thankYouSent:
      payload.thankYouSent !== undefined
        ? payload.thankYouSent
        : Boolean(prev.thankYouSent),
    eventTrackerNote:
      payload.eventTrackerNote !== undefined
        ? payload.eventTrackerNote
        : prev.eventTrackerNote ?? null,
    linkedInRequested:
      payload.linkedInRequested !== undefined
        ? payload.linkedInRequested
        : Boolean(prev.linkedInRequested),
    tshirtSize:
      payload.tshirtSize !== undefined
        ? payload.tshirtSize
        : prev.tshirtSize ?? null,
    tshirtRequested:
      payload.tshirtRequested !== undefined
        ? payload.tshirtRequested
        : Boolean(prev.tshirtRequested),
    receiptTiming:
      payload.receiptTiming !== undefined
        ? payload.receiptTiming
        : prev.receiptTiming ?? null,
    invoiceTimingNote:
      payload.invoiceTimingNote !== undefined
        ? payload.invoiceTimingNote
        : prev.invoiceTimingNote ?? null,
    email2: nextEmail2,
  };

  const now = new Date();
  const [updated] = await db
    .update(events)
    .set({
      postEvent: nextPostEvent,
      staffHoursNotes:
        payload.staffHoursNotes !== undefined
          ? payload.staffHoursNotes
          : event.staffHoursNotes,
      additionalEventDetails:
        payload.additionalEventDetails !== undefined
          ? payload.additionalEventDetails
          : event.additionalEventDetails,
      laborCost:
        payload.laborCost !== undefined ? payload.laborCost : event.laborCost,
      venueFees:
        payload.venueFees !== undefined ? payload.venueFees : event.venueFees,
      suppliesCost:
        payload.suppliesCost !== undefined
          ? payload.suppliesCost
          : event.suppliesCost,
      photosUploaded:
        payload.photosUploaded !== undefined
          ? payload.photosUploaded
          : event.photosUploaded,
      linkedinConnectionSent:
        payload.linkedInRequested === true
          ? true
          : event.linkedinConnectionSent,
      satisfactionRating:
        payload.satisfactionRating !== undefined
          ? (payload.satisfactionRating as typeof event.satisfactionRating)
          : event.satisfactionRating,
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  if (payload.staffHoursNotes != null) {
    await markTraceDone(eventId, ["C107"], "Staff hours captured");
  }
  if (payload.additionalEventDetails != null) {
    await markTraceDone(eventId, ["C108"], "Additional details captured");
  }
  if (
    payload.laborCost != null ||
    payload.venueFees != null ||
    payload.suppliesCost != null
  ) {
    await markTraceDone(eventId, ["C114"], "Event report costs updated");
  }
  if (payload.receiptTiming) {
    await markTraceDone(
      eventId,
      ["C113"],
      `Receipt timing: ${payload.receiptTiming}`
    );
  }
  if (payload.thankYouVariant === "v1" || payload.thankYouVariant === "v2") {
    await markTraceDone(
      eventId,
      ["C110"],
      `Thank-you variant ${payload.thankYouVariant} recorded`
    );
  }
  if (nextEmail2.nextEventPlanned) {
    await markTraceDone(eventId, ["C115"], "EMAIL 2 — next event answered");
  }
  if (nextEmail2.introThreeIndividuals) {
    await markTraceDone(eventId, ["C116"], "EMAIL 2 — intros answered");
  }
  if (nextEmail2.newsletterInterest != null) {
    await markTraceDone(eventId, ["C117"], "EMAIL 2 — newsletter answered");
  }

  const thankYouVariant =
    (nextPostEvent.thankYouVariant as ThankYouVariant) || null;
  if (thankYouVariant === "v2") {
    const eventDate = event.eventDate ? new Date(event.eventDate) : new Date();
    if (features.linkedInFollowUp) {
      await ensureTaskByTrace(
        eventId,
        "C111",
        "V2 yes — event tracker + LinkedIn connect",
        2,
        eventDate,
        "Sales"
      );
    }
    if (features.tshirtThreeMonth) {
      await ensureTaskByTrace(
        eventId,
        "C112",
        "+3 months — T-shirt size → CEO thank-you + Mangia T-shirt",
        90,
        eventDate,
        "Sales"
      );
    }
    if (payload.eventTrackerNote || payload.linkedInRequested) {
      await markTraceDone(
        eventId,
        ["C111"],
        "V2 tracker / LinkedIn progress saved"
      );
    }
    if (payload.tshirtSize || payload.tshirtRequested) {
      await markTraceDone(eventId, ["C112"], "T-shirt follow-up updated");
    }
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Post-Event Capture Saved",
    details: {
      thank_you_variant: thankYouVariant,
      create_lead: Boolean(newLeadId && options?.createLead),
      new_lead_id: newLeadId,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  return {
    success: true,
    state: buildState(updated || event),
    newLeadId,
    event: redactDepositFields(
      toApiRecord((updated || event) as Record<string, unknown>),
      user
    ),
  };
}

export { experienceDisplayName } from "./experienceName.js";
