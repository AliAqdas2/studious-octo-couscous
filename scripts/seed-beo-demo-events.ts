/**
 * Idempotent demo events for BEO QA: one cooking class, one private food tour.
 * Fills deposit, ROS, attendees, inventory (via workflow), eatery stops, artifacts.
 * Does not generate BEO HTML — do that in the UI.
 *
 * Usage: npm run db:seed-beo-demo-events
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
import { addEateryStop } from "../server/services/events/eateryStops.js";
import { replaceEventAttendeesFromImport } from "../server/services/events/eventAttendees.js";
import { generateEventWorkflow } from "../server/services/events/generateWorkflow.js";
import {
  saveEventArtifacts,
  saveRunOfShow,
} from "../server/services/events/runOfShow.js";
import type { RunOfShowPayload } from "../server/services/events/runOfShowTypes.js";

config();

const LOG = "[seed-beo-demo-events]";
const CLIENT_EMAIL = "beo-demo@mangiadc.example";
const COOKING_NAME = "[BEO Demo] Cooking Class";
const TOUR_NAME = "[BEO Demo] Private Food Tour";

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

function weeksFromNow(weeks: number, hour = 18, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}

async function loadActor(): Promise<AuthUser | null> {
  const db = requireDb();
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) return null;
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
      name: "BEO Demo Client",
      company: "Demo Corp",
      email: CLIENT_EMAIL,
      phone: "202-555-0199",
      clientType: "B2B",
      notes: "Seeded for BEO QA — safe to delete",
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

function cookingDeposit(venue: string): DepositIntakePayload {
  return {
    startTime: "18:00",
    pocName: "Alex Rivera",
    pocEmail: "alex.rivera@democorp.example",
    pocPhone: "202-555-0140",
    headcountMin: 18,
    headcountMax: 22,
    alcoholIncluded: true,
    barDetails: {
      paymentMode: "Ticketed",
      wineBeerSoft: true,
      mixedDrinks: "Rail",
    },
    isCompetition: true,
    dishConfiguration: "App + Entree + Dessert",
    foodAdditions: {
      charcuterie: { enabled: true, style: "boards", amount: 4 },
      additionalProtein: { enabled: true, amount: 2 },
      mysteryIngredients: { enabled: true, amount: 1 },
      alternativeSauces: { enabled: false, amount: null },
      flavorsOfDcWarmMeal: { enabled: false, amount: null },
    },
    customAddons: {
      embroideredAprons: {
        enabled: true,
        amount: 20,
        embroidered: true,
        customName: true,
        logoOrdered: true,
      },
      engravedGlassware: { enabled: false, amount: null },
      cheeseboard: { enabled: true, amount: 25 },
      chocolateMold: { enabled: false, amount: null },
      chefHats: { enabled: false, amount: null, embroidered: null },
      berets: { enabled: false, amount: null, embroidered: null },
    },
    transportationNeeded: true,
    transportCompany: "Sammy Transport",
    venueMode: "house_venue",
    venue,
    venueRestrictions: "No open flame on balcony; loading dock 4–6pm.",
    depositAmount: 2500,
    participationListUrl: "https://docs.google.com/spreadsheets/d/beo-demo-cooking",
    participationListType: "sheets",
  };
}

function tourDeposit(): DepositIntakePayload {
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
      charcuterie: { enabled: false, style: null, amount: null },
      additionalProtein: { enabled: false, amount: null },
      mysteryIngredients: { enabled: false, amount: null },
      alternativeSauces: { enabled: false, amount: null },
      flavorsOfDcWarmMeal: { enabled: true, amount: 14 },
    },
    customAddons: {
      embroideredAprons: {
        enabled: false,
        amount: null,
        embroidered: true,
        customName: null,
        logoOrdered: null,
      },
      engravedGlassware: { enabled: false, amount: null },
      cheeseboard: { enabled: false, amount: null },
      chocolateMold: { enabled: false, amount: null },
      chefHats: { enabled: false, amount: null, embroidered: null },
      berets: { enabled: false, amount: null, embroidered: null },
    },
    transportationNeeded: false,
    venueMode: "go_to_them",
    venueOther: "Marriott Marquis — 901 Massachusetts Ave NW",
    venueRestrictions: "Keep group together on sidewalks; 45 min between stops.",
    depositAmount: 1800,
    participationListUrl: "https://docs.google.com/spreadsheets/d/beo-demo-tour",
    participationListType: "sheets",
  };
}

function cookingRos(eventDate: Date): RunOfShowPayload {
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
    headcountConfirmed: 20,
    dayOfPoc: {
      name: "Alex Rivera",
      email: "alex.rivera@democorp.example",
      phone: "202-555-0140",
    },
    mediaPermission: "marketing_ok",
    seatingCurated: true,
    seatingStyle: "Client pre-organized groups",
    foodAdditions: {
      charcuterieCount: 4,
      additionalProtein: 2,
      mysteryIngredients: true,
      alternativeSauces: false,
    },
    transport: {
      needed: true,
      company: "Sammy Transport",
    },
    notes: `Cooking class demo for BEO. Event date ${eventDate.toISOString().slice(0, 10)}. Welcome drink, then stations.`,
  };
}

function tourRos(): RunOfShowPayload {
  return {
    activityConfirm: {
      label: "Confirm tour itinerary",
      notes:
        "Three-stop Georgetown/downtown loop. Meet in Marriott lobby. End at last restaurant.",
      confirmed: true,
    },
    bar: {
      handling: true,
      consumption: true,
      wineOrBeer: "Both",
      notes: "One drink ticket per stop.",
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
    notes: "High-level: walking tour, indoor seating at each stop.",
  };
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

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = requireDb();
  const user = await loadActor();
  const client = await upsertClient();
  const instructorId = await pickInstructorId();
  const venue = await pickVenueName();

  await deleteEventByName(COOKING_NAME);
  await deleteEventByName(TOUR_NAME);

  const cookingDate = weeksFromNow(3, 18, 0);
  const tourDate = weeksFromNow(4, 14, 0);

  const [cooking] = await db
    .insert(events)
    .values({
      eventName: COOKING_NAME,
      eventType: "In-Person Cooking",
      eventFormat: "In-Person",
      venue,
      venueMode: "house_venue",
      eventDate: cookingDate,
      startTime: hhmm(cookingDate),
      clientId: client.id,
      instructorId,
      pocName: "Alex Rivera",
      pocEmail: "alex.rivera@democorp.example",
      pocPhone: "202-555-0140",
      pocTitle: "Event Manager",
      dietaryRestrictions: "2 gluten-free, 1 nut allergy — see attendee list",
      specialRequests: "Group photo at dessert; logo on aprons.",
      additionalEventDetails: "Competition scoring sheets at host table.",
      accessibilityNeeds: "One guest uses a wheelchair — ground-floor kitchen.",
      staffAssigned: [
        { name: "Dave", role: "Ops" },
        { name: "Host", role: "Event Host" },
      ],
      menu: "App / salmon / tiramisu — confirmed at ROS",
      stage: "Deposit Received",
      depositReceived: true,
      depositAmount: 2500,
      depositReceivedAt: new Date(),
      /** Pre-mark completed so completeDepositIntake skips Gmail notify. */
      depositIntakeCompletedAt: new Date(),
    })
    .returning();

  if (!cooking) throw new Error("Failed to insert cooking event");

  await fillShared(
    cooking.id,
    user,
    cookingDeposit(venue),
    cookingRos(cookingDate)
  );

  const [tour] = await db
    .insert(events)
    .values({
      eventName: TOUR_NAME,
      eventType: "Private Food Tour",
      eventFormat: "In-Person",
      venue: "Marriott Marquis — 901 Massachusetts Ave NW",
      venueMode: "go_to_them",
      eventDate: tourDate,
      startTime: hhmm(tourDate),
      clientId: client.id,
      instructorId,
      pocName: "Taylor Nguyen",
      pocEmail: "taylor.nguyen@marriott.example",
      pocPhone: "202-555-0160",
      pocTitle: "Group Coordinator",
      dietaryRestrictions: "1 gluten-free, 1 vegetarian",
      specialRequests: "Keep group of 14 together; photo at stop 2.",
      additionalEventDetails: "Meet in lobby 15 minutes before first reservation.",
      accessibilityNeeds: "Avoid stairs between stops 1 and 2 if possible.",
      staffAssigned: [{ name: "Guide", role: "Event Host" }],
      stage: "Deposit Received",
      depositReceived: true,
      depositAmount: 1800,
      depositReceivedAt: new Date(),
      depositIntakeCompletedAt: new Date(),
    })
    .returning();

  if (!tour) throw new Error("Failed to insert tour event");

  await fillShared(tour.id, user, tourDeposit(), tourRos());

  const eateryIds = await pickEateryIds(3);
  if (eateryIds.length === 0) {
    console.warn(
      `${LOG} no eateries — tour has no stops. Run npm run db:seed-eateries`
    );
  } else {
    const times = ["14:15", "15:15", "16:30"];
    for (let i = 0; i < eateryIds.length; i += 1) {
      await addEateryStop(tour.id, {
        eatery_id: eateryIds[i],
        stop_time: times[i] || "17:00",
        guest_count: 14,
      });
    }
  }

  console.log(`${LOG} client=${client.id} ${CLIENT_EMAIL}`);
  console.log(`${LOG} cooking=${cooking.id}  ${COOKING_NAME}`);
  console.log(`${LOG} tour=${tour.id}  ${TOUR_NAME}`);
  console.log(`${LOG} Open Event Detail and generate each BEO in the UI.`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
