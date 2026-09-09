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
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW + On Premise. Canvas size from out-of-town Y/N; Jude coordinates scissors / large easels pickup.",
    rosConfirmLabel: "Confirm art piece / menu",
    deltas: [
      "Venue / on-premise + loading dock",
      "Out-of-town: 8x10 + bubble vs 11x14; scissors + easels on BEO",
      "Paint inventory @3w (canvases / easels / brushes; omit B067)",
      "Eventware checklist @3w",
      "Add-on supplies (nosh / warm meal / beverages / ice)",
      "Custom aprons → Basecamp",
      "Add-on vendor sources @1w",
      "During: drink consumption + team debrief",
      "Consumption invoice + EVENT REPORT",
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
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW + On Premise. Project/charity materials are event-specific — capture on BEO; do not invent SKUs.",
    rosConfirmLabel: "Confirm Lend a Hand activity / menu",
    deltas: [
      "Venue / on-premise + loading dock",
      "Project materials @3w (event-specific)",
      "Eventware checklist @3w (omit B067)",
      "Add-on supplies (nosh / warm meal / beverages / ice)",
      "Custom aprons → Basecamp",
      "Add-on vendor sources @1w",
      "During: drink consumption + team debrief",
      "Consumption invoice + EVENT REPORT",
    ],
  },
  {
    experienceKey: "In-Person Terrarium",
    eventType: "In-Person Terrarium",
    displayName: "In-Person Terrarium",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW (plus Launch, Mr. Smith's, City Tavern, Whittemore, Wharf Penthouse, Wingo's, 99 M St SE)",
    rosConfirmLabel: "Confirm terrarium build",
    deltas: [
      "Office inventory check @3w",
      "Kit order with per-kit quantities (omit B067)",
      "Final headcount + allergies @2w",
      "Remaining balance + final supplies + kit ship QA",
      "Print marketing/BEO + pick up logo’d add-ons",
      "24h inventory + ice",
      "Consumption invoice + EVENT REPORT",
    ],
  },
  {
    experienceKey: "Flavors of DC",
    eventType: "Flavors of DC",
    displayName: "Flavors of DC",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote:
      "House venues: Launch, Mr. Smith's of Georgetown, City Tavern, Whittemore House, Wharf Penthouse, Wingo's, 99 M St SE — omit Foundry / 1015 15th",
    rosConfirmLabel: "Confirm menu / eateries",
    deltas: [
      "Secure Event Team Lead",
      "Early participant list + FH embed",
      "Custom add-ons (glassware, cheeseboard, olive oil, eatery kits)",
      "ROS opening talk preference + wheelchair",
      "Eatery ordering / pickup / delivery (~1h before)",
      "FoDC inventory @2w (no aprons; no B067)",
      "Print BEO for Event Team Lead",
      "Guide & Support 72–48h check-in",
      "24h acquire ice",
      "Day-of FOH presentation",
      "Consumption invoice + EVENT REPORT",
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
    experienceKey: "Group Food Tour",
    eventType: "Group Food Tour",
    displayName: "Group Food Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: ["Multi-stop ordering; restaurant reservations; BEO mailed"],
  },
  {
    experienceKey: "Italian Food Tour",
    eventType: "Italian Food Tour",
    displayName: "Italian Food Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: ["Multi-stop ordering; restaurant reservations; BEO mailed"],
  },
  {
    experienceKey: "Georgetown Foodie Tour",
    eventType: "Georgetown Foodie Tour",
    displayName: "Georgetown Foodie Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: ["Multi-stop ordering; restaurant reservations; BEO mailed"],
  },
  {
    experienceKey: "Private Food Tour",
    eventType: "Private Food Tour",
    displayName: "Private Food Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: ["Same as private food tour + drinks 0–4 deferred to 2w"],
  },
  {
    experienceKey: "Indoor Food Tour",
    eventType: "Indoor Food Tour",
    displayName: "Indoor Food Tour",
    timelineFamily: "B",
    docQuality: "complete",
    flagNote: null,
    rosConfirmLabel: "Confirm tour itinerary",
    deltas: ["Multi-stop ordering; restaurant reservations; BEO mailed"],
  },
  {
    experienceKey: "In-Person Mixology",
    eventType: "In-Person Mixology",
    displayName: "In-Person Mixology",
    timelineFamily: "C",
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW + On Premise (plus Launch, Mr. Smith's, City Tavern, Whittemore, Wharf Penthouse, Wingo's, 99 M St SE). Eventware checklist seeded; do not invent liquor SKUs.",
    rosConfirmLabel: "Confirm cocktails / menu",
    deltas: [
      "Venue / on-premise + loading dock",
      "Cocktails selected count (1–3)",
      "Eventware supply checklist @1w (omit stub C067)",
      "Custom aprons → Basecamp",
      "Chef verifies menu",
      "Paper / FedEx + recipe-card marketing",
      "QR + logo’d / company aprons",
      "Triple-check inventory",
      "During: drink consumption + team debrief",
      "Consumption invoice + EVENT REPORT",
    ],
  },
  {
    experienceKey: "In-Person Chocolate Making",
    eventType: "In-Person Chocolate Making",
    displayName: "In-Person Chocolate Making",
    timelineFamily: "C",
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW + On Premise (plus Launch, Mr. Smith's, City Tavern, Whittemore, Wharf Penthouse, Wingo's, 99 M St SE)",
    rosConfirmLabel: "Confirm chocolate menu",
    deltas: [
      "Chocolate supply checklist @1w (omit stub C067)",
      "Custom aprons → Basecamp",
      "Chef verifies menu",
      "Paper / FedEx + recipe-card marketing",
      "QR + logo’d / company aprons",
      "Triple-check inventory",
      "During: drink consumption + team debrief",
      "Consumption invoice + EVENT REPORT",
    ],
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
    docQuality: "complete",
    flagNote:
      "House venues include Foundry + 1015 15th NW (plus Launch, Mr. Smith's, City Tavern, Whittemore, Wharf Penthouse, Wingo's, 99 M St SE)",
    rosConfirmLabel: "Confirm cheeseboard / menu",
    deltas: [
      "Cheeseboard supply checklist @1w (omit stub C067)",
      "Custom aprons → Basecamp",
      "Chef verifies cheese selection",
      "Paper / FedEx print",
      "QR + marketing printed",
      "Logo’d add-ons + company aprons",
      "Triple-check inventory",
      "During: drink consumption + team debrief",
      "Consumption invoice + EVENT REPORT",
    ],
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

/** Canonical Mangia food-tour products (restaurant-stop BEO). */
export const FOOD_TOUR_EXPERIENCE_KEYS = [
  "Group Food Tour",
  "Flavors of DC",
  "Italian Food Tour",
  "Georgetown Foodie Tour",
  "Private Food Tour",
  "Indoor Food Tour",
] as const;

/** Legacy stored event_type values that still use the food-tour BEO. */
export const FOOD_TOUR_EXPERIENCE_ALIASES = [
  "In-Person Private Food Tour",
] as const;

export function isFoodTourExperience(
  eventTypeOrKey: string | null | undefined
): boolean {
  if (!eventTypeOrKey) return false;
  const raw = String(eventTypeOrKey).trim();
  if (raw.toLowerCase() === "flavors of dc") return true;
  const key = experienceKeyForEventType(raw) ?? raw;
  const keys = FOOD_TOUR_EXPERIENCE_KEYS as readonly string[];
  const aliases = FOOD_TOUR_EXPERIENCE_ALIASES as readonly string[];
  return keys.includes(key) || aliases.includes(key) || keys.includes(raw) || aliases.includes(raw);
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
