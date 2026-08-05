import { desc, eq, sql } from "drizzle-orm";
import { inspect } from "node:util";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  gmailPollState,
  leads,
  processedGmailMessages,
  spamEmails,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import {
  buildClassifyInboundEmailPrompt,
  CLIENT_TYPE_ENUM,
  classifyInboundEmailSchema,
  EVENT_FORMAT_ENUM,
  EVENT_TYPE_INTEREST_OPTIONS,
  INQUIRY_TYPE_ENUM,
  isValidClassifyResult,
  type CandidateLeadForPrompt,
  type ClassifyInboundEmailLlmResult,
} from "../ai/prompts/classifyInboundEmail.js";
import { getGmailApi } from "./gmailClient.js";
import {
  decodeGmailBody,
  detectBulkMailHeaders,
  detectSpamKeywords,
  extractDomain,
  GENERIC_DOMAINS,
  getHeader,
  getRootDomain,
  parseSenderEmail,
  parseSenderEmailRaw,
  shouldSilentlySkip,
} from "./inboundFilters.js";
import { scheduleOnLeadCreated } from "../leads/onLeadCreated.js";
import { detectReturningClient } from "../leads/detectReturningClient.js";
import {
  enrichLeadOnCreate,
  logAutoClassification,
} from "../leads/enrichLeadOnCreate.js";
import {
  clearRetry,
  isPermanentIntakeError,
  isTerminalProcessedStatus,
  scheduleIntakeRetry,
  MAX_INTAKE_RETRIES,
} from "./intakeRetry.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const INTAKE_LOG = "[email-intake]";

function intakeLog(...args: unknown[]): void {
  console.log(INTAKE_LOG, ...args);
}

function intakeDump(label: string, value: unknown): void {
  const text =
    typeof value === "string"
      ? value
      : inspect(value, {
          depth: 10,
          colors: false,
          maxArrayLength: 100,
          maxStringLength: 50_000,
          breakLength: 120,
        });
  console.log(`${INTAKE_LOG} ${label}\n${text}`);
}

export type ProcessedSource = "webhook" | "poller";
export type ProcessedStatus = "lead" | "spam" | "ignored" | "failed";

export interface MessageResult {
  messageId: string;
  from?: string;
  subject?: string;
  outcome: string;
  reason?: string;
  lead_id?: string;
  name?: string;
  email?: string;
  ai_flag_category?: string;
  ai_flag_reason?: string;
  source?: string;
}

export interface HandleContactFormEmailResult {
  ok: true;
  created: number;
  spam: number;
  skipped: number;
  results: MessageResult[];
}

async function markWebhookHealth(): Promise<void> {
  try {
    const db = requireDb();
    const now = new Date();
    const rows = await db
      .select()
      .from(gmailPollState)
      .where(eq(gmailPollState.key, "default"))
      .limit(1);
    if (rows[0]) {
      await db
        .update(gmailPollState)
        .set({ lastWebhookReceivedAt: now, updatedDate: now })
        .where(eq(gmailPollState.id, rows[0].id));
    } else {
      await db.insert(gmailPollState).values({
        key: "default",
        lastWebhookReceivedAt: now,
      });
    }
  } catch (e) {
    console.warn(
      "[email-intake] markWebhookHealth failed:",
      e instanceof Error ? e.message : e
    );
  }
}

async function recordProcessed(
  gmailMessageId: string,
  status: ProcessedStatus,
  source: ProcessedSource
): Promise<void> {
  try {
    const db = requireDb();
    await db.insert(processedGmailMessages).values({
      gmailMessageId,
      processedAt: new Date(),
      source,
      status,
    });
    if (status !== "failed") {
      await clearRetry(gmailMessageId);
    }
    // Only a real lead proves AI intake recovered — do not clear on
    // ignored/spam (silent skips would unlock another alert email).
    if (status === "lead") {
      try {
        const poll = await getPollState();
        if (poll?.deadLetterAlertSentAt || poll?.lastDeadLetterError) {
          await upsertPollState({
            deadLetterAlertSentAt: null,
            lastDeadLetterError: null,
          });
        }
      } catch (clearErr) {
        console.warn(
          `[email-intake] clear dead-letter alert stamp failed:`,
          clearErr instanceof Error ? clearErr.message : clearErr
        );
      }
    }
  } catch (e) {
    console.warn(
      `[email-intake] recordProcessed(${gmailMessageId}, ${status}) failed:`,
      e instanceof Error ? e.message : e
    );
  }
}

