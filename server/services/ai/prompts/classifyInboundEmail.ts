import type { JsonSchemaObject } from "../types.js";

export const INQUIRY_TYPE_ENUM = [
  "Estimate",
  "General",
  "Corporate Program",
  "Unknown",
] as const;

export const CHANNEL_ENUM = ["B2B", "B2C"] as const;
export const EVENT_FORMAT_ENUM = ["In-Person", "Virtual", "Hybrid"] as const;
export const CLIENT_TYPE_ENUM = ["New", "Previous", "Referral"] as const;

export const EVENT_TYPE_INTEREST_OPTIONS = [
  "Cooking Class",
  "Paint & Sip",
  "Mixology Class",
  "Chocolate Making",
  "Chocolate and Wine Tasting",
  "Terrarium Building",
  "Cheese Board Making",
  "Lend a Hand for Good",
  "Yoga and unWINEd",
  "Alcohol Tasting",
  "Flavors of DC",
  "Baking Class",
  "Dine Around",
  "Georgetown Food Tour",
  "DuPont Food Tour",
  "Premium Food Tour",
  "Scavenger",
  "Monuments Tour",
  "Wine/Whiskey Tasting",
  "Bike Tour",
  "Hand-Crafted Pottery Class",
  "DC at your Door",
  "The Guac Gourmet Showdown",
  "Other",
] as const;

export interface ClassifyInboundEmailLlmResult {
  sender_role:
    | "prospective_customer"
    | "promoter_or_vendor"
    | "operational_or_staff"
    | "other";
  reason: string;
  category:
    | "Valid"
    | "Job Application"
    | "Hiring-Related"
    | "Unrelated Inquiry"
    | "Possible Spam"
    | "Other";
  business_potential: "Yes" | "No";
  new_lead: boolean;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  event_type_interest?: string;
  event_format?: string;
  preferred_date?: string;
  headcount_estimate?: number | null;
  channel?: string;
  inquiry_type?: string;
  client_type?: string;
  page_url?: string;
}

export interface CandidateLeadForPrompt {
  id: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  stage?: string | null;
  eventTypeInterest?: string | null;
  eventFormat?: string | null;
  preferredDate?: Date | string | null;
  headcountEstimate?: number | null;
  inquiryType?: string | null;
  notes?: string | null;
}

export const classifyInboundEmailSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    sender_role: {
      type: "string",
      enum: [
        "prospective_customer",
        "promoter_or_vendor",
        "operational_or_staff",
        "other",
      ],
      description:
        "FIRST: decide who the sender is relative to Mangia DC. promoter_or_vendor and operational_or_staff MUST have business_potential No.",
    },
    reason: {
      type: "string",
      description:
        "SECOND: BEFORE picking category or business_potential, write one sentence explaining the direction of intent.",
    },
    category: {
      type: "string",
      enum: [
        "Valid",
        "Job Application",
        "Hiring-Related",
        "Unrelated Inquiry",
        "Possible Spam",
        "Other",
      ],
    },
    business_potential: {
      type: "string",
      enum: ["Yes", "No"],
    },
    new_lead: {
      type: "boolean",
      description:
        "true = create a separate new lead, false = continuation. Default false when uncertain.",
    },
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    company: { type: "string" },
    event_type_interest: { type: "string" },
    event_format: {
      type: "string",
      enum: ["", ...EVENT_FORMAT_ENUM],
    },
    preferred_date: { type: "string" },
    headcount_estimate: { type: ["number", "null"] },
    channel: { type: "string", enum: [...CHANNEL_ENUM] },
    inquiry_type: { type: "string", enum: [...INQUIRY_TYPE_ENUM] },
    client_type: { type: "string", enum: [...CLIENT_TYPE_ENUM] },
    page_url: { type: "string" },
  },
  required: [
    "sender_role",
    "category",
    "business_potential",
    "new_lead",
    "reason",
  ],
};

