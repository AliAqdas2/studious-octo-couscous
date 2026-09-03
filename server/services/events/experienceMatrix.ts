/**
 * Experience matrix (plan 07 + meeting-first shared ROS).
 * Stubs / incomplete → flag Zach; do not invent inventory SKUs.
 * Meeting: shared skeleton + ROS; inventory and confirm-X are the main deltas.
 */

export type TimelineFamily = "A" | "B" | "C";
export type DocQuality = "complete" | "complete_ish" | "incomplete" | "stub";

export interface ExperienceMatrixRow {
  experienceKey: string;
  /** Value stored on events.event_type when selectable */
  eventType: string;
  displayName: string;
  timelineFamily: TimelineFamily;
  docQuality: DocQuality;
  /** Short note shown in admin UI */
  flagNote: string | null;
  /**
   * ROS “confirm X” label (meeting: confirm menu → painting / cocktails / …).
   * Shown in Run of Show UI and workflow task titles.
   */
  rosConfirmLabel: string;
  /** Real deltas to encode as tasks — no invented SKUs */
  deltas: string[];
}

export const EXPERIENCE_MATRIX: ExperienceMatrixRow[] = [
  {
    experienceKey: "In-Person Cooking",
    eventType: "In-Person Cooking",
    displayName: "In-Person Cooking Class",
    timelineFamily: "A",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm menu",
    deltas: ["Full cooking seed (traceability) — seeded separately"],
  },
  {
    experienceKey: "In-Person Paint & Sip",
    eventType: "In-Person Paint & Sip",
    displayName: "In-Person Paint & Sip",
    timelineFamily: "B",
    docQuality: "complete_ish",
    flagNote: null,
    rosConfirmLabel: "Confirm painting",
    deltas: [
      "Out-of-town: 8x10 canvas + bubble wrap vs house 11x14",
      "Scissors + large easels on BEO",
      "Canvas / easel / brush inventory (Michaels / 5 Below links in doc)",
    ],
  },
  {
    experienceKey: "In-Person Pottery",
    eventType: "In-Person Pottery",
    displayName: "In-Person Pottery Making",
    timelineFamily: "B",
    docQuality: "incomplete",
    flagNote: "Needs Zach inventory review — clay/kiln SKUs not invented",
    rosConfirmLabel: "Confirm pottery activity",
    deltas: ["Out-of-town clay + bubble; rest is Paint clone per doc"],
  },
  {
    experienceKey: "In-Person Lend a Hand",
    eventType: "In-Person Lend a Hand",
    displayName: "In-Person Lend a Hand for Good",
    timelineFamily: "B",
    docQuality: "incomplete",
    flagNote: "Needs Zach inventory review — materials placeholder",
    rosConfirmLabel: "Confirm activity",
    deltas: ["Materials placeholder; ON premise; Paint BEO gear"],
  },
  {
    experienceKey: "In-Person Terrarium",
    eventType: "In-Person Terrarium",
    displayName: "In-Person Terrarium",
    timelineFamily: "B",
    docQuality: "complete_ish",
    flagNote: null,
    rosConfirmLabel: "Confirm terrarium build",
    deltas: [
      "Full plant/soil inventory (cite doc URLs — seed as task notes, not cooking catalog)",
      "Remaining balance @2w",
      "Kit ship QA",
    ],
  },
  {
    experienceKey: "Flavors of DC",
    eventType: "Flavors of DC",
    displayName: "Flavors of DC",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: "Venues omit Foundry / 1015 15th per doc",
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: [
      "Early participant list",
      "Olive oil gift interest",
      "Multi-stop ordering/pickup/delivery",
      "Wheelchair accessibility",
      "BEO mailed",
      "Day-of FOH",
    ],
  },
  {
    experienceKey: "In-Person Private Monuments",
    eventType: "In-Person Private Monuments",
    displayName: "In-Person Private Monuments Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: [
      "Tour kit",
      "Dine Around option",
      "Multi-stop +45min between",
      "Wheelchair",
      "72h reconfirm reservations",
      "BEO mailed to guide",
    ],
  },
  {
    experienceKey: "In-Person Private Food Tour",
    eventType: "In-Person Private Food Tour",
    displayName: "In-Person Private Food Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: [
      "Same as Monuments + drinks 0–4 deferred to 2w",
    ],
  },
  {
    experienceKey: "In-Person Mixology",
    eventType: "In-Person Mixology",
    displayName: "In-Person Mixology",
    timelineFamily: "C",
    docQuality: "stub",
    flagNote: "Stub — flag Zach; venue 2001 K ST; do not invent Mixology inventory",
    rosConfirmLabel: "Confirm cocktails",
    deltas: ['Venue "2001 K ST"; inventory still cooking-clone in doc — not seeded as new SKUs'],
  },
  {
    experienceKey: "In-Person Chocolate Making",
    eventType: "In-Person Chocolate Making",
    displayName: "In-Person Chocolate Making",
    timelineFamily: "C",
    docQuality: "stub",
    flagNote: null,
    rosConfirmLabel: "Confirm activity",
    deltas: ["Cooking clone — shared skeleton only"],
  },
  {
    experienceKey: "In-Person Chocolate & Wine",
    eventType: "In-Person Chocolate & Wine",
    displayName: "In-Person Chocolate and Wine Tasting",
    timelineFamily: "C",
    docQuality: "stub",
    flagNote: "Stub — flag Zach; truncated cooking inventory in doc",
    rosConfirmLabel: "Confirm activity",
    deltas: ["Truncated cooking inventory — not invented"],
  },
  {
    experienceKey: "In-Person Cheeseboard",
    eventType: "In-Person Cheeseboard",
    displayName: "In-Person Cheeseboard Making",
    timelineFamily: "C",
    docQuality: "stub",
    flagNote: null,
    rosConfirmLabel: "Confirm activity",
    deltas: ["Cooking clone — shared skeleton only"],
  },
  {
    experienceKey: "In-Person Gingerbread",
    eventType: "In-Person Gingerbread",
    displayName: "In-Person Gingerbread Making",
    timelineFamily: "C",
    docQuality: "stub",
    flagNote: null,
    rosConfirmLabel: "Confirm activity",
    deltas: ["Cooking clone — shared skeleton only"],
  },
  {
    experienceKey: "In-Person Yoga & UnWined",
    eventType: "In-Person Yoga & UnWined",
    displayName: "In-Person Yoga & UnWined",
    timelineFamily: "B",
    docQuality: "incomplete",
    flagNote: "Needs Zach review — no dedicated BEO doc in plan 07 matrix; shared skeleton",
    rosConfirmLabel: "Confirm activity",
    deltas: ["Shared skeleton until doc-accurate Yoga workflow is added"],
  },
];