async function appendToExistingLead(
  lead: typeof leads.$inferSelect,
  params: {
    from: string;
    subject: string;
    emailBody: string;
    messageId: string;
    threadId: string | null | undefined;
    reasonTag: string;
  }
): Promise<void> {
  const db = requireDb();
  const now = new Date();
  try {
    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: lead.id,
      action: "Inbound Email Received (Follow-up)",
      details: {
        from: params.from,
        subject: params.subject,
        body_snippet: (params.emailBody || "").substring(0, 2000),
        gmail_message_id: params.messageId,
        gmail_thread_id: params.threadId,
        match_reason: params.reasonTag,
      },
      userName: "System (Email Intake)",
      timestamp: now,
    });
  } catch (e) {
    console.warn(
      `[email-intake] append activity log failed for lead ${lead.id}:`,
      e instanceof Error ? e.message : e
    );
  }
  try {
    await db
      .update(leads)
      .set({ lastContactDate: now, updatedDate: now })
      .where(eq(leads.id, lead.id));
  } catch (e) {
    console.warn(
      `[email-intake] last_contact_date update failed for lead ${lead.id}:`,
      e instanceof Error ? e.message : e
    );
  }
}

async function createSpamRow(params: {
  from: string;
  senderEmail: string;
  subject: string;
  body: string;
  pageUrl?: string;
  messageId: string;
  threadId?: string | null;
  spamCategory:
    | "Sales Pitch"
    | "SEO/Marketing"
    | "Web Design"
    | "Promotion"
    | "Gibberish"
    | "Other";
  spamReason: string;
  action: string;
  details?: Record<string, unknown>;
}): Promise<string | null> {
  const db = requireDb();
  try {
    const [spamRow] = await db
      .insert(spamEmails)
      .values({
        from: params.from,
        senderEmail: params.senderEmail,
        subject: params.subject || "(no subject)",
        body: params.body.substring(0, 5000),
        pageUrl: params.pageUrl || "",
        gmailMessageId: params.messageId,
        gmailThreadId: params.threadId || null,
        spamCategory: params.spamCategory,
        spamReason: params.spamReason,
        receivedAt: new Date(),
      })
      .returning();

    await db.insert(activityLogs).values({
      entityType: "Email",
      entityId: spamRow.id,
      action: params.action,
      details: {
        from: params.from,
        subject: params.subject,
        gmail_message_id: params.messageId,
        spam_email_id: spamRow.id,
        ...(params.details || {}),
      },
      userName: "System (Email Intake)",
      timestamp: new Date(),
    });

    return spamRow.id;
  } catch (e) {
    console.error(
      "[email-intake] Failed to save SpamEmail:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

function toCandidate(lead: typeof leads.$inferSelect): CandidateLeadForPrompt {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    stage: lead.stage,
    eventTypeInterest: lead.eventTypeInterest,
    eventFormat: lead.eventFormat,
    preferredDate: lead.preferredDate,
    headcountEstimate: lead.headcountEstimate,
    inquiryType: lead.inquiryType,
    notes: lead.notes,
  };
}

export async function handleContactFormEmail(input: {
  messageIds: string[];
  source?: ProcessedSource;
  markWebhook?: boolean;
  isRetry?: boolean;
}): Promise<HandleContactFormEmailResult> {
  const source: ProcessedSource = input.source || "webhook";
  const messageIds = input.messageIds || [];

  intakeLog("========== handleContactFormEmail START ==========");
  intakeDump("input", {
    source,
    markWebhook: input.markWebhook,
    isRetry: input.isRetry ?? false,
    messageIds,
    messageCount: messageIds.length,
  });

  if (input.markWebhook !== false && source === "webhook") {
    await markWebhookHealth();
    intakeLog("markWebhookHealth: lastWebhookReceivedAt updated");
  }

  if (messageIds.length === 0) {
    intakeLog("No messageIds — returning empty result");
    return { ok: true, created: 0, spam: 0, skipped: 0, results: [] };
  }

  // Meeting-confirmation fan-out intentionally skipped (not ported yet).

  const db = requireDb();
  const gmail = await getGmailApi();
  intakeLog("Gmail API client ready");

  let createdCount = 0;
  let skippedCount = 0;
  let spamCount = 0;
  const results: MessageResult[] = [];

  for (const messageId of messageIds) {
    intakeLog(`----- message ${messageId} -----`);
    try {
      const already = await db
        .select()
        .from(processedGmailMessages)
        .where(eq(processedGmailMessages.gmailMessageId, messageId))
        .limit(1);
      if (already[0]) {
        if (isTerminalProcessedStatus(already[0].status)) {
          intakeDump("already processed row", already[0]);
          skippedCount++;
          results.push({
            messageId,
            outcome: "already-processed",
            reason: `Previously processed as "${already[0].status}"`,
          });
          continue;
        }
      }

      let message;
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });
        message = res.data;
        intakeDump("gmail.users.messages.get (metadata)", {
          id: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds,
          snippet: message.snippet,
          internalDate: message.internalDate,
          sizeEstimate: message.sizeEstimate,
          payloadMimeType: message.payload?.mimeType,
          payloadPartCount: message.payload?.parts?.length,
        });
      } catch (fetchErr) {
        console.warn(
          `[email-intake] Failed to fetch ${messageId}:`,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        intakeDump("gmail fetch error", fetchErr);
        const statusCode =
          fetchErr &&
          typeof fetchErr === "object" &&
          "code" in fetchErr
            ? Number((fetchErr as { code: unknown }).code)
            : null;
        const retryResult = await scheduleIntakeRetry({
          messageId,
          source,
          error: fetchErr,
          immediateDeadLetter:
            statusCode === 404 || isPermanentIntakeError(fetchErr),
        });
        skippedCount++;
        results.push({
          messageId,
          outcome: retryResult.deadLetter ? "dead-letter" : "retry-scheduled",
          reason: retryResult.deadLetter
            ? "Gmail message not found — moved to dead-letter"
            : "Gmail fetch failed — scheduled for retry",
        });
        continue;
      }

      const headers = message.payload?.headers || [];
      const from = getHeader(headers, "From");
      const subject = getHeader(headers, "Subject");
      const threadId = message.threadId || null;
      const senderEmail = parseSenderEmail(from);
      const senderEmailRaw = parseSenderEmailRaw(from);
      const emailBody =
        decodeGmailBody(message.payload || null) || message.snippet || "";

      intakeDump("parsed headers (all)", headers);
      intakeDump("parsed envelope", {
        from,
        subject,
        threadId,
        senderEmail,
        senderEmailRaw,
        to: getHeader(headers, "To"),
        cc: getHeader(headers, "Cc"),
        date: getHeader(headers, "Date"),
        messageIdHeader: getHeader(headers, "Message-ID"),
        bodyLength: emailBody.length,
      });
      intakeDump("FULL email body", emailBody);

      const isWebsiteForm = senderEmail === "itsupport@mangiadc.com";
      intakeLog(`isWebsiteForm=${isWebsiteForm}`);

      if (isWebsiteForm) {
        if (
          !/Someone wants to connect with you via your website/i.test(
            emailBody
          ) &&
          !/Page URL:/i.test(emailBody)
        ) {
          await recordProcessed(messageId, "ignored", source);
          skippedCount++;
          results.push({
            messageId,
            from,
            subject,
            outcome: "skipped",
            reason: "Contact-form pattern not matched",
          });
          intakeLog("SKIP: contact-form pattern not matched");
          continue;
        }
      }

      if (!isWebsiteForm) {
        const silentSkip = shouldSilentlySkip(headers, senderEmail);
        if (silentSkip.skip) {
          await recordProcessed(messageId, "ignored", source);
          skippedCount++;
          results.push({
            messageId,
            from,
            subject,
            outcome: "silent-skip",
            reason: silentSkip.reason,
          });
          intakeLog(`SKIP silent: ${silentSkip.reason}`);
          continue;
        }

        const toHeader = (getHeader(headers, "To") || "").toLowerCase();
        const ccHeader = (getHeader(headers, "Cc") || "").toLowerCase();
        const mangiaInTo = toHeader.includes("@mangiadc.com");
        const mangiaInCc = ccHeader.includes("@mangiadc.com");
        intakeLog(`To/Cc check mangiaInTo=${mangiaInTo} mangiaInCc=${mangiaInCc}`);
        if (!mangiaInTo && mangiaInCc) {
          await createSpamRow({
            from,
            senderEmail,
            subject,
            body: emailBody,
            messageId,
            threadId,
            spamCategory: "Other",
            spamReason:
              "Mangia DC was only CCed, not in To field — not a direct customer inquiry",
            action: "Routed to Spam (CC-Only)",
            details: {
              ai_category: "Vendor/CC-Only",
              ai_reason:
                "All @mangiadc.com recipients in CC — not a customer inquiry",
            },
          });
          await recordProcessed(messageId, "spam", source);
          spamCount++;
          results.push({
            messageId,
            from,
            subject,
            outcome: "spam",
            reason: "CC-only — Mangia not in To field",
          });
          continue;
        }

        if (threadId) {
          const existingByThread = await db
            .select()
            .from(leads)
            .where(eq(leads.gmailThreadId, threadId))
            .limit(1);
          if (existingByThread[0]) {
            await appendToExistingLead(existingByThread[0], {
              from,
              subject,
              emailBody,
              messageId,
              threadId,
              reasonTag: "same_gmail_thread",
            });
            await recordProcessed(messageId, "ignored", source);
            skippedCount++;
            results.push({
              messageId,
              from,
              subject,
              outcome: "appended-to-lead",
              reason: `Same thread as lead ${existingByThread[0].id}`,
              lead_id: existingByThread[0].id,
            });
            continue;
          }
        }
      }

      let openLeadForSender: typeof leads.$inferSelect | null = null;
      let nameMatchedLeads: (typeof leads.$inferSelect)[] = [];
      let companyMatchedLeads: (typeof leads.$inferSelect)[] = [];
      let allCandidateLeads: (typeof leads.$inferSelect)[] = [];
      let domainMatchedLeads: (typeof leads.$inferSelect)[] = [];

      if (!isWebsiteForm && senderEmail) {
        const senderDisplayName = from
          .replace(/<[^>]+>/, "")
          .trim()
          .toLowerCase();

        const byEmail = await db
          .select()
          .from(leads)
          .where(sql`lower(${leads.email}) = ${senderEmail}`)
          .orderBy(desc(leads.createdDate))
          .limit(1);
        openLeadForSender = byEmail[0] || null;

        if (!openLeadForSender && senderEmailRaw !== senderEmail) {
          const byRaw = await db
            .select()
            .from(leads)
            .where(eq(leads.email, senderEmailRaw))
            .orderBy(desc(leads.createdDate))
            .limit(1);
          openLeadForSender = byRaw[0] || null;
        }

        const recentLeads = await db
          .select()
          .from(leads)
          .orderBy(desc(leads.createdDate))
          .limit(200);

        if (!openLeadForSender && senderDisplayName.length > 1) {
          nameMatchedLeads = recentLeads
            .filter((l) => {
              const leadName = (l.name || "").toLowerCase().trim();
              return (
                leadName &&
                (leadName.includes(senderDisplayName) ||
                  senderDisplayName.includes(leadName))
              );
            })
            .slice(0, 3);
          if (nameMatchedLeads[0]) openLeadForSender = nameMatchedLeads[0];
        }

        if (!openLeadForSender) {
          const haystack =
            `${subject || ""} ${emailBody.substring(0, 3000)}`.toLowerCase();
          companyMatchedLeads = recentLeads
            .filter((l) => {
              const company = (l.company || "").toLowerCase().trim();
              return company.length > 2 && haystack.includes(company);
            })
            .slice(0, 3);
          if (companyMatchedLeads[0]) openLeadForSender = companyMatchedLeads[0];
        }

        const candidateIds = new Set<string>();
        const addCandidate = (lead: typeof leads.$inferSelect | null) => {
          if (lead && !candidateIds.has(lead.id)) {
            candidateIds.add(lead.id);
            allCandidateLeads.push(lead);
          }
        };
        addCandidate(openLeadForSender);
        nameMatchedLeads.forEach(addCandidate);
        companyMatchedLeads.forEach(addCandidate);

        const senderDomain = extractDomain(senderEmail);
        const senderRootDomain = getRootDomain(senderDomain);
        if (senderDomain && !GENERIC_DOMAINS.has(senderDomain)) {
          domainMatchedLeads = recentLeads
            .filter((l) => {
              const leadDomain = extractDomain(l.email);
              const leadRootDomain = getRootDomain(leadDomain);
              return (
                leadDomain === senderDomain ||
                leadRootDomain === senderRootDomain ||
                leadDomain === senderRootDomain ||
                leadRootDomain === senderDomain
              );
            })
            .filter((l) => !candidateIds.has(l.id))
            .slice(0, 5);
          domainMatchedLeads.forEach(addCandidate);
        }
      }

      let namePart = "";
      const nameLineMatch = emailBody.match(/^\s*Name:\s*(.+)$/im);
      if (nameLineMatch) {
        namePart = nameLineMatch[1].trim().toLowerCase();
      } else {
        namePart = from.replace(/<[^>]+>/, "").trim().toLowerCase();
      }

      if (!isWebsiteForm) {
        const bulkCheck = detectBulkMailHeaders(headers);
        if (bulkCheck.isBulk) {
          await createSpamRow({
            from,
            senderEmail,
            subject,
            body: emailBody,
            messageId,
            threadId,
            spamCategory: "Promotion",
            spamReason: bulkCheck.matched || "Bulk mail",
            action: "Routed to Spam (Promotion)",
            details: {
              ai_category: "Promotional Newsletter",
              ai_reason: bulkCheck.matched,
            },
          });
          await recordProcessed(messageId, "spam", source);
          spamCount++;
          results.push({
            messageId,
            from,
            subject,
            outcome: "spam",
            reason: bulkCheck.matched,
          });
          continue;
        }
      }

      const spamCheck = detectSpamKeywords(subject, emailBody, namePart);
      if (spamCheck.isSpam) {
        const pageUrlMatch = emailBody.match(/Page URL:\s*(\S+)/i);
        await createSpamRow({
          from,
          senderEmail,
          subject,
          body: emailBody,
          pageUrl: pageUrlMatch ? pageUrlMatch[1] : "",
          messageId,
          threadId,
          spamCategory:
            spamCheck.matched?.startsWith("Bot name") ||
            spamCheck.matched === "url= injection"
              ? "Promotion"
              : "Sales Pitch",
          spamReason: spamCheck.matched || "Spam keyword",
          action: "Routed to Spam (Sales Pitch)",
        });
        await recordProcessed(messageId, "spam", source);
        spamCount++;
        results.push({
          messageId,
          from,
          subject,
          outcome: "spam",
          reason: spamCheck.matched,
        });
        continue;
      }

      if (!isAiConfigured()) {
        throw new AppError(
          "AI is not configured. Set ANTHROPIC_API_KEY to classify inbound email.",
          503
        );
      }

      const { system, user } = buildClassifyInboundEmailPrompt({
        isWebsiteForm,
        subject,
        from,
        emailBody,
        candidates: allCandidateLeads.map(toCandidate),
      });

      const ai = getAiProvider();
      intakeLog("Calling LLM structuredComplete (classify_inbound_email)...");
      intakeDump("LLM prompt user (truncated)", user.substring(0, 8000));
      const completion = await ai.structuredComplete<ClassifyInboundEmailLlmResult>({
        system,
        user,
        jsonSchema: classifyInboundEmailSchema,
        schemaName: "classify_inbound_email",
        temperature: 0,
      });

      const rawLlmResult = completion.data;
      intakeDump("LLM FULL raw result", rawLlmResult);
      intakeDump("LLM completion meta", {
        model: (completion as { model?: string }).model,
        usage: (completion as { usage?: unknown }).usage,
      });
      if (!isValidClassifyResult(rawLlmResult)) {
        throw new Error(
          `Malformed LLM response: ${JSON.stringify(rawLlmResult)?.substring(0, 300)}`
        );
      }

      const aiCategory =
        rawLlmResult.category === "Valid" ? "" : rawLlmResult.category || "";
      const aiReason = rawLlmResult.reason || "";
      const senderRole = rawLlmResult.sender_role || "other";
      const llmBusinessPotential = rawLlmResult.business_potential === "Yes";
      const hasBusinessPotential =
        senderRole === "promoter_or_vendor" ? false : llmBusinessPotential;
      const llmSaysNewLead = rawLlmResult.new_lead === true;
      intakeDump("LLM decision flags", {
        aiCategory,
        aiReason,
        senderRole,
        llmBusinessPotential,
        hasBusinessPotential,
        llmSaysNewLead,
        candidateCount: allCandidateLeads.length,
      });

      if (
        hasBusinessPotential &&
        allCandidateLeads.length > 0 &&
        !llmSaysNewLead
      ) {
        const bestMatch =
          openLeadForSender ||
          domainMatchedLeads[0] ||
          allCandidateLeads[0];
        await appendToExistingLead(bestMatch, {
          from,
          subject,
          emailBody,
          messageId,
          threadId,
          reasonTag: "llm_continuation_of_existing_lead",
        });
        await recordProcessed(messageId, "ignored", source);
        skippedCount++;
        results.push({
          messageId,
          from,
          subject,
          outcome: "appended-to-lead",
          reason: `LLM judged continuation of existing lead ${bestMatch.id}: ${aiReason}`,
          lead_id: bestMatch.id,
        });
        continue;
      }

      if (!hasBusinessPotential) {
        const pageUrlMatch = emailBody.match(/Page URL:\s*(\S+)/i);
        const spamCategoryMap: Record<
          string,
          "Promotion" | "Other"
        > = {
          "Job Application": "Other",
          "Hiring-Related": "Other",
          "Possible Spam": "Promotion",
          "Unrelated Inquiry": "Other",
          Other: "Other",
        };
        const spamCategory =
          senderRole === "promoter_or_vendor"
            ? "Promotion"
            : spamCategoryMap[rawLlmResult.category] || "Other";
        await createSpamRow({
          from,
          senderEmail,
          subject,
          body: emailBody,
          pageUrl: pageUrlMatch ? pageUrlMatch[1] : "",
          messageId,
          threadId,
          spamCategory,
          spamReason: `[${rawLlmResult.category} | role=${senderRole}] ${aiReason}`,
          action: `Routed to Spam (${spamCategory})`,
          details: {
            ai_category: rawLlmResult.category,
            sender_role: senderRole,
            ai_reason: aiReason,
          },
        });
        await recordProcessed(messageId, "spam", source);
        spamCount++;
        results.push({
          messageId,
          from,
          subject,
          outcome: "routed to spam",
          reason: `${rawLlmResult.category} (role=${senderRole}): ${aiReason}`,
        });
        continue;
      }

      const extractedEmail = (
        rawLlmResult.email ||
        senderEmail ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!extractedEmail) {
        await recordProcessed(messageId, "ignored", source);
        skippedCount++;
        results.push({
          messageId,
          from,
          subject,
          outcome: "skipped",
          reason: "No email address extractable",
        });
        continue;
      }

      const extractedName =
        (rawLlmResult.name || "").trim() ||
        from.replace(/<[^>]+>/, "").trim() ||
        extractedEmail.split("@")[0];

      const rawInterests = (rawLlmResult.event_type_interest || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const validInterests = rawInterests.filter((v) =>
        (EVENT_TYPE_INTEREST_OPTIONS as readonly string[]).includes(v)
      );
      const eventTypeInterest =
        validInterests.length > 0
          ? validInterests.join(", ")
          : rawInterests.length > 0
            ? "Other"
            : "";

      const companyName = (rawLlmResult.company || "").trim();
      const notesParts = isWebsiteForm
        ? [
            "Source: Website Contact Form",
            rawLlmResult.page_url
              ? `Page URL: ${rawLlmResult.page_url}`
              : null,
            `Form Subject: ${subject}`,
            "",
            "Message:",
            emailBody || "(no message)",
          ]
        : [
            "Source: Direct Email",
            `Subject: ${subject}`,
            `From: ${from}`,
            "",
            "Message:",
            emailBody.substring(0, 2000),
          ];

      const inquiryType = (INQUIRY_TYPE_ENUM as readonly string[]).includes(
        rawLlmResult.inquiry_type || ""
      )
        ? (rawLlmResult.inquiry_type as
            | "Estimate"
            | "General"
            | "Corporate Program"
            | "Unknown")
        : "Unknown";
      const clientType = (CLIENT_TYPE_ENUM as readonly string[]).includes(
        rawLlmResult.client_type || ""
      )
        ? (rawLlmResult.client_type as "New" | "Previous" | "Referral")
        : "New";
      const eventFormat = (EVENT_FORMAT_ENUM as readonly string[]).includes(
        rawLlmResult.event_format || ""
      )
        ? (rawLlmResult.event_format as "In-Person" | "Virtual" | "Hybrid")
        : null;

      let preferredDate: Date | null = null;
      if (rawLlmResult.preferred_date) {
        const parsed = new Date(rawLlmResult.preferred_date);
        if (!isNaN(parsed.getTime())) preferredDate = parsed;
      }

      const aiFlagCategory =
        aiCategory === "Job Application" ||
        aiCategory === "Hiring-Related" ||
        aiCategory === "Unrelated Inquiry" ||
        aiCategory === "Possible Spam" ||
        aiCategory === "Other"
          ? aiCategory
          : "";

      const notes = notesParts.filter(Boolean).join("\n");
      // Domain/company rules are server source of truth (override LLM channel)
      const enrich = await enrichLeadOnCreate({
        email: extractedEmail,
        company: companyName || null,
        inquiryType,
        notes,
        eventTypeInterest: eventTypeInterest || null,
        stage: "New Inquiry",
        source: isWebsiteForm ? "Website" : "Email",
      });

      const [newLead] = await db
        .insert(leads)
        .values({
          name: extractedName,
          email: extractedEmail,
          phone: rawLlmResult.phone || "",
          ...(companyName ? { company: companyName } : {}),
          source: isWebsiteForm ? "Website" : "Email",
          reviewed: false,
          channel: enrich.channel,
          inquiryType,
          clientType,
          eventTypeInterest: eventTypeInterest || null,
          eventFormat,
          preferredDate,
          headcountEstimate:
            typeof rawLlmResult.headcount_estimate === "number"
              ? rawLlmResult.headcount_estimate
              : null,
          notes,
          stage: enrich.stage,
          gmailThreadId: threadId,
          clientId: enrich.clientId,
          isReturningClient: enrich.isReturningClient,
          priorityTag: enrich.priorityTag,
          isPriority: enrich.isPriority,
          estimateKeywordsDetected: enrich.estimateKeywordsDetected,
          ...(aiFlagCategory
            ? { aiFlagCategory, aiFlagReason: aiReason }
            : {}),
        })
        .returning();

      try {
        await db.insert(activityLogs).values({
          entityType: "Lead",
          entityId: newLead.id,
          action: isWebsiteForm
            ? "Created from Contact Form"
            : "Created from Direct Email",
          details: {
            from,
            subject,
            page_url: rawLlmResult.page_url || "",
            gmail_message_id: messageId,
            ai_category: aiCategory || "Valid",
            ai_reason: aiReason,
          },
          userName: "System (Email Intake)",
          timestamp: new Date(),
        });
      } catch (logErr) {
        console.warn(
          "[email-intake] Activity log failed:",
          logErr instanceof Error ? logErr.message : logErr
        );
      }

      await logAutoClassification(newLead.id, enrich);

      await recordProcessed(messageId, "lead", source);
      createdCount++;
      results.push({
        messageId,
        from,
        subject,
        name: extractedName,
        email: extractedEmail,
        lead_id: newLead.id,
        outcome: aiCategory ? "created (flagged)" : "created",
        ai_flag_category: aiCategory || undefined,
        ai_flag_reason: aiCategory ? aiReason : undefined,
        source: isWebsiteForm ? "website-form" : "direct-email",
      });
      scheduleOnLeadCreated(newLead.id);
      try {
        await detectReturningClient(newLead.id);
      } catch (detectErr) {
        console.warn(
          "[email-intake] detectReturningClient failed:",
          detectErr instanceof Error ? detectErr.message : detectErr
        );
      }
      intakeDump("CREATED lead", {
        leadId: newLead.id,
        name: extractedName,
        email: extractedEmail,
        channel: enrich.channel,
        stage: enrich.stage,
        clientId: enrich.clientId,
        outcome: aiCategory ? "created (flagged)" : "created",
      });
    } catch (perMsgErr) {
      console.error(
        `[email-intake] Per-message error for ${messageId}:`,
        perMsgErr instanceof Error ? perMsgErr.message : perMsgErr
      );
      intakeDump("per-message error stack", perMsgErr);
      const retryResult = await scheduleIntakeRetry({
        messageId,
        source,
        error: perMsgErr,
        immediateDeadLetter: isPermanentIntakeError(perMsgErr),
      });
      skippedCount++;
      results.push({
        messageId,
        outcome: retryResult.deadLetter ? "dead-letter" : "retry-scheduled",
        reason: retryResult.deadLetter
          ? `Failed after ${retryResult.attemptCount} attempt(s) — moved to dead-letter`
          : `Error (retry ${retryResult.attemptCount}/${MAX_INTAKE_RETRIES} scheduled): ${
              perMsgErr instanceof Error
                ? perMsgErr.message.substring(0, 200)
                : "unknown"
            }`,
      });
    }
  }

  const summary = {
    ok: true as const,
    created: createdCount,
    spam: spamCount,
    skipped: skippedCount,
    results,
  };
  intakeDump("========== handleContactFormEmail END summary ==========", summary);
  return summary;
}
export async function listNewInboxMessageIds(
  startHistoryId: string,
  maxMessages = 20
): Promise<{ messageIds: string[]; newHistoryId: string }> {
  const gmail = await getGmailApi();
  try {
    // Do NOT pass labelId: "INBOX" — Gmail often omits history records for that
    // filter even when a real INBOX message arrived, which silently advances the
    // cursor and drops the email. Collect all messageAdded, then filter to INBOX.
    const hist = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    });

    const newHistoryId = hist.data.historyId
      ? String(hist.data.historyId)
      : startHistoryId;
    const seenIds = new Set<string>();
    const candidateIds: string[] = [];

    for (const h of hist.data.history || []) {
      for (const ma of h.messagesAdded || []) {
        const id = ma.message?.id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          candidateIds.push(id);
          if (candidateIds.length >= maxMessages * 3) break;
        }
      }
      if (candidateIds.length >= maxMessages * 3) break;
    }

    const messageIds: string[] = [];
    for (const id of candidateIds) {
      if (messageIds.length >= maxMessages) break;
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "minimal",
        });
        const labels = res.data.labelIds || [];
        if (labels.includes("INBOX")) {
          messageIds.push(id);
        }
      } catch (e) {
        console.warn(
          `[email-intake] history candidate ${id} minimal get failed:`,
          e instanceof Error ? e.message : e
        );
      }
    }

    return { messageIds, newHistoryId };
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "code" in err
        ? Number((err as { code: unknown }).code)
        : null;
    if (status === 404) {
      const profile = await gmail.users.getProfile({ userId: "me" });
      return {
        messageIds: [],
        newHistoryId: String(profile.data.historyId || startHistoryId),
      };
    }
    throw err;
  }
}

