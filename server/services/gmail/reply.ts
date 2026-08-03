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

export interface ReplyEmailInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  messageId?: string;
  leadId?: string;
  action?: "send" | "draft" | string;
  userId?: string | null;
  userName?: string | null;
}

export async function replyToEmail(input: ReplyEmailInput) {
  const gmail = await getGmailApi();
  const messageParts = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `In-Reply-To: ${input.messageId || ""}`,
    `References: ${input.messageId || ""}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ];
  const encodedMessage = encodeRawMessage(messageParts.join("\r\n"));
  const db = requireDb();
  const now = new Date();
  const action = input.action || "send";

  if (action === "draft") {
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: input.threadId || undefined,
        },
      },
    });
    const result = response.data;
    const draftId = result.id || "";

    await db.insert(activityLogs).values({
      entityType: "Email",
      entityId: input.leadId || randomUUID(),
      action: "Reply Draft Created",
      details: { to: input.to, subject: input.subject, draftId },
      userId: input.userId || null,
      userName: input.userName || null,
      timestamp: now,
    });

    return {
      success: true,
      type: "draft",
      draftId,
      draftUrl: `https://mail.google.com/mail/u/0/#drafts/${result.message?.id || draftId}`,
    };
  }

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: input.threadId || undefined,
    },
  });
  const result = response.data;
  const messageId = result.id || "";

  await db.insert(activityLogs).values({
    entityType: "Email",
    entityId: input.leadId || randomUUID(),
    action: "Reply Sent",
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
      if (!lead.gmailThreadId && result.threadId) {
        updates.gmailThreadId = result.threadId;
      }
      await db.update(leads).set(updates).where(eq(leads.id, input.leadId));
    }
  }

  return {
    success: true,
    type: "sent",
    messageId,
    threadId: result.threadId || null,
  };
}
