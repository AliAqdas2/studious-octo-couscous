import { eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  automationConfig,
  callLogs,
  leads,
} from "../../db/schema/index.js";

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlAttr(url: string): string {
  return String(url).replace(/&/g, "&amp;");
}

function humanSay(text: string): string {
  const withPhones = String(text).replace(
    /(\+?[\d][\d\s\-().]{6,18}[\d])/g,
    (match) => {
      const digits = match.replace(/[^\d+]/g, "");
      return `<say-as interpret-as="telephone">${escapeXml(digits)}</say-as>`;
    }
  );
  return `<Say voice="Polly.Joanna-Neural" language="en-US"><prosody rate="95%">${withPhones}</prosody></Say>`;
}

function hangupTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${humanSay(message)}
  <Hangup/>
</Response>`;
}

async function resetLeadIfCallInitiated(leadId: string | null | undefined) {
  if (!leadId) return;
  const db = getDb();
  if (!db) return;
  const rows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = rows[0];
  if (lead?.stage === "Call Initiated") {
    await db
      .update(leads)
      .set({ stage: "New Inquiry", updatedDate: new Date() })
      .where(eq(leads.id, leadId));
  }
}

export interface TwimlHandlerResult {
  contentType: "text/xml" | "text/plain";
  body: string;
  status?: number;
}

export async function handleTwimlCallback(params: {
  stage: string;
  callLogId: string;
  attempt?: number;
  timeout?: boolean;
  body: Record<string, string>;
}): Promise<TwimlHandlerResult> {
  const { stage, callLogId, body } = params;
  const appUrl = env.appUrl().replace(/\/$/, "");
  const db = getDb();

  if (!db) {
    return {
      contentType: "text/xml",
      body: hangupTwiML("System unavailable. Goodbye."),
    };
  }

  const callLogRows = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.id, callLogId))
    .limit(1);
  const callLog = callLogRows[0];
  if (!callLog) {
    return {
      contentType: "text/xml",
      body: hangupTwiML("Call record not found. Goodbye."),
    };
  }

  if (stage === "rep_answer") {
    const attempt = params.attempt || 1;
    const MAX_ATTEMPTS = 5;

    if (attempt === 1) {
      await db
        .update(callLogs)
        .set({ status: "In Progress", updatedDate: new Date() })
        .where(eq(callLogs.id, callLogId));
    }

    const leadName = callLog.leadName || "a new lead";
    const leadCompany = callLog.leadCompany || "their company";
    const leadBrief = callLog.leadBrief || "";
    const hasLeadPhone = Boolean(
      callLog.leadPhone && callLog.leadPhone.length >= 5
    );
    const gatherUrl = `${appUrl}/webhook/twilio/voice?stage=rep_gather&call_log_id=${callLogId}&attempt=${attempt}`;
    const nextAttemptUrl = `${appUrl}/webhook/twilio/voice?stage=rep_answer&call_log_id=${callLogId}&attempt=${attempt + 1}`;
    const giveUpUrl = `${appUrl}/webhook/twilio/voice?stage=rep_gather&call_log_id=${callLogId}&attempt=${attempt}&timeout=true`;

    const briefSegment = leadBrief
      ? ` <break time="400ms"/>Here are the details. <break time="250ms"/>${escapeXml(leadBrief)}`
      : "";
    const noPhoneNote = !hasLeadPhone
      ? ` <break time="300ms"/>Note: the lead's phone number is not available, so no call will be connected. This is an info-only briefing.`
      : "";

    let message: string;
    if (attempt === 1) {
      if (hasLeadPhone) {
        message = `<break time="300ms"/>Hi there. This is Mangia DC calling with a new lead. <break time="300ms"/>Press 1 at any time to accept the call, <break time="200ms"/>or press 2 to decline. <break time="400ms"/>${escapeXml(leadName)} from ${escapeXml(leadCompany)} is on the line.${briefSegment} <break time="500ms"/>Press 1 to accept, <break time="200ms"/>or press 2 to decline.`;
      } else {
        message = `<break time="300ms"/>Hi there. This is Mangia DC with a new lead notification.${noPhoneNote} <break time="400ms"/>${escapeXml(leadName)} from ${escapeXml(leadCompany)} has inquired.${briefSegment} <break time="500ms"/>Press 1 to acknowledge, <break time="200ms"/>or press 2 to skip.`;
      }
    } else if (hasLeadPhone) {
      message = `<break time="200ms"/>Are you still there? <break time="250ms"/>Press 1 to connect with ${escapeXml(leadName)}, <break time="200ms"/>or press 2 to decline.`;
    } else {
      message = `<break time="200ms"/>Are you still there? <break time="250ms"/>Press 1 to acknowledge the lead from ${escapeXml(leadName)}, <break time="200ms"/>or press 2 to skip.`;
    }

    const fallbackUrl = attempt >= MAX_ATTEMPTS ? giveUpUrl : nextAttemptUrl;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="8" action="${xmlAttr(gatherUrl)}" method="POST">
    ${humanSay(message)}
  </Gather>
  <Redirect method="POST">${xmlAttr(fallbackUrl)}</Redirect>
