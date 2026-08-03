import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getGmailApi } from "./gmailClient.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export async function logLeadEmailActivity(leadId: string) {
  if (!leadId) {
    throw new AppError("No leadId provided", 400);
  }

  const db = requireDb();
  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];

  if (!lead || !lead.email) {
    throw new AppError("Lead not found or no email", 404);
  }

  const gmail = await getGmailApi();
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `from:${lead.email} OR to:${lead.email}`,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  let newActivitiesCount = 0;

  const existingLogs = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.entityType, "Lead"),
        eq(activityLogs.entityId, leadId),
        eq(activityLogs.action, "Email Activity")
      )
    );

  const loggedIds = new Set(
    existingLogs
      .map((log) => {
        const details = log.details as { gmail_message_id?: string } | null;
        return details?.gmail_message_id;
      })
      .filter(Boolean)
  );

  for (const message of messages.slice(0, 20)) {
    if (!message.id || loggedIds.has(message.id)) continue;

    const messageRes = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });

    const messageData = messageRes.data;
    const headers = messageData.payload?.headers || [];
    const subject = headerValue(headers, "Subject") || "(No Subject)";
    const from = headerValue(headers, "From");
    const to = headerValue(headers, "To");
    const date = headerValue(headers, "Date");
    const direction = from.includes(lead.email)
      ? "Received from Lead"
      : "Sent to Lead";

    const timestamp = messageData.internalDate
      ? new Date(parseInt(messageData.internalDate, 10))
      : new Date();

    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: leadId,
      action: "Email Activity",
      details: {
        subject,
        from,
        to,
        date,
        direction,
        gmail_message_id: message.id,
        gmail_thread_id: messageData.threadId,
      },
      timestamp,
    });

    loggedIds.add(message.id);
    newActivitiesCount++;
  }

  return {
    success: true,
    leadId,
    totalEmails: messages.length,
    newActivities: newActivitiesCount,
  };
}
