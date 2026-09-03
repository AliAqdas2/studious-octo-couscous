import { asc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { eventAttendees, events } from "../../db/schema/index.js";
import { toApiRecord } from "../entities/serialize.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
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

export interface AttendeeRowInput {
  name?: string | null;
  allergies?: string | null;
  phone?: string | null;
}

function normalizeAttendeeRow(row: AttendeeRowInput): {
  name: string;
  allergies: string | null;
  phone: string | null;
} | null {
  const name = String(row?.name ?? "").trim();
  if (!name) return null;
  const allergies = String(row?.allergies ?? "").trim() || null;
  const phone = String(row?.phone ?? "").trim() || null;
  return { name, allergies, phone };
}

function headerKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Map spreadsheet header cells to name / allergies / phone. */
function mapHeaderIndexes(headers: unknown[]): {
  name: number;
  allergies: number;
  phone: number;
} {
  let name = -1;
  let allergies = -1;
  let phone = -1;
  headers.forEach((h, i) => {
    const key = headerKey(h);
    if (!key) return;
    if (name < 0 && (key === "name" || key === "fullname" || key === "attendee")) {
      name = i;
    } else if (
      allergies < 0 &&
      (key === "allergies" ||
        key === "allergy" ||
        key === "dietary" ||
        key === "dietaryrestrictions" ||
        key === "diet")
    ) {
      allergies = i;
    } else if (
      phone < 0 &&
      (key === "phone" ||
        key === "phonenumber" ||
        key === "mobile" ||
        key === "cell" ||
        key === "tel")
    ) {
      phone = i;
    }
  });
  return { name, allergies, phone };
}

function rowsFromSheetMatrix(matrix: unknown[][]): AttendeeRowInput[] {
  if (!matrix.length) return [];
  const headers = matrix[0] ?? [];
  const indexes = mapHeaderIndexes(headers);
  // If no name header, treat first column as name (no header row).
  const useHeader = indexes.name >= 0;
  const nameIdx = useHeader ? indexes.name : 0;
  const allergiesIdx = useHeader ? indexes.allergies : 1;
  const phoneIdx = useHeader ? indexes.phone : 2;
  const dataRows = useHeader ? matrix.slice(1) : matrix;

  const out: AttendeeRowInput[] = [];
  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    const mapped = normalizeAttendeeRow({
      name: row[nameIdx] != null ? String(row[nameIdx]) : "",
      allergies:
        allergiesIdx >= 0 && row[allergiesIdx] != null
          ? String(row[allergiesIdx])
          : "",
      phone:
        phoneIdx >= 0 && row[phoneIdx] != null ? String(row[phoneIdx]) : "",
    });
    if (mapped) out.push(mapped);
  }
  return out;
}

export function parseAttendeeSpreadsheetBuffer(buffer: Buffer): AttendeeRowInput[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  return rowsFromSheetMatrix(matrix);
}

export function parseAttendeeCsvText(csvText: string): AttendeeRowInput[] {
  const workbook = XLSX.read(csvText, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  return rowsFromSheetMatrix(matrix);
}

/** Turn a Google Sheets view URL into a CSV export URL when possible. */
export function googleSheetCsvExportUrl(rawUrl: string): string {
  const url = String(rawUrl || "").trim();
  if (!url) throw new AppError("url is required", 400);

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("docs.google.com") && u.pathname.includes("/spreadsheets/")) {
      const match = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      if (match?.[1]) {
        const gid =
          u.searchParams.get("gid") ||
          (u.hash.match(/gid=(\d+)/) || [])[1] ||
          "0";
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
      }
    }
  } catch {
    throw new AppError("Invalid Google Sheet URL", 400);
  }

  // Already an export / published CSV link
  if (/export\?format=csv/i.test(url) || /output=csv/i.test(url)) {
    return url;
  }
  return url;
}

export async function listEventAttendees(eventId: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(eventAttendees)
    .where(eq(eventAttendees.eventId, eventId))
    .orderBy(asc(eventAttendees.sortOrder), asc(eventAttendees.createdDate));
  return rows.map((r) => toApiRecord(r as Record<string, unknown>));
}

export async function getEventAttendees(eventId: string) {
  await requireEvent(eventId);
  return { attendees: await listEventAttendees(eventId) };
}

