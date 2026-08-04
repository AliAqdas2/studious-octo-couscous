import { AppError } from "../../lib/errors.js";
import { getGmailApi } from "./gmailClient.js";

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export interface SyncedEmailMeta {
  id: string;
  threadId: string | null;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string;
}

/**
 * List Gmail messages for a lead email (from: OR to:), metadata only.
 * Used by the Emails page — does not write activity logs.
 */
export async function syncGmailEmails(leadEmail: string): Promise<{
  emails: SyncedEmailMeta[];
  count: number;
}> {
  const email = (leadEmail || "").trim();
  if (!email) {
    throw new AppError("leadEmail is required", 400);
  }

  const gmail = await getGmailApi();
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `from:${email} OR to:${email}`,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  const emails: SyncedEmailMeta[] = [];

  for (const message of messages) {
    if (!message.id) continue;
    const messageRes = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });
    const messageData = messageRes.data;
    const headers = messageData.payload?.headers || [];
    emails.push({
      id: message.id,
      threadId: messageData.threadId || null,
      subject: headerValue(headers, "Subject") || "(No Subject)",
      from: headerValue(headers, "From"),
      to: headerValue(headers, "To"),
      snippet: messageData.snippet || "",
      date: headerValue(headers, "Date"),
    });
  }

  return { emails, count: emails.length };
}
