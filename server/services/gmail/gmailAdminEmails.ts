import { AppError } from "../../lib/errors.js";

/** CRM login emails allowed to connect/disconnect the shared Gmail mailbox. */
export const GMAIL_ADMIN_EMAILS = [
  "aa03095276332@gmail.com",
  "info@mangiadc.com",
] as const;

export const GMAIL_DISCONNECT_PHRASE = "DISCONNECT GMAIL";

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function isGmailAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (GMAIL_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export function assertGmailAdmin(email: string | null | undefined): void {
  if (!isGmailAdminEmail(email)) {
    throw new AppError(
      "Only designated admins can manage the Gmail mailbox connection",
      403
    );
  }
}
