import { and, desc, eq, or } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  emailTemplates,
  leads,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { createGmailDraft } from "../gmail/drafts.js";
import { sendGmailEmail } from "../gmail/send.js";

const LOG = "[survey-draft-fallback]";
const FALLBACK_ACTION = "Meeting Proposal Draft Created (No-Answer Fallback)";
const SURVEY_STAGE = "Survey Sent";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function replaceVariables(
  text: string,
  lead: typeof leads.$inferSelect
): string {
  if (!text) return "";
  const preferred = lead.preferredDate
    ? new Date(lead.preferredDate).toLocaleDateString()
    : "";
  return text
    .replace(/\{\{name\}\}/gi, lead.name || "")
    .replace(/\{\{company\}\}/gi, lead.company || "")
    .replace(/\{\{email\}\}/gi, lead.email || "")
    .replace(/\{\{event_type\}\}/gi, lead.eventTypeInterest || "")
    .replace(/\{\{preferred_date\}\}/gi, preferred)
    .replace(
      /\{\{headcount\}\}/gi,
      lead.headcountEstimate != null ? String(lead.headcountEstimate) : ""
    )
    .replace(/\{\{phone\}\}/gi, lead.phone || "");
}

async function pickSurveyTemplate(
  db: ReturnType<typeof requireDb>,
  channel: string | null | undefined
) {
  const channelNorm = channel === "B2C" || channel === "B2B" ? channel : null;

  const channelFilter = channelNorm
    ? or(
        eq(emailTemplates.channel, "Both"),
        eq(emailTemplates.channel, channelNorm)
      )
    : or(
        eq(emailTemplates.channel, "Both"),
        eq(emailTemplates.channel, "B2B"),
        eq(emailTemplates.channel, "B2C")
      );

  const candidates = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.isActive, true),
        eq(emailTemplates.pipelineStage, SURVEY_STAGE),
        channelFilter
      )
    )
    .orderBy(desc(emailTemplates.sendAutomatically));

  if (candidates.length > 0) return candidates[0]!;

  const [any] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.isActive, true),
        eq(emailTemplates.pipelineStage, SURVEY_STAGE)
      )
    )
    .orderBy(desc(emailTemplates.sendAutomatically))
    .limit(1);
  return any ?? null;
}

export interface SendSurveyDraftResult {
  ok: boolean;
  skipped?: string;
  draftId?: string;
}

/**
 * When auto-call cannot run, create a Gmail draft from the Survey Sent template,
 * notify the first digest recipient, and move the lead to Survey Sent.
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

  const template = await pickSurveyTemplate(db, lead.channel);
  if (!template) {
    console.error(
      `${LOG} No active EmailTemplate for pipeline_stage="${SURVEY_STAGE}"`
    );
    return { ok: false, skipped: "no_template" };
  }

  const subject = replaceVariables(template.subject, lead);
  const body = replaceVariables(template.body, lead);

  const draft = await createGmailDraft({
    to: lead.email,
    subject,
    body,
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
      template_name: template.templateName,
      template_id: template.id,
      to: lead.email,
      subject,
    },
    userName: "System (Call Fallback)",
    timestamp: now,
  });

  const digestTo = env.digestRecipients()[0];
  if (digestTo) {
    try {
      await sendGmailEmail({
        to: digestTo,
        subject: `Draft ready for review — follow-up to ${lead.name || lead.email}`,
        body: [
          "A survey follow-up email has been added to Drafts in Gmail and is awaiting review.",
          "",
          `Reason: ${reason}`,
          "",
          `Lead: ${lead.name || "(no name)"}${lead.company ? ` (${lead.company})` : ""}`,
          `Email: ${lead.email}`,
          `Phone: ${lead.phone || "(none)"}`,
          `Template: ${template.templateName}`,
          "",
          "Open Gmail → Drafts to review and send.",
        ].join("\n"),
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
  } else {
    console.warn(`${LOG} No DIGEST_RECIPIENTS configured — skip notify`);
  }

  console.log(
    `${LOG} Draft created for lead ${lead.id} template="${template.templateName}" draftId=${draftId}`
  );
  return { ok: true, draftId };
}
