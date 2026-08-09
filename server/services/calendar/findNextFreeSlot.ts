import { getCalendarApi } from "../gmail/gmailClient.js";

/** Placeholder when no free slot is found in the search window. */
export const MEETING_TIME_PLACEHOLDER = "<Meeting Date And Time>";

/** Template token for sales-manager availability in email bodies. */
export const SALES_MANAGER_AVAILABILITY_TOKEN =
  "<<Sales Manager Availability>>";

const DEFAULT_MEETING_DURATION_MIN = 30;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const SLOT_GRANULARITY_MIN = 30;
const MAX_BUSINESS_DAYS_TO_SCAN = 14;
const TZ = "America/New_York";
const US_HOLIDAY_CALENDAR_ID = "en.usa#holiday@group.v.calendar.google.com";

interface BusyInterval {
  start: number;
  end: number;
}

function tzOffsetMinutes(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === "24" ? "00" : map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asIfUtc - utcDate.getTime()) / 60000;
}

function etWallClockToUtc(
  year: number,
  month1to12: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const approxUtc = Date.UTC(year, month1to12 - 1, day, hour, minute, 0);
  const offsetMin = tzOffsetMinutes(new Date(approxUtc), TZ);
  return new Date(approxUtc - offsetMin * 60000);
}

function etDayOfWeek(utcDate: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(utcDate);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function etDateParts(utcDate: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

/** Format a UTC instant as e.g. "Tuesday, June 3, 2026 at 2:30 PM EDT". */
export function formatSlotForHumans(utcDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(utcDate);
}

async function fetchPrimaryBusy(
  timeMinISO: string,
  timeMaxISO: string
): Promise<BusyInterval[]> {
  const calendar = await getCalendarApi();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: TZ,
      items: [{ id: "primary" }],
    },
  });

  const intervals: BusyInterval[] = [];
  for (const cal of Object.values(res.data.calendars || {})) {
    if (cal.errors?.length) {
      console.warn("[findNextFreeSlot] calendar errors:", cal.errors);
    }
    for (const b of cal.busy || []) {
      if (!b.start || !b.end) continue;
      intervals.push({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
      });
    }
  }
  return intervals;
}

async function fetchHolidayDates(
  timeMinISO: string,
  timeMaxISO: string
): Promise<Set<string>> {
  try {
    const calendar = await getCalendarApi();
    const res = await calendar.events.list({
      calendarId: US_HOLIDAY_CALENDAR_ID,
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      singleEvents: true,
      maxResults: 100,
      timeZone: TZ,
    });

    const dates = new Set<string>();
    for (const ev of res.data.items || []) {
      const startDate = ev.start?.date;
      const endDate = ev.end?.date;
      if (!startDate || !endDate) continue;
      let cur = new Date(`${startDate}T00:00:00Z`);
      const stop = new Date(`${endDate}T00:00:00Z`);
      while (cur.getTime() < stop.getTime()) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
        const d = String(cur.getUTCDate()).padStart(2, "0");
        dates.add(`${y}-${m}-${d}`);
        cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    return dates;
  } catch (err) {
    console.warn(
      "[findNextFreeSlot] US Holidays fetch failed:",
      err instanceof Error ? err.message : err
    );
    return new Set();
  }
}

function hasConflict(
  startMs: number,
  endMs: number,
  busy: BusyInterval[]
): boolean {
  for (const b of busy) {
    if (startMs < b.end && endMs > b.start) return true;
  }
  return false;
}

export interface NextFreeSlotResult {
  /** UTC start of the free slot, or null if none. */
  slotUtc: Date | null;
  /** Human-readable ET label, or MEETING_TIME_PLACEHOLDER. */
  formatted: string;
}

/**
 * Next free Mon–Fri 9–5 ET 30-min slot on the primary calendar,
 * skipping US holidays. Returns null slot + placeholder on failure / no room.
 */
export async function findNextFreeSlot(
  durationMin = DEFAULT_MEETING_DURATION_MIN
): Promise<NextFreeSlotResult> {
  try {
    const nowUtc = new Date();
    const todayET = etDateParts(nowUtc);
    let cursor = etWallClockToUtc(
      todayET.year,
      todayET.month,
      todayET.day,
      0,
      0
    );
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);

    const windowEnd = new Date(
      cursor.getTime() +
        Math.ceil(MAX_BUSINESS_DAYS_TO_SCAN * 1.6) * 24 * 60 * 60 * 1000
    );

    const [busy, holidayDates] = await Promise.all([
      fetchPrimaryBusy(cursor.toISOString(), windowEnd.toISOString()),
      fetchHolidayDates(cursor.toISOString(), windowEnd.toISOString()),
    ]);

    let businessDaysScanned = 0;
    for (
      let dayOffset = 0;
      dayOffset < 30 && businessDaysScanned < MAX_BUSINESS_DAYS_TO_SCAN;
      dayOffset++
    ) {
      const dayStart = new Date(
        cursor.getTime() + dayOffset * 24 * 60 * 60 * 1000
      );
      const dow = etDayOfWeek(dayStart);
      if (dow === 0 || dow === 6) continue;
      businessDaysScanned++;

      const { year, month, day } = etDateParts(dayStart);
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (holidayDates.has(dateKey)) continue;

      const lastStartMinutes = BUSINESS_END_HOUR * 60 - durationMin;
      for (
        let m = BUSINESS_START_HOUR * 60;
        m <= lastStartMinutes;
        m += SLOT_GRANULARITY_MIN
      ) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        const slotStartUtc = etWallClockToUtc(year, month, day, hour, minute);
        if (slotStartUtc.getTime() <= nowUtc.getTime()) continue;
        const slotEndMs = slotStartUtc.getTime() + durationMin * 60000;
        if (!hasConflict(slotStartUtc.getTime(), slotEndMs, busy)) {
          return {
            slotUtc: slotStartUtc,
            formatted: formatSlotForHumans(slotStartUtc),
          };
        }
      }
    }

    return { slotUtc: null, formatted: MEETING_TIME_PLACEHOLDER };
  } catch (err) {
    console.error(
      "[findNextFreeSlot] failed:",
      err instanceof Error ? err.message : err
    );
    return { slotUtc: null, formatted: MEETING_TIME_PLACEHOLDER };
  }
}

/** Replace <<Sales Manager Availability>> with a concrete time or placeholder. */
export function replaceSalesManagerAvailability(
  text: string,
  availabilityText: string
): string {
  if (!text) return "";
  return text.replace(
    /<<\s*Sales Manager Availability\s*>>/gi,
    availabilityText
  );
}
