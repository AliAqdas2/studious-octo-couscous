import { eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  automationConfig,
  callLogs,
  leads,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import type { JsonSchemaObject } from "../ai/types.js";
import {
  isLocalFileUrl,
  parseFileIdFromUrl,
  readFileBuffer,
  saveBuffer,
} from "../files/storage.js";
import { sendGmailEmail } from "../gmail/send.js";
import { sendSurveyDraftOnCallFailure } from "../leads/sendSurveyDraftOnCallFailure.js";

const LOG = "[analyzeCall]";

const AVAILABLE_STAGES = [
  "New Inquiry",
  "Outreach Initiated – Call Attempted",
  "No Answer – 1st Email Sent",
  "Calendar Invite Sent",
  "Invite Not Accepted",
  "2nd Follow-Up – Off Radar",
  "No Response – Final Email Sent",
  "Invite Accepted – Survey Sent",
  "Program Planning Discussion",
  "After Meeting Follow-Up",
  "Deposit Requested",
  "Confirmed Sales",
  "Lost/Canceled",
  "Initial Outreach – Call to Schedule",
  "Survey Sent",
  "Awaiting Survey Response (24hr)",
  "No Survey Response – Follow-Up 1",
  "Awaiting Response After Follow-Up 1",
  "No Response – Follow-Up 2",
  "Awaiting Response After Follow-Up 2",
  "Survey Completed – Calendar Invite Sent",
  "Awaiting Calendar Acceptance",
  "Calendar Invite Resent",
  "Calendar Accepted",
] as const;

const AVAILABLE_EVENT_TYPES = [
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
] as const;

interface ExtractedCall {
  talked_to_lead: boolean;
  summary: string;
  nextStage?: string;
  notes?: string;
  budget?: string;
  headcount?: string;
  timing?: string;
  /** Agreed planning-call datetime (regroup / questionnaire review). */
  meeting_date_iso?: string;
  /** When the client wants the experience/event itself. */
  event_date_iso?: string;
  event_types_interested?: string[];
  event_type_other?: string;
  event_format?: "In-Person" | "Virtual" | "Hybrid";
  channel?: "B2B" | "B2C";
  contact_name?: string;
  contact_company?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  venue?: string;
  dietary_restrictions?: string;
  special_requests?: string;
  transportation_needed?: boolean;
  alcohol_preference?: string;
  occasion?: string;
  decision_maker?: string;
}

const PLACEHOLDER_PATTERN =
  /^(not mentioned|not provided|unknown|n\/?a|none|null|no phone|no email)$/i;

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") {
    const t = v.trim();
    return t !== "" && !PLACEHOLDER_PATTERN.test(t);
  }
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function twilioBasicAuth(): string {
  const sid = env.twilioAccountSid();
  const token = env.twilioAuthToken();
  if (!sid || !token) {
    throw new AppError("Twilio credentials not configured", 500);
  }
  return Buffer.from(`${sid}:${token}`).toString("base64");
}

async function downloadRecording(recordingUrl: string): Promise<Buffer> {
  if (isLocalFileUrl(recordingUrl)) {
    const id = parseFileIdFromUrl(recordingUrl);
    if (!id) {
      throw new AppError("Invalid local recording URL", 400);
    }
    const { buffer } = await readFileBuffer(id);
    return buffer;
  }

  const audioUrl = recordingUrl.endsWith(".mp3")
    ? recordingUrl
    : `${recordingUrl}.mp3`;
  const auth = twilioBasicAuth();
  const delays = [2000, 3000, 4000, 5000, 6000];
  let lastStatus = 0;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const res = await fetch(audioUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });
    lastStatus = res.status;
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
    if (res.status !== 404 || attempt === delays.length) break;
    console.log(
      `${LOG} Recording not yet available (404), retrying in ${delays[attempt]}ms`
    );
    await new Promise((r) => setTimeout(r, delays[attempt]!));
  }

  throw new AppError(
    `Failed to download recording: HTTP ${lastStatus}`,
    502
  );
}

