/**
 * Import Base44 CSV exports from scripts/data/ into Postgres.
 * Remaps Base44 24-char IDs → UUIDs and rewrites FKs.
 *
 * Usage: npm run db:load-data
 *        npm run db:load-data -- --skip-heavy   (skip ActivityLog, ProcessedGmail, SpamEmail)
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { eq, sql } from "drizzle-orm";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";
import {
  activityLogs,
  automationConfig,
  callLogs,
  clients,
  eventTemplates,
  events,
  leads,
  processedGmailMessages,
  roleAssignments,
  spamEmails,
  stageEmailMappings,
  tasks,
  threadMessages,
  users,
} from "../server/db/schema/index.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG = "[load-data]";
const skipHeavy = process.argv.includes("--skip-heavy");

function resolveDataFile(name: string): string | null {
  const candidates = [
    join(__dirname, "data", name),
    join(process.cwd(), "scripts", "data", name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Minimal RFC4180 CSV parser (handles quoted multiline fields). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.length > 0) || rows.length === 0) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = cols[i] ?? "";
    }
    return obj;
  });
}

function loadCsv(name: string): Record<string, string>[] {
  const path = resolveDataFile(name);
  if (!path) {
    console.warn(`${LOG} SKIP missing file: ${name}`);
    return [];
  }
  console.log(`${LOG} Reading ${path}`);
  return parseCsv(readFileSync(path, "utf8"));
}

class IdMap {
  private map = new Map<string, string>();

  get(base44Id: string | null | undefined): string | null {
    if (!base44Id || !base44Id.trim()) return null;
    const key = base44Id.trim();
    let id = this.map.get(key);
    if (!id) {
      id = randomUUID();
      this.map.set(key, id);
    }
    return id;
  }

  peek(base44Id: string | null | undefined): string | null {
    if (!base44Id || !base44Id.trim()) return null;
    return this.map.get(base44Id.trim()) || null;
  }
}

function parseBool(v: string | undefined, fallback = false): boolean {
  if (v == null || v === "") return fallback;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

function parseBoolOrNull(v: string | undefined): boolean | null {
  if (v == null || v.trim() === "") return null;
  return parseBool(v, false);
}

function parseNum(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | undefined): Date | null {
  if (v == null || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseJson(v: string | undefined, fallback: unknown = null): unknown {
  if (v == null || v.trim() === "") return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function pickEnum<T extends string>(
  v: string | undefined,
  allowed: readonly T[],
  fallback: T | null = null
): T | null {
  if (v == null || v.trim() === "") return fallback;
  const found = allowed.find((a) => a === v.trim());
  return found ?? fallback;
}

function isUserEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  if (email.includes("no-reply.base44.com")) return false;
  if (email.startsWith("service+")) return false;
  return true;
}

async function loadData(): Promise<void> {
  console.log(`${LOG} Starting${skipHeavy ? " (--skip-heavy)" : ""}`);

  if (!resolveDatabaseUrl()) {
    throw new Error(`${LOG} DATABASE_URL is not set`);
  }
  const db = getDb();
  if (!db) throw new Error(`${LOG} getDb() returned null`);
  await db.execute(sql`select 1`);
  console.log(`${LOG} Database connection OK`);

  const ids = new IdMap();
  const userRows = await db.select().from(users);
  const userByEmail = new Map(
    userRows.map((u) => [u.email.toLowerCase(), u.id] as const)
  );
  console.log(`${LOG} Loaded ${userByEmail.size} existing user(s) for FK resolve`);

  const resolveUserByEmail = (email: string | undefined): string | null => {
    if (!email || !isUserEmail(email)) return null;
    return userByEmail.get(email.trim().toLowerCase()) || null;
  };

  // ── Clients ──────────────────────────────────────────────────────────
  {
    const rows = loadCsv("Client_export.csv");
    let ok = 0;
    let skip = 0;
    for (const r of rows) {
      const email = (r.email || "").trim();
      const name = (r.name || "").trim() || email || "Unknown";
      if (!email) {
        skip++;
        continue;
      }
      const id = ids.get(r.id)!;
      try {
        await db.insert(clients).values({
          id,
          name,
          company: r.company || null,
          email,
          phone: r.phone || null,
          additionalContacts: parseJson(r.additional_contacts, []),
          clientType: pickEnum(r.client_type, ["B2B", "B2C"] as const),
          totalEvents: parseNum(r.total_events) ?? 0,
          lifetimeRevenue: parseNum(r.lifetime_revenue) ?? 0,
          averageEventValue: parseNum(r.average_event_value) ?? 0,
          firstEventDate: parseDate(r.first_event_date),
          lastEventDate: parseDate(r.last_event_date),
          isVip: parseBool(r.is_vip),
          isReturning: parseBool(r.is_returning),
          newsletterSubscribed: parseBool(r.newsletter_subscribed),
          linkedinConnected: parseBool(r.linkedin_connected),
          tshirtSent: parseBool(r.tshirt_sent),
          lostIntelligence: parseJson(r.lost_intelligence, null),
          notes: r.notes || null,
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} client skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} clients inserted=${ok} skipped=${skip}`);
  }

  // ── Event templates ──────────────────────────────────────────────────
  {
    const rows = loadCsv("EventTemplate_export.csv");
    let ok = 0;
    let skip = 0;
    const EVENT_TYPES = [
      "In-Person Mixology",
      "In-Person Private Monuments",
      "In-Person Paint & Sip",
      "In-Person Private Food Tour",
      "In-Person Yoga & UnWined",
      "Virtual Mixology",
      "Virtual Paint & Sip",
    ] as const;
    for (const r of rows) {
      const eventType = pickEnum(r.event_type, EVENT_TYPES);
      const templateName = (r.template_name || "").trim();
      if (!eventType || !templateName) {
        skip++;
        continue;
      }
      try {
        await db.insert(eventTemplates).values({
          id: ids.get(r.id)!,
          templateName,
          eventType,
          description: r.description || null,
          preEventTasks: parseJson(r.pre_event_tasks, []),
          eventDayTasks: parseJson(r.event_day_tasks, []),
          postEventTasks: parseJson(r.post_event_tasks, []),
          isActive: parseBool(r.is_active, true),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} event_template skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} event_templates inserted=${ok} skipped=${skip}`);
  }

  // ── Leads (defer event link FKs) ─────────────────────────────────────
  const leadEventLinks: Array<{
    leadId: string;
    linkedEventBase44: string | null;
    convertedEventBase44: string | null;
  }> = [];

  {
    const rows = loadCsv("Lead_export.csv");
    let ok = 0;
    let skip = 0;
    const SOURCES = [
      "Website",
      "Email",
      "Phone",
      "Referral",
      "Call",
      "Form",
      "Other",
    ] as const;
    const REFERRALS = [
      "ChatGPT",
      "Perplexity",
      "Gemini",
      "Google",
      "Word-of-mouth",
      "Washington.org",
      "Other",
    ] as const;
    const INQUIRY = [
      "Estimate",
      "General",
      "Corporate Program",
      "Unknown",
    ] as const;
    const CHANNELS = ["B2B", "B2C"] as const;
    const CLIENT_TYPES = ["New", "Previous", "Referral"] as const;
    const FORMATS = ["In-Person", "Virtual", "Hybrid"] as const;
    const PRIORITY = ["Previous Client Priority", "First Priority"] as const;
    const AI_FLAGS = [
      "",
      "Possible Spam",
      "Job Application",
      "Unrelated Inquiry",
      "Hiring-Related",
      "Other",
    ] as const;

    for (const r of rows) {
      const email = (r.email || "").trim();
      const name = (r.name || "").trim() || email || "Unknown";
      if (!email) {
        skip++;
        continue;
      }
      const id = ids.get(r.id)!;
      leadEventLinks.push({
        leadId: id,
        linkedEventBase44: r.linked_event_id?.trim() || null,
        convertedEventBase44: r.converted_to_event_id?.trim() || null,
      });
      try {
        await db.insert(leads).values({
          id,
          name,
          title: r.title || null,
          company: r.company || null,
          email,
          phone: r.phone || null,
          additionalContacts: parseJson(r.additional_contacts, null),
          source: pickEnum(r.source, SOURCES),
          referralSource: pickEnum(r.referral_source, REFERRALS),
          referralSourceOther: r.referral_source_other || null,
          inquiryType: pickEnum(r.inquiry_type, INQUIRY, "Unknown"),
          channel: pickEnum(r.channel, CHANNELS),
          clientType: pickEnum(r.client_type, CLIENT_TYPES, "New"),
          isPriority: parseBool(r.is_priority),
          reviewed: parseBoolOrNull(r.reviewed),
          headcountEstimate: parseNum(r.headcount_estimate),
          eventTypeInterest: r.event_type_interest || null,
          eventFormat: pickEnum(r.event_format, FORMATS),
          preferredDate: parseDate(r.preferred_date),
          meetingDate: parseDate(r.meeting_date),
          proposedMeetingDate: parseDate(r.proposed_meeting_date),
          awaitingMeetingConfirmation: parseBool(
            r.awaiting_meeting_confirmation
          ),
          surveySent: parseBool(r.survey_sent),
          surveySentDate: parseDate(r.survey_sent_date),
          surveyResponded: parseBool(r.survey_responded),
          stage: r.stage?.trim() || "New Inquiry",
          assignedSalesRep: ids.peek(r.assigned_sales_rep),
          notes: r.notes || null,
          gmailThreadId: r.gmail_thread_id || null,
          lastContactDate: parseDate(r.last_contact_date),
          clientId: ids.peek(r.client_id),
          convertedToEventId: null,
          isReturningClient: parseBool(r.is_returning_client),
          returningClientSummary: parseJson(r.returning_client_summary, null),
          priorityTag: pickEnum(r.priority_tag, PRIORITY),
          estimateKeywordsDetected: parseBool(r.estimate_keywords_detected),
          returningClientChecked: parseBool(r.returning_client_checked),
          eventCreated: parseBool(r.event_created),
          linkedEventId: null,
          depositNumber: r.deposit_number || null,
          depositAmount: parseNum(r.deposit_amount),
          aiFlagCategory: pickEnum(r.ai_flag_category, AI_FLAGS, ""),
          aiFlagReason: r.ai_flag_reason || null,
          skipAutoCall: parseBool(r.skip_auto_call),
          surveyData: parseJson(r.survey_data, null),
          followupSaleConfirmed: parseBoolOrNull(r.followup_sale_confirmed),
          followupClientType: r.followup_client_type || null,
          followupResponseEta: parseDate(r.followup_response_eta),
          followupNextDate: parseDate(r.followup_next_date),
          followupExperienceConfirmation:
            r.followup_experience_confirmation || null,
          followupWarmthScale: parseNum(r.followup_warmth_scale),
          followupMeetingNotes: r.followup_meeting_notes || null,
          followupContractRequired: parseBoolOrNull(
            r.followup_contract_required
          ),
          lostReason: r.lost_reason || null,
          lostOkToContact: parseBoolOrNull(r.lost_ok_to_contact),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} lead skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} leads inserted=${ok} skipped=${skip}`);
  }

  // ── Events ───────────────────────────────────────────────────────────
  {
    const rows = loadCsv("Event_export.csv");
    let ok = 0;
    let skip = 0;
    const EVENT_TYPES = [
      "In-Person Mixology",
      "In-Person Private Monuments",
      "In-Person Paint & Sip",
      "In-Person Private Food Tour",
      "In-Person Yoga & UnWined",
      "Virtual Mixology",
      "Virtual Paint & Sip",
    ] as const;
    const STAGES = [
      "Deposit Received",
      "Pre-Event Planning",
      "Inventory Ordering",
      "Staff Confirmed",
      "72hr Final Check",
      "Event Day",
      "Post-Event Processing",
      "Completed",
      "Cancelled",
    ] as const;
    const FORMATS = ["In-Person", "Virtual"] as const;
    const ALCOHOL = ["Alcohol", "Non-Alcohol", "Mocktails", "Mixed"] as const;
    const SHIPPING = ["Domestic", "International", "Local Pickup"] as const;
    const INVENTORY = ["Not Started", "Ordered", "Shipped", "Confirmed"] as const;
    const INVOICE = ["Not Sent", "Sent", "Paid", "Overdue"] as const;
    const SATISFACTION = ["Excellent", "Good", "Fair", "Poor"] as const;

    for (const r of rows) {
      const eventName = (r.event_name || "").trim();
      const eventType = pickEnum(r.event_type, EVENT_TYPES);
      const eventDate = parseDate(r.event_date);
      if (!eventName || !eventType || !eventDate) {
        skip++;
        continue;
      }
      try {
        await db.insert(events).values({
          id: ids.get(r.id)!,
          leadId: ids.peek(r.lead_id),
          eventName,
          eventType,
          eventFormat: pickEnum(r.event_format, FORMATS),
          templateId: ids.peek(r.template_id),
          venue: r.venue || null,
          virtualPlatform: r.virtual_platform || null,
          venueRestrictions: r.venue_restrictions || null,
          eventDate,
          depositReceived: parseBool(r.deposit_received),
          depositAmount: parseNum(r.deposit_amount),
          headcount: parseNum(r.headcount),
          alcoholIncluded: parseBool(r.alcohol_included),
          alcoholPreference: pickEnum(r.alcohol_preference, ALCOHOL),
          transportationNeeded: parseBool(r.transportation_needed),
          transportationDetails: parseJson(r.transportation_details, null),
          customAddons: parseJson(r.custom_addons, null),
          dietaryRestrictions: r.dietary_restrictions || null,
          specialRequests: r.special_requests || null,
          accessibilityNeeds: r.accessibility_needs || null,
          shippingRequired: parseBool(r.shipping_required),
          shippingType: pickEnum(r.shipping_type, SHIPPING),
          shippingTracking: r.shipping_tracking || null,
          menu: r.menu || null,
          pocName: r.poc_name || null,
          pocTitle: r.poc_title || null,
          pocEmail: r.poc_email || null,
          pocPhone: r.poc_phone || null,
          pocVerified: parseBool(r.poc_verified),
          instructorAssigned: ids.peek(r.instructor_assigned),
          opsSupportAssigned: ids.peek(r.ops_support_assigned),
          beoLink: r.beo_link || null,
          fareharborLink: r.fareharbor_link || null,
          inventoryStatus: pickEnum(r.inventory_status, INVENTORY, "Not Started"),
          loadingDockReserved: parseBool(r.loading_dock_reserved),
          venueReservationsConfirmed: parseBool(r.venue_reservations_confirmed),
          staffAssigned: parseJson(r.staff_assigned, null),
          staffConfirmedDate: parseDate(r.staff_confirmed_date),
          stage: pickEnum(r.stage, STAGES, "Deposit Received")!,
          driveFolderId: r.drive_folder_id || null,
          driveFolderUrl: r.drive_folder_url || null,
          photosUploaded: parseBool(r.photos_uploaded),
          followupEmailSent: parseBool(r.followup_email_sent),
          referralRequested: parseBool(r.referral_requested),
          linkedinConnectionSent: parseBool(r.linkedin_connection_sent),
          postEventFeedback: r.post_event_feedback || null,
          invoiceStatus: pickEnum(r.invoice_status, INVOICE, "Not Sent"),
          totalCost: parseNum(r.total_cost),
          laborCost: parseNum(r.labor_cost),
          suppliesCost: parseNum(r.supplies_cost),
          venueFees: parseNum(r.venue_fees),
          clientId: ids.peek(r.client_id),
          cancellationReason: r.cancellation_reason || null,
          wentToCompetitor: r.went_to_competitor || null,
          budgetIssue: parseBool(r.budget_issue),
          timingIssue: parseBool(r.timing_issue),
          satisfactionRating: pickEnum(r.satisfaction_rating, SATISFACTION),
          sourceLeadId: ids.peek(r.source_lead_id),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} event skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} events inserted=${ok} skipped=${skip}`);
  }

  // Pass 2: lead ↔ event links
  {
    let patched = 0;
    for (const link of leadEventLinks) {
      const linked = link.linkedEventBase44
        ? ids.peek(link.linkedEventBase44)
        : null;
      const converted = link.convertedEventBase44
        ? ids.peek(link.convertedEventBase44)
        : null;
      if (!linked && !converted) continue;
      await db
        .update(leads)
        .set({
          linkedEventId: linked,
          convertedToEventId: converted,
          updatedDate: new Date(),
        })
        .where(eq(leads.id, link.leadId));
      patched++;
    }
    console.log(`${LOG} lead↔event links patched=${patched}`);
  }

  // ── Tasks ────────────────────────────────────────────────────────────
  {
    const rows = loadCsv("Task_export.csv");
    let ok = 0;
    let skip = 0;
    const CATS = ["Pre-Event", "Event-Day", "Post-Event", "Checklist"] as const;
    const ROLES = [
      "Admin",
      "Sales",
      "Ops",
      "Chef",
      "Event Host",
      "Finance",
    ] as const;
    const STATUSES = ["Not Acknowledged", "Working On It", "Done"] as const;
    for (const r of rows) {
      const eventId = ids.peek(r.event_id);
      const title = (r.title || "").trim();
      let role = pickEnum(r.responsible_role, ROLES);
      if (!role && (r.responsible_role === "Guide" || r.responsible_role === "Host")) {
        role = "Event Host";
      }
      let category = pickEnum(r.category, CATS);
      // Base44 used "Upon Deposit" — map into Pre-Event
      if (!category && /upon deposit/i.test(r.category || "")) {
        category = "Pre-Event";
      }
      if (!eventId || !title || !role || !category) {
        skip++;
        continue;
      }
      try {
        await db.insert(tasks).values({
          id: ids.get(r.id)!,
          eventId,
          title,
          description: r.description || null,
          category,
          responsibleRole: role,
          assignedUser: ids.peek(r.assigned_user),
          status: pickEnum(r.status, STATUSES, "Not Acknowledged"),
          acknowledgedTimestamp: parseDate(r.acknowledged_timestamp),
          completionTimestamp: parseDate(r.completion_timestamp),
          overrideFlag: parseBool(r.override_flag),
          overrideTimestamp: parseDate(r.override_timestamp),
          previousAssignee: ids.peek(r.previous_assignee),
          overriddenBy: ids.peek(r.overridden_by),
          dueDate: parseDate(r.due_date),
          order: parseNum(r.order),
          progressNotes: r.progress_notes || null,
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        if (skip <= 5) {
          console.warn(
            `${LOG} task skip ${r.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
    console.log(`${LOG} tasks inserted=${ok} skipped=${skip}`);
  }

  // ── Call logs ────────────────────────────────────────────────────────
  {
    const rows = loadCsv("CallLog_export.csv");
    let ok = 0;
    let skip = 0;
    const STATUSES = [
      "Initiated",
      "Ringing",
      "In Progress",
      "Completed",
      "No Answer",
      "Busy",
      "Failed",
      "Rep Declined",
      "Analyzed",
    ] as const;
    for (const r of rows) {
      const leadId = ids.peek(r.lead_id);
      if (!leadId) {
        skip++;
        continue;
      }
      try {
        await db.insert(callLogs).values({
          id: ids.get(r.id)!,
          leadId,
          leadName: r.lead_name || null,
          leadCompany: r.lead_company || null,
          leadPhone: r.lead_phone || null,
          leadBrief: r.lead_brief || null,
          repPhone: r.rep_phone || null,
          repEmail: r.rep_email || null,
          attemptNumber: parseNum(r.attempt_number) ?? 1,
          status: pickEnum(r.status, STATUSES, "Initiated"),
          twilioCallSid: r.twilio_call_sid || null,
          twilioExecutionSid: r.twilio_execution_sid || null,
          recordingUrl: r.recording_url || null,
          transcript: r.transcript || null,
          summary: r.summary || null,
          extractedBudget: r.extracted_budget || null,
          extractedHeadcount: r.extracted_headcount || null,
          extractedTiming: r.extracted_timing || null,
          extractedNextStage: r.extracted_next_stage || null,
          extractedNotes: r.extracted_notes || null,
          errorMessage: r.error_message || null,
          startedAt: parseDate(r.started_at),
          endedAt: parseDate(r.ended_at),
          scheduledRetryAt: parseDate(r.scheduled_retry_at),
          retryProcessed: parseBool(r.retry_processed),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} call_log skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} call_logs inserted=${ok} skipped=${skip}`);
  }

  // ── Role assignments ─────────────────────────────────────────────────
  {
    const rows = loadCsv("RoleAssignment_export.csv");
    let ok = 0;
    let skip = 0;
    const ROLES = [
      "Admin",
      "Sales",
      "Ops",
      "Chef",
      "Event Host",
      "Finance",
      "Instructor",
    ] as const;
    for (const r of rows) {
      const role = pickEnum(r.role, ROLES);
      if (!role) {
        skip++;
        continue;
      }
      const userEmail = (r.user_email || "").trim().toLowerCase();
      const userId =
        (userEmail && userByEmail.get(userEmail)) || ids.peek(r.user_id);
      try {
        await db.insert(roleAssignments).values({
          id: ids.get(r.id)!,
          userId,
          userEmail: r.user_email || null,
          userName: r.user_name || null,
          role,
          isActive: parseBool(r.is_active, true),
          coverageRules: parseJson(r.coverage_rules, null),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} role_assignment skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} role_assignments inserted=${ok} skipped=${skip}`);
  }

  // ── Thread messages ──────────────────────────────────────────────────
  {
    const rows = loadCsv("ThreadMessage_export.csv");
    let ok = 0;
    let skip = 0;
    const ACTIONS = [
      "acknowledged",
      "status_changed",
      "completed",
      "override",
      "event_created",
      "tasks_generated",
    ] as const;
    for (const r of rows) {
      const authorId =
        ids.peek(r.author_id) ||
        resolveUserByEmail(r.created_by) ||
        userRows[0]?.id;
      if (!authorId) {
        skip++;
        continue;
      }
      try {
        await db.insert(threadMessages).values({
          id: ids.get(r.id)!,
          taskId: ids.peek(r.task_id),
          eventId: ids.peek(r.event_id),
          authorId,
          authorName: r.author_name || null,
          body: r.body || "",
          mentionedUsers: parseJson(r.mentioned_users, null),
          attachmentUrls: parseJson(r.attachment_urls, null),
          isSystemMessage: parseBool(r.is_system_message),
          systemAction: pickEnum(r.system_action, ACTIONS),
          systemMetadata: parseJson(r.system_metadata, null),
          parentMessageId: ids.peek(r.parent_message_id),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} thread_message skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} thread_messages inserted=${ok} skipped=${skip}`);
  }

  // ── Stage email mappings ─────────────────────────────────────────────
  {
    const rows = loadCsv("StageEmailMapping_export.csv");
    let ok = 0;
    let skip = 0;
    const CHANNELS = ["B2B", "B2C", "Both"] as const;
    const CATEGORIES = [
      "Lead Follow-Up",
      "Survey",
      "Reminder",
      "Proposal",
      "Event Confirmation",
      "Post-Event",
      "Re-Engagement",
    ] as const;
    for (const r of rows) {
      const stage = (r.stage || "").trim();
      const emailCategory = pickEnum(r.email_category, CATEGORIES);
      if (!stage || !emailCategory) {
        skip++;
        continue;
      }
      try {
        await db.insert(stageEmailMappings).values({
          id: ids.get(r.id)!,
          stage,
          channel: pickEnum(r.channel, CHANNELS, "Both"),
          emailCategory,
          isActive: parseBool(r.is_active, true),
          notes: r.notes || null,
          lastSentTemplate: r.last_sent_template || null,
          lastSentDate: parseDate(r.last_sent_date),
          createdDate: parseDate(r.created_date) || new Date(),
          updatedDate: parseDate(r.updated_date) || new Date(),
          createdBy: resolveUserByEmail(r.created_by),
        });
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} stage_email_mapping skip ${r.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} stage_email_mappings inserted=${ok} skipped=${skip}`);
  }

  // ── Automation config (upsert by key) ────────────────────────────────
  {
    const rows = loadCsv("AutomationConfig_export.csv");
    let ok = 0;
    let skip = 0;
    for (const r of rows) {
      const key = (r.key || "default").trim() || "default";
      try {
        const [existing] = await db
          .select()
          .from(automationConfig)
          .where(eq(automationConfig.key, key))
          .limit(1);
        const patch = {
          enabled: parseBool(r.enabled, true),
          businessHoursGateEnabled: parseBool(
            r.business_hours_gate_enabled,
            true
          ),
          useRepCallerIdEnabled: parseBool(r.use_rep_caller_id_enabled, false),
          repPhone: r.rep_phone || null,
          repEmail: r.rep_email || null,
          calendarLink: r.calendar_link || null,
          companyTriggerPrefix: r.company_trigger_prefix || "ALITEST",
          maxAttempts: parseNum(r.max_attempts) ?? 3,
          updatedDate: parseDate(r.updated_date) || new Date(),
        };
        if (existing) {
          await db
            .update(automationConfig)
            .set(patch)
            .where(eq(automationConfig.id, existing.id));
        } else {
          await db.insert(automationConfig).values({
            id: ids.get(r.id) || randomUUID(),
            key,
            ...patch,
            createdDate: parseDate(r.created_date) || new Date(),
            createdBy: resolveUserByEmail(r.created_by),
          });
        }
        ok++;
      } catch (err) {
        skip++;
        console.warn(
          `${LOG} automation_config skip:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    console.log(`${LOG} automation_config upserted=${ok} skipped=${skip}`);
  }

  // ── Email templates via existing seed script ─────────────────────────
  {
    console.log(`${LOG} Running seed-email-templates...`);
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
        join(__dirname, "seed-email-templates.ts"),
      ],
      { stdio: "inherit", env: process.env }
    );
    if (result.status !== 0) {
      // Fallback: npx tsx
      const fallback = spawnSync(
        "npx",
        ["tsx", join(__dirname, "seed-email-templates.ts")],
        { stdio: "inherit", env: process.env, shell: true }
      );
      if (fallback.status !== 0) {
        console.warn(`${LOG} seed-email-templates failed — run manually later`);
      }
    }
  }

  if (!skipHeavy) {
    // ── Activity logs ──────────────────────────────────────────────────
    {
      const rows = loadCsv("ActivityLog_export.csv");
      let ok = 0;
      let skip = 0;
      const TYPES = ["Lead", "Event", "Task", "Email", "Drive"] as const;
      for (const r of rows) {
        const entityType = pickEnum(r.entity_type, TYPES);
        const entityId = ids.peek(r.entity_id);
        const action = (r.action || "").trim();
        if (!entityType || !entityId || !action) {
          skip++;
          continue;
        }
        try {
          await db.insert(activityLogs).values({
            id: ids.get(r.id)!,
            entityType,
            entityId,
            action,
            details: parseJson(r.details, null),
            userId: ids.peek(r.user_id) || resolveUserByEmail(r.created_by),
            userName: r.user_name || null,
            timestamp: parseDate(r.timestamp),
            createdDate: parseDate(r.created_date) || new Date(),
            updatedDate: parseDate(r.updated_date) || new Date(),
            createdBy: resolveUserByEmail(r.created_by),
          });
          ok++;
        } catch {
          skip++;
        }
      }
      console.log(`${LOG} activity_logs inserted=${ok} skipped=${skip}`);
    }

    // ── Processed Gmail messages ───────────────────────────────────────
    {
      const rows = loadCsv("ProcessedGmailMessage_export.csv");
      let ok = 0;
      let skip = 0;
      const SOURCES = ["webhook", "poller"] as const;
      const STATUSES = ["lead", "spam", "ignored", "failed"] as const;
      for (const r of rows) {
        const gmailMessageId = (r.gmail_message_id || "").trim();
        if (!gmailMessageId) {
          skip++;
          continue;
        }
        try {
          await db.insert(processedGmailMessages).values({
            id: ids.get(r.id)!,
            gmailMessageId,
            processedAt: parseDate(r.processed_at),
            source: pickEnum(r.source, SOURCES),
            status: pickEnum(r.status, STATUSES),
            createdDate: parseDate(r.created_date) || new Date(),
            updatedDate: parseDate(r.updated_date) || new Date(),
            createdBy: resolveUserByEmail(r.created_by),
          });
          ok++;
        } catch {
          skip++;
        }
      }
      console.log(
        `${LOG} processed_gmail_messages inserted=${ok} skipped=${skip}`
      );
    }

    // ── Spam emails ────────────────────────────────────────────────────
    {
      const rows = loadCsv("SpamEmail_export.csv");
      let ok = 0;
      let skip = 0;
      const CATS = [
        "Sales Pitch",
        "SEO/Marketing",
        "Web Design",
        "Promotion",
        "Gibberish",
        "Other",
      ] as const;
      for (const r of rows) {
        const from = (r.from || r.sender_email || "").trim();
        const subject = (r.subject || "(no subject)").trim();
        if (!from) {
          skip++;
          continue;
        }
        try {
          await db.insert(spamEmails).values({
            id: ids.get(r.id)!,
            from,
            senderEmail: r.sender_email || null,
            subject,
            body: r.body || null,
            pageUrl: r.page_url || null,
            gmailMessageId: r.gmail_message_id || null,
            gmailThreadId: r.gmail_thread_id || null,
            spamCategory: pickEnum(r.spam_category, CATS),
            spamReason: r.spam_reason || null,
            receivedAt: parseDate(r.received_at),
            createdDate: parseDate(r.created_date) || new Date(),
            updatedDate: parseDate(r.updated_date) || new Date(),
            createdBy: resolveUserByEmail(r.created_by),
          });
          ok++;
        } catch {
          skip++;
        }
      }
      console.log(`${LOG} spam_emails inserted=${ok} skipped=${skip}`);
    }
  } else {
    console.log(
      `${LOG} Skipped ActivityLog + ProcessedGmail + SpamEmail (--skip-heavy)`
    );
  }

  console.log(`${LOG} Done`);
}

loadData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} Failed:`, err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
