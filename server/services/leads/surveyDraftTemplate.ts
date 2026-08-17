import type { leads } from "../../db/schema/index.js";
import type { SurveyPrefill } from "./buildSurveyDraftContext.js";

export const MEETING_DATE_TIME_PLACEHOLDER = "<MEETING DATE AND TIME>";

/** Cloned B2B Survey copy — not loaded from CSV/DB for no-answer fallback. */
export const SURVEY_DRAFT_INTRO = `Thank you so much for reaching out to plan a future function with us. We've worked with many groups in the past...rest assured you're in good hands and will have a blast!

The good news is that we'd love to work with you. However, we are receiving lots of experience requests around this time and recommend attempting to block off times for your group sooner rather than later.

We'll do our best to make sure to support your budget and take pride in customizing our experiences to your organization's culture. We have experiences that range from $59-$300 a person but try to customize these experiences to align with your group dynamic. To better understand your group dynamic and to get us started, perhaps you could help address these few questions. I've went ahead and answered what you have already told me:`;

export interface SurveyQuestionRow {
  question: string;
  answerKey: keyof SurveyPrefill;
}

export const SURVEY_DRAFT_QUESTIONS: SurveyQuestionRow[] = [
  { question: "Name:", answerKey: "name" },
  { question: "What is the company name?", answerKey: "company" },
  { question: "What is the occasion?", answerKey: "occasion" },
  {
    question:
      "What date(s) did you have in mind? Can you please send us multiple available dates when you have a moment?",
    answerKey: "available_dates",
  },
  {
    question:
      "What time of day is preferred for this event or is that flexible?",
    answerKey: "preferred_time",
  },
  {
    question:
      "Would you like this to be in-person, virtual, or hybrid (in-person & virtual)?",
    answerKey: "event_format",
  },
  { question: "What is your daytime phone number?", answerKey: "phone" },
  {
    question: "Around how many people do you have in mind?",
    answerKey: "guest_count",
  },
  { question: "Do you need transportation?", answerKey: "transportation_needed" },
  {
    question:
      "Would you consider the group to be none, light, or moderate drinkers?",
    answerKey: "drinking_level",
  },
  {
    question: "Would you consider your group(s) competitive or not so much?",
    answerKey: "competitive_group",
  },
  { question: "What is your budget for this event?", answerKey: "budget" },
  {
    question:
      "Would you be responsible for processing this or who else would need to be involved?",
    answerKey: "decision_maker",
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boldAnswer(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return ` <b>${escapeHtml(trimmed)}</b>`;
}

/** Calendar prose or red placeholder when availability could not be fetched. */
export function formatMeetingAvailabilityHtml(prose: string | null): string {
  if (prose?.trim()) {
    return escapeHtml(prose.trim());
  }
  return `<span style="color:#C62828;font-weight:bold">${escapeHtml(MEETING_DATE_TIME_PLACEHOLDER)}</span>`;
}

export function buildSurveyDraftSubject(
  lead: typeof leads.$inferSelect
): string {
  const companyForSubject =
    lead.company?.trim() || lead.name?.trim() || "your group";
  return `Event Planning Survey - ${companyForSubject}`;
}

export function buildSurveyDraftHtml(
  lead: typeof leads.$inferSelect,
  prefill: SurveyPrefill,
  availabilityProse: string | null
): string {
  const greeting = escapeHtml(lead.name?.trim() || "there");
  const questionLines = SURVEY_DRAFT_QUESTIONS.map(({ question, answerKey }) => {
    const answer = prefill[answerKey] || "";
    return `${escapeHtml(question)}${boldAnswer(answer)}`;
  }).join("<br><br>");

  const availabilityHtml = formatMeetingAvailabilityHtml(availabilityProse);
  const closing = `Sending you documentation and a brief program planning discussion will help customize this experience to help keep this process smooth and seamless. Does ${availabilityHtml} work? Please let me know which time works best for you so we can plan accordingly.`;

  const introHtml = SURVEY_DRAFT_INTRO.split("\n\n")
    .map((p) => escapeHtml(p))
    .join("<br><br>");

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #2D3436;">Hi ${greeting},<br><br>${introHtml}<br><br>${questionLines}<br><br>${closing}<br><br>Here to help and look forward to further planning this with you.<br><br>Sincerely,<br>Dave</div>`;
}
