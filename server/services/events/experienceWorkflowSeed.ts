import type { WorkflowResourceLink } from "../../db/schema/event-workflow-task-defs.js";
import type { CookingTaskDefSeed } from "./cookingWorkflowSeed.js";
import { WORKFLOW_RESOURCES } from "./workflowResources.js";
import type { DocQuality, ExperienceMatrixRow, TimelineFamily } from "./experienceMatrix.js";

export type ExperienceTaskDefSeed = CookingTaskDefSeed;

const R = WORKFLOW_RESOURCES;

let sort = 0;
function nextSort(n = 10): number {
  sort += n;
  return sort;
}

function resetSort(): void {
  sort = 0;
}

/** Shared deposit + staff outreach (all families). */
function sharedUponDeposit(includeRosTemplate: boolean): ExperienceTaskDefSeed[] {
  const tasks: ExperienceTaskDefSeed[] = [
    {
      phase: "upon_deposit",
      title: "Sales intake meeting — location, date, timing, preferences",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S001",
    },
    {
      phase: "upon_deposit",
      title: "Email deposit notify to Dave, Zach, Monica, Eileen",
      description:
        "Required notify. Slack Salesalert is optional resource only.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.slackSalesAlert],
      traceId: "S030",
    },
    {
      phase: "upon_deposit",
      title: "Create FareHarbor item",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.fareharborHowTo],
      traceId: "S031",
    },
    {
      phase: "upon_deposit",
      title: "Create participation link (Google Sheets or Forms)",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S032",
    },
    {
      phase: "upon_deposit",
      title: "Create / link Post Event Survey",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "S033",
    },
    {
      phase: "upon_deposit",
      title: "Set CRM workflow direct event link",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S034",
    },
    {
      phase: "upon_deposit",
      title: "Create BEO (Admin)",
      description: "Admin creates the BEO artifact — distinct from Ops BEO Shell.",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S035",
    },
  ];

  if (includeRosTemplate) {
    tasks.push({
      phase: "upon_deposit",
      title: "Attach Run of Show template",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S036",
    });
  }

  tasks.push(
    {
      phase: "upon_deposit",
      title: "Create BEO Shell and link to FareHarbor",
      description: "Ops creates BEO Shell and links BEO to FareHarbor.",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.beoShellHowTo],
      traceId: "S037",
    },
    {
      phase: "upon_deposit",
      title: "Reach out to Instructor and Event Team immediately",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      conditional: { assigneeOptions: ["Ops"] },
      traceId: "S038",
    },
    {
      phase: "upon_deposit",
      title: "Track 48h staff response; escalate if needed",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      conditional: { assigneeOptions: ["Ops"] },
      traceId: "S039",
    },
    {
      phase: "upon_deposit",
      title: "Record which member reached out for staff availability",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S040",
    },
    {
      phase: "upon_deposit",
      title: "Contact venue and reserve loading dock",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "S041",
    },
    {
      phase: "upon_deposit",
      title: "Confirm FoDC / warm meal shared add-on (if selected)",
      description: "Meeting: FoDC/warm meal is a shared add-on across experiences.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "S020",
    }
  );

  return tasks;
}

function sharedRosCadence(confirmLabel: string): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "two_point_five_weeks",
      title: "Email client 2.5 weeks before — schedule ROS",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C042",
    },
    {
      phase: "two_point_five_weeks",
      title: "Schedule Run of Show with client",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C043",
    },
    {
      phase: "two_point_five_weeks",
      title: "Send calendar invite (client + Sales)",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C044",
    },
    {
      phase: "ros",
      title: `ROS — ${confirmLabel}`,
      description:
        "Meeting: confirm activity (menu / painting / cocktails / itinerary) with the client.",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C045",
    },
    {
      phase: "ros",
      title: "ROS — double-check bar",
      description: "Handling? Consumption? Wine or beer?",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "C046",
    },
    {
      phase: "upon_deposit",
      title: "Confirm drink tickets / beverages per person",
      description:
        "Ticketed bar — capture how many drink tickets or beverages per person.",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      conditional: { if: "bar_ticketed" },
      traceId: "C046T",
    },
    {
      phase: "ros",
      title: "ROS — confirm arrival method",
      description: "Motorcoach / Uber / own / all of the above",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C047",
    },
    {
      phase: "ros",
      title: "ROS — confirm event time change",
      description: "Has the event time changed — yes/no; if yes, new time?",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C048",
    },
    {
      phase: "ros",
      title: "ROS — confirm headcount",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C049",
    },
    {
      phase: "ros",
      title: "ROS — capture day-of POC",
      description: "Name, email, phone",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C050",
    },
    {
      phase: "ros",
      title: "ROS — multimedia permission",
      description:
        "OK for marketing | OK internal only | No photos — use talk-track helper",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C051",
    },
    {
      phase: "ros",
      title: "ROS — seating curation",
      description: "Curate Y/N → random or client pre-organized groups",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C052",
    },
    {
      phase: "ros",
      title: "ROS — food addition counts",
      description:
        "Charcuterie count, additional protein (mystery ingredients / sauces are cooking-only).",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C053",
    },
    {
      phase: "ros",
      title: "ROS — custom add-on progress",
      description:
        "Aprons logo→embroiderist, custom name, glassware, cheeseboard, chocolate mold, chef hats, berets",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [
        R.vendorDirectory,
        R.wattzDesign,
        R.minutemanPress,
        R.basecampDc,
        R.qualityGlassEngraving,
      ],
      traceId: "C054",
    },
    {
      phase: "ros",
      title: "ROS — confirm transportation",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      conditional: { if: "transportation_needed" },
      traceId: "C055",
    },
  ];
}

