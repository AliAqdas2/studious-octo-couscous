/**
 * Idempotent demo events — one fully pre-populated event per experience matrix type.
 * Fills deposit, workflow tasks, ROS, attendees, artifacts; food tours get eatery stops.
 * Does not generate BEO HTML — do that in the UI.
 *
 * Usage:
 *   npm run db:seed-demo-events-by-type
 *   npm run db:seed-demo-events-by-type -- --type="In-Person Mixology"
 *   npm run db:seed-demo-events-by-type -- --force   # allow NODE_ENV=production
 */
import { config } from "dotenv";
import { asc, eq } from "drizzle-orm";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";
import {
  clients,
  eateries,
  events,
  instructors,
  users,
  venues,
} from "../server/db/schema/index.js";
import type { AuthUser } from "../server/services/auth/authService.js";
import { completeDepositIntake } from "../server/services/events/completeDepositIntake.js";
import type { DepositIntakePayload } from "../server/services/events/depositIntakeTypes.js";
import { emptyCustomAddons, emptyFoodAdditions } from "../server/services/events/depositIntakeTypes.js";
import { addEateryStop } from "../server/services/events/eateryStops.js";
import { replaceEventAttendeesFromImport } from "../server/services/events/eventAttendees.js";
import {
  COOKING_EVENT_EXPERIENCE_KEYS,
  EXPERIENCE_MATRIX,
  isFoodTourExperience,
  type ExperienceMatrixRow,
} from "../server/services/events/experienceMatrix.js";
import { generateEventWorkflow } from "../server/services/events/generateWorkflow.js";
import {
  saveEventArtifacts,
  saveRunOfShow,
} from "../server/services/events/runOfShow.js";
import type { RunOfShowPayload } from "../server/services/events/runOfShowTypes.js";

config();

const LOG = "[seed-demo-events-by-type]";
const CLIENT_EMAIL = "demo-events@mangiadc.example";
const TOUR_VENUE = "Marriott Marquis — 901 Massachusetts Ave NW";

type DemoProfile = "cooking" | "venueKit" | "tour";

const DEMO_ATTENDEES = [
  { name: "Priya Shah", allergies: "Tree nuts", phone: "202-555-0101" },
  { name: "Marcus Chen", allergies: "", phone: "202-555-0102" },
  { name: "Elena Rossi", allergies: "Gluten", phone: "202-555-0103" },
  { name: "Jordan Blake", allergies: "Shellfish", phone: "202-555-0104" },
  { name: "Sam Okonkwo", allergies: "", phone: "202-555-0105" },
  { name: "Hannah Kim", allergies: "Dairy", phone: "202-555-0106" },
  { name: "Luis Ortega", allergies: "", phone: "202-555-0107" },
  { name: "Avery Patel", allergies: "Peanuts", phone: "202-555-0108" },
];

function parseArgs(argv: string[]) {
  let typeFilter: string | null = null;
  let force = false;
  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--type=")) {
      typeFilter = arg.slice("--type=".length).trim() || null;
      continue;
    }
    if (arg === "--type") {
      // next token handled below — keep simple: require --type=value
      continue;
    }
  }
  // Support `--type "In-Person Mixology"` (two argv tokens)
  const typeIdx = argv.indexOf("--type");
  if (typeIdx >= 0 && argv[typeIdx + 1] && !argv[typeIdx + 1].startsWith("--")) {
    typeFilter = argv[typeIdx + 1].trim();
  }
  return { typeFilter, force };
}

function weeksFromNow(weeks: number, hour = 18, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function demoEventName(row: ExperienceMatrixRow): string {
  return `[Demo] ${row.displayName}`;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}

function resolveProfile(row: ExperienceMatrixRow): DemoProfile {
  const cookingKeys = COOKING_EVENT_EXPERIENCE_KEYS as readonly string[];
  if (cookingKeys.includes(row.experienceKey)) return "cooking";
  if (
    isFoodTourExperience(row.eventType) ||
    row.experienceKey === "In-Person Private Monuments" ||
    row.experienceKey === "Flavors of DC"
  ) {
    return "tour";
  }
  return "venueKit";
}

async function loadActor(): Promise<AuthUser | null> {
  const db = requireDb();
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) {
    console.warn(`${LOG} no admin user — workflow/ROS actor will be null`);
    return null;
  }
  return {
    id: admin.id,
    email: admin.email,
    full_name: admin.fullName,
    role: admin.role,
  };
}

