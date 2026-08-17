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
const MAX_BUSINESS_DAYS_FOR_AVAILABILITY = 3;
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

export interface MeetingWindow {
  dayLabel: string;
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
}

export interface FreeMeetingWindowsResult {
  windows: MeetingWindow[];
  prose: string;
  firstSlotUtc: Date | null;
  calendarOk: boolean;
}

function formatEtTime(utcDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
}

function etWeekdayName(utcDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
  }).format(utcDate);
}

function etDateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addEtCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

interface SlotCandidate {
  startUtc: Date;
  dateKey: string;
}

function groupSlotsIntoWindows(
  slots: SlotCandidate[],
  durationMin: number
): { dateKey: string; startUtc: Date; endUtc: Date }[] {
  if (slots.length === 0) return [];

  const byDay = new Map<string, Date[]>();
  for (const slot of slots) {
    const list = byDay.get(slot.dateKey) || [];
    list.push(slot.startUtc);
    byDay.set(slot.dateKey, list);
  }

  const allWindows: { dateKey: string; startUtc: Date; endUtc: Date }[] = [];

  for (const [dateKey, starts] of byDay) {
    starts.sort((a, b) => a.getTime() - b.getTime());
    let windowStart = starts[0]!;
    let windowEndMs = starts[0]!.getTime() + durationMin * 60000;

    for (let i = 1; i < starts.length; i++) {
      const slotStart = starts[i]!;
      const expectedNext =
        starts[i - 1]!.getTime() + SLOT_GRANULARITY_MIN * 60000;
      if (slotStart.getTime() === expectedNext) {
        windowEndMs = slotStart.getTime() + durationMin * 60000;
      } else {
        allWindows.push({
          dateKey,
          startUtc: windowStart,
          endUtc: new Date(windowEndMs),
        });
        windowStart = slotStart;
        windowEndMs = slotStart.getTime() + durationMin * 60000;
      }
    }
    allWindows.push({
      dateKey,
      startUtc: windowStart,
      endUtc: new Date(windowEndMs),
    });
  }

  allWindows.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return allWindows;
}

function formatDayAvailabilityPhrase(
  dayLabel: string,
  dayWindows: { startUtc: Date; endUtc: Date }[]
): string {
  if (dayWindows.length === 0) return "";
  if (dayWindows.length === 1) {
    const w = dayWindows[0]!;
    if (dayLabel === "later today") {
      return `later today between ${formatEtTime(w.startUtc)} and ${formatEtTime(w.endUtc)} ET`;
    }
    return `${dayLabel} from ${formatEtTime(w.startUtc)} to ${formatEtTime(w.endUtc)} ET`;
  }
  const ranges = dayWindows
    .map(
      (w) => `${formatEtTime(w.startUtc)} to ${formatEtTime(w.endUtc)}`
    )
    .join(" or ");
  if (dayLabel === "later today") {
    return `later today from ${ranges} ET`;
  }
  return `${dayLabel} from ${ranges} ET`;
}

function buildAvailabilityProse(
  grouped: { dateKey: string; startUtc: Date; endUtc: Date }[],
  todayKey: string,
  tomorrowKey: string
): { prose: string; windows: MeetingWindow[] } {
  const byDate = new Map<string, { startUtc: Date; endUtc: Date }[]>();
  for (const w of grouped) {
    const list = byDate.get(w.dateKey) || [];
    list.push({ startUtc: w.startUtc, endUtc: w.endUtc });
    byDate.set(w.dateKey, list);
  }

  const orderedDateKeys = [...new Set(grouped.map((g) => g.dateKey))];
  const meetingWindows: MeetingWindow[] = [];
  const dayPhrases: string[] = [];

  for (const dateKey of orderedDateKeys) {
    const dayWindows = byDate.get(dateKey) || [];
    const weekday = etWeekdayName(dayWindows[0]!.startUtc);
    let dayLabel: string;
    if (dateKey === todayKey) dayLabel = "later today";
    else if (dateKey === tomorrowKey) dayLabel = "tomorrow";
    else dayLabel = weekday;

    for (const w of dayWindows) {
      meetingWindows.push({
        dayLabel,
        dateKey,
        startUtc: w.startUtc,
        endUtc: w.endUtc,
      });
    }

    dayPhrases.push(
      formatDayAvailabilityPhrase(dayLabel, dayWindows)
    );
  }

  if (dayPhrases.length === 0) return { prose: "", windows: [] };
  if (dayPhrases.length === 1) return { prose: dayPhrases[0]!, windows: meetingWindows };

  const last = dayPhrases.pop()!;
  return {
    prose: `${dayPhrases.join(", ")}, or ${last}`,
    windows: meetingWindows,
  };
}

/**
 * Find free meeting windows Mon–Fri 9–5 ET from Google Calendar (includes today).
 * Returns prose for up to 3 business days; no static fallback text.
 */
export async function findFreeMeetingWindows(
  durationMin = DEFAULT_MEETING_DURATION_MIN
): Promise<FreeMeetingWindowsResult> {
  try {
    const nowUtc = new Date();
    const todayET = etDateParts(nowUtc);
    const cursor = etWallClockToUtc(
      todayET.year,
      todayET.month,
      todayET.day,
      0,
      0
    );
    const todayKey = etDateKeyFromParts(
      todayET.year,
      todayET.month,
      todayET.day
    );
    const tomorrowParts = addEtCalendarDays(
      todayET.year,
      todayET.month,
      todayET.day,
      1
    );
    const tomorrowKey = etDateKeyFromParts(
      tomorrowParts.year,
      tomorrowParts.month,
      tomorrowParts.day
    );

    const windowEnd = new Date(
      cursor.getTime() +
        Math.ceil(MAX_BUSINESS_DAYS_FOR_AVAILABILITY * 2) * 24 * 60 * 60 * 1000
    );

    const [busy, holidayDates] = await Promise.all([
      fetchPrimaryBusy(cursor.toISOString(), windowEnd.toISOString()),
      fetchHolidayDates(cursor.toISOString(), windowEnd.toISOString()),
    ]);

    const freeSlots: SlotCandidate[] = [];
    let businessDaysScanned = 0;

    for (
      let dayOffset = 0;
      dayOffset < 14 && businessDaysScanned < MAX_BUSINESS_DAYS_FOR_AVAILABILITY;
      dayOffset++
    ) {
      const dayStart = new Date(
        cursor.getTime() + dayOffset * 24 * 60 * 60 * 1000
      );
      const dow = etDayOfWeek(dayStart);
      if (dow === 0 || dow === 6) continue;
      businessDaysScanned++;

      const { year, month, day } = etDateParts(dayStart);
      const dateKey = etDateKeyFromParts(year, month, day);
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
          freeSlots.push({ startUtc: slotStartUtc, dateKey });
        }
      }
    }

    freeSlots.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
    const grouped = groupSlotsIntoWindows(freeSlots, durationMin);
    const { prose, windows } = buildAvailabilityProse(
      grouped,
      todayKey,
      tomorrowKey
    );

    return {
      windows,
      prose,
      firstSlotUtc: freeSlots[0]?.startUtc ?? null,
      calendarOk: true,
    };
  } catch (err) {
    console.error(
      "[findFreeMeetingWindows] failed:",
      err instanceof Error ? err.message : err
    );
    return {
      windows: [],
      prose: "",
      firstSlotUtc: null,
      calendarOk: false,
    };
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
