import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import {
  asciiEmailSubject,
  decodeBase64Url,
  encodeRawMessage,
  getGmailApi,
  getGmailConnection,
} from "./gmailClient.js";
import { parseSenderEmail } from "./inboundFilters.js";

const LOG = "[meeting-confirmation]";
const MEETING_DURATION_MS = 30 * 60 * 1000;

interface MeetingClassification {
  proposed_meeting_iso?: string;
  classification?:
    | "confirmed"
    | "proposed_alternative"
    | "declined"
    | "unclear";
  new_meeting_iso?: string;
  reason?: string;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function buildIcsInvite(params: {
  start: Date;
  summary: string;
  description: string;
  attendeeEmail: string;
  attendeeName: string;
  organizerEmail: string;
}): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const end = new Date(params.start.getTime() + MEETING_DURATION_MS);
  const dtstamp = fmt(new Date());
  const uid = `${randomUUID()}@mangiadc.com`;
  const escape = (s: string) =>
    String(s || "")
      .replace(/[\\,;]/g, (m) => "\\" + m)
      .replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mangia DC//CRM//EN",
    "METHOD:REQUEST",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${fmt(params.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(params.summary)}`,
    `DESCRIPTION:${escape(params.description)}`,
    `ORGANIZER;CN=Mangia DC:mailto:${params.organizerEmail}`,
    `ATTENDEE;CN=${escape(params.attendeeName || params.attendeeEmail)};RSVP=TRUE:mailto:${params.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function sendIcsInvite(params: {
  to: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  icsContent: string;
}): Promise<void> {
  const gmail = await getGmailApi();
  const boundary = `mangia_boundary_${Date.now()}`;
  const icsB64 = Buffer.from(params.icsContent, "utf8").toString("base64");

  const raw = [
    `From: ${params.fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${asciiEmailSubject(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "Auto-Submitted: auto-generated",
    "X-Auto-Response-Suppress: All",
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/calendar; method=REQUEST; name="invite.ics"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="invite.ics"',
    "",
    icsB64,
    `--${boundary}--`,
  ].join("\r\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeRawMessage(raw) },
  });
}

function getPlainBodyFromMessage(message: {
  payload?: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: unknown[] | null;
  } | null;
  snippet?: string | null;
}): string {
  const walk = (part: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: unknown[] | null;
  } | null | undefined): string => {
    if (!part) return "";
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const p of part.parts) {
        const t = walk(
          p as {
            mimeType?: string | null;
            body?: { data?: string | null } | null;
            parts?: unknown[] | null;
          }
        );
        if (t) return t;
      }
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      return decodeBase64Url(part.body.data)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return "";
  };
  const body = walk(message.payload).trim();
  return body || message.snippet || "";
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface MeetingConfirmationResult {
  handled: boolean;
  leadId?: string;
  classification?: string;
}

/**
 * If the sender matches a lead awaiting meeting confirmation, classify the
 * reply, update the lead, and optionally send an ICS invite.
 */
export async function tryHandleMeetingConfirmationReply(input: {
  messageId: string;
  message: {
    id?: string | null;
    threadId?: string | null;
    payload?: unknown;
    snippet?: string | null;
  };
  senderEmail: string;
}): Promise<MeetingConfirmationResult> {
  if (!input.senderEmail) {
    return { handled: false };
  }

  const db = requireDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(
        sql`lower(${leads.email}) = ${input.senderEmail.toLowerCase()}`,
        eq(leads.awaitingMeetingConfirmation, true)
      )
    )
    .orderBy(desc(leads.createdDate))
    .limit(1);

  if (!lead) {
    return { handled: false };
  }

  const replyText = getPlainBodyFromMessage(
    input.message as {
      payload?: {
        mimeType?: string | null;
        body?: { data?: string | null } | null;
        parts?: unknown[] | null;
      } | null;
      snippet?: string | null;
    }
  ).slice(0, 4000);

  if (!replyText) {
    console.log(`${LOG} Empty body for lead ${lead.id}`);
    return { handled: false };
  }

  if (!isAiConfigured()) {
    console.warn(`${LOG} AI not configured — cannot classify reply`);
    return { handled: false };
  }

  let repProposalText = "";
  const threadId = input.message.threadId;
  if (threadId) {
    try {
      const gmail = await getGmailApi();
      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });
      const msgs = threadRes.data.messages || [];
      const replyIdx = msgs.findIndex((m) => m.id === input.messageId);
      const earlier = replyIdx > 0 ? msgs.slice(0, replyIdx) : [];
      for (let i = earlier.length - 1; i >= 0; i--) {
        const m = earlier[i]!;
        const headers = m.payload?.headers || [];
        const from =
          headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
        const sender = parseSenderEmail(from);
        if (sender && sender !== input.senderEmail) {
          repProposalText = getPlainBodyFromMessage(m).slice(0, 4000);
          break;
        }
      }
    } catch (err) {
      console.error(
        `${LOG} Thread fetch failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const ai = getAiProvider();
  const completion = await ai.structuredComplete<MeetingClassification>({
    system:
      "You analyze email exchanges about scheduling meetings. Return structured JSON only via the tool.",
    user: `Today's date is: ${new Date().toISOString().slice(0, 10)}

The REP sent this email proposing a meeting time:
"""
${repProposalText || "(previous email not available)"}
"""

The LEAD replied with:
"""
${replyText}
"""

Step 1 — Extract the meeting date/time the REP proposed in their email (look for a specific date and time). Format as ISO 8601 (YYYY-MM-DDTHH:mm:ss). If the rep didn't propose a specific time, leave proposed_meeting_iso empty.

Step 2 — Classify the LEAD's reply as ONE of:
- "confirmed" — they accepted the proposed time (e.g. "yes", "sure", "yeah", "sounds good", "that works", "confirmed")
- "proposed_alternative" — they suggested a different specific time/date
- "declined" — they're no longer interested or can't meet (e.g. "no thanks", "not interested", "we went with someone else")
- "unclear" — can't tell, or off-topic, or needs more info

Step 3 — Determine the final meeting datetime in ISO 8601:
- If lead "confirmed" → use the rep's proposed time (proposed_meeting_iso)
- If lead "proposed_alternative" → use the lead's new time
- Otherwise → leave new_meeting_iso empty`,
    jsonSchema: {
      type: "object",
      properties: {
        proposed_meeting_iso: { type: "string" },
        classification: {
          type: "string",
          enum: [
            "confirmed",
            "proposed_alternative",
            "declined",
            "unclear",
          ],
        },
        new_meeting_iso: { type: "string" },
        reason: { type: "string" },
      },
      required: ["classification"],
    },
    schemaName: "meeting_confirmation_reply",
    temperature: 0,
    maxTokens: 1024,
  });

  const llm = completion.data;
  const classification = llm?.classification || "unclear";
  const proposedMeetingIso = llm?.proposed_meeting_iso || "";
  const newMeetingIso = llm?.new_meeting_iso || "";
  const reason = llm?.reason || "";

  const now = new Date();
  const update: {
    lastContactDate: Date;
    updatedDate: Date;
    stage?: string;
    meetingDate?: Date | null;
    awaitingMeetingConfirmation?: boolean;
    lostReason?: string;
  } = {
    lastContactDate: now,
    updatedDate: now,
  };
  let action = "";

  if (classification === "confirmed") {
    update.stage = "Program Planning Discussion";
    const meeting =
      parseIsoDate(newMeetingIso) ||
      parseIsoDate(proposedMeetingIso) ||
      (lead.proposedMeetingDate
        ? new Date(lead.proposedMeetingDate)
        : null);
    if (meeting) update.meetingDate = meeting;
    update.awaitingMeetingConfirmation = false;
    action = "Meeting Confirmed by Lead Reply";
  } else if (classification === "proposed_alternative") {
    update.stage = "Program Planning Discussion";
    const alt = parseIsoDate(newMeetingIso);
    if (alt) update.meetingDate = alt;
    update.awaitingMeetingConfirmation = false;
    action = "Meeting Rescheduled by Lead Reply";
  } else if (classification === "declined") {
    update.stage = "Lost/Canceled";
    update.awaitingMeetingConfirmation = false;
    if (!lead.lostReason) {
      update.lostReason = "Lead declined meeting via email reply";
    }
    action = "Meeting Declined by Lead Reply";
  } else {
    action = "Meeting Reply Unclear (Awaiting Human)";
  }

  await db.update(leads).set(update).where(eq(leads.id, lead.id));

  const meetingIso =
    update.meetingDate?.toISOString() ||
    newMeetingIso ||
    proposedMeetingIso ||
    (lead.proposedMeetingDate
      ? new Date(lead.proposedMeetingDate).toISOString()
      : null);

  if (
    meetingIso &&
    (classification === "confirmed" ||
      classification === "proposed_alternative")
  ) {
    try {
      const meetingDate = new Date(meetingIso);
      if (!Number.isNaN(meetingDate.getTime())) {
        const connection = await getGmailConnection();
        const organizerEmail =
          connection?.email ||
          env.gmailSenderEmail() ||
          "info@mangiadc.com";
        const ics = buildIcsInvite({
          start: meetingDate,
          summary: "Mangia DC — Planning Call",
          description:
            "Quick planning call with the Mangia DC team to walk through your event.",
          attendeeEmail: lead.email || input.senderEmail,
          attendeeName: lead.name || lead.email || input.senderEmail,
          organizerEmail,
        });
        await sendIcsInvite({
          to: lead.email || input.senderEmail,
          fromEmail: organizerEmail,
          subject: "Calendar invite - Mangia DC planning call",
          bodyText: `Hi ${(lead.name || "there").split(" ")[0]},\n\nThanks for confirming! Attaching a calendar invite for our call. Looking forward to chatting.\n\n— The Mangia DC Team`,
          icsContent: ics,
        });
        console.log(`${LOG} ICS invite sent to ${lead.email}`);
      }
    } catch (err) {
      console.error(
        `${LOG} ICS invite failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await db.insert(activityLogs).values({
    entityType: "Lead",
    entityId: lead.id,
    action,
    details: {
      classification,
      proposed_meeting_iso: proposedMeetingIso || null,
      new_meeting_iso: newMeetingIso || null,
      reason,
      message_id: input.messageId,
      from: input.senderEmail,
    },
    userName: "Meeting Confirmation Watcher",
    timestamp: now,
  });

  console.log(
    `${LOG} lead=${lead.id} classification=${classification} action=${action}`
  );

  return {
    handled: true,
    leadId: lead.id,
    classification,
  };
}