function sharedFamilyBCadence(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "three_weeks",
      title: "Confirm event staff (Host / Instructor / Ops)",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "B021",
    },
    {
      phase: "two_weeks",
      title: "Finalize details with client (time, date, place, specials)",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "B050",
    },
    {
      phase: "two_weeks",
      title: "Reconfirm staff for the event",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "B051",
    },
    {
      phase: "two_weeks",
      title: "Request attendee list + dietary restrictions",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "B052",
    },
    {
      phase: "two_weeks",
      title: "Create BEO",
      role: "Admin",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.beoShellHowTo],
      traceId: "B053",
    },
    // Meeting: inventory after ROS (~2.5w) → order at ~1 week
    {
      phase: "one_week_before",
      title: "Order inventory / supplemental supplies",
      description:
        "After ROS. Use experience-specific inventory notes + Inventory Links. Do not invent SKUs.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "B067",
    },
    {
      phase: "one_week_before",
      title: "Email BEO to all event staff + embed in FareHarbor",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "B056",
    },
    {
      phase: "staff_checkin_72_48h",
      title: "BEO staff check-in — Host and Instructor (72–48h)",
      description:
        "Phone Host and Instructor to discuss questions, concerns, and additional event details vs BEO/leadership.",
      role: "Ops",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook],
      traceId: "B089",
    },
    {
      phase: "one_week_before",
      title: "Company aprons cleaned and ready",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "B090",
    },
  ];
}

function sharedCollapsedOneWeek(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "one_week_before",
      title: "Order inventory / supplemental supplies (1w collapsed timeline)",
      description:
        "Stub experiences: use cooking-adjacent supplies from Inventory Links only — do not invent Mixology/Chocolate SKUs.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "C067",
    },
    {
      phase: "one_week_before",
      title: "Email BEO to all event staff + embed in FareHarbor",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "C056",
    },
    {
      phase: "staff_checkin_72_48h",
      title: "BEO staff check-in — Host and Instructor (72–48h)",
      role: "Ops",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook],
      traceId: "C089",
    },
  ];
}

function sharedDuringPost(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "during",
      title: "Follow event-specific BEO for layout / inventory / client",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook],
      traceId: "D095",
    },
    {
      phase: "during",
      title: "Event Host — follow Company Handbook",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook],
      traceId: "D096",
    },
    {
      phase: "during",
      title: "Ops support — follow Company Handbook",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook],
      traceId: "D097",
    },
    {
      phase: "during",
      title: "Gather photo assets + upload to digital database",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.eventPhotosDrive],
      traceId: "D100",
    },
    {
      phase: "during",
      title: "Complete post-event survey / team debrief",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "D105",
    },
    {
      phase: "post",
      title: "Admin — obtain media for post-event email",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.eventPhotosDrive],
      traceId: "P106",
    },
    {
      phase: "post",
      title: "Capture staff hours + additional event details",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "P107",
    },
    {
      phase: "post",
      title: "Send thank-you email (V1/V2) + photo link",
      description:
        "Use dynamic experience name — never hardcode paint and sip for other experiences.",
      role: "Sales",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.eventPhotosDrive],
      traceId: "P110",
    },
    {
      phase: "post",
      title: "V2 yes — event tracker + LinkedIn connect",
      role: "Sales",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "thank_you_v2_yes" },
      traceId: "P111",
    },
    {
      phase: "post",
      title: "+3 months — T-shirt size → CEO thank-you + Mangia T-shirt",
      role: "Sales",
      dueOffsetDays: 90,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "thank_you_v2_yes" },
      traceId: "P112",
    },
    {
      phase: "post",
      title: "EMAIL 2 — next event / intros / newsletter / build lead",
      role: "Sales",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "feature_email2" },
      traceId: "P115",
    },
    {
      phase: "post",
      title: "Staff invoice EOM; receipts EOM or immediate",
      role: "Event Host",
      dueOffsetDays: 3,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "P113",
    },
  ];
}

function zachFlagTask(row: ExperienceMatrixRow): ExperienceTaskDefSeed {
  return {
    phase: "upon_deposit",
    title: `Needs Zach inventory review — ${row.displayName}`,
    description:
      row.flagNote ||
      `Doc quality: ${row.docQuality}. Do not invent SKUs until Zach confirms.`,
    role: "Admin",
    dueOffsetDays: 0,
    dueAnchor: "immediate",
    sortOrder: nextSort(5),
    resourceLinks: [R.vendorDirectory],
    traceId: "Z001",
  };
}

