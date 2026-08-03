import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import twilio from "twilio";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  automationConfig,
  callLogs,
  leads,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    env.twilioAccountSid() &&
      env.twilioAuthToken() &&
      env.twilioPhoneNumber() &&
      env.appUrl()
  );
}

export function normalizeUSPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d]/g, "");
  if (!s) return null;
  if (s.startsWith("92")) return s;
  if (s.length === 10) return `1${s}`;
  if (s.length === 11 && s.startsWith("1")) return s;
  if (s.length >= 10) return `1${s.slice(-10)}`;
  return null;
}

function buildLeadBrief(lead: typeof leads.$inferSelect): string {
  const parts: string[] = [];

  if (lead.aiFlagCategory) {
    const reason = lead.aiFlagReason ? `: ${lead.aiFlagReason}` : "";
    parts.push(
      `Heads up — this lead was flagged as ${lead.aiFlagCategory}${reason}.`
    );
  }
  if (lead.inquiryType && lead.inquiryType !== "Unknown") {
    parts.push(`Inquiry type: ${lead.inquiryType}.`);
  }
  if (lead.channel) parts.push(`This is a ${lead.channel} lead.`);
  if (lead.clientType) parts.push(`${lead.clientType} client.`);
  if (lead.eventTypeInterest) {
    parts.push(`Interested in: ${lead.eventTypeInterest}.`);
  }
  if (lead.eventFormat) parts.push(`Format: ${lead.eventFormat}.`);
  if (lead.headcountEstimate) {
    parts.push(`About ${lead.headcountEstimate} guests.`);
  }
  if (lead.preferredDate) {
    try {
      const d = new Date(lead.preferredDate);
      if (!isNaN(d.getTime())) {
        parts.push(
          `Preferred date: ${d.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          })}.`
        );
      }
    } catch {
      /* ignore */
    }
  }
  if (lead.source) parts.push(`Source: ${lead.source}.`);
  if (lead.notes) {
    const rawNotes = String(lead.notes);
    const callBlockIdx = rawNotes.indexOf("--- Call ");
    let originalMessage =
      callBlockIdx > 0
        ? rawNotes.slice(0, callBlockIdx).trim()
        : rawNotes.trim();
    const messageMatch = originalMessage.match(/\bMessage:\s*\n([\s\S]*)/i);
    if (messageMatch) {
      originalMessage = messageMatch[1].trim();
    }
    const trimmed = originalMessage.replace(/\s+/g, " ").trim().slice(0, 800);
    if (trimmed) {
      parts.push(
        `Message from the lead: ${trimmed}${originalMessage.length > 800 ? "..." : ""}`
      );
    }
  }

  return parts.join(" ");
}

function checkBusinessHoursDC(now = new Date()): {
  ok: boolean;
  nextStartUtc?: Date;
} {
  const tz = "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const weekday = get("weekday");
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  const minutesOfDay = hour * 60 + minute;
  const START = 7 * 60 + 30;
  const END = 20 * 60 + 30;
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday || "");
  const inWindow = isWeekday && minutesOfDay >= START && minutesOfDay < END;
  if (inWindow) return { ok: true };

  const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let dayIdx = dayOrder.indexOf(weekday || "Sun");
  let addDays = 0;
  if (isWeekday && minutesOfDay < START) {
    addDays = 0;
  } else {
    addDays = 1;
    while (true) {
      const next = dayOrder[(dayIdx + addDays) % 7];
      if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(next)) break;
      addDays++;
    }
  }

  const dcNowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const g = (t: string) =>
    parseInt(dcNowParts.find((p) => p.type === t)?.value || "0", 10);
  const asIfUtc = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day"),
    g("hour"),
    g("minute"),
    g("second")
  );
  const offsetMs = asIfUtc - now.getTime();
  const targetAsIfUtc = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day") + addDays,
    7,
    30,
    0
  );
  return { ok: false, nextStartUtc: new Date(targetAsIfUtc - offsetMs) };
}