async function transcribeWithDeepgram(audio: Buffer): Promise<string> {
  const deepgramKey = env.deepgramApiKey();
  if (!deepgramKey) {
    throw new AppError("DEEPGRAM_API_KEY not configured", 500);
  }

  const dgRes = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize=true&punctuate=true&paragraphs=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramKey}`,
        "Content-Type": "audio/mpeg",
      },
      body: audio,
    }
  );

  if (!dgRes.ok) {
    const errText = await dgRes.text();
    console.error(`${LOG} Deepgram failed:`, dgRes.status, errText);
    throw new AppError(`Deepgram transcription failed: ${dgRes.status}`, 502);
  }

  const dgData = (await dgRes.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          paragraphs?: {
            paragraphs?: Array<{
              speaker?: number;
              sentences?: Array<{ text?: string }>;
            }>;
          };
        }>;
      }>;
    };
  };

  const alt = dgData?.results?.channels?.[0]?.alternatives?.[0] || {};
  const paragraphs = alt?.paragraphs?.paragraphs;
  if (Array.isArray(paragraphs) && paragraphs.length > 0) {
    return paragraphs
      .map((p) => {
        const text = (p.sentences || []).map((s) => s.text || "").join(" ");
        return `Speaker ${p.speaker ?? 0}: ${text}`;
      })
      .join("\n")
      .trim();
  }
  return (alt.transcript || "").trim();
}

function normalizeEventType(val: string): string | null {
  const exact = AVAILABLE_EVENT_TYPES.find((t) => t === val);
  if (exact) return exact;
  const lower = val.toLowerCase().trim();
  return AVAILABLE_EVENT_TYPES.find((t) => t.toLowerCase() === lower) || null;
}

/** Interpret naive ISO as America/New_York wall time → UTC Date. */
function easternWallTimeToUtc(isoLike: string): Date | null {
  const m = isoLike.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) {
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(isoLike.trim())) {
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] || 0);
  const targetAsUtc = Date.UTC(y, mo, day, h, mi, s);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let utcMs = targetAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value || "0";
    const hourRaw = Number(get("hour"));
    const asUtc = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      hourRaw === 24 ? 0 : hourRaw,
      Number(get("minute")),
      Number(get("second"))
    );
    utcMs += targetAsUtc - asUtc;
  }
  return new Date(utcMs);
}

function correctPreferredDate(iso: string): Date | null {
  const now = new Date();
  let fixed = easternWallTimeToUtc(iso);
  if (!fixed) return null;

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  if (fixed < oneYearAgo) {
    const adjusted = new Date(fixed);
    adjusted.setFullYear(now.getFullYear());
    if (adjusted < now) adjusted.setFullYear(now.getFullYear() + 1);
    // Re-interpret wall components after year fix
    const pad = (n: number) => String(n).padStart(2, "0");
    const wall = `${adjusted.getUTCFullYear()}-${pad(adjusted.getUTCMonth() + 1)}-${pad(adjusted.getUTCDate())}T${pad(adjusted.getUTCHours())}:${pad(adjusted.getUTCMinutes())}:${pad(adjusted.getUTCSeconds())}`;
    fixed = easternWallTimeToUtc(wall) || adjusted;
  }
  return fixed;
}

const extractionSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    talked_to_lead: { type: "boolean" },
    summary: { type: "string" },
    nextStage: { type: "string", enum: [...AVAILABLE_STAGES] },
    notes: { type: "string" },
    budget: { type: "string" },
    headcount: { type: "string" },
    timing: { type: "string" },
    meeting_date_iso: { type: "string" },
    event_date_iso: { type: "string" },
    event_types_interested: {
      type: "array",
      items: { type: "string", enum: [...AVAILABLE_EVENT_TYPES] },
    },
    event_type_other: { type: "string" },
    event_format: {
      type: "string",
      enum: ["In-Person", "Virtual", "Hybrid"],
    },
    channel: { type: "string", enum: ["B2B", "B2C"] },
    contact_name: { type: "string" },
    contact_company: { type: "string" },
    contact_title: { type: "string" },
    contact_email: { type: "string" },
    contact_phone: { type: "string" },
    venue: { type: "string" },
    dietary_restrictions: { type: "string" },
    special_requests: { type: "string" },
    transportation_needed: { type: "boolean" },
    alcohol_preference: {
      type: "string",
      enum: ["Alcohol", "Non-Alcohol", "Mocktails", "Mixed"],
    },
    occasion: { type: "string" },
    decision_maker: { type: "string" },
  },
  required: ["summary", "talked_to_lead"],
};

export interface AnalyzeCallParams {
  callLogId: string;
  recordingUrl?: string;
  reanalyze?: boolean;
}

export interface AnalyzeCallResult {
  ok: boolean;
  note?: string;
  voicemail?: boolean;
  extracted?: ExtractedCall;
}

export async function analyzeCall(
  params: AnalyzeCallParams
): Promise<AnalyzeCallResult> {
  const db = requireDb();
  const { callLogId, reanalyze } = params;

  const [callLog] = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.id, callLogId))
    .limit(1);

  if (!callLog) {
    throw new AppError("CallLog not found", 404);
  }

  let recordingUrl =
    params.recordingUrl || callLog.recordingUrl || "";
  const leadId = callLog.leadId;

  if (!reanalyze && params.recordingUrl) {
    await db
      .update(callLogs)
      .set({
        recordingUrl: params.recordingUrl,
        status: "Completed",
        endedAt: new Date(),
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));
    recordingUrl = params.recordingUrl;
  }

  if (!recordingUrl) {
    return { ok: true, note: "No recording URL to analyze" };
  }

  if (!isAiConfigured()) {
    throw new AppError("AI is not configured", 503);
  }

  let audio: Buffer;
  try {
    audio = await downloadRecording(recordingUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(callLogs)
      .set({ errorMessage: msg, updatedDate: new Date() })
      .where(eq(callLogs.id, callLogId));
    throw err;
  }

  // Persist Twilio recording to local storage so the UI can play it without Twilio auth.
  if (!isLocalFileUrl(recordingUrl)) {
    try {
      const saved = await saveBuffer({
        buffer: audio,
        filename: `call-${callLogId}.mp3`,
        contentType: "audio/mpeg",
      });
      recordingUrl = saved.fileUrl;
      await db
        .update(callLogs)
        .set({
          recordingUrl: saved.fileUrl,
          updatedDate: new Date(),
        })
        .where(eq(callLogs.id, callLogId));
      console.log(`${LOG} Saved recording to ${saved.fileUrl}`);
    } catch (err) {
      console.warn(
        `${LOG} Failed to persist recording locally (continuing with analysis):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  let transcript: string;
  try {
    transcript = await transcribeWithDeepgram(audio);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(callLogs)
      .set({
        errorMessage: msg,
        status: "Completed",
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));
    throw err;
  }

  console.log(
    `${LOG} Transcript length:`,
    transcript.length,
    "preview:",
    transcript.substring(0, 200)
  );

  if (!transcript || transcript.length < 3) {
    await db
      .update(callLogs)
      .set({
        transcript: "[No audible speech detected in recording]",
        errorMessage: "Audio was silent or unclear",
        status: "Completed",
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));
    return { ok: true, note: "No audible speech in recording" };
  }

  await db
    .update(callLogs)
    .set({ transcript, updatedDate: new Date() })
    .where(eq(callLogs.id, callLogId));

  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are an assistant analyzing a sales call transcript for Mangia DC, a company that hosts food, wine, cooking, mixology, paint & sip, yoga, food tours, monuments tours, and team-building experiences in Washington DC.