/** Frozen thin Paint-clone for Pottery until Pottery has its own playbook. */
function potteryPaintCloneDeltas(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "upon_deposit",
      title: "Capture out-of-town Y/N → canvas size (8x10+bubble vs 11x14)",
      description:
        "Yes (out of town): 8x10 + optional bubble wrap. No: 11x14. Add scissors + large easels to BEO equipment list.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "PA001",
    },
    {
      phase: "upon_deposit",
      title: "BEO Shell — add scissors + large easel(s) to equipment list",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.beoShellHowTo],
      traceId: "PA002",
    },
    {
      phase: "three_weeks",
      title: "Order Paint & Sip inventory (canvases / easels / brushes)",
      description:
        "8x10 or 11x14 canvases (Michaels), easels (5 Below / JMARK), brush sets (Michaels / 5 Below). Bubble wrap if out of town. See Paint doc + Vendor Directory — do not pull into cooking catalog.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "PA067",
    },
  ];
}

/** In-Person Paint & Sip — Family B playbook (Updated January 2024). */
function paintDeltas(): ExperienceTaskDefSeed[] {
  const paintInventoryChecklist =
    "8x10 canvases (Michaels — out-of-town / carry-on; optional bubble wrap); 11x14 canvases (Michaels — in-town); easels — 5 Below (large) or JMARK Direct (small); brush sets (Michaels / 5 Below). Contact Jude to coordinate scissors / large easels pickup if not in office.";
  const eventwareChecklist =
    "Bubble wrap if out of town; paper towels; plastic tall cups (Amazon or CVS); plastic water cups; paper plates; plastic tablecloth rolls (Party City, neutral colors preferred); masking tape; trash bags; dinner napkins.";

  return [
    // —— upon deposit ——
    {
      phase: "upon_deposit",
      title: "Confirm venue / on-premise + loading dock",
      description:
        "House venues (Launch, Mr. Smith's, City Tavern, Whittemore House, Wharf Penthouse, Wingo's, 99 M St SE, Foundry, 1015 15th) or On Premise. Contact venue; reserve loading dock when applicable. See Vendor Directory.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "PA000",
    },
    {
      phase: "upon_deposit",
      title: "Capture out-of-town Y/N → canvas size (8x10+bubble vs 11x14)",
      description:
        "Yes (out of town): 8x10 + optional bubble wrap. No: 11x14. Add scissors + large easels to BEO equipment list.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "PA001",
    },
    {
      phase: "upon_deposit",
      title: "BEO Shell — add scissors + large easel(s) to equipment list",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.beoShellHowTo],
      traceId: "PA002",
    },

    // —— three weeks ——
    {
      phase: "three_weeks",
      title: "Order Paint & Sip inventory (canvases / easels / brushes)",
      description: `${paintInventoryChecklist} Cite Inventory Links / Vendor Directory — do not invent cooking catalog SKUs.`,
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "PA067",
    },
    {
      phase: "three_weeks",
      title: "Order Paint & Sip eventware supplies",
      description: `Ensure supplies purchased/ordered: ${eventwareChecklist}`,
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "PA068",
    },
    {
      phase: "three_weeks",
      title: "Plan add-on supplies (nosh / warm meal / beverages / ice)",
      description:
        "If selected: nosh items, warm meal supplies, alcohol/NA beverages, glassware, ice bucket; acquire ice if venue does not supply.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.inventoryLinks],
      traceId: "PA069",
    },
    {
      phase: "three_weeks",
      title: "Custom aprons sent to Basecamp for printing",
      description:
        "Custom-ordered aprons sent to Basecamp to be printed. See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "PA070",
    },

    // —— one week ——
    {
      phase: "one_week_before",
      title: "Confirm add-on purchase sources (Vendor Directory)",
      description: "If add-ons — where are you buying? Confirm vendors.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "PA071",
    },
    {
      phase: "one_week_before",
      title: "Logo’d / custom aprons ready for Basecamp pickup",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "PA075",
    },
    {
      phase: "one_week_before",
      title: "Triple-check Paint & Sip inventory + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "PA076",
    },

    // —— during ——
    {
      phase: "during",
      title: "Track client drink consumption (+ WhatsApp media)",
      description:
        "Event host tracks the client's drink consumption; gather WhatsApp / photo media as needed.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "PA100",
    },
    {
      phase: "during",
      title: "Team debrief — what went well / improve → Post Event Survey",
      description:
        "Event team lead checks in: “What did we do well? What do we need to improve?” Add to Post Event Survey.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "PA105",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "PA108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "PA109",
    },
  ];
}

