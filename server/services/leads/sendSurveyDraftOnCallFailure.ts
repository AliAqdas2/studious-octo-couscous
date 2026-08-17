import { and, eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { findFreeMeetingWindows } from "../calendar/findNextFreeSlot.js";
import { createGmailDraft } from "../gmail/drafts.js";
import { sendGmailEmail } from "../gmail/send.js";
import { buildSurveyDraftContext } from "./buildSurveyDraftContext.js";
import {
  buildSurveyDraftHtml,
  buildSurveyDraftSubject,
} from "./surveyDraftTemplate.js";

const LOG = "[survey-draft-fallback]";
const FALLBACK_ACTION = "Meeting Proposal Draft Created (No-Answer Fallback)";
const CALENDAR_BLOCKED_ACTION =
  "Survey Draft Skipped (Calendar Unavailable)";
const SURVEY_STAGE = "Survey Sent";

const REASON_TEXT: Record<string, string> = {
  rep_no_response: "the rep didn't respond to the briefing prompt",
  rep_declined: "the rep declined the briefing prompt",
  rep_unreachable: "the rep's phone couldn't be reached (no-answer / busy / failed)",
  rep_line_dropped: "the rep line dropped before the lead was dialed",
  lead_no_answer: "the lead didn't pick up the call",
  voicemail: "the call reached voicemail / no two-way conversation",
};

export function humanizeCallFailureReason(reason: string): string {
  return REASON_TEXT[reason] || reason || "the automated call could not be completed";
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export interface SendSurveyDraftResult {
  ok: boolean;
  skipped?: string;
  draftId?: string;
}

async function sendDigestAlert(
  lead: typeof leads.$inferSelect,
  reasonText: string,
  bodyLines: string[]
): Promise<void> {
  const digestTo = env.digestRecipients()[0];
  if (!digestTo) {
    console.warn(`${LOG} No DIGEST_RECIPIENTS configured — skip notify`);
    return;
  }
  try {
    await sendGmailEmail({
      to: digestTo,
      subject: `Survey follow-up — ${lead.name || lead.email}`,
      body: bodyLines.join("\n"),
      leadId: lead.id,
      userName: "System (Call Fallback)",
      systemAlert: true,
    });
  } catch (notifyErr) {
    console.error(
      `${LOG} Digest notify failed:`,
      notifyErr instanceof Error ? notifyErr.message : notifyErr
    );
  }
}

/**
 * When auto-call cannot run, build a programmatic survey draft with pre-filled
 * answers and Google Calendar availability windows. Skips client draft if
 * calendar is unavailable or has no free business-hour slots.
 */
export async function sendSurveyDraftOnCallFailure(
  leadId: string,
  reason: string
): Promise<SendSurveyDraftResult> {
  const db = requireDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return { ok: false, skipped: "lead_not_found" };
  }
  if (!lead.email) {
    return { ok: false, skipped: "no_email" };
  }
  if (lead.surveySent) {
    console.log(`${LOG} Lead ${leadId} already surveySent — skip`);
    return { ok: true, skipped: "already_survey_sent" };
  }

  const [prior] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.entityId, leadId),
        eq(activityLogs.action, FALLBACK_ACTION)
      )
    )
    .limit(1);
  if (prior) {
    console.log(`${LOG} Lead ${leadId} already has fallback draft activity — skip`);
    return { ok: true, skipped: "already_drafted" };
  }

  const reasonText = humanizeCallFailureReason(reason);
  const { prefill } = await buildSurveyDraftContext(lead);
  const availability = await findFreeMeetingWindows();

  if (!availability.calendarOk || !availability.prose) {
    const calendarReason = !availability.calendarOk
      ? "Google Calendar could not be queried."
      : "No free meeting slots were found during business hours (Mon–Fri 9 AM–5 PM ET) in the next 3 business days.";

    console.warn(`${LOG} ${calendarReason} — skip client draft for lead ${leadId}`);

    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: lead.id,
      action: CALENDAR_BLOCKED_ACTION,
      details: {
        reason,
        reason_text: reasonText,
        calendar_ok: availability.calendarOk,
        calendar_reason: calendarReason,
        to: lead.email,
        prefill,
      },
      userName: "System (Call Fallback)",
      timestamp: new Date(),
    });

    await sendDigestAlert(lead, reasonText, [
      "Survey follow-up draft was NOT created for the lead below.",
      "",
      `Reason: ${reasonText}`,
      "",
      calendarReason,
      "Please create the survey email manually in Gmail and add meeting times from the calendar.",
      "",
      `Lead: ${lead.name || "(no name)"}${lead.company ? ` (${lead.company})` : ""}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "(none)"}`,
    ]);

    return { ok: true, skipped: "calendar_unavailable" };
  }

  const subject = buildSurveyDraftSubject(lead);
  const bodyHtml = buildSurveyDraftHtml(lead, prefill, availability.prose);

  const draft = await createGmailDraft({
    to: lead.email,
    subject,
    body: bodyHtml,
    html: true,
    leadId: lead.id,
    userName: "System (Call Fallback)",
  });

  const draftId =
    draft && typeof draft === "object" && "draftId" in draft
      ? String((draft as { draftId?: string }).draftId || "")
      : "";

  const now = new Date();
  await db
    .update(leads)
    .set({
      stage: SURVEY_STAGE,
      surveySent: true,
      surveySentDate: now,
      lastContactDate: now,
      awaitingMeetingConfirmation: true,
      ...(availability.firstSlotUtc
        ? { proposedMeetingDate: availability.firstSlotUtc }
        : {}),
      updatedDate: now,
    })
    .where(eq(leads.id, lead.id));

  await db.insert(activityLogs).values({
    entityType: "Lead",
    entityId: lead.id,
    action: FALLBACK_ACTION,
    details: {
      draft_id: draftId,
      reason,
      reason_text: reasonText,
      template_name: "B2B Survey (programmatic)",
      to: lead.email,
      subject,
      availability_prose: availability.prose,
      meeting_windows: availability.windows.map((w) => ({
        day: w.dayLabel,
        start_utc: w.startUtc.toISOString(),
        end_utc: w.endUtc.toISOString(),
      })),
      proposed_meeting_time_utc: availability.firstSlotUtc
        ? availability.firstSlotUtc.toISOString()
        : null,
      prefill,
    },
    userName: "System (Call Fallback)",
    timestamp: now,
  });

  await sendDigestAlert(lead, reasonText, [
    "A survey follow-up email has been added to Drafts in Gmail and is awaiting review.",
    "",
    `Reason: ${reasonText}`,
    "",
    `Lead: ${lead.name || "(no name)"}${lead.company ? ` (${lead.company})` : ""}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone || "(none)"}`,
    "",
    `Proposed meeting windows (from Google Calendar): ${availability.prose}`,
    "",
    "Open Gmail → Drafts to review and send.",
  ]);

  console.log(
    `${LOG} Draft created for lead ${lead.id} draftId=${draftId} availability="${availability.prose}"`
  );
  return { ok: true, draftId };
}
