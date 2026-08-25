import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  events,
  leads,
  tasks,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { linkEventToClient } from "../events/linkEventToClient.js";
import { assignEventStaff } from "../events/assignEventStaff.js";
import { resolveVenueModeForName } from "../events/venuesService.js";
import { syncLeadEventVenue } from "../events/syncLeadEventVenue.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const EVENT_TYPE_MAPPING: Record<string, string> = {
  "In-Person Cooking": "In-Person Cooking",
  "Cooking Class": "In-Person Cooking",
  Cooking: "In-Person Cooking",
  "In-Person Mixology": "In-Person Mixology",
  Mixology: "In-Person Mixology",
  "Private Monuments": "In-Person Private Monuments",
  Monuments: "In-Person Private Monuments",
  "Paint & Sip": "In-Person Paint & Sip",
  "Paint and Sip": "In-Person Paint & Sip",
  "Food Tour": "In-Person Private Food Tour",
  "Yoga & UnWined": "In-Person Yoga & UnWined",
  "Virtual Mixology": "Virtual Mixology",
  "Virtual Paint & Sip": "Virtual Paint & Sip",
};

const DEFAULT_CHECKLIST = [
  { title: "Did we update in Sales Alert of Slack?", order: 1 },
  { title: "Is it documented in Fareharbor?", order: 2 },
  { title: "Workflow document", order: 3 },
  { title: "Participation List - Link", order: 4 },
  { title: "Add Ons: Logo'd aprons, glassware and Cheese board", order: 5 },
  { title: "Did we send it to supplier?", order: 6 },
  {
    title:
      "Interest in consumption on-site Y or N (Includes: drink tickets)",
    order: 7,
  },
  {
    title: "If Yes, How many drink tickets / beverages per person?",
    order: 8,
  },
  { title: "BEO?", order: 9 },
  { title: "Final HC", order: 10 },
  { title: "Did we send an event flow reminder email?", order: 11 },
  { title: "Remaining Balance Invoice Number", order: 12 },
  { title: "Remaining Balance and Headcount DUE", order: 13 },
  { title: "CC form", order: 14 },
  {
    title:
      "Did we schedule an Internal BEO discussion with the instructor and Event Team Lead?",
    order: 15,
  },
  {
    title:
      "Has Operation Support confirmed when they are planning on meeting the location and time they are meeting (This can be done preferably by SMS or Email)",
    order: 16,
  },
];

export interface CreateEventFromWonLeadInput {
  leadId: string;
  venue?: string;
  depositNumber?: string | null;
  depositAmount?: number | null;
}

async function releaseEventLock(leadId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(leads)
    .set({ eventCreated: false, updatedDate: new Date() })
    .where(eq(leads.id, leadId));
}