/** In-Person Lend a Hand for Good — Family B playbook (not Paint clone). */
function lendAHandDeltas(): ExperienceTaskDefSeed[] {
  const eventwareChecklist =
    "Paper towels; paper plates; plastic tablecloth rolls (neutral colors preferred); masking tape; trash bags; dinner napkins.";

  return [
    // —— upon deposit ——
    {
      phase: "upon_deposit",
      title: "Confirm venue / on-premise + loading dock",
      description:
        "House venues (Launch, Mr. Smith's, City Tavern, Whittemore House, Wharf Penthouse, Wingo's, 99 M St SE, Foundry, 1015 15th) or On Premise. Contact venue; reserve loading dock when applicable. See Vendor Directory.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "LH001",
    },

    // —— three weeks ——
    {
      phase: "three_weeks",
      title: "Capture / order Lend a Hand project materials",
      description:
        "Charity / project materials are event-specific — capture the partner list on the BEO. Do not invent catalog SKUs.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "LH066",
    },
    {
      phase: "three_weeks",
      title: "Order Lend a Hand eventware supplies",
      description: `Ensure supplies purchased/ordered: ${eventwareChecklist}`,
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "LH067",
    },
    {
      phase: "three_weeks",
      title: "Plan add-on supplies (nosh / warm meal / beverages / ice)",
      description:
        "If selected: nosh items, warm meal supplies, alcohol/NA beverages, glassware, ice bucket; acquire ice if venue does not supply.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.inventoryLinks],
      traceId: "LH068",
    },
    {
      phase: "three_weeks",
      title: "Custom aprons sent to Basecamp for printing",
      description:
        "Custom-ordered aprons sent to Basecamp to be printed. See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "LH069",
    },

    // —— one week ——
    {
      phase: "one_week_before",
      title: "Confirm add-on purchase sources (Vendor Directory)",
      description: "If add-ons — where are you buying? Confirm vendors.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "LH070",
    },
    {
      phase: "one_week_before",
      title: "Logo’d / custom aprons ready for Basecamp pickup",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "LH075",
    },
    {
      phase: "one_week_before",
      title: "Triple-check Lend a Hand inventory + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "LH076",
    },

    // —— during ——
    {
      phase: "during",
      title: "Track client drink consumption (+ WhatsApp media)",
      description:
        "Event host tracks the client's drink consumption; gather WhatsApp / photo media as needed.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "LH100",
    },
    {
      phase: "during",
      title: "Team debrief — what went well / improve → Post Event Survey",
      description:
        "Event team lead checks in: “What did we do well? What do we need to improve?” Add to Post Event Survey.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "LH105",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "LH108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "LH109",
    },
  ];
}

function terrariumDeltas(): ExperienceTaskDefSeed[] {
  const kitChecklist =
    "Glass terrarium container; 2-inch succulents; potting soil 9.6 oz/kit; washable creek rocks 14.4 oz/kit; sand bag (beach texture) 7.4 oz/kit; dried moss (dark or light green) 0.4 oz/kit; mini spray bottles; plastic bags; charcoal bag 2.4 oz/kit; decorative ducks; logo’d apron; chopsticks or fork & knife.";

  return [
    // —— three weeks ——
    {
      phase: "three_weeks",
      title: "Check office inventory for terrarium function",
      description:
        "Ops checks office inventory to firm needed supplies for the function.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "TE066",
    },
    {
      phase: "three_weeks",
      title: "Order terrarium kit supplies",
      description: `Order supplemental supplies if needed. Per-kit checklist: ${kitChecklist} Cite Vendor Directory / Inventory Links — do not invent cooking catalog SKUs.`,
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.inventoryLinks],
      traceId: "TE067",
    },

    // —— two weeks ——
    {
      phase: "two_weeks",
      title: "Final participant headcount",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE058",
    },
    {
      phase: "two_weeks",
      title: "Document add-on allergies",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE059",
    },
    {
      phase: "two_weeks",
      title: "Collect remaining balance @ 2 weeks",
      role: "Sales",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE060",
    },
    {
      phase: "two_weeks",
      title: "Get final terrarium supplies needed",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "TE062",
    },
    {
      phase: "two_weeks",
      title: "Kit ship QA (if shipping kits)",
      description: "If kits ship to the client/venue — QA packaging and contents before ship.",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE061",
    },

    // —— one week ——
    {
      phase: "one_week_before",
      title: "Print marketing material and BEO with supplies",
      description:
        "Print marketing material and BEO to leave with supplies for the event.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.beosFolder],
      traceId: "TE070",
    },
    {
      phase: "one_week_before",
      title: "Pick up logo’d add-ons",
      description: "Logo’d aprons / custom add-ons picked up from vendors.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "TE071",
    },

    // —— 24h ——
    {
      phase: "twenty_four_h",
      title: "24h — triple-check terrarium inventory in-office",
      role: "Ops",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "TE090",
    },
    {
      phase: "twenty_four_h",
      title: "24h — acquire ice (Y/N)",
      description: "Operations Manager or Intern — acquire ice if needed.",
      role: "Ops",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE091",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "TE108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE109",
    },
  ];
}

function tourDeltas(kind: "monuments" | "food"): ExperienceTaskDefSeed[] {
  const tasks: ExperienceTaskDefSeed[] = [
    {
      phase: "two_weeks",
      title: "Wheelchair accessibility check + client awareness of steps",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TO001",
    },
    {
      phase: "two_weeks",
      title: "Confirm multi-stop locations + place orders / reservations",
      description:
        "Contact each stop; reserve time windows. See Vendor Directory tour restaurants.",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "TO002",
    },
    {
      phase: "two_weeks",
      title: "Add ~45 minutes between stops on itinerary",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TO003",
    },
    {
      phase: "staff_checkin_72_48h",
      title: "72h reconfirm location reservations are in their system",
      role: "Ops",
      dueOffsetDays: 3,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TO072",
    },
    {
      phase: "one_week_before",
      title: "Mail / send BEO to guide (and staff)",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TO056",
    },
  ];

  tasks.unshift({
    phase: "upon_deposit",
    title: "Capture Dine Around Y/N + pickup/dropoff addresses",
    role: "Sales",
    dueOffsetDays: 0,
    dueAnchor: "immediate",
    sortOrder: nextSort(),
    conditional: { if: "transportation_needed" },
    traceId: "TO010",
  });
  tasks.push({
    phase: "three_weeks",
    title: "Prepare tour kit (water, ponchos, sanitizer, hand warmers, sheets…)",
    description: "Tour kit items from Monuments/Food Tour doc — not cooking SKUs.",
    role: "Ops",
    dueOffsetDays: 21,
    dueAnchor: "event_date",
    sortOrder: nextSort(),
    resourceLinks: [R.inventoryLinks],
    traceId: "TO067",
  });

  if (kind === "food") {
    tasks.push({
      phase: "two_weeks",
      title: "Finalize drinks included (0–4) — deferred to 2 weeks",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "TO080",
    });
  }

  return tasks;
}