async function upsertClient() {
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, CLIENT_EMAIL))
    .limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(clients)
    .values({
      name: "Demo Events Client",
      company: "Demo Corp",
      email: CLIENT_EMAIL,
      phone: "202-555-0299",
      clientType: "B2B",
      notes: "Seeded for multi-type demo events — safe to delete",
    })
    .returning();
  return row;
}

async function deleteEventByName(name: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.eventName, name))
    .limit(1);
  if (!row) return;
  await db.delete(events).where(eq(events.id, row.id));
  console.log(`${LOG} replaced existing ${name} (${row.id})`);
}

async function pickInstructorId(): Promise<string | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(instructors)
    .where(eq(instructors.isActive, true))
    .orderBy(asc(instructors.sortOrder))
    .limit(1);
  if (!row) {
    console.warn(
      `${LOG} no active instructors — run npm run db:seed-instructors`
    );
    return null;
  }
  return row.id;
}

async function pickVenueName(): Promise<string> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(venues)
    .where(eq(venues.isActive, true))
    .orderBy(asc(venues.sortOrder))
    .limit(1);
  return row?.name || "Launch Glover Park";
}

async function pickEateryIds(limit: number): Promise<string[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(eateries)
    .where(eq(eateries.isActive, true))
    .orderBy(asc(eateries.sortOrder))
    .limit(limit);
  return rows.map((r) => r.id);
}

function cookingDeposit(venue: string, row: ExperienceMatrixRow): DepositIntakePayload {
  const isClassicCooking = row.experienceKey === "In-Person Cooking";
  return {
    startTime: "18:00",
    pocName: "Alex Rivera",
    pocEmail: "alex.rivera@democorp.example",
    pocPhone: "202-555-0140",
    headcountMin: 16,
    headcountMax: 20,
    alcoholIncluded: true,
    barDetails: {
      paymentMode: "Ticketed",
      wineBeerSoft: true,
      mixedDrinks: "Rail",
    },
    isCompetition: isClassicCooking,
    dishConfiguration: isClassicCooking
      ? "App + Entree + Dessert"
      : "Entree",
    foodAdditions: {
      charcuterie: { enabled: true, style: "boards", amount: 3 },
      additionalProtein: { enabled: isClassicCooking, amount: isClassicCooking ? 2 : null },
      mysteryIngredients: { enabled: isClassicCooking, amount: isClassicCooking ? 1 : null },
      alternativeSauces: { enabled: false, amount: null },
      flavorsOfDcWarmMeal: { enabled: false, amount: null },
    },
    customAddons: {
      ...emptyCustomAddons(),
      embroideredAprons: {
        enabled: true,
        amount: 18,
        embroidered: true,
        customName: true,
        logoOrdered: true,
      },
      cheeseboard:
        row.experienceKey === "In-Person Cheeseboard"
          ? { enabled: true, amount: 25 }
          : { enabled: false, amount: null },
      chocolateMold:
        row.experienceKey.includes("Chocolate")
          ? { enabled: true, amount: 20 }
          : { enabled: false, amount: null },
    },
    transportationNeeded: true,
    transportCompany: "Sammy Transport",
    venueMode: "house_venue",
    venue,
    venueRestrictions: "Loading dock 4–6pm; no open flame on balcony.",
    depositAmount: 2200,
    participationListUrl: `https://docs.google.com/spreadsheets/d/demo-${encodeURIComponent(row.eventType)}`,
    participationListType: "sheets",
  };
}