Today's date is ${today}. When resolving dates (e.g. "June 15", "next Friday"), use the CURRENT year (${year}), not a past year. The transcript was recorded very recently — any date mentioned is in the present or near future.

Mangia DC offers EXACTLY these event types (this is the master list — the values are CASE-SENSITIVE):
${AVAILABLE_EVENT_TYPES.map((t) => `- ${t}`).join("\n")}

Your job: extract ONLY information that is explicitly mentioned in the transcript. If a field is not mentioned, OMIT it from the response (do not return empty strings or guesses). Only include a field if the caller actually said something about it.

Extract the following:
- talked_to_lead (REQUIRED): boolean.
    * true ONLY if there is a real two-way conversation between the rep and the lead in the transcript — both sides clearly speaking and responding to each other.
    * false if any of these are true: the transcript is empty, the rep is the only one speaking (e.g. they left a voicemail), the lead said nothing meaningful, or the transcript appears to be only a voicemail greeting + the rep's recorded message.
- summary (REQUIRED): 2-3 sentence summary of the call (or "Rep left a voicemail" if talked_to_lead is false)
- nextStage: based on the call outcome, pick ONE pipeline stage from this list (CASE-SENSITIVE — return the value verbatim):
${AVAILABLE_STAGES.map((s) => `    * ${s}`).join("\n")}
  Guidance:
    * If a SPECIFIC planning-call date AND time was clearly agreed on (e.g. "let's regroup Wednesday at 10am") → "Program Planning Discussion" (and you MUST also fill meeting_date_iso with that exact date+time).
    * If the lead is interested but NO specific meeting date/time was confirmed yet → "Initial Outreach – Call to Schedule"
    * If a proposal / deposit was requested → "Deposit Requested"
    * If they confirmed and want to move forward / pay → "Confirmed Sales"
    * If they're not interested / canceled → "Lost/Canceled"
    * If a follow-up call was scheduled → "After Meeting Follow-Up"
    * If you cannot confidently determine a stage from the transcript, OMIT this field entirely (do not guess — the lead's current stage will be preserved).
- notes: any other useful info / action items for the rep
- budget: any mentioned budget (e.g. "$5000", "around $3-5k")
- headcount: number of guests / attendees mentioned (just the number as a string)
- timing: when they want to do the EVENT/EXPERIENCE (free text, e.g. "September 21st", "May 10 at 2pm"). This is NOT the planning-call time.
- meeting_date_iso: the agreed PLANNING CALL / regroup datetime only (ISO 8601 YYYY-MM-DDTHH:mm:ss, Eastern wall time). Use when rep and lead schedule a call to discuss logistics, questionnaire, pricing, etc. If only a date (no time), use YYYY-MM-DDT00:00:00. NEVER put the event/experience date here.
- event_date_iso: when they want the actual EVENT/EXPERIENCE (ISO 8601 YYYY-MM-DDTHH:mm:ss). Phrases like "interest on the twenty-first", "retreat in September", "event on Sep 21". If only a date (no time), use YYYY-MM-DDT00:00:00. NEVER put the planning-call datetime here.
  DATE DISAMBIGUATION (critical — calls often mention BOTH):
    * Planning call: "regroup Wednesday at 10", "planning discussion tomorrow at 3" → meeting_date_iso only
    * Event date: "experience on the twenty-first", "retreat September 21" → event_date_iso + timing
    * Example: lead wants event Sep 21 and agrees to planning call Wed Aug 20 at 10am ET → event_date_iso: 2026-09-21T00:00:00, timing: "September 21st", meeting_date_iso: 2026-08-20T10:00:00, nextStage: "Program Planning Discussion"
- event_types_interested: array of event types from the master list above that the caller mentioned interest in. **You MUST return values EXACTLY as they appear in the master list — same spelling, same casing, same punctuation.**
- event_type_other: if they mentioned an event type that genuinely does NOT match anything in the master list, put it here as free text.
- event_format: ONE of "In-Person", "Virtual", "Hybrid" — only if explicitly mentioned.
- channel: "B2B" if it's a company/team event, "B2C" if it's personal/private. Only if clear.
- contact_name, contact_company, contact_title, contact_email, contact_phone: only if mentioned.
- venue, dietary_restrictions, special_requests, transportation_needed, alcohol_preference, occasion, decision_maker: only if mentioned.

Transcript:
${transcript.substring(0, 8000)}

CRITICAL: OMIT any field that was not explicitly mentioned in the transcript. Do NOT return "not mentioned", "unknown", "n/a", or similar placeholder strings — simply OMIT the field from the JSON entirely.`;

  const ai = getAiProvider();
  const completion = await ai.structuredComplete<ExtractedCall>({
    system:
      "You extract structured CRM fields from sales call transcripts. Return only fields that were explicitly stated.",
    user: prompt,
    jsonSchema: extractionSchema,
    schemaName: "analyze_call_extraction",
    temperature: 0,
    maxTokens: 4096,
  });

  const extracted = completion.data || ({} as ExtractedCall);

  if (extracted.talked_to_lead === false) {
    console.log(
      `${LOG} No two-way conversation detected — treating as voicemail/no-answer.`
    );

    await db
      .update(callLogs)
      .set({
        summary:
          extracted.summary ||
          "Rep left a voicemail — no two-way conversation.",
        extractedNotes:
          "Voicemail / no-answer — survey draft created for lead. CRM fields not updated.",
        status: "Analyzed",
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, callLogId));

    if (leadId) {
      await db
        .update(leads)
        .set({
          stage: "No Answer – 1st Email Sent",
          lastContactDate: new Date(),
          updatedDate: new Date(),
        })
        .where(eq(leads.id, leadId));

      void sendSurveyDraftOnCallFailure(leadId, "voicemail").catch((e) =>
        console.error(
          `${LOG} sendSurveyDraftOnCallFailure failed:`,
          e instanceof Error ? e.message : e
        )
      );
    }

    return { ok: true, voicemail: true, extracted };
  }

  const matchedCanonical = Array.isArray(extracted.event_types_interested)
    ? extracted.event_types_interested
        .map(normalizeEventType)
        .filter((t): t is string => Boolean(t))
    : [];

  const eventInterestParts: string[] = [];
  if (matchedCanonical.length > 0) eventInterestParts.push(...matchedCanonical);
  if (hasValue(extracted.event_type_other) && !matchedCanonical.length) {
    eventInterestParts.push(extracted.event_type_other!);
  }
  const eventInterestStr = eventInterestParts.join(", ");

  const extractedNotes = [
    extracted.notes || "",
    eventInterestStr ? `Event interest: ${eventInterestStr}` : "",
    hasValue(extracted.occasion) ? `Occasion: ${extracted.occasion}` : "",
    hasValue(extracted.decision_maker)
      ? `Decision maker: ${extracted.decision_maker}`
      : "",
    hasValue(extracted.venue) ? `Venue: ${extracted.venue}` : "",
    hasValue(extracted.dietary_restrictions)
      ? `Dietary: ${extracted.dietary_restrictions}`
      : "",
    hasValue(extracted.special_requests)
      ? `Special requests: ${extracted.special_requests}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db
    .update(callLogs)
    .set({
      summary: extracted.summary || "",
      extractedBudget: extracted.budget || "",
      extractedHeadcount: extracted.headcount || "",
      extractedTiming: extracted.timing || "",
      extractedNextStage: extracted.nextStage || "",
      extractedNotes,
      status: "Analyzed",
      updatedDate: new Date(),
    })
    .where(eq(callLogs.id, callLogId));

  let correctedMeetingDate: Date | null = null;
  if (hasValue(extracted.meeting_date_iso)) {
    correctedMeetingDate = correctPreferredDate(extracted.meeting_date_iso!);
  }

  let correctedEventDate: Date | null = null;
  if (hasValue(extracted.event_date_iso)) {
    correctedEventDate = correctPreferredDate(extracted.event_date_iso!);
  }

  let resolvedStage = hasValue(extracted.nextStage)
    ? extracted.nextStage!
    : null;
  const hasMeetingTime = Boolean(correctedMeetingDate);
  const meetingStages = ["Program Planning Discussion", "Calendar Accepted"];

  if (resolvedStage && meetingStages.includes(resolvedStage)) {
    if (hasMeetingTime) {
      resolvedStage = "Program Planning Discussion";
    } else {
      resolvedStage = "Initial Outreach – Call to Schedule";
    }
  }

  if (leadId) {
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    const leadUpdate: Partial<typeof leads.$inferInsert> = {
      lastContactDate: new Date(),
      updatedDate: new Date(),
    };

    if (resolvedStage) leadUpdate.stage = resolvedStage;
    if (correctedMeetingDate) {
      leadUpdate.meetingDate = correctedMeetingDate;
    }

    if (hasValue(extracted.headcount)) {
      const num = parseInt(
        String(extracted.headcount).replace(/[^\d]/g, ""),
        10
      );
      if (!Number.isNaN(num)) leadUpdate.headcountEstimate = num;
    }
    if (eventInterestStr) leadUpdate.eventTypeInterest = eventInterestStr;
    if (hasValue(extracted.event_format)) {
      leadUpdate.eventFormat = extracted.event_format;
    }
    if (hasValue(extracted.channel)) leadUpdate.channel = extracted.channel;
    if (hasValue(extracted.contact_company)) {
      leadUpdate.company = extracted.contact_company;
    }
    if (hasValue(extracted.contact_title)) {
      leadUpdate.title = extracted.contact_title;
    }
    if (hasValue(extracted.contact_email)) {
      leadUpdate.email = extracted.contact_email;
    }
    if (hasValue(extracted.contact_phone)) {
      leadUpdate.phone = extracted.contact_phone;
    }
    if (correctedEventDate) {
      leadUpdate.preferredDate = correctedEventDate;
    }

    const noteLines = [
      `--- Call ${new Date().toISOString().slice(0, 10)} ---`,
      `Summary: ${extracted.summary || ""}`,
      hasValue(extracted.budget) ? `Budget: ${extracted.budget}` : "",
      hasValue(extracted.headcount)
        ? `Headcount: ${extracted.headcount}`
        : "",
      hasValue(extracted.timing) ? `Timing: ${extracted.timing}` : "",
      eventInterestStr ? `Event interest: ${eventInterestStr}` : "",
      hasValue(extracted.occasion) ? `Occasion: ${extracted.occasion}` : "",
      hasValue(extracted.venue) ? `Venue: ${extracted.venue}` : "",
      hasValue(extracted.dietary_restrictions)
        ? `Dietary: ${extracted.dietary_restrictions}`
        : "",
      hasValue(extracted.special_requests)
        ? `Special requests: ${extracted.special_requests}`
        : "",
      hasValue(extracted.transportation_needed)
        ? `Transportation needed: ${extracted.transportation_needed ? "yes" : "no"}`
        : "",
      hasValue(extracted.alcohol_preference)
        ? `Alcohol: ${extracted.alcohol_preference}`
        : "",
      hasValue(extracted.decision_maker)
        ? `Decision maker: ${extracted.decision_maker}`
        : "",
      hasValue(extracted.notes) ? `Notes: ${extracted.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const existingNotes = existingLead?.notes || "";
    leadUpdate.notes = existingNotes
      ? `${existingNotes}\n\n${noteLines}`
      : noteLines;

    await db.update(leads).set(leadUpdate).where(eq(leads.id, leadId));

    const lead = existingLead
      ? { ...existingLead, ...leadUpdate }
      : null;
    const [cfg] = await db
      .select()
      .from(automationConfig)
      .where(eq(automationConfig.key, "default"))
      .limit(1);

    const calendarLink = cfg?.calendarLink || "";
    const repEmail = cfg?.repEmail || "";
    const leadName = lead?.name || "there";
    const leadEmail = lead?.email;
    const stage = resolvedStage;

    const meetingTimeStr = hasMeetingTime && correctedMeetingDate
      ? correctedMeetingDate.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
          timeZoneName: "short",
        })
      : "";

    try {
      if (stage === "Program Planning Discussion" && leadEmail) {
        await sendGmailEmail({
          to: leadEmail,
          subject: "Your meeting with Mangia DC is confirmed",
          body: `Hi ${leadName},\n\nThanks for the call! Your planning meeting with Mangia DC is confirmed for:\n\n${meetingTimeStr || "the time we discussed"}\n\nWe'll send a calendar invite shortly. If you need to reschedule, just reply to this email or use the link below:\n${calendarLink}\n\nLooking forward to it!\n\n— The Mangia DC Team`,
          leadId,
          userName: "System (Call Analysis)",
        });
      } else if (
        stage === "Initial Outreach – Call to Schedule" &&
        leadEmail
      ) {
        await sendGmailEmail({
          to: leadEmail,
          subject: "Let’s find a time to chat",
          body: `Hi ${leadName},\n\nThanks so much for chatting with us today — really glad to hear you're interested in working with Mangia DC!\n\nTo dig into the details, let's get a planning call on the calendar. You can grab a time that works for you here:\n${calendarLink}\n\nOr just reply to this email with a few times that work and we'll lock one in.\n\n— The Mangia DC Team`,
          leadId,
          userName: "System (Call Analysis)",
        });
      } else if (stage === "Deposit Requested" && repEmail) {
        await sendGmailEmail({
          to: repEmail,
          subject: `[Action] Proposal needed for ${lead?.name || "lead"} (${lead?.company || "unknown"})`,
          body: `A call with ${lead?.name || "a lead"} just wrapped up and a proposal is needed.\n\nSummary: ${extracted.summary || ""}\nBudget: ${extracted.budget || "n/a"}\nHeadcount: ${extracted.headcount || "n/a"}\nTiming: ${extracted.timing || "n/a"}\nNotes: ${extracted.notes || "n/a"}\n\nLead phone: ${lead?.phone || ""}\nLead email: ${lead?.email || ""}`,
          leadId,
          userName: "System (Call Analysis)",
          systemAlert: true,
        });
      } else if (stage === "Lost/Canceled" && leadEmail) {
        await sendGmailEmail({
          to: leadEmail,
          subject: "Thanks for chatting with us",
          body: `Hi ${leadName},\n\nThanks so much for taking the time to talk with us today. We totally understand it's not the right fit right now — we'll keep you in the loop on future offerings in case anything sparks your interest down the road.\n\n— The Mangia DC Team`,
          leadId,
          userName: "System (Call Analysis)",
        });
      } else if (stage === "After Meeting Follow-Up" && leadEmail) {
        await sendGmailEmail({
          to: leadEmail,
          subject: "Following up on our call",
          body: `Hi ${leadName},\n\nThanks for the chat! Just following up — when works for you to take the next step?\n\n${calendarLink ? `Grab a time directly: ${calendarLink}\n\n` : ""}— The Mangia DC Team`,
          leadId,
          userName: "System (Call Analysis)",
        });
      }
    } catch (emailErr) {
      console.error(
        `${LOG} Follow-up email failed:`,
        emailErr instanceof Error ? emailErr.message : emailErr
      );
    }
  }

  return { ok: true, extracted };
}