/** Sept 2026 In-Person Flavors of DC playbook — not a walking-tour overlay. */
function flavorsDeltas(): ExperienceTaskDefSeed[] {
  const inventoryChecklist =
    "Trays, wire frames, aluminum trays, sternos, lighter, metal bowls, tongs, large/small spoons, knives, to-go boxes, small plates, dinner napkins, trash bags, ingredients, toothpicks, ramekins, plastic cups, cutting boards, poster boards, easels, menu tents.";

  return [
    // —— upon_deposit ——
    {
      phase: "upon_deposit",
      title: "Secure Event Team Lead immediately",
      description:
        "As soon as deposit is received — lock an Event Team Lead for this Flavors of DC event.",
      role: "Ops",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "FO000",
    },
    {
      phase: "upon_deposit",
      title: "Send early participant list to client + embed in FareHarbor",
      description:
        "Admin sends participant list form (allergies) to client, then embeds into the FareHarbor date.",
      role: "Admin",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "FO001",
    },
    {
      phase: "upon_deposit",
      title: "Capture custom add-on interest (FoDC)",
      description:
        "Custom engraved glassware; custom cheeseboard (25 unit min); olive oil mini gift to take home; eatery kits.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.georgetownOliveOil, R.vendorDirectory, R.qualityGlassEngraving],
      traceId: "FO002",
    },

    // —— ROS ——
    {
      phase: "ros",
      title: "ROS — confirm how many eateries and which eateries",
      description: "How many eateries? What are the eateries?",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO045",
    },
    {
      phase: "ros",
      title: "ROS — opening talk preference",
      description:
        "Explain the event at the start, jump straight in, or email copy for distribution ahead of time?",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO046",
    },
    {
      phase: "ros",
      title: "ROS — wheelchair accessibility needs",
      description:
        "Any participants needing wheelchair accessibility assistance?",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO047",
    },
    {
      phase: "ros",
      title: "ROS — transport company (Alberto or DC Nation Tours)",
      description: "If transportation requested — which company? See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      conditional: { if: "transportation_needed" },
      traceId: "FO055",
    },
    {
      phase: "ros",
      title: "ROS — FoDC custom add-ons progress",
      description:
        "Glassware, cheeseboard, olive oil mini gift, eatery kits — status and vendors.",
      role: "Ops",
      dueOffsetDays: 17,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [
        R.vendorDirectory,
        R.georgetownOliveOil,
        R.qualityGlassEngraving,
      ],
      traceId: "FO054",
    },

    // —— two weeks ——
    {
      phase: "two_weeks",
      title: "Confirm customer locations + place eatery orders",
      description:
        "Locations confirmed by customer? Contact eateries to place delivery/pickup orders per Flavors ordering procedures.",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.flavorsOrderingProcedures, R.vendorDirectory],
      traceId: "FO060",
    },
    {
      phase: "two_weeks",
      title: "Assign pickup owner per dish + delivery plan",
      description:
        "Who picks up which dish? Delivery plan and start times — dishes should arrive ~1 hour before event start.",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.flavorsOrderingProcedures],
      traceId: "FO061",
    },
    {
      phase: "two_weeks",
      title: "Confirm headcount (has it changed?)",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO062",
    },
    {
      phase: "two_weeks",
      title: "Confirm ticketed beverages included (if ticketed bar)",
      description: "How many beverages are included when the bar is ticketed?",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "bar_ticketed" },
      traceId: "FO063",
    },
    {
      phase: "two_weeks",
      title: "Remind transport + capture driver / pickup & dropoff",
      description:
        "Remind transportation they are working with us; capture driver; pickup and dropoff addresses and times.",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      conditional: { if: "transportation_needed" },
      traceId: "FO064",
    },
    {
      phase: "two_weeks",
      title: "Order / revise FoDC inventory",
      description: `Order supplemental supplies and revise inventory. Checklist: ${inventoryChecklist}`,
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory],
      traceId: "FO067",
    },
    {
      phase: "two_weeks",
      title: "Double-check FoDC inventory list on BEO",
      description: inventoryChecklist,
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "FO068",
    },

    // —— one week / 72–48h / 24h ——
    {
      phase: "one_week_before",
      title: "Print BEO and store with Event Team Lead equipment",
      description:
        "BEO is printed and stored with equipment for the Event Team Lead responsible for the event.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.beosFolder],
      traceId: "FO070",
    },
    {
      phase: "one_week_before",
      title: "Triple-check FoDC inventory in-office + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "FO071",
    },
    {
      phase: "staff_checkin_72_48h",
      title: "Guide & Support phone check-in (72–48h)",
      description:
        "Contact Guide and Support via phone to discuss questions, concerns, and BEO details. Spot gaps vs leadership instructions.",
      role: "Ops",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook, R.beosFolder],
      traceId: "FO089",
    },
    {
      phase: "staff_checkin_72_48h",
      title: "72h reconfirm eatery reservations are in their system",
      role: "Ops",
      dueOffsetDays: 3,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.flavorsOrderingProcedures],
      traceId: "FO072",
    },
    {
      phase: "twenty_four_h",
      title: "24h — triple-check FoDC inventory in-office",
      role: "Ops",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "FO090",
    },
    {
      phase: "twenty_four_h",
      title: "24h — acquire ice (Y/N)",
      description: "Operations Manager or Intern — acquire ice if needed.",
      role: "Ops",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO091",
    },

    // —— during ——
    {
      phase: "during",
      title: "Day-of FOH — food presentation & service setup",
      description:
        "Trays spread evenly; each dish has correct utensil (spoons/tongs/ladles); salad mixed (olive oil ~3× balsamic); dish/establishment info posters presented.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO095",
    },
    {
      phase: "during",
      title: "Event Lead — stay with day-of POC + photos",
      description:
        "Remain in contact with client POC; ensure guest speakers speak; take photos of the experience.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.companyHandbook, R.eventPhotosDrive],
      traceId: "FO096",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "FO108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO109",
    },
  ];
}