/**
 * Safety net when history.list advances the cursor but returns no INBOX IDs.
 * Scans recent INBOX mail and returns IDs not yet terminally processed.
 */
export async function listUnprocessedInboxMessageIds(
  maxMessages = 20
): Promise<string[]> {
  const gmail = await getGmailApi();
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox newer_than:2d",
    maxResults: maxMessages,
  });

  const candidates = (listRes.data.messages || [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));

  if (candidates.length === 0) return [];

  const db = getDb();
  if (!db) return candidates;

  const unprocessed: string[] = [];
  for (const id of candidates) {
    const seen = await db
      .select()
      .from(processedGmailMessages)
      .where(eq(processedGmailMessages.gmailMessageId, id))
      .limit(1);
    if (!seen[0] || !isTerminalProcessedStatus(seen[0].status)) {
      unprocessed.push(id);
    }
  }
  return unprocessed;
}

export async function getCurrentHistoryId(): Promise<string> {
  const gmail = await getGmailApi();
  const profile = await gmail.users.getProfile({ userId: "me" });
  return String(profile.data.historyId || "");
}

export async function upsertPollState(patch: {
  lastHistoryId?: string;
  lastPolledAt?: Date;
  lastWebhookReceivedAt?: Date;
  watchExpiration?: Date | null;
  watchRegisteredAt?: Date | null;
  lastTokenRefreshAt?: Date | null;
  lastConnectionError?: string | null;
  disconnectAlertSentAt?: Date | null;
  deadLetterAlertSentAt?: Date | null;
  lastDeadLetterError?: string | null;
}): Promise<void> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(gmailPollState)
    .where(eq(gmailPollState.key, "default"))
    .limit(1);
  const now = new Date();
  if (rows[0]) {
    await db
      .update(gmailPollState)
      .set({ ...patch, updatedDate: now })
      .where(eq(gmailPollState.id, rows[0].id));
  } else {
    await db.insert(gmailPollState).values({
      key: "default",
      ...patch,
    });
  }
}

export async function getPollState() {
  const db = requireDb();
  const rows = await db
    .select()
    .from(gmailPollState)
    .where(eq(gmailPollState.key, "default"))
    .limit(1);
  return rows[0] || null;
}