export interface TriggerCallInput {
  leadId: string;
  attemptNumber?: number;
  skipBusinessHours?: boolean;
  dryRun?: boolean;
}

export async function triggerCall(input: TriggerCallInput) {
  if (!isTwilioConfigured()) {
    throw new AppError(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and APP_URL.",
      503
    );
  }

  const db = requireDb();
  const leadRows = await db
    .select()
    .from(leads)
    .where(eq(leads.id, input.leadId))
    .limit(1);
  const lead = leadRows[0];
  if (!lead) {
    throw new AppError("Lead not found", 404);
  }

  if (lead.email) {
    const emailLower = lead.email.toLowerCase();
    const allWithEmail = await db.select().from(leads);
    const otherLeads = allWithEmail.filter(
      (l) => l.id !== input.leadId && l.email?.toLowerCase() === emailLower
    );
    if (otherLeads.length > 0) {
      await db.insert(activityLogs).values({
        entityType: "Lead",
        entityId: input.leadId,
        action: "Auto-Call Skipped (Existing Client)",
        details: {
          reason: `Email ${lead.email} already exists on ${otherLeads.length} other lead record(s) — this is not a new client.`,
          matching_lead_ids: otherLeads.map((l) => l.id),
        },
        userName: "Automated Calling",
        timestamp: new Date(),
      });
      return {
        ok: true,
        success: true,
        skipped: "existing_client",
        reason: `Email "${lead.email}" has ${otherLeads.length} existing lead(s). Automated calls are only for new clients.`,
        matching_lead_ids: otherLeads.map((l) => l.id),
        message: `Skipped — existing client (${otherLeads.length} other lead(s))`,
      };
    }
  }

  const configs = await db
    .select()
    .from(automationConfig)
    .where(eq(automationConfig.key, "default"))
    .limit(1);
  const config = configs[0];
  if (!config || !config.repPhone || !config.repEmail) {
    throw new AppError(
      "AutomationConfig not set. Please configure rep_phone, rep_email, and calendar_link in the admin panel.",
      400
    );
  }

  if (config.enabled === false) {
    return {
      ok: true,
      success: true,
      skipped: "automated_calling_disabled",
      message: "Automated calling is disabled",
    };
  }

  const repPhone = normalizeUSPhone(config.repPhone);
  const leadPhone = normalizeUSPhone(lead.phone);
  if (!repPhone) {
    throw new AppError("Invalid rep_phone in AutomationConfig", 400);
  }

  const previousCalls = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.leadId, input.leadId));
  const nextAttempt = input.attemptNumber || previousCalls.length + 1;
  const leadBrief = buildLeadBrief(lead);

  const bh =
    input.skipBusinessHours || config.businessHoursGateEnabled === false
      ? { ok: true as const }
      : checkBusinessHoursDC();

  if (!bh.ok && bh.nextStartUtc) {
    const [queued] = await db
      .insert(callLogs)
      .values({
        leadId: input.leadId,
        leadName: lead.name || "",
        leadCompany: lead.company || "",
        leadPhone: lead.phone || "",
        leadBrief,
        repPhone: `+${repPhone}`,
        repEmail: config.repEmail,
        attemptNumber: nextAttempt,
        status: "Initiated",
        errorMessage: `Queued — outside DC business hours. Will call after ${bh.nextStartUtc.toISOString()}.`,
        startedAt: new Date(),
        scheduledRetryAt: bh.nextStartUtc,
        retryProcessed: false,
      })
      .returning();

    await db
      .update(leads)
      .set({ stage: "Call Initiated", updatedDate: new Date() })
      .where(eq(leads.id, input.leadId));

    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: input.leadId,
      action: "Call Queued (Outside Business Hours)",
      details: {
        call_log_id: queued.id,
        scheduled_for_utc: bh.nextStartUtc.toISOString(),
        window: "Mon–Fri 7:30 AM – 8:30 PM America/New_York",
      },
      userName: "Automated Calling",
      timestamp: new Date(),
    });

    return {
      ok: true,
      success: true,
      queued: true,
      call_log_id: queued.id,
      scheduled_for: bh.nextStartUtc.toISOString(),
      message: "Call queued for next business hours window",
    };
  }

  if (!input.skipBusinessHours) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await db
      .select()
      .from(callLogs)
      .where(
        and(
          inArray(callLogs.status, ["Ringing", "In Progress"]),
          gt(callLogs.startedAt, tenMinutesAgo),
          isNull(callLogs.scheduledRetryAt)
        )
      )
      .orderBy(desc(callLogs.startedAt))
      .limit(50);

    if (recent.length > 0) {
      const queuedAt = new Date(Date.now() + 5 * 60 * 1000);
      const [queued] = await db
        .insert(callLogs)
        .values({
          leadId: input.leadId,
          leadName: lead.name || "",
          leadCompany: lead.company || "",
          leadPhone: lead.phone || "",
          leadBrief,
          repPhone: `+${repPhone}`,
          repEmail: config.repEmail,
          attemptNumber: nextAttempt,
          status: "Initiated",
          errorMessage:
            "Queued — another call is already active. Will retry in ~5 minutes.",
          startedAt: new Date(),
          scheduledRetryAt: queuedAt,
          retryProcessed: false,
        })
        .returning();

      return {
        ok: true,
        success: true,
        queued: true,
        reason: "concurrent_call_active",
        call_log_id: queued.id,
        scheduled_for: queuedAt.toISOString(),
        message: "Call queued — another call is active",
      };
    }
  }

  if (input.dryRun) {
    return {
      ok: true,
      success: true,
      dry_run: true,
      summary: {
        lead_id: input.leadId,
        lead_name: lead.name,
        lead_email: lead.email,
        lead_phone: leadPhone ? `+${leadPhone}` : "(no phone)",
        rep_phone: `+${repPhone}`,
        attempt_number: nextAttempt,
        max_attempts: config.maxAttempts || 3,
      },
    };
  }

  const [callLog] = await db
    .insert(callLogs)
    .values({
      leadId: input.leadId,
      leadName: lead.name || "",
      leadCompany: lead.company || "",
      leadPhone: leadPhone ? `+${leadPhone}` : "",
      leadBrief,
      repPhone: `+${repPhone}`,
      repEmail: config.repEmail,
      attemptNumber: nextAttempt,
      status: "Initiated",
      startedAt: new Date(),
    })
    .returning();

  const baseUrl = env.appUrl().replace(/\/$/, "");
  const callLogId = callLog.id;
  const repAnswerUrl = `${baseUrl}/webhook/twilio/voice?stage=rep_answer&call_log_id=${callLogId}`;
  const repStatusUrl = `${baseUrl}/webhook/twilio/status?stage=rep_status&call_log_id=${callLogId}`;

  const client = twilio(env.twilioAccountSid(), env.twilioAuthToken());

  try {
    const call = await client.calls.create({
      to: `+${repPhone}`,
      from: env.twilioPhoneNumber(),
      url: repAnswerUrl,
      method: "POST",
      statusCallback: repStatusUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      timeout: 20,
    });

    await db
      .update(callLogs)
      .set({
        twilioCallSid: call.sid || "",
        status: "Ringing",
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));

    await db
      .update(leads)
      .set({ stage: "Call Initiated", updatedDate: new Date() })
      .where(eq(leads.id, input.leadId));

    return {
      ok: true,
      success: true,
      call_log_id: callLogId,
      call_sid: call.sid || null,
      attempt_number: nextAttempt,
      message: "Call initiated",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(callLogs)
      .set({
        status: "Failed",
        errorMessage: message,
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));
    throw new AppError(`Twilio rejected the call: ${message}`, 502);
  }
}