/** Family B shared tasks Flavors of DC should not inherit. */
const FLAVORS_OMIT_TRACE_IDS = new Set(["B067", "B089", "B090"]);

/** Family B shared tasks Terrarium should not inherit (inventory ordered @3w). */
const TERRARIUM_OMIT_TRACE_IDS = new Set(["B067"]);

/** Family B shared tasks Lend a Hand should not inherit (inventory ordered @3w). */
const LEND_A_HAND_OMIT_TRACE_IDS = new Set(["B067"]);

/** Family B shared tasks Paint & Sip should not inherit (inventory ordered @3w). */
const PAINT_OMIT_TRACE_IDS = new Set(["B067"]);

/** Family C shared tasks Cheeseboard should not inherit (replace stub C067). */
const CHEESEBOARD_OMIT_TRACE_IDS = new Set(["C067"]);

/** Family C shared tasks Chocolate Making should not inherit (replace stub C067). */
const CHOCOLATE_MAKING_OMIT_TRACE_IDS = new Set(["C067"]);

/** Family C shared tasks Mixology should not inherit (replace stub C067). */
const MIXOLOGY_OMIT_TRACE_IDS = new Set(["C067"]);

/** In-Person Cheeseboard Making — Family C playbook (Jan 2024 HTML). */
function cheeseboardDeltas(): ExperienceTaskDefSeed[] {
  const supplyChecklist =
    "Cheese types; paper towels; dish soap; plastic or ceramic plates; plastic tablecloth roll (white preferred); trash bags; dinner napkins; cocktail napkins; 3rd-party furniture; sterno fuel; aluminum trays (two per tray); parchment paper; to-go containers; plastic gloves; butane cartridges / burners; olive oil (Georgetown Olive Oil); fig or strawberry balsamic; salt and pepper; aluminum foil. Also run inventory cost / purchase-source analysis.";

  return [
    // —— one week ——
    {
      phase: "one_week_before",
      title: "Order Cheeseboard inventory / supplemental supplies",
      description: `Collapsed 1w timeline. Ensure supplies purchased/ordered: ${supplyChecklist}`,
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory, R.georgetownOliveOil],
      traceId: "CB067",
    },
    {
      phase: "one_week_before",
      title: "Reconfirm custom aprons sent to Basecamp",
      description:
        "If custom-ordered aprons — confirm sent to Basecamp for printing. See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "CB068",
    },
    {
      phase: "one_week_before",
      title: "Cheese selection verified by chef for this function",
      description: "Was the cheese selection verified by the chef for THIS function?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CB069",
    },
    {
      phase: "one_week_before",
      title: "Confirm specialty paper stock + FedEx print job",
      description:
        "Do we have the appropriate paper in stock? Was printing sent to FedEx if needed?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CB070",
    },
    {
      phase: "one_week_before",
      title: "Marketing materials printed",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CB071",
    },
    {
      phase: "one_week_before",
      title: "QR code created",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CB072",
    },
    {
      phase: "one_week_before",
      title: "QR code on website",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CB073",
    },
    {
      phase: "one_week_before",
      title: "QR code printed",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CB074",
    },
    {
      phase: "one_week_before",
      title: "Logo’d aprons / add-ons ready for Basecamp pickup",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "CB075",
    },
    {
      phase: "one_week_before",
      title: "Company aprons cleaned and ready",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "CB090",
    },
    {
      phase: "one_week_before",
      title: "Triple-check Cheeseboard inventory + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "CB076",
    },

    // —— during ——
    {
      phase: "during",
      title: "Track client drink consumption (+ WhatsApp media)",
      description:
        "Event host tracks the client's drink consumption; gather WhatsApp / photo media as needed.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "CB100",
    },
    {
      phase: "during",
      title: "Team debrief — what went well / improve → Post Event Survey",
      description:
        "Event team lead checks in: “What did we do well? What do we need to improve?” Add to Post Event Survey.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "CB105",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "CB108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CB109",
    },
  ];
}

