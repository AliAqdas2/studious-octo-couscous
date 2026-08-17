import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import { parseEasternIsoDate } from "../dates/easternTime.js";
import { createGmailDraft } from "./drafts.js";
import {
  decodeBase64Url,
  getGmailApi,
} from "./gmailClient.js";
import { parseSenderEmail } from "./inboundFilters.js";
import { sendGmailEmail } from "./send.js";

const LOG = "[meeting-confirmation]";
const MEETING_CONFIRM_DRAFT_ACTION = "Meeting Confirmation Draft Created";

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

function formatMeetingForPrompt(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "(none on file)";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function parseIsoDate(value: string | null | undefined): Date | null {
  return parseEasternIsoDate(value);
}

async function draftAlreadyLoggedForMessage(
  db: ReturnType<typeof requireDb>,
  leadId: string,
  messageId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.entityId, leadId),
        eq(activityLogs.entityType, "Lead"),
        eq(activityLogs.action, MEETING_CONFIRM_DRAFT_ACTION),
        sql`${activityLogs.details}->>'message_id' = ${messageId}`
      )
    )
    .limit(1);
  return Boolean(row);
}

export interface MeetingConfirmationResult {
  handled: boolean;
  leadId?: string;
  classification?: string;
}

/**
 * If the sender matches a lead awaiting meeting confirmation, classify the
 * reply, update the lead, and create a Gmail draft + digest notify (never auto-send).
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
  const crmMeetingContext = [
    lead.proposedMeetingDate
      ? `Proposed meeting on file (CRM): ${formatMeetingForPrompt(lead.proposedMeetingDate)}`
      : null,
    lead.meetingDate
      ? `Confirmed meeting on file (CRM): ${formatMeetingForPrompt(lead.meetingDate)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await ai.structuredComplete<MeetingClassification>({
    system:
      "You analyze email exchanges about scheduling meetings. Return structured JSON only via the tool.",
    user: `Today's date is: ${new Date().toISOString().slice(0, 10)}

${crmMeetingContext ? `${crmMeetingContext}\n` : ""}
The REP sent this email proposing a meeting time:
"""
${repProposalText || "(previous email not available)"}
"""

The LEAD replied with:
"""
${replyText}
"""

Step 1 — Extract the meeting date/time the REP proposed in their email (look for a specific date and time). Format as ISO 8601 (YYYY-MM-DDTHH:mm:ss) in Eastern wall time unless the email explicitly states Central Time (then convert CT → ET). If the rep didn't propose a specific time, leave proposed_meeting_iso empty. The ISO date MUST fall on the weekday named in the rep's email (e.g. Wednesday must not map to a Thursday calendar date).

Step 2 — Classify the LEAD's reply as ONE of:
- "confirmed" — they accepted the proposed time (e.g. "yes", "sure", "yeah", "sounds good", "that works", "confirmed")
- "proposed_alternative" — they suggested a different specific time/date
- "declined" — they're no longer interested or can't meet (e.g. "no thanks", "not interested", "we went with someone else")
- "unclear" — can't tell, or off-topic, or needs more info

Step 3 — Determine the final meeting datetime in ISO 8601 (Eastern wall time):
- If lead "confirmed" → use the rep's proposed time (proposed_meeting_iso), or CRM proposed meeting on file if rep email is ambiguous
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
        ? parseEasternIsoDate(
            lead.proposedMeetingDate instanceof Date
              ? lead.proposedMeetingDate.toISOString()
              : String(lead.proposedMeetingDate)
          )
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

  const meetingDateResolved =
    update.meetingDate ||
    parseIsoDate(newMeetingIso) ||
    parseIsoDate(proposedMeetingIso) ||
    (lead.proposedMeetingDate
      ? parseEasternIsoDate(
          lead.proposedMeetingDate instanceof Date
            ? lead.proposedMeetingDate.toISOString()
            : String(lead.proposedMeetingDate)
        )
      : null);

  if (
    meetingDateResolved &&
    (classification === "confirmed" ||
      classification === "proposed_alternative")
  ) {
    const leadEmail = lead.email || input.senderEmail;
    const meetingTimeStr = formatMeetingForPrompt(meetingDateResolved);

    if (
      !(await draftAlreadyLoggedForMessage(db, lead.id, input.messageId))
    ) {
      try {
        const firstName = (lead.name || "there").split(" ")[0]!;
        const draftSubject = "Calendar invite - Mangia DC planning call";
        const draftBody = `Hi ${firstName},\n\nThanks for confirming! Our planning call is scheduled for:\n\n${meetingTimeStr}\n\nWe will send a calendar invite shortly. If you need to reschedule, just reply to this email.\n\nLooking forward to chatting.\n\n— The Mangia DC Team`;

        const draft = await createGmailDraft({
          to: leadEmail,
          subject: draftSubject,
          body: draftBody,
          leadId: lead.id,
          userName: "System (Meeting Confirmation)",
        });

        const draftId =
          draft && typeof draft === "object" && "draftId" in draft
            ? String((draft as { draftId?: string }).draftId || "")
            : "";

        await db.insert(activityLogs).values({
          entityType: "Lead",
          entityId: lead.id,
          action: MEETING_CONFIRM_DRAFT_ACTION,
          details: {
            draft_id: draftId,
            message_id: input.messageId,
            classification,
            meeting_iso: meetingDateResolved.toISOString(),
            meeting_time_et: meetingTimeStr,
            to: leadEmail,
            subject: draftSubject,
          },
          userName: "System (Meeting Confirmation)",
          timestamp: now,
        });

        const digestTo = env.digestRecipients()[0];
        if (digestTo) {
          await sendGmailEmail({
            to: digestTo,
            subject: `Draft ready for review - calendar invite for ${lead.name || leadEmail}`,
            body: [
              "A meeting confirmation email has been added to Drafts in Gmail and is awaiting review.",
              "",
              `Classification: ${classification}`,
              `Meeting: ${meetingTimeStr}`,
              "",
              `Lead: ${lead.name || "(no name)"}${lead.company ? ` (${lead.company})` : ""}`,
              `Email: ${leadEmail}`,
              "",
              "Open Gmail → Drafts to review, attach a Google Calendar invite if needed, and send.",
            ].join("\n"),
            leadId: lead.id,
            userName: "System (Meeting Confirmation)",
            systemAlert: true,
          });
        } else {
          console.warn(`${LOG} No DIGEST_RECIPIENTS configured — skip notify`);
        }

        console.log(
          `${LOG} Confirmation draft created lead=${lead.id} draftId=${draftId}`
        );
      } catch (err) {
        console.error(
          `${LOG} Confirmation draft/notify failed:`,
          err instanceof Error ? err.message : err
        );
      }
    } else {
      console.log(
        `${LOG} Draft already logged for message ${input.messageId} — skip`
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
