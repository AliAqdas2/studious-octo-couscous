import { and, desc, eq, inArray } from "drizzle-orm";
import { env } from "../config/env.js";
import { getDb } from "../db/index.js";
import { activityLogs, leads } from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";
import { sendGmailEmail } from "../services/gmail/send.js";

const DC_TZ = "America/New_York";
const LEAD_LIMIT = 1000;

const STAGE_META: Record<string, { status: string; description: string }> = {
  "New Inquiry": {
    status: "New",
    description:
      "Brand new lead — no contact made yet, sitting in queue for first outreach.",
  },
  "Program Planning Discussion": {
    status: "In Meeting",
    description:
      "Active planning meeting underway — discussing event needs, budget, and program details.",
  },
  "After Meeting Follow-Up": {
    status: "Proposal",
    description:
      "Meeting done — sending deposit request / recognition template; awaiting client decision.",
  },
  "Deposit Requested": {
    status: "Pending Payment",
    description:
      "Client agreed — deposit invoice sent, waiting on payment to confirm booking.",
  },
  "Confirmed Sales": {
    status: "Won",
    description:
      "Deposit received — event confirmed, internal workflows triggered.",
  },
  "Lost/Canceled": {
    status: "Closed Lost",
    description:
      "Lead did not convert or event canceled — reason logged for future nurturing.",
  },
  "Initial Outreach – Call to Schedule": {
    status: "Active",
    description:
      "First call placed to B2B client to schedule a planning discussion.",
  },
  "Survey Sent": {
    status: "Active",
    description:
      "Call unanswered — pre-program survey emailed to collect details before scheduling.",
  },
  "Awaiting Survey Response (24hr)": {
    status: "Waiting",
    description: "Holding 24 hours for the client to complete the survey.",
  },
  "No Survey Response – Follow-Up 1": {
    status: "Following Up",
    description:
      'No survey reply — "overwhelm nudge" email sent to re-engage.',
  },
  "Awaiting Response After Follow-Up 1": {
    status: "Waiting",
    description: "Waiting 48 hours after first nudge before escalating.",
  },
  "No Response – Follow-Up 2": {
    status: "At Risk",
    description:
      'Still silent — "fall off radar" email sent as second attempt.',
  },
  "Awaiting Response After Follow-Up 2": {
    status: "At Risk",
    description:
      "48-hour hold after second follow-up — serious risk of closing.",
  },
  "No Response – Final Email Sent": {
    status: "Closing Soon",
    description:
      "Last-chance email sent — no reply in 48 hours will close this lead.",
  },
  "Survey Completed – Calendar Invite Sent": {
    status: "Progressing",
    description:
      "Survey returned and calendar invite sent — planning meeting being scheduled.",
  },
  "Awaiting Calendar Acceptance": {
    status: "Waiting",
    description:
      "Invite is out — waiting on client to accept and lock the slot.",
  },
  "Calendar Invite Resent": {
    status: "Following Up",
    description: "Original invite ignored — resent after 24 hours.",
  },
  "Calendar Accepted": {
    status: "Confirmed",
    description:
      "Client confirmed the meeting — team ready to run the planning call.",
  },
  "Outreach Initiated – Call Attempted": {
    status: "Active",
    description:
      "First call made to B2C client — pending answer or email fallback.",
  },
  "No Answer – 1st Email Sent": {
    status: "Following Up",
    description: "Call unanswered — first email sent requesting availability.",
  },
  "Calendar Invite Sent": {
    status: "Progressing",
    description:
      "Client responded — calendar invite sent to schedule planning discussion.",
  },
  "Invite Not Accepted": {
    status: "Waiting",
    description:
      "Invite not yet accepted — 48-hour nudge follow-up dispatched.",
  },
  "2nd Follow-Up – Off Radar": {
    status: "At Risk",
    description:
      "No invite acceptance after nudge — second follow-up sent; lead at risk.",
  },
  "Invite Accepted – Survey Sent": {
    status: "Confirmed",
    description:
      "Meeting confirmed and pre-program survey sent — collecting event details.",
  },
};

