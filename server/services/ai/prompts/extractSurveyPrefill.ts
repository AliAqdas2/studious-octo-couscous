import type { JsonSchemaObject } from "../types.js";

export interface SurveyPrefillLlmResult {
  occasion?: string;
  preferred_time?: string;
  event_format?: string;
  available_dates?: string;
  guest_count?: string;
  transportation_needed?: string;
  drinking_level?: string;
  competitive_group?: string;
  budget?: string;
  decision_maker?: string;
}

export const extractSurveyPrefillSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    occasion: {
      type: "string",
      description:
        "The occasion or reason for the event (e.g. company meeting, team-building). Empty string if not stated.",
    },
    preferred_time: {
      type: "string",
      description:
        "Preferred time of day for the event (e.g. 2 PM, early evening). Empty string if not stated.",
    },
    event_format: {
      type: "string",
      description:
        "In-person, virtual, or hybrid — only if explicitly stated. Empty string if not stated.",
    },
    available_dates: {
      type: "string",
      description:
        "Date(s) the client mentioned for the event, in natural language. Empty string if not stated.",
    },
    guest_count: {
      type: "string",
      description:
        "Headcount / group size as stated (e.g. 10 people, around 25). Empty string if not stated.",
    },
    transportation_needed: {
      type: "string",
      description: "Transportation needs if mentioned. Empty string if not stated.",
    },
    drinking_level: {
      type: "string",
      description: "Drinking preference if mentioned. Empty string if not stated.",
    },
    competitive_group: {
      type: "string",
      description: "Whether group is competitive if mentioned. Empty string if not stated.",
    },
    budget: {
      type: "string",
      description: "Budget if mentioned. Empty string if not stated.",
    },
    decision_maker: {
      type: "string",
      description: "Who processes payment / decision maker if mentioned. Empty string if not stated.",
    },
  },
  required: [],
};

export function buildExtractSurveyPrefillPrompt(input: {
  notes: string;
  knownFields: Record<string, string | number | null | undefined>;
}): { system: string; user: string } {
  const known = Object.entries(input.knownFields)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const system = `You extract survey questionnaire pre-fill values from a lead inquiry email or notes for Mangia DC, a Washington DC events company.

Rules:
- Extract ONLY information explicitly stated in the inquiry text.
- Do NOT invent or guess values.
- Return empty string for any field not clearly stated.
- For occasion, use the event purpose (e.g. "company meeting"), NOT the experience type (food tour).
- For guest_count, include "people" when a number is given (e.g. "10 people").
- For event_format, use lowercase: in-person, virtual, or hybrid.`;

  const user = `Known CRM fields already on file:
${known || "(none)"}

Inquiry notes / email:
${input.notes.substring(0, 4000)}

Extract pre-fill values for the survey questionnaire. Leave fields empty when not stated.`;

  return { system, user };
}
