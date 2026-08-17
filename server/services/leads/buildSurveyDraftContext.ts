import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { leads } from "../../db/schema/index.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import {
  buildExtractSurveyPrefillPrompt,
  extractSurveyPrefillSchema,
  type SurveyPrefillLlmResult,
} from "../ai/prompts/extractSurveyPrefill.js";
import { EASTERN_TZ } from "../dates/easternTime.js";

export interface SurveyDataJson {
  occasion?: string | null;
  preferred_time?: string | null;
  daytime_phone?: string | null;
  event_format?: string | null;
  competitive_group?: string | null;
  guest_count?: string | null;
  decision_maker?: string | null;
  transportation_needed?: string | null;
  drinking_level?: string | null;
  available_dates?: string | null;
  budget?: string | null;
}

export interface SurveyPrefill {
  name: string;
  company: string;
  occasion: string;
  available_dates: string;
  preferred_time: string;
  event_format: string;
  phone: string;
  guest_count: string;
  transportation_needed: string;
  drinking_level: string;
  competitive_group: string;
  budget: string;
  decision_maker: string;
}

function parseSurveyData(raw: unknown): SurveyDataJson {
  if (!raw || typeof raw !== "object") return {};
  return raw as SurveyDataJson;
}

function formatPreferredDateLong(date: Date | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatEventFormatDisplay(
  value: string | null | undefined
): string {
  if (!value) return "";
  const norm = value.trim().toLowerCase();
  if (norm === "in-person" || norm === "in person") return "in-person";
  if (norm === "virtual") return "virtual";
  if (norm === "hybrid") return "hybrid";
  return value.trim();
}

function formatHeadcount(
  estimate: number | null | undefined,
  guestCount: string | null | undefined
): string {
  if (guestCount?.trim()) return guestCount.trim();
  if (estimate == null || estimate <= 0) return "";
  const n = Number(estimate);
  if (!Number.isFinite(n)) return "";
  return `${n} people`;
}

function str(value: string | null | undefined): string {
  return value?.trim() || "";
}

function mergePrefillFromLead(
  lead: typeof leads.$inferSelect,
  surveyData: SurveyDataJson
): SurveyPrefill {
  const availableFromDate = formatPreferredDateLong(lead.preferredDate);

  return {
    name: str(lead.name),
    company: str(lead.company),
    occasion: str(surveyData.occasion),
    available_dates:
      str(surveyData.available_dates) || availableFromDate,
    preferred_time: str(surveyData.preferred_time),
    event_format:
      formatEventFormatDisplay(surveyData.event_format) ||
      formatEventFormatDisplay(lead.eventFormat),
    phone: str(surveyData.daytime_phone) || str(lead.phone),
    guest_count: formatHeadcount(
      lead.headcountEstimate,
      surveyData.guest_count
    ),
    transportation_needed: str(surveyData.transportation_needed),
    drinking_level: str(surveyData.drinking_level),
    competitive_group: str(surveyData.competitive_group),
    budget: str(surveyData.budget),
    decision_maker: str(surveyData.decision_maker),
  };
}

const PREFILL_LLM_KEYS: (keyof SurveyPrefillLlmResult)[] = [
  "occasion",
  "preferred_time",
  "event_format",
  "available_dates",
  "guest_count",
  "transportation_needed",
  "drinking_level",
  "competitive_group",
  "budget",
  "decision_maker",
];

function needsLlmExtraction(prefill: SurveyPrefill, notes: string): boolean {
  if (!notes.trim()) return false;
  const criticalEmpty =
    !prefill.occasion ||
    !prefill.preferred_time ||
    !prefill.event_format ||
    !prefill.available_dates ||
    !prefill.guest_count;
  return criticalEmpty;
}

function applyLlmToPrefill(
  prefill: SurveyPrefill,
  llm: SurveyPrefillLlmResult
): SurveyPrefill {
  const next = { ...prefill };
  if (!next.occasion && llm.occasion?.trim()) next.occasion = llm.occasion.trim();
  if (!next.preferred_time && llm.preferred_time?.trim()) {
    next.preferred_time = llm.preferred_time.trim();
  }
  if (!next.event_format && llm.event_format?.trim()) {
    next.event_format = formatEventFormatDisplay(llm.event_format);
  }
  if (!next.available_dates && llm.available_dates?.trim()) {
    next.available_dates = llm.available_dates.trim();
  }
  if (!next.guest_count && llm.guest_count?.trim()) {
    next.guest_count = llm.guest_count.trim();
  }
  if (!next.transportation_needed && llm.transportation_needed?.trim()) {
    next.transportation_needed = llm.transportation_needed.trim();
  }
  if (!next.drinking_level && llm.drinking_level?.trim()) {
    next.drinking_level = llm.drinking_level.trim();
  }
  if (!next.competitive_group && llm.competitive_group?.trim()) {
    next.competitive_group = llm.competitive_group.trim();
  }
  if (!next.budget && llm.budget?.trim()) next.budget = llm.budget.trim();
  if (!next.decision_maker && llm.decision_maker?.trim()) {
    next.decision_maker = llm.decision_maker.trim();
  }
  return next;
}

function prefillToSurveyData(
  prefill: SurveyPrefill,
  existing: SurveyDataJson
): SurveyDataJson {
  return {
    ...existing,
    occasion: prefill.occasion || existing.occasion || null,
    preferred_time: prefill.preferred_time || existing.preferred_time || null,
    event_format: prefill.event_format || existing.event_format || null,
    available_dates: prefill.available_dates || existing.available_dates || null,
    guest_count: prefill.guest_count || existing.guest_count || null,
    daytime_phone: prefill.phone || existing.daytime_phone || null,
    transportation_needed:
      prefill.transportation_needed || existing.transportation_needed || null,
    drinking_level: prefill.drinking_level || existing.drinking_level || null,
    competitive_group:
      prefill.competitive_group || existing.competitive_group || null,
    budget: prefill.budget || existing.budget || null,
    decision_maker: prefill.decision_maker || existing.decision_maker || null,
  };
}

export interface BuildSurveyDraftContextResult {
  prefill: SurveyPrefill;
  surveyData: SurveyDataJson;
}

/**
 * Merge lead fields + surveyData; optionally run LLM on notes for gaps.
 * Persists merged surveyData back to the lead when LLM fills new values.
 */
export async function buildSurveyDraftContext(
  lead: typeof leads.$inferSelect
): Promise<BuildSurveyDraftContextResult> {
  const existingSurveyData = parseSurveyData(lead.surveyData);
  let prefill = mergePrefillFromLead(lead, existingSurveyData);

  let llmResult: SurveyPrefillLlmResult | null = null;
  if (needsLlmExtraction(prefill, lead.notes || "")) {
    if (isAiConfigured()) {
      try {
        const ai = getAiProvider();
        const { system, user } = buildExtractSurveyPrefillPrompt({
          notes: lead.notes || "",
          knownFields: {
            name: lead.name,
            company: lead.company,
            event_type: lead.eventTypeInterest,
            event_format: lead.eventFormat,
            preferred_date: formatPreferredDateLong(lead.preferredDate),
            headcount: lead.headcountEstimate,
            phone: lead.phone,
          },
        });
        const completion = await ai.structuredComplete<SurveyPrefillLlmResult>({
          system,
          user,
          jsonSchema: extractSurveyPrefillSchema,
          schemaName: "extract_survey_prefill",
          temperature: 0,
          maxTokens: 1024,
        });
        llmResult = completion.data || {};
        prefill = applyLlmToPrefill(prefill, llmResult);
      } catch (err) {
        console.warn(
          "[buildSurveyDraftContext] LLM prefill failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const surveyData = prefillToSurveyData(prefill, existingSurveyData);

  const llmAddedValue = llmResult && PREFILL_LLM_KEYS.some((key) => {
    const fromLlm = llmResult![key]?.trim();
    if (!fromLlm) return false;
    const existing = existingSurveyData[key as keyof SurveyDataJson];
    return !existing || !String(existing).trim();
  });

  if (llmAddedValue) {
    const db = getDb();
    if (db) {
      await db
        .update(leads)
        .set({ surveyData, updatedDate: new Date() })
        .where(eq(leads.id, lead.id));
    }
  }

  return { prefill, surveyData };
}

/** Build initial surveyData from intake LLM fields. */
export function buildInitialSurveyDataFromIntake(input: {
  occasion?: string | null;
  preferred_time?: string | null;
  event_format?: string | null;
  preferred_date?: Date | null;
  headcount_estimate?: number | null;
  phone?: string | null;
}): SurveyDataJson | null {
  const data: SurveyDataJson = {
    occasion: input.occasion?.trim() || null,
    preferred_time: input.preferred_time?.trim() || null,
    event_format: input.event_format
      ? formatEventFormatDisplay(input.event_format)
      : null,
    available_dates: formatPreferredDateLong(input.preferred_date) || null,
    guest_count: formatHeadcount(input.headcount_estimate, null) || null,
    daytime_phone: input.phone?.trim() || null,
  };

  const hasAny = Object.values(data).some((v) => v != null && String(v).trim());
  return hasAny ? data : null;
}