function venueKitDeposit(venue: string, row: ExperienceMatrixRow): DepositIntakePayload {
  return {
    startTime: "18:00",
    pocName: "Jordan Lee",
    pocEmail: "jordan.lee@democorp.example",
    pocPhone: "202-555-0155",
    headcountMin: 14,
    headcountMax: 18,
    alcoholIncluded: true,
    barDetails: {
      paymentMode: "Fixed Open Bar",
      wineBeerSoft: true,
      mixedDrinks:
        row.experienceKey === "In-Person Mixology" ? "Top Shelf" : "Rail",
    },
    foodAdditions: {
      ...emptyFoodAdditions(),
      charcuterie: { enabled: true, style: "boards", amount: 2 },
      flavorsOfDcWarmMeal: { enabled: false, amount: null },
    },
    customAddons: {
      ...emptyCustomAddons(),
      embroideredAprons: {
        enabled: true,
        amount: 16,
        embroidered: true,
        customName: false,
        logoOrdered: true,
      },
      berets:
        row.experienceKey === "In-Person Paint & Sip"
          ? { enabled: true, amount: 16, embroidered: true }
          : { enabled: false, amount: null, embroidered: null },
    },
    transportationNeeded: false,
    venueMode: "house_venue",
    venue,
    venueRestrictions: "Confirm loading dock with Ops.",
    depositAmount: 1900,
    participationListUrl: `https://docs.google.com/spreadsheets/d/demo-${encodeURIComponent(row.eventType)}`,
    participationListType: "sheets",
  };
}

function tourDeposit(row: ExperienceMatrixRow): DepositIntakePayload {
  return {
    startTime: "14:00",
    pocName: "Taylor Nguyen",
    pocEmail: "taylor.nguyen@marriott.example",
    pocPhone: "202-555-0160",
    headcountMin: 12,
    headcountMax: 16,
    alcoholIncluded: true,
    barDetails: {
      paymentMode: "Fixed Open Bar",
      wineBeerSoft: true,
      mixedDrinks: "Top Shelf",
    },
    foodAdditions: {
      ...emptyFoodAdditions(),
      flavorsOfDcWarmMeal: {
        enabled: row.experienceKey === "Flavors of DC",
        amount: row.experienceKey === "Flavors of DC" ? 14 : null,
      },
    },
    customAddons: emptyCustomAddons(),
    transportationNeeded: false,
    venueMode: "go_to_them",
    venueOther: TOUR_VENUE,
    venueRestrictions:
      row.experienceKey === "In-Person Private Monuments"
        ? "Security lines; keep group together at each stop."
        : "Keep group together on sidewalks; 45 min between stops.",
    depositAmount: 1800,
    participationListUrl: `https://docs.google.com/spreadsheets/d/demo-${encodeURIComponent(row.eventType)}`,
    participationListType: "sheets",
  };
}

function cookingRos(eventDate: Date, row: ExperienceMatrixRow): RunOfShowPayload {
  return {
    menu: {
      app: "Burrata, roasted tomatoes, basil oil",
      entree: "Pan-seared salmon, lemon risotto",
      dessert: "Tiramisu cups",
      confirmed: true,
    },
    bar: {
      handling: true,
      consumption: true,
      wineOrBeer: "Wine",
      notes: "Two whites, one red; NA option on the bar.",
    },
    arrivalMethod: "Motorcoach",
    timeChanged: false,
    headcountConfirmed: 18,
    dayOfPoc: {
      name: "Alex Rivera",
      email: "alex.rivera@democorp.example",
      phone: "202-555-0140",
    },
    mediaPermission: "marketing_ok",
    seatingCurated: true,
    seatingStyle: "Client pre-organized groups",
    foodAdditions: {
      charcuterieCount: 3,
      additionalProtein: 2,
      mysteryIngredients: row.experienceKey === "In-Person Cooking",
      alternativeSauces: false,
    },
    transport: {
      needed: true,
      company: "Sammy Transport",
    },
    notes: `Demo ${row.displayName}. Event date ${eventDate.toISOString().slice(0, 10)}.`,
  };
}

