import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { asciiEmailSubject, encodeRawMessage, getGmailApi } from "./gmailClient.js";
import { getBody, headerValue } from "./messages.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function gmailStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as {
    code?: number | string;
    response?: { status?: number };
    status?: number;
  };
  if (typeof e.code === "number") return e.code;
  if (typeof e.code === "string" && /^\d+$/.test(e.code)) {
    return parseInt(e.code, 10);
  }
  return e.response?.status ?? e.status;
}

export async function getDraftDetail(draftId: string) {
  if (!draftId) {
    throw new AppError("draftId is required", 400);
  }

  const gmail = await getGmailApi();
  let draft;
  try {
    const res = await gmail.users.drafts.get({
      userId: "me",
      id: draftId,
      format: "full",
    });
    draft = res.data;
  } catch (err) {
    if (gmailStatus(err) === 404) {
      throw new AppError("Draft not found. It may have been sent or deleted.", 404);
    }
    throw err;
  }

  const msg = draft.message || {};
  const headers = msg.payload?.headers || [];
  const bodyResult = getBody(msg.payload || {});

  return {
    success: true,
    email: {
      id: msg.id,
      draftId: draft.id,
      threadId: msg.threadId,
      subject: headerValue(headers, "Subject"),
      from: headerValue(headers, "From"),
      to: headerValue(headers, "To"),
      cc: headerValue(headers, "Cc"),
      date: headerValue(headers, "Date"),
      body: bodyResult.content,
      bodyMimeType: bodyResult.mimeType,
      snippet: msg.snippet || "",
    },
  };
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
  const message = [
    `To: ${input.to}`,
    `Subject: ${asciiEmailSubject(input.subject)}`,
    "",
    input.body,
  ].join("\n");
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
