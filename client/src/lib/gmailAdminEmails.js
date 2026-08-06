/** CRM login emails allowed to manage the shared Gmail mailbox (must match server). */
export const GMAIL_ADMIN_EMAILS = [
  "aa03095276332@gmail.com",
  "info@mangiadc.com",
];

export const GMAIL_DISCONNECT_PHRASE = "DISCONNECT GMAIL";

export function isGmailAdminEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return GMAIL_ADMIN_EMAILS.includes(normalized);
}