function venueKitRos(eventDate: Date, row: ExperienceMatrixRow): RunOfShowPayload {
  return {
    activityConfirm: {
      label: row.rosConfirmLabel,
      notes: `Confirmed for demo ${row.displayName}.`,
      confirmed: true,
    },
    bar: {
      handling: true,
      consumption: true,
      wineOrBeer:
        row.experienceKey === "In-Person Mixology" ? "Both" : "Wine",
      notes: "NA options available.",
    },
    arrivalMethod: "Own",
    timeChanged: false,
    headcountConfirmed: 16,
    dayOfPoc: {
      name: "Jordan Lee",
      email: "jordan.lee@democorp.example",
      phone: "202-555-0155",
    },
    mediaPermission: "marketing_ok",
    seatingCurated: true,
    seatingStyle: "At random",
    foodAdditions: {
      charcuterieCount: 2,
      additionalProtein: null,
      mysteryIngredients: false,
      alternativeSauces: false,
    },
    transport: { needed: false, company: null },
    notes: `Demo venue kit — ${row.displayName}. Date ${eventDate.toISOString().slice(0, 10)}.`,
  };
}

function tourRos(row: ExperienceMatrixRow): RunOfShowPayload {
  return {
    activityConfirm: {
      label: row.rosConfirmLabel,
      notes:
        row.experienceKey === "In-Person Private Monuments"
          ? "Monument loop confirmed. Meet in Marriott lobby."
          : "Three-stop loop confirmed. Meet in Marriott lobby. End at last restaurant.",
      confirmed: true,
    },
    bar: {
      handling: true,
      consumption: true,
      wineOrBeer: "Both",
      notes: "One drink ticket per stop where applicable.",
    },
    arrivalMethod: "Own",
    timeChanged: false,
    headcountConfirmed: 14,
    dayOfPoc: {
      name: "Taylor Nguyen",
      email: "taylor.nguyen@marriott.example",
      phone: "202-555-0160",
    },
    mediaPermission: "internal_only",
    seatingCurated: false,
    transport: { needed: false, company: null },
    notes: `Demo tour/itinerary — ${row.displayName}.`,
  };
}

function buildDeposit(
  profile: DemoProfile,
  venue: string,
  row: ExperienceMatrixRow
): DepositIntakePayload {
  if (profile === "cooking") return cookingDeposit(venue, row);
  if (profile === "tour") return tourDeposit(row);
  return venueKitDeposit(venue, row);
}

function buildRos(
  profile: DemoProfile,
  eventDate: Date,
  row: ExperienceMatrixRow
): RunOfShowPayload {
  if (profile === "cooking") return cookingRos(eventDate, row);
  if (profile === "tour") return tourRos(row);
  return venueKitRos(eventDate, row);
}

async function fillShared(
  eventId: string,
  user: AuthUser | null,
  deposit: DepositIntakePayload,
  ros: RunOfShowPayload
) {
  await completeDepositIntake(eventId, deposit, user);
  try {
    await generateEventWorkflow(eventId, user ?? undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/already/i.test(message)) {
      console.warn(`${LOG} generateEventWorkflow: ${message}`);
    }
  }
  await saveRunOfShow(eventId, ros, user, {
    complete: true,
    markScheduled: true,
  });
  await saveEventArtifacts(
    eventId,
    {
      participationListUrl: deposit.participationListUrl ?? null,
      participationListType: deposit.participationListType ?? "sheets",
      fareharborLink: "https://fareharbor.com/embeds/book/mangiadc/demo",
    },
    user
  );
  await replaceEventAttendeesFromImport(eventId, DEMO_ATTENDEES);
}

async function attachEateryStops(eventId: string, guestCount: number) {
  const eateryIds = await pickEateryIds(3);
  if (eateryIds.length === 0) {
    console.warn(
      `${LOG} no eateries — run npm run db:seed-eateries for tour stops`
    );
    return;
  }
  const times = ["14:15", "15:15", "16:30"];
  for (let i = 0; i < eateryIds.length; i += 1) {
    await addEateryStop(eventId, {
      eatery_id: eateryIds[i],
      stop_time: times[i] || "17:00",
      guest_count: guestCount,
    });
  }
}

function uniqueMatrixRows(): ExperienceMatrixRow[] {
  const seen = new Set<string>();
  const out: ExperienceMatrixRow[] = [];
  for (const row of EXPERIENCE_MATRIX) {
    if (seen.has(row.eventType)) continue;
    seen.add(row.eventType);
    out.push(row);
  }
  return out;
}