export async function createEventAttendee(
  eventId: string,
  payload: AttendeeRowInput
) {
  const db = requireDb();
  await requireEvent(eventId);
  const normalized = normalizeAttendeeRow(payload);
  if (!normalized) throw new AppError("name is required", 400);

  const existing = await listEventAttendees(eventId);
  const sortOrder = existing.length;

  const [row] = await db
    .insert(eventAttendees)
    .values({
      eventId,
      name: normalized.name,
      allergies: normalized.allergies,
      phone: normalized.phone,
      sortOrder,
      updatedDate: new Date(),
    })
    .returning();

  return { attendee: toApiRecord(row as Record<string, unknown>) };
}

export async function updateEventAttendee(
  eventId: string,
  attendeeId: string,
  payload: AttendeeRowInput & { sort_order?: number | null }
) {
  const db = requireDb();
  await requireEvent(eventId);
  const [existing] = await db
    .select()
    .from(eventAttendees)
    .where(eq(eventAttendees.id, attendeeId))
    .limit(1);
  if (!existing || existing.eventId !== eventId) {
    throw new AppError("Attendee not found", 404);
  }

  const nextName =
    payload.name !== undefined
      ? String(payload.name ?? "").trim()
      : existing.name;
  if (!nextName) throw new AppError("name is required", 400);

  const [row] = await db
    .update(eventAttendees)
    .set({
      name: nextName,
      allergies:
        payload.allergies !== undefined
          ? String(payload.allergies ?? "").trim() || null
          : existing.allergies,
      phone:
        payload.phone !== undefined
          ? String(payload.phone ?? "").trim() || null
          : existing.phone,
      sortOrder:
        payload.sort_order != null && Number.isFinite(Number(payload.sort_order))
          ? Number(payload.sort_order)
          : existing.sortOrder,
      updatedDate: new Date(),
    })
    .where(eq(eventAttendees.id, attendeeId))
    .returning();

  return { attendee: toApiRecord(row as Record<string, unknown>) };
}

export async function deleteEventAttendee(eventId: string, attendeeId: string) {
  const db = requireDb();
  await requireEvent(eventId);
  const [existing] = await db
    .select()
    .from(eventAttendees)
    .where(eq(eventAttendees.id, attendeeId))
    .limit(1);
  if (!existing || existing.eventId !== eventId) {
    throw new AppError("Attendee not found", 404);
  }
  await db.delete(eventAttendees).where(eq(eventAttendees.id, attendeeId));
  return { ok: true };
}

export async function replaceEventAttendeesFromImport(
  eventId: string,
  rows: AttendeeRowInput[]
) {
  const db = requireDb();
  await requireEvent(eventId);

  const normalized = (Array.isArray(rows) ? rows : [])
    .map((r) => normalizeAttendeeRow(r))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  await db.delete(eventAttendees).where(eq(eventAttendees.eventId, eventId));

  if (normalized.length === 0) {
    return { attendees: [], imported: 0 };
  }

  const now = new Date();
  const inserted = await db
    .insert(eventAttendees)
    .values(
      normalized.map((r, i) => ({
        eventId,
        name: r.name,
        allergies: r.allergies,
        phone: r.phone,
        sortOrder: i,
        updatedDate: now,
      }))
    )
    .returning();

  return {
    attendees: inserted.map((r) => toApiRecord(r as Record<string, unknown>)),
    imported: inserted.length,
  };
}

export async function importAttendeesFromSheetUrl(
  eventId: string,
  rawUrl: string
) {
  const exportUrl = googleSheetCsvExportUrl(rawUrl);
  let res: Response;
  try {
    res = await fetch(exportUrl, {
      redirect: "follow",
      headers: { Accept: "text/csv,text/plain,*/*" },
    });
  } catch {
    throw new AppError("Could not fetch Google Sheet URL", 400);
  }
  if (!res.ok) {
    throw new AppError(
      `Google Sheet fetch failed (${res.status}). Use a published or shared spreadsheet with a CSV export URL.`,
      400
    );
  }
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (
    contentType.includes("text/html") ||
    text.trimStart().toLowerCase().startsWith("<!DOCTYPE") ||
    text.trimStart().toLowerCase().startsWith("<html")
  ) {
    throw new AppError(
      "URL returned a web page, not CSV. Publish the sheet or use File → Share → Anyone with the link, then paste the /export?format=csv URL.",
      400
    );
  }
  const rows = parseAttendeeCsvText(text);
  return replaceEventAttendeesFromImport(eventId, rows);
}