export async function createEventFromWonLead(
  input: CreateEventFromWonLeadInput
) {
  const { leadId, venue = "" } = input;
  if (!leadId) {
    throw new AppError("No leadId found", 400);
  }

  const db = requireDb();
  let leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  let lead = leadRows[0];

  if (!lead) {
    throw new AppError("Lead not found", 404);
  }

  if (lead.stage !== "Won" && lead.stage !== "Confirmed Sales") {
    return {
      success: true,
      skipped: true,
      reason: "Lead not in Confirmed Sales stage",
    };
  }

  // Duplicate only when an event id is already linked — bare eventCreated is a stale lock
  const existingEventId = lead.convertedToEventId || lead.linkedEventId;
  if (existingEventId) {
    return {
      success: true,
      skipped: true,
      reason: "Event already exists",
      eventId: existingEventId,
    };
  }

  if (lead.eventCreated) {
    await releaseEventLock(leadId);
  }

  const depositUpdates: {
    depositNumber?: string;
    depositAmount?: number | null;
    venue?: string;
    venueMode?: "go_to_them" | "house_venue" | null;
    updatedDate: Date;
  } = { updatedDate: new Date() };
  if (input.depositNumber != null && String(input.depositNumber).trim() !== "") {
    depositUpdates.depositNumber = String(input.depositNumber).trim();
  }
  if (input.depositAmount !== undefined && input.depositAmount !== null) {
    const n = Number(input.depositAmount);
    if (!Number.isNaN(n)) {
      depositUpdates.depositAmount = n;
    }
  }
  // Prefer explicit venue arg; else light scrape from notes; else existing lead.venue
  let resolvedVenue = (venue || "").trim();
  if (!resolvedVenue && lead.venue) {
    resolvedVenue = String(lead.venue).trim();
  }
  if (!resolvedVenue && lead.notes) {
    const m = lead.notes.match(/venue[:\s]+([^\n]+)/i);
    if (m?.[1]) resolvedVenue = m[1].trim().slice(0, 255);
  }
  const venueMode = resolvedVenue
    ? await resolveVenueModeForName(resolvedVenue)
    : null;
  if (resolvedVenue) {
    depositUpdates.venue = resolvedVenue;
    depositUpdates.venueMode = venueMode;
  }
  if (
    depositUpdates.depositNumber !== undefined ||
    depositUpdates.depositAmount !== undefined ||
    depositUpdates.venue !== undefined
  ) {
    await db.update(leads).set(depositUpdates).where(eq(leads.id, leadId));
    leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    lead = leadRows[0] || lead;
  }

  if (!lead.email) {
    throw new AppError("Lead missing email", 400);
  }

  // Pre-lock to reduce duplicate creates under concurrency
  await db
    .update(leads)
    .set({ eventCreated: true, updatedDate: new Date() })
    .where(eq(leads.id, leadId));

  const refreshed = (
    await db.select().from(leads).where(eq(leads.id, leadId)).limit(1)
  )[0];
  if (refreshed?.convertedToEventId || refreshed?.linkedEventId) {
    return {
      success: true,
      skipped: true,
      reason: "Event already created by another process",
      eventId: refreshed.convertedToEventId || refreshed.linkedEventId,
    };
  }

  const interestKey = (lead.eventTypeInterest || "").split(", ")[0] || "";
  const eventType =
    (EVENT_TYPE_MAPPING[interestKey] as
      | "In-Person Cooking"
      | "In-Person Mixology"
      | "In-Person Private Monuments"
      | "In-Person Paint & Sip"
      | "In-Person Private Food Tour"
      | "In-Person Yoga & UnWined"
      | "Virtual Mixology"
      | "Virtual Paint & Sip"
      | undefined) || "In-Person Mixology";

  const company = (lead.company || "").trim();
  const eventName = company
    ? `${company} — ${lead.name || lead.email}`
    : lead.name || `Event for ${lead.email}`;

  const eventDate = lead.preferredDate
    ? new Date(lead.preferredDate)
    : new Date();

  let startTime: string | null = null;
  if (lead.preferredDate) {
    const d = new Date(lead.preferredDate);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      if (hh !== "00" || mm !== "00") {
        startTime = `${hh}:${mm}`;
      }
    }
  }

  const headcountEstimate = lead.headcountEstimate
    ? Math.round(lead.headcountEstimate)
    : null;

  const finalVenue =
    (lead.venue || resolvedVenue || "").trim() || null;
  const finalVenueMode =
    lead.venueMode ||
    (finalVenue ? await resolveVenueModeForName(finalVenue) : null);

  let newEvent: typeof events.$inferSelect;
  try {
    const [created] = await db
      .insert(events)
      .values({
        eventName,
        eventDate,
        startTime,
        eventType,
        leadId,
        sourceLeadId: leadId,
        pocName: lead.name,
        pocTitle: lead.title || null,
        pocEmail: lead.email,
        pocPhone: lead.phone || "",
        headcount: headcountEstimate,
        headcountMin: headcountEstimate,
        headcountMax: headcountEstimate,
        clientId: lead.clientId || null,
        venue: finalVenue,
        venueMode: finalVenueMode,
        depositReceived: true,
        depositAmount:
          lead.depositAmount != null ? Number(lead.depositAmount) : null,
        depositReceivedAt: new Date(),
        stage: "Deposit Received",
        specialRequests: lead.notes
          ? `Prefill from lead notes:\n${lead.notes}`.slice(0, 4000)
          : null,
      })
      .returning();
    newEvent = created;

    await db
      .update(leads)
      .set({
        eventCreated: true,
        convertedToEventId: newEvent.id,
        linkedEventId: newEvent.id,
        venue: finalVenue,
        venueMode: finalVenueMode,
        updatedDate: new Date(),
      })
      .where(eq(leads.id, leadId));

    if (finalVenue) {
      try {
        await syncLeadEventVenue({
          leadId,
          eventId: newEvent.id,
          venue: finalVenue,
          venueMode: finalVenueMode,
        });
      } catch (syncErr) {
        console.warn(
          "[createEventFromWonLead] syncLeadEventVenue failed:",
          syncErr instanceof Error ? syncErr.message : syncErr
        );
      }
    }

    for (const item of DEFAULT_CHECKLIST) {
      await db.insert(tasks).values({
        eventId: newEvent.id,
        title: item.title,
        category: "Checklist",
        responsibleRole: "Admin",
        status: "Not Acknowledged",
        order: item.order,
      });
    }

    try {
      const linkResult = await linkEventToClient(newEvent.id);
      if (linkResult.clientId && !newEvent.clientId) {
        newEvent = {
          ...newEvent,
          clientId: linkResult.clientId,
        };
      }
    } catch (linkErr) {
      console.warn(
        "[createEventFromWonLead] linkEventToClient failed:",
        linkErr instanceof Error ? linkErr.message : linkErr
      );
    }

    try {
      await assignEventStaff(newEvent.id);
    } catch (staffErr) {
      console.warn(
        "[createEventFromWonLead] assignEventStaff failed:",
        staffErr instanceof Error ? staffErr.message : staffErr
      );
    }

    // Cooking Family A: defer full workflow until Deposit Intake completes (plan 02).
    // Other types still get checklist only; Generate Workflow remains manual / intake for cooking.
  } catch (err) {
    await releaseEventLock(leadId);
    throw err;
  }

  const now = new Date();
  try {
    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: leadId,
      action: "Event Created",
      details: {
        event_id: newEvent.id,
        event_name: eventName,
        automated: true,
      },
      timestamp: now,
    });
    await db.insert(activityLogs).values({
      entityType: "Event",
      entityId: newEvent.id,
      action: "Created from Won Lead",
      details: {
        lead_id: leadId,
        lead_name: lead.name,
      },
      timestamp: now,
    });
  } catch (logError) {
    console.warn(
      "[createEventFromWonLead] Failed to log activity:",
      logError instanceof Error ? logError.message : logError
    );
  }

  return {
    success: true,
    eventId: newEvent.id,
    eventName,
  };
}