async function createDemoEvent(opts: {
  row: ExperienceMatrixRow;
  index: number;
  clientId: string;
  instructorId: string | null;
  venue: string;
  user: AuthUser | null;
}): Promise<{ id: string; eventName: string; eventType: string }> {
  const { row, index, clientId, instructorId, venue, user } = opts;
  const profile = resolveProfile(row);
  const eventName = demoEventName(row);
  const hour = profile === "tour" ? 14 : 18;
  const eventDate = weeksFromNow(3 + index, hour, 0);
  const deposit = buildDeposit(profile, venue, row);
  const ros = buildRos(profile, eventDate, row);

  await deleteEventByName(eventName);

  const db = requireDb();
  const venueMode = profile === "tour" ? "go_to_them" : "house_venue";
  const venueValue = profile === "tour" ? TOUR_VENUE : venue;

  const [created] = await db
    .insert(events)
    .values({
      eventName,
      eventType: row.eventType as (typeof events.$inferInsert)["eventType"],
      eventFormat: "In-Person",
      venue: venueValue,
      venueMode,
      eventDate,
      startTime: hhmm(eventDate),
      clientId,
      instructorId,
      pocName: deposit.pocName ?? "Demo POC",
      pocEmail: deposit.pocEmail ?? null,
      pocPhone: deposit.pocPhone ?? null,
      pocTitle: "Event Coordinator",
      dietaryRestrictions: "See attendee list — demo allergies seeded",
      specialRequests: `Demo seed for ${row.displayName}`,
      additionalEventDetails: `Profile=${profile}; family=${row.timelineFamily}; quality=${row.docQuality}`,
      accessibilityNeeds: "Ground-floor access preferred.",
      staffAssigned: [
        { name: "Ops", role: "Ops" },
        { name: "Host", role: "Event Host" },
      ],
      menu:
        profile === "cooking"
          ? "Demo menu — confirmed at ROS"
          : `${row.rosConfirmLabel} — see ROS`,
      stage: "Deposit Received",
      depositReceived: true,
      depositAmount: deposit.depositAmount ?? 1500,
      depositReceivedAt: new Date(),
      /** Pre-mark completed so completeDepositIntake skips Gmail notify. */
      depositIntakeCompletedAt: new Date(),
    })
    .returning();

  if (!created) throw new Error(`Failed to insert ${eventName}`);

  await fillShared(created.id, user, deposit, ros);

  if (isFoodTourExperience(row.eventType)) {
    await attachEateryStops(created.id, deposit.headcountMax ?? 14);
  }

  return {
    id: created.id,
    eventName,
    eventType: row.eventType,
  };
}

async function main(): Promise<void> {
  const { typeFilter, force } = parseArgs(process.argv.slice(2));

  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error(
      `${LOG} refused: NODE_ENV=production. Pass --force if you really intend to seed demo events.`
    );
  }

  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }

  const user = await loadActor();
  const client = await upsertClient();
  if (!client) throw new Error("Failed to upsert demo client");
  const instructorId = await pickInstructorId();
  const venue = await pickVenueName();

  let rows = uniqueMatrixRows();
  if (typeFilter) {
    rows = rows.filter((r) => r.eventType === typeFilter);
    if (rows.length === 0) {
      const known = uniqueMatrixRows()
        .map((r) => r.eventType)
        .join("\n  ");
      throw new Error(
        `${LOG} unknown --type="${typeFilter}". Known eventType values:\n  ${known}`
      );
    }
  }

  console.log(
    `${LOG} creating ${rows.length} demo event(s); client=${CLIENT_EMAIL}`
  );

  const created: Array<{ id: string; eventName: string; eventType: string }> =
    [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const result = await createDemoEvent({
      row,
      index: i,
      clientId: client.id,
      instructorId,
      venue,
      user,
    });
    created.push(result);
    console.log(
      `${LOG} ok  ${result.eventType}  id=${result.id}  ${result.eventName}`
    );
  }

  console.log(`${LOG} client=${client.id} ${CLIENT_EMAIL}`);
  console.log(`${LOG} created ${created.length} event(s)`);
  console.log(`${LOG} Open Event Detail and generate BEOs in the UI as needed.`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
