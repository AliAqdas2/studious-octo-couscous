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
      traceId: "C046",
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

function paintDeltas(): ExperienceTaskDefSeed[] {
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

function terrariumDeltas(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "three_weeks",
      title: "Order terrarium kit supplies (containers, soil, rocks, sand, plants)",
      description:
        "Use URLs from Terrarium workflow doc. Cite Vendor Directory for experience vendors — do not add to cooking inventory catalog.",
      role: "Ops",
      dueOffsetDays: 21,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      resourceLinks: [R.vendorDirectory, R.inventoryLinks],
      traceId: "TE067",
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
      title: "Kit ship QA (if shipping kits)",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TE061",
    },
  ];
}

function tourDeltas(kind: "monuments" | "food" | "flavors"): ExperienceTaskDefSeed[] {
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

  if (kind === "monuments" || kind === "food") {
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
  }

  if (kind === "food") {
    tasks.push({
      phase: "two_weeks",
      title: "Finalize drinks included (0–4) — deferred to 2 weeks",
      role: "Ops",
      dueOffsetDays: 14,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "TO080",
    });
  }

  if (kind === "flavors") {
    tasks.unshift(
      {
        phase: "upon_deposit",
        title: "Send early participant list to client + embed in FareHarbor",
        role: "Admin",
        dueOffsetDays: 0,
        dueAnchor: "immediate",
        sortOrder: nextSort(),
        traceId: "FO001",
      },
      {
        phase: "upon_deposit",
        title: "Olive oil mini gift interest Y/N",
        role: "Sales",
        dueOffsetDays: 0,
        dueAnchor: "immediate",
        sortOrder: nextSort(),
        resourceLinks: [R.georgetownOliveOil, R.vendorDirectory],
        traceId: "FO002",
      }
    );
    tasks.push({
      phase: "during",
      title: "Day-of FOH / multi-stop delivery coordination",
      role: "Event Host",
      dueOffsetDays: 0,
      dueAnchor: "event_date",
      sortOrder: nextSort(),
      traceId: "FO095",
    });
  }

  return tasks;
}

function mixologyVenueDelta(): ExperienceTaskDefSeed[] {
  return [
    {
      phase: "upon_deposit",
      title: "Confirm venue — 2001 K ST NW (on premise) when applicable",
      description: "Mixology doc venue note. Inventory remains stub — flag Zach.",
      role: "Sales",
      dueOffsetDays: 0,
      dueAnchor: "immediate",
      sortOrder: nextSort(),
      traceId: "MX001",
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
    case "In-Person Lend a Hand":
      out.push(...paintDeltas().map((t) => ({
        ...t,
        description: `${t.description || ""} (Paint-clone baseline per doc — ${row.flagNote || "incomplete"}).`,
      })));
      break;
    case "In-Person Terrarium":
      out.push(...terrariumDeltas());
      break;
    case "Flavors of DC":
      out.push(...tourDeltas("flavors"));
      break;
    case "In-Person Private Monuments":
      out.push(...tourDeltas("monuments"));
      break;
    case "In-Person Private Food Tour":
      out.push(...tourDeltas("food"));
      break;
    case "In-Person Mixology":
      out.push(...mixologyVenueDelta());
      break;
    default:
      break;
  }

  out.push(...sharedDuringPost());
  return out;
}

export function isIncompleteDocQuality(q: DocQuality): boolean {
  return q === "incomplete" || q === "stub";
}

export type { TimelineFamily, WorkflowResourceLink };