/** In-Person Chocolate Making — Family C playbook (Jan 2024 HTML). */
function chocolateMakingDeltas(): ExperienceTaskDefSeed[] {
  const supplyChecklist =
    "Chocolate chunks; coarse salt; cacao beans & nibs; cashews; dried mangos; dried cherries; clementines; strawberries; coconut shavings; leaf dishes; ramekins; paper towels; dish soap; plastic or ceramic plates; plastic tablecloth roll (white preferred); trash bags; dinner napkins; cocktail napkins; 3rd-party furniture; sterno fuel; aluminum trays (two per tray); parchment paper; to-go containers; plastic gloves; butane cartridges / burners; olive oil (Georgetown Olive Oil); fig or strawberry balsamic; salt and pepper; aluminum foil. Also run inventory cost / purchase-source analysis.";

  return [
    // —— one week ——
    {
      phase: "one_week_before",
      title: "Order Chocolate Making inventory / supplemental supplies",
      description: `Collapsed 1w timeline. Ensure supplies purchased/ordered: ${supplyChecklist}`,
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory, R.georgetownOliveOil],
      traceId: "CM067",
    },
    {
      phase: "one_week_before",
      title: "Reconfirm custom aprons sent to Basecamp",
      description:
        "If custom-ordered aprons — confirm sent to Basecamp for printing. See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "CM068",
    },
    {
      phase: "one_week_before",
      title: "Menu verified by chef for this function",
      description: "Was the menu verified by the chef for THIS function?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CM069",
    },
    {
      phase: "one_week_before",
      title: "Confirm specialty paper stock + FedEx print job",
      description:
        "Do we have the appropriate paper in stock? Was printing sent to FedEx if needed?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CM070",
    },
    {
      phase: "one_week_before",
      title: "Marketing materials printed (recipe cards)",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.recipeCardsHowTo],
      traceId: "CM071",
    },
    {
      phase: "one_week_before",
      title: "QR code created",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CM072",
    },
    {
      phase: "one_week_before",
      title: "QR code on website",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CM073",
    },
    {
      phase: "one_week_before",
      title: "QR code printed",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "CM074",
    },
    {
      phase: "one_week_before",
      title: "Logo’d aprons ready for Basecamp pickup",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "CM075",
    },
    {
      phase: "one_week_before",
      title: "Company aprons cleaned and ready",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "CM090",
    },
    {
      phase: "one_week_before",
      title: "Triple-check Chocolate Making inventory + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "CM076",
    },

    // —— during ——
    {
      phase: "during",
      title: "Track client drink consumption (+ WhatsApp media)",
      description:
        "Event host tracks the client's drink consumption; gather WhatsApp / photo media as needed.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "CM100",
    },
    {
      phase: "during",
      title: "Team debrief — what went well / improve → Post Event Survey",
      description:
        "Event team lead checks in: “What did we do well? What do we need to improve?” Add to Post Event Survey.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "CM105",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "CM108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "CM109",
    },
  ];
}

function mixologyDeltas(): ExperienceTaskDefSeed[] {
  const supplyChecklist =
    "Paper towels; dish soap; plastic or ceramic plates; plastic tablecloth roll (white preferred); trash bags; dinner napkins; cocktail napkins; 3rd-party furniture; sterno fuel; aluminum trays (two per tray); parchment paper; to-go containers; plastic gloves; butane cartridges / burners; olive oil (Georgetown Olive Oil); fig or strawberry balsamic; salt and pepper; aluminum foil. Also run inventory cost / purchase-source analysis. Spirit/mixer picks follow the confirmed cocktail menu + Inventory Links — do not invent liquor SKUs.";

  return [
    // —— upon deposit ——
    {
      phase: "upon_deposit",
      title: "Confirm venue / on-premise + loading dock",
      description:
        "House venues (Launch, Mr. Smith's, City Tavern, Whittemore House, Wharf Penthouse, Wingo's, 99 M St SE, Foundry, 1015 15th) or On Premise / going to them. Contact venue; reserve loading dock when applicable. See Vendor Directory.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "MX001",
    },
    {
      phase: "upon_deposit",
      title: "Capture how many cocktails selected (1 / 2 / 3)",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "MX002",
    },

    // —— one week ——
    {
      phase: "one_week_before",
      title: "Order Mixology eventware / supplemental supplies",
      description: `Collapsed 1w timeline. Ensure supplies purchased/ordered: ${supplyChecklist}`,
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks, R.vendorDirectory, R.georgetownOliveOil],
      traceId: "MX067",
    },
    {
      phase: "one_week_before",
      title: "Reconfirm custom aprons sent to Basecamp",
      description:
        "If custom-ordered aprons — confirm sent to Basecamp for printing. See Vendor Directory.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "MX068",
    },
    {
      phase: "one_week_before",
      title: "Menu verified by chef for this function",
      description: "Was the menu verified by the chef for THIS function?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "MX069",
    },
    {
      phase: "one_week_before",
      title: "Confirm specialty paper stock + FedEx print job",
      description:
        "Do we have the appropriate paper in stock? Was printing sent to FedEx if needed?",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "MX070",
    },
    {
      phase: "one_week_before",
      title: "Menu / marketing materials printed (recipe cards)",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.recipeCardsHowTo],
      traceId: "MX071",
    },
    {
      phase: "one_week_before",
      title: "QR code created",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "MX072",
    },
    {
      phase: "one_week_before",
      title: "QR code on website",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "MX073",
    },
    {
      phase: "one_week_before",
      title: "QR code printed",
      role: "Marketing",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.qrCodesFolder],
      traceId: "MX074",
    },
    {
      phase: "one_week_before",
      title: "Logo’d aprons ready for Basecamp pickup",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.basecampDc],
      traceId: "MX075",
    },
    {
      phase: "one_week_before",
      title: "Company aprons cleaned and ready",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory],
      traceId: "MX090",
    },
    {
      phase: "one_week_before",
      title: "Triple-check Mixology inventory + rush remaining supplies",
      description:
        "Any remaining needed supplies via in-person shopping, curbside, or rush shipping.",
      role: "Ops",
      dueOffsetDays: 7,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.inventoryLinks],
      traceId: "MX076",
    },

    // —— during ——
    {
      phase: "during",
      title: "Track client drink consumption (+ WhatsApp media)",
      description:
        "Event host tracks the client's drink consumption; gather WhatsApp / photo media as needed.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "MX100",
    },
    {
      phase: "during",
      title: "Team debrief — what went well / improve → Post Event Survey",
      description:
        "Event team lead checks in: “What did we do well? What do we need to improve?” Add to Post Event Survey.",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.postEventSurvey],
      traceId: "MX105",
    },

    // —— post ——
    {
      phase: "post",
      title: "Prepare consumption invoice (if applicable)",
      role: "Admin",
      dueOffsetDays: 1,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      conditional: { if: "alcohol_included" },
      traceId: "MX108",
    },
    {
      phase: "post",
      title: "Document EVENT REPORT (labor / venue / supplies)",
      description:
        "Note labor hours, venue fees, and supplies purchased for the event.",
      role: "Admin",
      dueOffsetDays: 2,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "MX109",
    },
  ];
}

