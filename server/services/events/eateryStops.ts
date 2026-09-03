import { asc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  eateries,
  eventEateryStops,
  events,
} from "../../db/schema/index.js";
import type { EateryOrderLine } from "../../db/schema/eateries.js";
import { toApiRecord } from "../entities/serialize.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function normalizeOrderLines(value: unknown): EateryOrderLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => {
      const per = Number(l.perGuests);
      return {
        label: String(l.label ?? "").trim(),
        perGuests: Number.isFinite(per) && per > 0 ? per : null,
        note: l.note ? String(l.note).trim() : null,
      };
    })
    .filter((l) => l.label);
}

async function requireEvent(eventId: string) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);
  return event;
}

export async function listEventEateryStops(eventId: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(eventEateryStops)
    .where(eq(eventEateryStops.eventId, eventId))
    .orderBy(asc(eventEateryStops.sortOrder));
  return rows.map((r) => toApiRecord(r as Record<string, unknown>));
}

export async function getEventEateryStops(eventId: string) {
  await requireEvent(eventId);
  return { stops: await listEventEateryStops(eventId) };
}

export interface AddEateryStopPayload {
  eatery_id?: string | null;
  name?: string;
  stop_time?: string | null;
  guest_count?: number | null;
}

export async function addEateryStop(
  eventId: string,
  payload: AddEateryStopPayload
) {
  const db = requireDb();
  const event = await requireEvent(eventId);

  let base: {
    name: string;
    address: string | null;
    timeLabel: "Reservation Time" | "Arrival Time";
    orderMode: "PRE-ORDERED" | "ORDERING AT";
    orderLines: EateryOrderLine[];
    drinkOption: string | null;
    orderKeyDishes: string | null;
  } | null = null;

  if (payload.eatery_id) {
    const [eatery] = await db
      .select()
      .from(eateries)
      .where(eq(eateries.id, payload.eatery_id))
      .limit(1);
    if (!eatery) throw new AppError("Eatery not found", 404);
    base = {
      name: eatery.name,
      address: eatery.address ?? null,
      timeLabel: eatery.timeLabel,
      orderMode: eatery.orderMode,
      orderLines: Array.isArray(eatery.orderLines) ? eatery.orderLines : [],
      drinkOption: eatery.drinkOption ?? null,
      orderKeyDishes: eatery.orderKeyDishes ?? null,
    };
  }

  const name = (payload.name ?? base?.name ?? "").trim();
  if (!name) throw new AppError("Stop name is required", 400);

  const existing = await db
    .select()
    .from(eventEateryStops)
    .where(eq(eventEateryStops.eventId, eventId));
  const maxSort = existing.reduce(
    (m, r) => Math.max(m, r.sortOrder ?? 0),
    0
  );

  const guestCount =
    payload.guest_count ??
    event.headcount ??
    event.headcountMax ??
    event.headcountMin ??
    null;

  await db.insert(eventEateryStops).values({
    eventId,
    eateryId: payload.eatery_id ?? null,
    name,
    address: base?.address ?? null,
    stopTime: payload.stop_time ?? null,
    guestCount,
    timeLabel: base?.timeLabel ?? "Reservation Time",
    orderMode: base?.orderMode ?? "PRE-ORDERED",
    orderLines: base?.orderLines ?? [],
    drinkOption: base?.drinkOption ?? null,
    orderKeyDishes: base?.orderKeyDishes ?? null,
    sortOrder: maxSort + 10,
  });

  return { stops: await listEventEateryStops(eventId) };
}

export interface UpdateEateryStopPayload {
  name?: string;
  address?: string | null;
  stop_time?: string | null;
  guest_count?: number | null;
  time_label?: string;
  order_mode?: string;
  order_lines?: unknown;
  drink_option?: string | null;
  order_key_dishes?: string | null;
  notes?: string | null;
  sort_order?: number;
}

export async function updateEateryStop(
  eventId: string,
  stopId: string,
  payload: UpdateEateryStopPayload
) {
  const db = requireDb();
  await requireEvent(eventId);

  const [stop] = await db
    .select()
    .from(eventEateryStops)
    .where(eq(eventEateryStops.id, stopId))
    .limit(1);
  if (!stop || stop.eventId !== eventId) {
    throw new AppError("Stop not found", 404);
  }

  const patch: Record<string, unknown> = { updatedDate: new Date() };
  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw new AppError("Stop name is required", 400);
    patch.name = name;
  }
  if (payload.address !== undefined) patch.address = payload.address;
  if (payload.stop_time !== undefined) patch.stopTime = payload.stop_time;
  if (payload.guest_count !== undefined) {
    const n = Number(payload.guest_count);
    patch.guestCount = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (payload.time_label !== undefined) patch.timeLabel = payload.time_label;
  if (payload.order_mode !== undefined) patch.orderMode = payload.order_mode;
  if (payload.order_lines !== undefined) {
    patch.orderLines = normalizeOrderLines(payload.order_lines);
  }
  if (payload.drink_option !== undefined) {
    patch.drinkOption = payload.drink_option;
  }
  if (payload.order_key_dishes !== undefined) {
    patch.orderKeyDishes = payload.order_key_dishes;
  }
  if (payload.notes !== undefined) patch.notes = payload.notes;
  if (payload.sort_order !== undefined) {
    patch.sortOrder = Number(payload.sort_order) || 0;
  }

  await db
    .update(eventEateryStops)
    .set(patch)
    .where(eq(eventEateryStops.id, stopId));

  return { stops: await listEventEateryStops(eventId) };
}

export async function removeEateryStop(eventId: string, stopId: string) {
  const db = requireDb();
  await requireEvent(eventId);

  const [stop] = await db
    .select()
    .from(eventEateryStops)
    .where(eq(eventEateryStops.id, stopId))
    .limit(1);
  if (!stop || stop.eventId !== eventId) {
    throw new AppError("Stop not found", 404);
  }

  await db.delete(eventEateryStops).where(eq(eventEateryStops.id, stopId));
  return { stops: await listEventEateryStops(eventId) };
}