const OVERDUE_RULES: Record<string, { hours: number; action: string }> = {
  "New Inquiry": {
    hours: 24,
    action: "Initial outreach overdue — call or email the lead",
  },
  "Outreach Initiated – Call Attempted": {
    hours: 24,
    action: "No answer — send first follow-up email",
  },
  "Initial Outreach – Call to Schedule": {
    hours: 24,
    action: "Send survey to lead",
  },
  "No Answer – 1st Email Sent": {
    hours: 48,
    action: "Send calendar invite or move to off-radar",
  },
  "Survey Sent": {
    hours: 24,
    action: "Move to Awaiting Survey Response (24hr)",
  },
  "Awaiting Survey Response (24hr)": {
    hours: 24,
    action: "No survey response received — send follow-up",
  },
  "No Survey Response – Follow-Up 1": {
    hours: 24,
    action: "Move to Awaiting Response After Follow-Up 1",
  },
  "Awaiting Response After Follow-Up 1": {
    hours: 48,
    action: "No response — send Follow-Up 2",
  },
  "No Response – Follow-Up 2": {
    hours: 24,
    action: "Move to Awaiting Response After Follow-Up 2",
  },
  "Awaiting Response After Follow-Up 2": {
    hours: 48,
    action: "No response — send final email",
  },
  "Calendar Invite Sent": {
    hours: 48,
    action: "Check if invite was accepted",
  },
  "Survey Completed – Calendar Invite Sent": {
    hours: 48,
    action: "Check if invite was accepted",
  },
  "Awaiting Calendar Acceptance": {
    hours: 48,
    action: "Resend calendar invite",
  },
  "Calendar Invite Resent": {
    hours: 48,
    action: "Follow up on calendar invite",
  },
  "Invite Not Accepted": {
    hours: 24,
    action: "Send 2nd follow-up — off radar",
  },
  "2nd Follow-Up – Off Radar": {
    hours: 72,
    action: "Send final outreach email",
  },
  "Invite Accepted – Survey Sent": {
    hours: 48,
    action: "Move to Program Planning Discussion",
  },
  "Calendar Accepted": {
    hours: 24,
    action: "Begin program planning discussion",
  },
  "Program Planning Discussion": {
    hours: 72,
    action: "Send After-Meeting Follow-Up",
  },
  "After Meeting Follow-Up": {
    hours: 72,
    action: "Request deposit or follow up on proposal",
  },
  "Deposit Requested": { hours: 72, action: "Follow up on deposit" },
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatStage(stage: string | null | undefined): string {
  if (!stage) return "";
  const meta = STAGE_META[stage];
  if (!meta) return stage;
  return meta.status ? `${stage} — ${meta.status}` : stage;
}

function stageDescription(stage: string | null | undefined): string {
  if (!stage) return "";
  return STAGE_META[stage]?.description || "";
}

function toDateInput(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    // Date-only (YYYY-MM-DD) — treat as noon ET-safe by appending T12:00:00
    const d =
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isSameDayInTZ(dateVal: unknown, todayStr: string, tz: string): boolean {
  const d = toDateInput(dateVal);
  if (!d) return false;
  const dStr = d.toLocaleDateString("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dStr === todayStr;
}

function formatTimeInTZ(dateVal: unknown, tz: string): string {
  const d = toDateInput(dateVal);
  if (!d) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

function hoursSince(dateVal: unknown): number {
  const d = toDateInput(dateVal);
  if (!d) return 0;
  return (Date.now() - d.getTime()) / 36e5;
}

type LeadRow = typeof leads.$inferSelect;

function detailsNewStage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  const v = rec.new_stage ?? rec.newStage;
  return typeof v === "string" ? v : null;
}

/**
 * Daily Task Digest — Base44 sendDailyDigest port.
 * Lead meetings / follow-ups today + overdue pipeline actions → team HTML email.
 */
export async function sendDailyDigest(): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) {
    console.warn("[sendDailyDigest] Database not configured — skipping");
    return { success: false, skipped: "no_database" };
  }

  const recipients = env.digestRecipients();
  if (recipients.length === 0) {
    console.warn("[sendDailyDigest] No recipients configured — skipping");
    return { success: false, skipped: "no_recipients" };
  }

  const appBaseUrl = env.appUrl().replace(/\/$/, "");
  const leadUrl = (id: string) =>
    appBaseUrl ? `${appBaseUrl}/LeadDetail?id=${id}` : "#";

  const now = new Date();
  const todayStr = now.toLocaleDateString("en-US", {
    timeZone: DC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayDisplay = now.toLocaleDateString("en-US", {
    timeZone: DC_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const allLeads = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.updatedDate))
    .limit(LEAD_LIMIT);

  const leadIds = allLeads.map((l) => l.id);
  const stageLogs =
    leadIds.length === 0
      ? []
      : await db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.entityType, "Lead"),
              eq(activityLogs.action, "Stage Changed"),
              inArray(activityLogs.entityId, leadIds)
            )
          );

  // Newest Stage Changed timestamp per lead+stage
  const stageEntryByLeadStage = new Map<string, Date>();
  for (const log of stageLogs) {
    const newStage = detailsNewStage(log.details);
    if (!newStage || !log.entityId) continue;
    const ts = log.timestamp || log.createdDate;
    if (!ts) continue;
    const key = `${log.entityId}::${newStage}`;
    const existing = stageEntryByLeadStage.get(key);
    if (!existing || ts.getTime() > existing.getTime()) {
      stageEntryByLeadStage.set(key, ts);
    }
  }

  const getStageEntry = (lead: LeadRow): Date | string | null => {
    if (lead.stage) {
      const fromLog = stageEntryByLeadStage.get(`${lead.id}::${lead.stage}`);
      if (fromLog) return fromLog;
    }
    return lead.updatedDate || lead.createdDate || null;
  };

  const leadMeetingsToday = allLeads.filter(
    (l) =>
      l.preferredDate &&
      isSameDayInTZ(l.preferredDate, todayStr, DC_TZ) &&
      l.stage !== "Lost/Canceled" &&
      l.stage !== "Confirmed Sales"
  );

  const followUpMeetingsToday = allLeads.filter(
    (l) =>
      (l.meetingDate && isSameDayInTZ(l.meetingDate, todayStr, DC_TZ)) ||
      (l.followupNextDate && isSameDayInTZ(l.followupNextDate, todayStr, DC_TZ))
  );

  const overdueActions: {
    lead: LeadRow;
    rule: { hours: number; action: string };
    hrs: number;
  }[] = [];

  for (const lead of allLeads) {
    if (!lead.stage) continue;
    const rule = OVERDUE_RULES[lead.stage];
    if (!rule) continue;
    const entry = getStageEntry(lead);
    const hrs = hoursSince(entry);
    if (hrs >= rule.hours) {
      overdueActions.push({ lead, rule, hrs });
    }
  }

  const section = (title: string, count: number, rowsHtml: string) => `
      <h2 style="color:#C84B31;font-size:18px;margin:24px 0 8px 0;border-bottom:2px solid #E8B55F;padding-bottom:4px;">
        ${title} <span style="color:#666;font-size:14px;font-weight:normal;">(${count})</span>
      </h2>
      ${count === 0 ? '<p style="color:#999;font-style:italic;margin:8px 0;">Nothing scheduled.</p>' : rowsHtml}
    `;

  const panel = (
    id: string,
    borderColor: string,
    bgColor: string,
    inner: string
  ) => {
    const style = `display:block;padding:10px;border-left:3px solid ${borderColor};background:${bgColor};margin-bottom:6px;text-decoration:none;color:inherit;cursor:pointer;border-radius:2px;`;
    return appBaseUrl
      ? `<a href="${leadUrl(id)}" style="${style}">${inner}</a>`
      : `<div style="${style}">${inner}</div>`;
  };

  const leadMeetingRows = leadMeetingsToday
    .map((l) =>
      panel(
        l.id,
        "#C84B31",
        "#FFF9F0",
        `
      <span style="color:#C84B31;font-weight:bold;">${escapeHtml(l.name || "Lead")}</span>${
        l.company
          ? `<span style="color:#333;"> — ${escapeHtml(l.company)}</span>`
          : ""
      }<br/>
      <span style="color:#555;font-size:13px;">📅 ${formatTimeInTZ(l.preferredDate, DC_TZ)} &nbsp;·&nbsp; ${escapeHtml(formatStage(l.stage))}</span>
      ${
        stageDescription(l.stage)
          ? `<div style="color:#777;font-size:12px;margin-top:4px;font-style:italic;">${escapeHtml(stageDescription(l.stage))}</div>`
          : ""
      }
    `
      )
    )
    .join("");

  const followUpRows = followUpMeetingsToday
    .map((l) => {
      const when =
        l.meetingDate && isSameDayInTZ(l.meetingDate, todayStr, DC_TZ)
          ? l.meetingDate
          : l.followupNextDate;
      return panel(
        l.id,
        "#7A9D54",
        "#F4F8EE",
        `
        <span style="color:#4F7A2E;font-weight:bold;">${escapeHtml(l.name || "Lead")}</span>${
          l.company
            ? `<span style="color:#333;"> — ${escapeHtml(l.company)}</span>`
            : ""
        }<br/>
        <span style="color:#555;font-size:13px;">🔄 ${formatTimeInTZ(when, DC_TZ)} &nbsp;·&nbsp; ${escapeHtml(formatStage(l.stage))}</span>
        ${
          stageDescription(l.stage)
            ? `<div style="color:#777;font-size:12px;margin-top:4px;font-style:italic;">${escapeHtml(stageDescription(l.stage))}</div>`
            : ""
        }
      `
      );
    })
    .join("");

  const overdueRows = overdueActions
    .map(({ lead, rule, hrs }) =>
      panel(
        lead.id,
        "#E8B55F",
        "#FFF4E0",
        `
      <span style="color:#B8860B;font-weight:bold;">${escapeHtml(lead.name || "Lead")}</span>${
        lead.company
          ? `<span style="color:#333;"> — ${escapeHtml(lead.company)}</span>`
          : ""
      }<br/>
      <span style="color:#B8860B;font-size:13px;font-weight:600;">⚠ ${escapeHtml(rule.action)}</span><br/>
      <span style="color:#555;font-size:12px;">${escapeHtml(formatStage(lead.stage))} &nbsp;·&nbsp; ${Math.floor(hrs)}h in stage</span>
      ${
        stageDescription(lead.stage)
          ? `<div style="color:#777;font-size:12px;margin-top:4px;font-style:italic;">${escapeHtml(stageDescription(lead.stage))}</div>`
          : ""
      }
    `
      )
    )
    .join("");

  const totalItems =
    leadMeetingsToday.length +
    followUpMeetingsToday.length +
    overdueActions.length;

  const body = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#fff;">
        <div style="background:linear-gradient(135deg,#C84B31,#E8B55F);color:white;padding:20px;border-radius:8px;">
          <h1 style="margin:0;font-size:22px;">Mangia DC — Daily Task Digest</h1>
          <p style="margin:6px 0 0 0;opacity:0.95;">${escapeHtml(todayDisplay)}</p>
        </div>
        <p style="color:#333;font-size:14px;margin:16px 0;">
          You have <strong>${totalItems}</strong> item${totalItems === 1 ? "" : "s"} to review today.
        </p>
        ${section("📅 Lead Meetings Scheduled Today", leadMeetingsToday.length, leadMeetingRows)}
        ${section("🔄 Follow-Up Meetings Today", followUpMeetingsToday.length, followUpRows)}
        ${section("⚠ Overdue Pipeline Actions", overdueActions.length, overdueRows)}
        <p style="color:#999;font-size:12px;margin-top:32px;text-align:center;border-top:1px solid #eee;padding-top:16px;">
          Sent automatically each morning at 7:00 AM ET · Mangia DC CRM
        </p>
      </div>
    `;

  const subject = `Daily Digest — ${totalItems} item${totalItems === 1 ? "" : "s"} for ${todayDisplay}`;

  const sent: { to: string; ok: boolean; error?: string }[] = [];

  for (const to of recipients) {
    try {
      await sendGmailEmail({
        to,
        subject,
        body,
        html: true,
        userName: "System (Daily Digest)",
      });
      sent.push({ to, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isGmailDown =
        err instanceof AppError &&
        (message.includes("Gmail not connected") ||
          message.includes("Gmail token expired"));
      if (isGmailDown) {
        console.warn(
          `[sendDailyDigest] Gmail unavailable — skipping remaining sends: ${message}`
        );
        sent.push({ to, ok: false, error: message });
        return {
          success: false,
          skipped: "gmail_not_connected",
          totalItems,
          recipients,
          sent,
          meetings: leadMeetingsToday.length,
          followUps: followUpMeetingsToday.length,
          overdue: overdueActions.length,
        };
      }
      console.error(`[sendDailyDigest] Failed to send to ${to}:`, message);
      sent.push({ to, ok: false, error: message });
    }
  }

  const okCount = sent.filter((s) => s.ok).length;
  console.log(
    `[sendDailyDigest] totalItems=${totalItems} sent=${okCount}/${recipients.length}`
  );

  return {
    success: okCount > 0,
    totalItems,
    recipients,
    sent,
    meetings: leadMeetingsToday.length,
    followUps: followUpMeetingsToday.length,
    overdue: overdueActions.length,
  };
}
