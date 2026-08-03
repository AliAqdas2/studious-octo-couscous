import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { encodeRawMessage, getGmailApi } from "./gmailClient.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  /** When true, sends body as text/html (for digests, rich templates). */
  html?: boolean;
  leadId?: string;
  userId?: string | null;
  userName?: string | null;
}

export async function sendGmailEmail(input: SendEmailInput) {
  const gmail = await getGmailApi();
  const contentType = input.html
    ? 'text/html; charset="UTF-8"'
    : 'text/plain; charset="UTF-8"';
  const message = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "",
    input.body,
  ].join("\r\n");
  const encodedMessage = encodeRawMessage(message);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  const sentMessage = response.data;
  const messageId = sentMessage.id || "";
  const db = requireDb();
  const now = new Date();

  await db.insert(activityLogs).values({
    entityType: "Email",
    entityId: input.leadId || randomUUID(),
    action: "Email Sent",
    details: { to: input.to, subject: input.subject, messageId },
    userId: input.userId || null,
    userName: input.userName || null,
    timestamp: now,
  });

  if (input.leadId) {
    const leadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, input.leadId))
      .limit(1);
    const lead = leadRows[0];
    if (lead) {
      const updates: {
        lastContactDate: Date;
        gmailThreadId?: string;
        updatedDate: Date;
      } = {
        lastContactDate: now,
        updatedDate: now,
      };
      if (!lead.gmailThreadId && sentMessage.threadId) {
        updates.gmailThreadId = sentMessage.threadId;
      }
      await db.update(leads).set(updates).where(eq(leads.id, input.leadId));
    }
  }

  return {
    success: true,
    messageId,
    threadId: sentMessage.threadId || null,
  };
}
