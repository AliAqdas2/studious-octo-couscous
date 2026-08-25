import { env } from "../../config/env.js";
import { sendGmailEmail } from "../gmail/send.js";
import type { AuthUser } from "../auth/authService.js";

/** Deposit notify blast — Dave, Zach, Monica, Eileen (plan 02/03). Slack is not used. */
export const DEPOSIT_NOTIFY_DEFAULT_EMAILS = [
  "dave@mangiadc.com",
  "zach@mangiadc.com",
  "monica@mangiadc.com",
  "eileen@mangiadc.com",
] as const;

export function depositNotifyRecipients(): string[] {
  const raw = process.env.DEPOSIT_NOTIFY_EMAILS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
  }
  return [...DEPOSIT_NOTIFY_DEFAULT_EMAILS];
}

export interface DepositNotifyInput {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: Date;
  venue?: string | null;
  companyHint?: string | null;
  pocName?: string | null;
  pocEmail?: string | null;
  headcountMin?: number | null;
  headcountMax?: number | null;
  user?: AuthUser | null;
}

/**
 * Email blast on deposit intake complete. Failures are logged, not thrown
 * (intake must still succeed if Gmail is down).
 */
export async function sendDepositNotifyEmail(
  input: DepositNotifyInput
): Promise<{ sent: number; failed: number; recipients: string[] }> {
  const recipients = depositNotifyRecipients();
  const appUrl = env.appUrl().replace(/\/$/, "");
  const eventUrl = `${appUrl}/EventDetail?id=${encodeURIComponent(input.eventId)}`;
  const dateStr = input.eventDate.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const hc =
    input.headcountMin != null || input.headcountMax != null
      ? `${input.headcountMin ?? "?"}-${input.headcountMax ?? "?"}`
      : "TBD";

  const subject = `Deposit received — ${input.eventName} (${input.eventType})`;
  const body = [
    `A deposit intake was completed in Mangia CRM.`,
    "",
    `Event: ${input.eventName}`,
    `Type: ${input.eventType}`,
    `Date: ${dateStr}`,
    `Venue: ${input.venue || "TBD"}`,
    `Headcount: ${hc}`,
    `POC: ${input.pocName || "—"} <${input.pocEmail || "—"}>`,
    input.companyHint ? `Company: ${input.companyHint}` : null,
    "",
    `Open in CRM: ${eventUrl}`,
    "",
    "(Slack Sales Alert is not required — this email is the deposit notify.)",
  ]
    .filter((line) => line != null)
    .join("\n");

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await sendGmailEmail({
        to,
        subject,
        body,
        systemAlert: true,
        userId: input.user?.id || null,
        userName: input.user?.full_name
          ? `System (${input.user.full_name})`
          : "System (Deposit Notify)",
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        `[depositNotify] Failed to email ${to}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { sent, failed, recipients };
}