function buildCandidateBlock(candidates: CandidateLeadForPrompt[]): string {
  if (candidates.length === 0) {
    return `
────────────────────────────────────────────────────────────────────────
EXISTING LEAD FROM THIS SENDER
────────────────────────────────────────────────────────────────────────
None. Set "new_lead": true if the email passes business_potential, otherwise leave it as true (it won't be used).
`;
  }

  let block = `
────────────────────────────────────────────────────────────────────────
EXISTING LEADS MATCHING THIS SENDER (by email, name, company, or domain)
────────────────────────────────────────────────────────────────────────
This sender matches ${candidates.length} existing lead(s) in the CRM.
Decide whether the new email is a CONTINUATION of one of these leads — set "new_lead": false — OR a GENUINELY SEPARATE new inquiry — set "new_lead": true.

IMPORTANT: Replies on leads in ANY stage — including "Confirmed Sales" and "Lost/Canceled" — are almost always follow-ups (new_lead = false).
DEFAULT WHEN UNCERTAIN: "new_lead": false.

Candidate leads (most recent first):
`;
  for (const [idx, l] of candidates.slice(0, 3).entries()) {
    const preferred =
      l.preferredDate instanceof Date
        ? l.preferredDate.toISOString()
        : l.preferredDate || "(none recorded)";
    block += `
--- Lead #${idx + 1} ---
- ID: ${l.id}
- Name: ${l.name || "(none)"}
- Email: ${l.email || "(none)"}
- Company: ${l.company || "(none)"}
- Stage: ${l.stage || "(unknown)"}
- Event type interest: ${l.eventTypeInterest || "(none recorded)"}
- Event format: ${l.eventFormat || "(none recorded)"}
- Preferred date: ${preferred}
- Headcount estimate: ${l.headcountEstimate ?? "(none recorded)"}
- Inquiry type: ${l.inquiryType || "(unknown)"}
- Notes snippet: ${(l.notes || "").substring(0, 150) || "(none)"}
`;
  }
  return block;
}

