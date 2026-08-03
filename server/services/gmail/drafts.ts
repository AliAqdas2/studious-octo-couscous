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

export interface CreateDraftInput {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
  userId?: string | null;
  userName?: string | null;
}

export async function createGmailDraft(input: CreateDraftInput) {
  const gmail = await getGmailApi();
  const message = [`To: ${input.to}`, `Subject: ${input.subject}`, "", input.body].join(
    "\n"
  );
  const encodedMessage = encodeRawMessage(message);

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw: encodedMessage },
    },
  });

  const draft = response.data;
  const draftId = draft.id || "";
  const db = requireDb();
  const now = new Date();

  await db.insert(activityLogs).values({
    entityType: "Email",
    entityId: input.leadId || randomUUID(),
    action: "Draft Created",
    details: { to: input.to, subject: input.subject, draftId },
    userId: input.userId || null,
    userName: input.userName || null,
    timestamp: now,
  });

  if (input.leadId) {
    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: input.leadId,
      action: "Email Activity",
      details: {
        to: input.to,
        subject: input.subject,
        direction: "Outbound (Draft)",
        template: input.subject,
      },
      userId: input.userId || null,
      userName: input.userName || null,
      timestamp: now,
    });

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
      const draftThreadId = draft.message?.threadId;
      if (!lead.gmailThreadId && draftThreadId) {
        updates.gmailThreadId = draftThreadId;
      }
      await db.update(leads).set(updates).where(eq(leads.id, input.leadId));
    }
  }

  return {
    success: true,
    draftId,
    draftUrl: `https://mail.google.com/mail/u/0/#drafts/${draftId}`,
  };
}
