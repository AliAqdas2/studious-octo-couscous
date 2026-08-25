import { and, desc, eq, ilike, or } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  emailTemplates,
  events,
  tasks,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { syncClientMetrics } from "../clients/syncClientMetrics.js";
import { createGmailDraft } from "../gmail/drafts.js";
import { sendGmailEmail } from "../gmail/send.js";
import { getEventOpsFeatures } from "./eventOpsSettings.js";
import { experienceDisplayName } from "./experienceName.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  try {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(date);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function replaceVariables(
  text: string,
  event: typeof events.$inferSelect
): string {
  if (!text) return "";
  const experience = experienceDisplayName(event.eventType);
  const pe = asRecord(event.postEvent);
  const photoLink =
    typeof pe.photoDownloadUrl === "string" ? pe.photoDownloadUrl : "";
  return text
    .replace(/\{\{name\}\}/gi, event.pocName || "there")
    .replace(/\{\{company\}\}/gi, event.venue || event.pocName || "")
    .replace(/\{\{event_type\}\}/gi, experience)
    .replace(/\{\{experience_name\}\}/gi, experience)
    .replace(/\{\{preferred_date\}\}/gi, formatDate(event.eventDate))
    .replace(/\{\{photo_link\}\}/gi, photoLink)
    .replace(/paint and sip/gi, experience)
    .replace(/Paint & Sip/gi, experience);
}

const POST_EVENT_FOLLOWUPS = [
  {
    title: "Upload Event Photos",
    description: "Upload event photos to Google Drive and share with client",
    responsibleRole: "Ops" as const,
    daysAfter: 2,
  },
  {
    title: "Send Newsletter Subscription",
    description: "Send newsletter subscription request",
    responsibleRole: "Admin" as const,
    daysAfter: 3,
  },
  {
    title: "Request Testimonial",
    description: "Request testimonial and LinkedIn connection",
    responsibleRole: "Sales" as const,
    daysAfter: 7,
  },
  {
    title: "3-Month Follow-Up",
    description: "Send CEO thank you and t-shirt offer",
    responsibleRole: "Admin" as const,
    daysAfter: 90,
  },
];

/**
 * Runs when an event first transitions to Completed.
 * Thank-you Gmail draft (not auto-sent) + optional legacy follow-ups,
 * client metrics sync. Cooking DB workflows already seed C106–C118.
 */
export async function postEventAutomation(
  event: typeof events.$inferSelect
): Promise<{ success: boolean; tasksCreated: number; skipped?: string }> {
  if (!event?.id) {
    return { success: false, tasksCreated: 0, skipped: "no_event" };
  }

  const db = requireDb();
  let tasksCreated = 0;
  const { features } = await getEventOpsFeatures();
  const pe = asRecord(event.postEvent);
  const thankYouVariant =
    pe.thankYouVariant === "v1" || pe.thankYouVariant === "v2"
      ? pe.thankYouVariant
      : null;

  if (features.thankYouAutoDraft && event.pocEmail) {
    try {
      const templates = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.isActive, true),
            or(
              ilike(emailTemplates.templateName, "%Thank You%"),
              eq(emailTemplates.category, "Post-Event")
            )
          )
        )
        .orderBy(desc(emailTemplates.sendAutomatically));

      let preferred = templates[0];
      if (thankYouVariant === "v2") {
        preferred =
          templates.find((t) =>
            /v2|highly positive|positive/i.test(t.templateName || "")
          ) || preferred;
      } else if (thankYouVariant === "v1") {
        preferred =
          templates.find((t) =>
            /v1|general|without consumption/i.test(t.templateName || "")
          ) ||
          templates.find((t) =>
            /without consumption/i.test(t.templateName || "")
          ) ||
          preferred;
      } else {
        preferred =
          templates.find((t) =>
            /without consumption/i.test(t.templateName || "")
          ) ||
          templates.find((t) => /thank you/i.test(t.templateName || "")) ||
          preferred;
      }

      if (preferred) {
        const subject = replaceVariables(preferred.subject || "", event);
        const body = replaceVariables(preferred.body || "", event);
        const draft = await createGmailDraft({
          to: event.pocEmail,
          subject,
          body,
          userName: "System (Post-Event)",
        });
        const draftId =
          draft && typeof draft === "object" && "draftId" in draft
            ? String((draft as { draftId?: string }).draftId || "")
            : "";

        await db.insert(activityLogs).values({
          entityType: "Event",
          entityId: event.id,
          action: "Post-Event Thank You Draft Created",
          details: {
            draft_id: draftId,
            to: event.pocEmail,
            template_name: preferred.templateName,
            subject,
            thank_you_variant: thankYouVariant,
            experience_name: experienceDisplayName(event.eventType),
          },
          userName: "Post-Event System",
          timestamp: new Date(),
        });

        const digestTo = env.digestRecipients()[0];
        if (digestTo) {
          try {
            await sendGmailEmail({
              to: digestTo,
              subject: `Draft ready for review - thank-you for ${event.eventName}`,
              body: [
                "A post-event thank-you email has been added to Drafts in Gmail and is awaiting review.",
                "",
                `Event: ${event.eventName}`,
                `Experience: ${experienceDisplayName(event.eventType)}`,
                `POC: ${event.pocName || "(no name)"} <${event.pocEmail}>`,
                `Template: ${preferred.templateName}`,
                thankYouVariant ? `Variant: ${thankYouVariant}` : "",
                draftId ? `Draft ID: ${draftId}` : "",
                "",
                "Open Gmail → Drafts to review and send.",
              ]
                .filter(Boolean)
                .join("\n"),
              userName: "System (Post-Event)",
              systemAlert: true,
            });
          } catch (notifyErr) {
            console.warn(
              "[postEventAutomation] digest notify failed:",
              notifyErr instanceof Error ? notifyErr.message : notifyErr
            );
          }
        } else {
          console.warn(
            "[postEventAutomation] No DIGEST_RECIPIENTS configured — skip notify"
          );
        }
      }
    } catch (err) {
      console.warn(
        "[postEventAutomation] thank-you draft failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const useLegacy =
    features.legacyPostEventFollowups && !event.workflowTemplateId;

  if (useLegacy) {
    const eventDate = event.eventDate ? new Date(event.eventDate) : new Date();
    for (const task of POST_EVENT_FOLLOWUPS) {
      const dueDate = new Date(eventDate);
      dueDate.setDate(dueDate.getDate() + task.daysAfter);
      try {
        await db.insert(tasks).values({
          eventId: event.id,
          title: task.title,
          description: task.description,
          category: "Post-Event",
          responsibleRole: task.responsibleRole,
          dueDate,
          status: "Not Acknowledged",
        });
        tasksCreated++;
      } catch (err) {
        console.warn(
          "[postEventAutomation] task create failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  if (event.clientId) {
    try {
      await syncClientMetrics(event.clientId);
    } catch (err) {
      console.warn(
        "[postEventAutomation] syncClientMetrics failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return { success: true, tasksCreated };
}
