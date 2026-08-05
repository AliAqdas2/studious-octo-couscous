import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  clients,
  leads,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { triggerCall } from "../twilio/triggerCall.js";
import { sendSurveyDraftOnCallFailure } from "./sendSurveyDraftOnCallFailure.js";

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

export interface OnLeadCreatedResult {
  ok: true;
  skipped?: string;
  triggered?: boolean;
  call_log_id?: string | null;
  call_sid?: string | null;
  survey_draft?: boolean;
}

function isPastClientForAutoCall(client: {
  totalEvents: number | null;
  isReturning: boolean | null;
}): boolean {
  return (client.totalEvents ?? 0) > 0 || client.isReturning === true;
}

async function runSurveyDraftFallback(
  leadId: string,
  reason: string
): Promise<boolean> {
  try {
    const result = await sendSurveyDraftOnCallFailure(leadId, reason);
    if (result.ok && !result.skipped) {
      console.log(
        `[onLeadCreated] Survey draft fallback OK for ${leadId} draftId=${result.draftId || "?"}`
      );
      return true;
    }
    console.log(
      `[onLeadCreated] Survey draft fallback skipped for ${leadId}: ${result.skipped || "unknown"}`
    );
    return false;
  } catch (e) {
    console.error(
      `[onLeadCreated] Survey draft fallback failed for ${leadId}:`,
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

/**
 * Auto-call hook after a Lead is created (form Save & Call, Gmail intake, etc.).
 * Applies Base44 skip guards, then invokes triggerCall.
 * On call failure / Twilio misconfig: create Survey Sent Gmail draft + digest notice.
 * Safe to fire-and-forget — catches/logs errors and does not rethrow to create paths.
 */
export async function onLeadCreated(leadId: string): Promise<OnLeadCreatedResult> {
  try {
    if (!leadId) {
      return { ok: true, skipped: "no lead id" };
    }

    const db = requireDb();
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    const lead = rows[0];
    if (!lead) {
      return { ok: true, skipped: "no lead data" };
    }

    if (lead.skipAutoCall) {
      console.log(
        `[onLeadCreated] Lead ${lead.id} has skip_auto_call=true — skipping auto-call`
      );
      return { ok: true, skipped: "skip_auto_call" };
    }

    if (lead.aiFlagCategory) {
      console.log(
        `[onLeadCreated] Lead ${lead.id} flagged as "${lead.aiFlagCategory}" — skipping auto-call`
      );
      return { ok: true, skipped: `ai_flag:${lead.aiFlagCategory}` };
    }

    if (lead.gmailThreadId) {
      const sameThread = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.gmailThreadId, lead.gmailThreadId),
            ne(leads.id, lead.id)
          )
        )
        .limit(5);
      if (sameThread.length > 0) {
        console.log(
          `[onLeadCreated] Lead ${lead.id} shares Gmail thread ${lead.gmailThreadId} with ${sameThread.length} other lead(s) — existing conversation, skipping call`
        );
        return { ok: true, skipped: "existing_email_thread" };
      }
    }

    if (lead.isReturningClient) {
      console.log(
        `[onLeadCreated] Lead ${lead.id} is_returning_client — skipping call`
      );
      return { ok: true, skipped: "returning_client" };
    }

    if (lead.clientId) {
      const clientRows = await db
        .select()
        .from(clients)
        .where(eq(clients.id, lead.clientId))
        .limit(1);
      const client = clientRows[0];
      if (client && isPastClientForAutoCall(client)) {
        console.log(
          `[onLeadCreated] Lead ${lead.id} linked to past client ${client.id} — skipping call`
        );
        return { ok: true, skipped: "returning_client" };
      }
    }

    if (lead.email) {
      const emailLower = lead.email.toLowerCase();
      const otherLeads = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(sql`lower(${leads.email}) = ${emailLower}`, ne(leads.id, lead.id))
        )
        .orderBy(desc(leads.createdDate))
        .limit(10);

      if (otherLeads.length > 0) {
        const checks = await Promise.all(
          otherLeads.slice(0, 3).map(async (l) => {
            const logs = await db
              .select({ id: activityLogs.id })
              .from(activityLogs)
              .where(eq(activityLogs.entityId, l.id))
              .limit(1);
            return logs.length > 0;
          })
        );
        if (checks.some(Boolean)) {
          console.log(
            `[onLeadCreated] Lead ${lead.id} — email ${lead.email} has prior leads with activity — existing contact, skipping call`
          );
          return { ok: true, skipped: "existing_contact_with_activity" };
        }
      }

      const existingClients = await db
        .select()
        .from(clients)
        .where(sql`lower(${clients.email}) = ${emailLower}`)
        .limit(1);
      if (existingClients[0] && isPastClientForAutoCall(existingClients[0])) {
        console.log(
          `[onLeadCreated] Lead ${lead.id} — email ${lead.email} found in Client DB with event history — skipping call`
        );
        return { ok: true, skipped: "past_client" };
      }
    }

    console.log(`[onLeadCreated] Lead ${lead.id} created — triggering call`);
    try {
      const result = await triggerCall({
        leadId: lead.id,
        attemptNumber: 1,
      });

      return {
        ok: true,
        triggered: true,
        call_log_id:
          "call_log_id" in result
            ? ((result as { call_log_id?: string }).call_log_id ?? null)
            : null,
        call_sid:
          "call_sid" in result
            ? ((result as { call_sid?: string | null }).call_sid ?? null)
            : null,
      };
    } catch (callErr) {
      const reason =
        callErr instanceof Error ? callErr.message : "Automated call failed";
      console.error(
        "[onLeadCreated] Call failed — running survey draft fallback:",
        reason
      );
      const drafted = await runSurveyDraftFallback(lead.id, reason);
      return {
        ok: true,
        skipped: `error:${reason}`,
        survey_draft: drafted,
      };
    }
  } catch (error) {
    console.error(
      "[onLeadCreated] Error:",
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : ""
    );
    return {
      ok: true,
      skipped: `error:${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

/** Fire-and-forget wrapper for create paths. */
export function scheduleOnLeadCreated(leadId: string): void {
  void onLeadCreated(leadId).catch((e) =>
    console.error("[onLeadCreated] Unhandled:", e)
  );
}