</Response>`;
    return { contentType: "text/xml", body: twiml };
  }

  if (stage === "rep_gather") {
    const digits = body.Digits || "";
    const timedOut = params.timeout === true;

    if (timedOut || !digits) {
      await db
        .update(callLogs)
        .set({
          status: "Rep Declined",
          errorMessage: "Rep did not press any key",
          endedAt: new Date(),
          updatedDate: new Date(),
        })
        .where(eq(callLogs.id, callLogId));
      await resetLeadIfCallInitiated(callLog.leadId);
      return {
        contentType: "text/xml",
        body: hangupTwiML("No input received. Goodbye."),
      };
    }

    if (digits === "2") {
      await db
        .update(callLogs)
        .set({
          status: "Rep Declined",
          endedAt: new Date(),
          updatedDate: new Date(),
        })
        .where(eq(callLogs.id, callLogId));
      await resetLeadIfCallInitiated(callLog.leadId);
      return {
        contentType: "text/xml",
        body: hangupTwiML("Call declined. Goodbye."),
      };
    }

    if (digits === "1") {
      const leadPhone = callLog.leadPhone;
      if (!leadPhone || leadPhone.length < 5) {
        await db
          .update(callLogs)
          .set({
            status: "Completed",
            errorMessage: "Info-only call — lead has no phone number on file",
            endedAt: new Date(),
            updatedDate: new Date(),
          })
          .where(eq(callLogs.id, callLogId));
        return {
          contentType: "text/xml",
          body: hangupTwiML(
            "Thank you for acknowledging. The lead does not have a phone number on file, so no call will be connected. Please follow up with them via email. Goodbye."
          ),
        };
      }

      const dialActionUrl = `${appUrl}/webhook/twilio/voice?stage=dial_complete&call_log_id=${callLogId}`;
      const recordingStatusUrl = `${appUrl}/webhook/twilio/voice?stage=recording&call_log_id=${callLogId}`;

      let callerIdAttr = "";
      try {
        const cfgs = await db
          .select()
          .from(automationConfig)
          .where(eq(automationConfig.key, "default"))
          .limit(1);
        if (cfgs[0]?.useRepCallerIdEnabled && callLog.repPhone) {
          callerIdAttr = ` callerId="${escapeXml(callLog.repPhone)}"`;
        }
      } catch {
        /* ignore */
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${humanSay('Great. Connecting you now. <break time="300ms"/>Please hold.')}
  <Dial timeout="35"${callerIdAttr} action="${xmlAttr(dialActionUrl)}" method="POST" record="record-from-answer-dual" recordingStatusCallback="${xmlAttr(recordingStatusUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed">
    <Number>${escapeXml(leadPhone)}</Number>
  </Dial>
</Response>`;
      return { contentType: "text/xml", body: twiml };
    }

    const reAttempt = (params.attempt || 1) + 1;
    if (reAttempt <= 5) {
      return {
        contentType: "text/xml",
        body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${xmlAttr(`${appUrl}/webhook/twilio/voice?stage=rep_answer&call_log_id=${callLogId}&attempt=${reAttempt}`)}</Redirect>
</Response>`,
      };
    }
    return {
      contentType: "text/xml",
      body: hangupTwiML("Sorry, I did not catch that. Goodbye."),
    };
  }

  if (stage === "rep_status") {
    const callStatus = body.CallStatus || "";

    if (["completed", "failed", "canceled"].includes(callStatus)) {
      const current = (
        await db.select().from(callLogs).where(eq(callLogs.id, callLogId)).limit(1)
      )[0];
      if (current && current.status === "In Progress" && !current.endedAt) {
        await db
          .update(callLogs)
          .set({
            status: "Failed",
            errorMessage: `Rep line dropped mid-call (Twilio reported ${callStatus})`,
            endedAt: new Date(),
            updatedDate: new Date(),
          })
          .where(eq(callLogs.id, callLogId));
        await resetLeadIfCallInitiated(current.leadId);
        return { contentType: "text/plain", body: "", status: 200 };
      }
    }

    if (["no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
      const current = (
        await db.select().from(callLogs).where(eq(callLogs.id, callLogId)).limit(1)
      )[0];
      if (
        current &&
        (current.status === "Initiated" || current.status === "Ringing")
      ) {
        const statusMap: Record<
          string,
          "No Answer" | "Busy" | "Failed"
        > = {
          "no-answer": "No Answer",
          busy: "Busy",
          failed: "Failed",
          canceled: "Failed",
        };

        // One auto-retry +1h — only if no prior CallLog for this lead
        // already had a retry scheduled/processed.
        let retryAt: Date | null = null;
        try {
          const priorForLead = await db
            .select()
            .from(callLogs)
            .where(eq(callLogs.leadId, current.leadId));
          const alreadyRetried = priorForLead.some(
            (p) =>
              p.id !== callLogId &&
              (p.scheduledRetryAt != null || p.retryProcessed === true)
          );
          if (!alreadyRetried) {
            retryAt = new Date(Date.now() + 60 * 60 * 1000);
          }
        } catch (err) {
          console.error(
            "[twimlCallbacks] retry-check failed:",
            err instanceof Error ? err.message : err
          );
        }

        await db
          .update(callLogs)
          .set({
            status: statusMap[callStatus],
            errorMessage: `Rep call ${callStatus}`,
            endedAt: new Date(),
            updatedDate: new Date(),
            ...(retryAt
              ? { scheduledRetryAt: retryAt, retryProcessed: false }
              : {}),
          })
          .where(eq(callLogs.id, callLogId));
        await resetLeadIfCallInitiated(current.leadId);
      }
    }

    return { contentType: "text/plain", body: "", status: 200 };
  }

  if (stage === "dial_complete") {
    const dialStatus = body.DialCallStatus || body.CallStatus || "";
    const status =
      dialStatus === "completed"
        ? "Completed"
        : dialStatus === "busy"
          ? "Busy"
          : dialStatus === "no-answer"
            ? "No Answer"
            : dialStatus === "failed"
              ? "Failed"
              : "Completed";

    await db
      .update(callLogs)
      .set({
        status,
        endedAt: new Date(),
        updatedDate: new Date(),
        errorMessage: dialStatus ? `Dial status: ${dialStatus}` : null,
      })
      .where(eq(callLogs.id, callLogId));

    if (status !== "Completed") {
      await resetLeadIfCallInitiated(callLog.leadId);
    }

    return {
      contentType: "text/xml",
      body: hangupTwiML("Call complete. Thank you. Goodbye."),
    };
  }

  if (stage === "recording") {
    const recordingUrl = body.RecordingUrl || "";
    if (recordingUrl) {
      await db
        .update(callLogs)
        .set({
          recordingUrl,
          updatedDate: new Date(),
        })
        .where(eq(callLogs.id, callLogId));
    }
    return { contentType: "text/plain", body: "", status: 200 };
  }

  return {
    contentType: "text/xml",
    body: hangupTwiML("Unknown call stage. Goodbye."),
  };
}
