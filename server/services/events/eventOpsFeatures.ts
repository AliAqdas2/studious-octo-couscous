/** Global Event Ops feature flags (plan 06). WhatsApp forced off. */

export interface EventOpsFeatures {
  /** C104 — WhatsApp media collection. Always forced off. */
  whatsappMedia: boolean;
  /** C111 LinkedIn / tracker follow-up after V2 */
  linkedInFollowUp: boolean;
  /** C112 +3 month T-shirt path */
  tshirtThreeMonth: boolean;
  /** C115–C118 EMAIL 2 checklist tasks */
  email2FollowUps: boolean;
  /** Auto-create thank-you Gmail draft on Completed */
  thankYouAutoDraft: boolean;
  /**
   * Legacy short follow-ups from postEventAutomation (Upload Photos, etc.).
   * Off when Cooking DB workflow already seeds C106–C118. Hidden from UI.
   */
  legacyPostEventFollowups: boolean;
}

export const DEFAULT_EVENT_OPS_FEATURES: EventOpsFeatures = {
  whatsappMedia: false,
  linkedInFollowUp: true,
  tshirtThreeMonth: true,
  email2FollowUps: true,
  thankYouAutoDraft: true,
  legacyPostEventFollowups: false,
};

/** Keys shown in the Event Detail thank-you & follow-ups panel (stable order). */
export const EVENT_OPS_UI_FEATURE_KEYS: Array<
  Exclude<keyof EventOpsFeatures, "whatsappMedia" | "legacyPostEventFollowups">
> = [
  "thankYouAutoDraft",
  "linkedInFollowUp",
  "tshirtThreeMonth",
  "email2FollowUps",
];

export const EVENT_OPS_FEATURE_LABELS: Record<
  keyof EventOpsFeatures,
  { label: string; description: string }
> = {
  whatsappMedia: {
    label: "WhatsApp media task",
    description:
      "Day-of task to collect WhatsApp media. Disabled — not available.",
  },
  thankYouAutoDraft: {
    label: "Thank-you email draft",
    description:
      "When an event is marked Completed, create a thank-you draft in Gmail for the planner.",
  },
  linkedInFollowUp: {
    label: "LinkedIn follow-up (after V2)",
    description:
      "If thank-you V2 is chosen, add a task to request LinkedIn / update the event tracker.",
  },
  tshirtThreeMonth: {
    label: "Mangia T-shirt (~3 months)",
    description:
      "If thank-you V2 is chosen, schedule a reminder ~90 days later for a CEO thank-you and T-shirt.",
  },
  email2FollowUps: {
    label: "Follow-up checklist (EMAIL 2)",
    description:
      "Add checklist tasks for next event, intros, newsletter, and creating another lead.",
  },
  legacyPostEventFollowups: {
    label: "Legacy post-event tasks",
    description:
      "Also insert the old generic post-event follow-ups. Leave off for Cooking workflows.",
  },
};

export function mergeEventOpsFeatures(
  raw: unknown
): EventOpsFeatures {
  const base = { ...DEFAULT_EVENT_OPS_FEATURES };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...base, whatsappMedia: false };
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof EventOpsFeatures)[]) {
    if (key === "whatsappMedia") continue;
    if (typeof obj[key] === "boolean") {
      base[key] = obj[key] as boolean;
    }
  }
  // WhatsApp is not integrated — never enable C104.
  base.whatsappMedia = false;
  return base;
}

/** Map workflow conditional.if → feature flag key */
export const FEATURE_CONDITIONAL_MAP: Record<string, keyof EventOpsFeatures> = {
  feature_whatsapp_media: "whatsappMedia",
  feature_linkedin_followup: "linkedInFollowUp",
  feature_tshirt_three_month: "tshirtThreeMonth",
  feature_email2: "email2FollowUps",
};