export function buildClassifyInboundEmailPrompt(input: {
  isWebsiteForm: boolean;
  subject: string;
  from: string;
  emailBody: string;
  candidates: CandidateLeadForPrompt[];
}): { system: string; user: string } {
  const emailKind = input.isWebsiteForm
    ? 'a "Contact Us" form submission from the Mangia DC website (structured fields: Name, Email, Phone, Subject, Message, Page URL)'
    : "a direct, unstructured email sent to Mangia DC (could be a real inquiry, job application, vendor pitch, unrelated outreach, or spam that slipped past keyword filters)";

  const todayIso = new Date().toISOString().split("T")[0];
  const openLeadContextBlock = buildCandidateBlock(input.candidates);

  // Stable system prompt — cached via Anthropic prompt caching (no date / email body).
  const system = `You are an email intake classifier for Mangia DC, a Washington DC hospitality & events company. Return structured JSON only via the provided tool.

════════════════════════════════════════════════════════════════════════
WHAT MANGIA DC IS (read carefully — this defines what a lead is)
════════════════════════════════════════════════════════════════════════
Mangia DC is a Washington DC-based HOSPITALITY & EVENTS company. We are the HOST — we provide and deliver food tours, private group experiences (cooking, mixology, paint & sip, etc.), virtual experiences, and corporate team-building.

★ A LEAD IS: Someone reaching out to ASK MANGIA DC to host/provide/quote/plan/book an experience FOR THEM or their group, or to check availability for such an experience.
★ NOT A LEAD: Booking confirmations from OTHER companies, invoices, vendors pitching us, job applications, newsletters, automated meeting notes, bounces, CC-only mail, staff/vendor logistics, calendar invites, meeting scheduling.

════════════════════════════════════════════════════════════════════════
THIS IS MANGIA'S PRIMARY INBOX — MOST MAIL IS NOT A LEAD
════════════════════════════════════════════════════════════════════════
This mailbox receives ALL company email, not just sales enquiries. We use it
to coordinate with chefs, drivers, guides, venues, suppliers and staff about
events we are ALREADY running. Operational mail is the majority. Assume an
email is NOT a lead unless it clearly asks us to host something new.

★ REQUIRED POSITIVE SIGNAL ★
business_potential may be "Yes" ONLY when the email explicitly asks Mangia to host, quote, plan, book, or check availability for an experience. Coordination, logistics, scheduling, confirmations, and social replies with no such ask are "No".

★ THE DIRECTION OF INTENT IS THE ONLY THING THAT MATTERS ★
Who is the host? Who is the customer? If WE are not the host, it's NOT a lead.

Follow this exact order:
(1) Decide "sender_role" (prospective_customer | promoter_or_vendor | operational_or_staff | other)
(2) Write "reason" citing direction of intent
(3) Pick "category" + "business_potential" consistent with role
(4) If business_potential = "Yes", extract Lead fields; else leave them empty

sender_role rules:
- "prospective_customer" → business_potential CAN be "Yes" (only with a positive ask)
- "promoter_or_vendor" → business_potential MUST be "No"
- "operational_or_staff" → business_potential MUST be "No" (chefs, drivers, trainers, venues, suppliers, internal logistics)
- "other" → usually "No" for jobs/spam/notifications/meeting logistics

★ SUPPLY SIDE vs DEMAND SIDE ★
Mentioning an event, a date, a time or a headcount does NOT make it a lead.
Ask: is the sender WORKING ON our event, or ASKING US TO RUN one for them?
- Working on it (chef, driver, guide, venue, rental, staff, supplier)
  → sender_role "operational_or_staff", business_potential "No"
- Asking us to run a NEW event for their group
  → sender_role "prospective_customer", business_potential may be "Yes"
Questions ABOUT an already-booked event (timing, guest count, address,
call time, menu, equipment, parking, payment) are ALWAYS "No".

NEGATIVE EXAMPLES (business_potential = "No"):
- Chef, driver, guide or staff member asking about an event they are working:
  "how many guests on Friday?", "what time should I arrive?", "what's the address?"
- Someone confirming availability to WORK a shift (not to book an experience)
- Venue, rental or supplier coordination for an already-booked event
- Meeting scheduling, Google Meet / calendar notes, "can we hop on a call?"
- Invoices or receipts from suppliers
- "Thanks!" / "Sounds good" with no new event ask

category: Valid | Job Application | Hiring-Related | Unrelated Inquiry | Possible Spam | Other
Use "Unrelated Inquiry" for operational_or_staff and meeting/logistics mail.

PART 2 — FIELD EXTRACTION (only if business_potential = "Yes")
- name / email / phone from fields, signature, or From header
- company: ONLY if explicitly mentioned — do NOT guess from domain
- event_type_interest: comma-separated from ${JSON.stringify(EVENT_TYPE_INTEREST_OPTIONS)}
- event_format: ${JSON.stringify(EVENT_FORMAT_ENUM)}
- preferred_date: ISO date-time if explicit; if no year, next future occurrence vs today's date in the user message
- headcount_estimate: numeric if mentioned
- channel: ${JSON.stringify(CHANNEL_ENUM)}
- inquiry_type: ${JSON.stringify(INQUIRY_TYPE_ENUM)}
- client_type: ${JSON.stringify(CLIENT_TYPE_ENUM)} — default "New"
- page_url: from body if present

★ FOCUS ON THE NEWEST MESSAGE ONLY ★
Ignore quoted history and signatures. The "reason" field MUST cite direction of intent.`;

  // Per-email dynamic user prompt — not cached.
  const user = `You are processing ${emailKind} for Mangia DC.

Today's date is: ${todayIso}

${openLeadContextBlock}
────────────────────────────────────────────────────────────────────────
EMAIL DATA
────────────────────────────────────────────────────────────────────────
Subject: ${input.subject}
From: ${input.from}
Body:
${input.emailBody.substring(0, 2000)}`;

  return { system, user };
}

export function isValidClassifyResult(
  raw: unknown
): raw is ClassifyInboundEmailLlmResult {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  const validCategories = [
    "Valid",
    "Job Application",
    "Hiring-Related",
    "Unrelated Inquiry",
    "Possible Spam",
    "Other",
  ];
  const validSenderRoles = [
    "prospective_customer",
    "promoter_or_vendor",
    "operational_or_staff",
    "other",
  ];
  return (
    validCategories.includes(String(r.category)) &&
    ["Yes", "No"].includes(String(r.business_potential)) &&
    validSenderRoles.includes(String(r.sender_role))
  );
}