/** Every experience in the matrix (for universal Drinks catalog rows). */
export const ALL_EXPERIENCE_KEYS = EXPERIENCE_MATRIX.map((r) => r.experienceKey);

/** Cooking-class events that share Cooking Supplies + Miscellaneous checklists. */
export const COOKING_EVENT_EXPERIENCE_KEYS = [
  "In-Person Cooking",
  "In-Person Chocolate Making",
  "In-Person Chocolate & Wine",
  "In-Person Cheeseboard",
  "In-Person Gingerbread",
] as const;

/** Experiences whose BEO uses the food-tour layout (orders, order key, route). */
export const FOOD_TOUR_EXPERIENCE_KEYS = [
  "In-Person Private Food Tour",
  "Flavors of DC",
  "In-Person Private Monuments",
] as const;

export function isFoodTourExperience(
  eventTypeOrKey: string | null | undefined
): boolean {
  if (!eventTypeOrKey) return false;
  const key = experienceKeyForEventType(eventTypeOrKey) ?? eventTypeOrKey;
  return (FOOD_TOUR_EXPERIENCE_KEYS as readonly string[]).includes(key);
}

export function getExperienceRow(
  experienceKeyOrEventType: string
): ExperienceMatrixRow | undefined {
  return EXPERIENCE_MATRIX.find(
    (r) =>
      r.experienceKey === experienceKeyOrEventType ||
      r.eventType === experienceKeyOrEventType
  );
}

export function experienceKeyForEventType(eventType: string): string | null {
  const row = getExperienceRow(eventType);
  return row?.experienceKey ?? null;
}

/** Meeting: confirm menu → confirm painting / cocktails / … */
export function getRosConfirmLabel(eventType: string | null | undefined): string {
  if (!eventType) return "Confirm activity";
  const row = getExperienceRow(eventType);
  return row?.rosConfirmLabel ?? "Confirm activity";
}