/**
 * Build Family B / C task defs for one experience (Cooking Family A stays in cookingWorkflowSeed).
 * Meeting-first: shared ROS + confirm-X for all; inventory / deltas remain experience-specific.
 */
export function buildExperienceTaskDefs(
  row: ExperienceMatrixRow
): ExperienceTaskDefSeed[] {
  if (row.timelineFamily === "A") {
    return [];
  }

  resetSort();
  const includeRos = true;
  const out: ExperienceTaskDefSeed[] = [
    ...sharedUponDeposit(includeRos),
    ...sharedRosCadence(row.rosConfirmLabel),
  ];

  if (row.docQuality === "incomplete" || row.docQuality === "stub") {
    out.push(zachFlagTask(row));
  }

  if (row.timelineFamily === "B") {
    out.push(...sharedFamilyBCadence());
  } else if (row.timelineFamily === "C") {
    out.push(...sharedCollapsedOneWeek());
  }

  switch (row.experienceKey) {
    case "In-Person Paint & Sip":
      out.push(...paintDeltas());
      break;
    case "In-Person Pottery":
      out.push(...potteryPaintCloneDeltas().map((t) => ({
        ...t,
        description: `${t.description || ""} (Paint-clone baseline per doc — ${row.flagNote || "incomplete"}).`,
      })));
      break;
    case "In-Person Lend a Hand":
      out.push(...lendAHandDeltas());
      break;
    case "In-Person Terrarium":
      out.push(...terrariumDeltas());
      break;
    case "Flavors of DC":
      out.push(...flavorsDeltas());
      break;
    case "In-Person Private Monuments":
      out.push(...tourDeltas("monuments"));
      break;
    case "In-Person Private Food Tour":
    case "Private Food Tour":
    case "Group Food Tour":
    case "Italian Food Tour":
    case "Georgetown Foodie Tour":
    case "Indoor Food Tour":
      out.push(...tourDeltas("food"));
      break;
    case "In-Person Mixology":
      out.push(...mixologyDeltas());
      break;
    case "In-Person Cheeseboard":
      out.push(...cheeseboardDeltas());
      break;
    case "In-Person Chocolate Making":
      out.push(...chocolateMakingDeltas());
      break;
    default:
      break;
  }

  out.push(...sharedDuringPost());

  if (row.experienceKey === "Flavors of DC") {
    return out.filter((t) => !FLAVORS_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Terrarium") {
    return out.filter((t) => !TERRARIUM_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Lend a Hand") {
    return out.filter((t) => !LEND_A_HAND_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Paint & Sip") {
    return out.filter((t) => !PAINT_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Cheeseboard") {
    return out.filter((t) => !CHEESEBOARD_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Chocolate Making") {
    return out.filter((t) => !CHOCOLATE_MAKING_OMIT_TRACE_IDS.has(t.traceId));
  }

  if (row.experienceKey === "In-Person Mixology") {
    return out.filter((t) => !MIXOLOGY_OMIT_TRACE_IDS.has(t.traceId));
  }

  return out;
}

export function isIncompleteDocQuality(q: DocQuality): boolean {
  return q === "incomplete" || q === "stub";
}

export type { TimelineFamily, WorkflowResourceLink };
