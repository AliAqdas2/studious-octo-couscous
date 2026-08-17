export const EASTERN_TZ = "America/New_York";

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

const WEEKDAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Interpret naive ISO as America/New_York wall time → UTC Date. */
export function easternWallTimeToUtc(isoLike: string): Date | null {
  const m = isoLike.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!m) {
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(isoLike.trim())) {
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  const s = Number(m[6] ?? 0);
  const targetAsUtc = Date.UTC(y, mo, day, h, mi, s);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let utcMs = targetAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value || "0";
    const hourRaw = Number(get("hour"));
    const asUtc = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      hourRaw === 24 ? 0 : hourRaw,
      Number(get("minute")),
      Number(get("second"))
    );
    utcMs += targetAsUtc - asUtc;
  }
  return new Date(utcMs);
}

export function etDateParts(utcDate: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
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

/** 0 = Sunday … 6 = Saturday in Eastern time. */
export function easternWeekday(utcDate: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
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

export function easternWeekdayName(utcDate: Date): WeekdayName {
  return WEEKDAY_NAMES[easternWeekday(utcDate)]!;
}

export function weekdayNameToNumber(name: string): number | null {
  const key = name.trim().toLowerCase();
  return WEEKDAY_NAME_TO_NUM[key] ?? null;
}

/** Parse weekday name from free text (first match). */
export function parseWeekdayFromText(text: string): number | null {
  const re =
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i;
  const m = text.match(re);
  if (!m) return null;
  return weekdayNameToNumber(m[1]!);
}

export function parseIsoDateParts(iso: string): {
  year: number;
  month: number;
  day: number;
  timeSuffix: string;
} | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    timeSuffix: m[4] || "T00:00:00",
  };
}

/** Date-only ISO → noon Eastern to avoid UTC midnight day shift. */
export function parseDateOnlyEt(isoDate: string): Date | null {
  const trimmed = isoDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return easternWallTimeToUtc(`${trimmed}T12:00:00`);
  }
  return easternWallTimeToUtc(trimmed);
}

/** Parse LLM/contact-form preferred_date with Eastern semantics. */
export function parsePreferredDateFromLlm(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateOnlyEt(trimmed);
  }
  return easternWallTimeToUtc(trimmed);
}

/** Parse naive ISO as Eastern wall time; pass through Z/offset strings. */
export function parseEasternIsoDate(
  value: string | null | undefined
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateOnlyEt(trimmed);
  }
  const parsed = easternWallTimeToUtc(trimmed);
  if (parsed) return parsed;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function correctEasternPreferredDate(iso: string): Date | null {
  const now = new Date();
  let fixed = easternWallTimeToUtc(iso);
  if (!fixed) return null;

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  if (fixed < oneYearAgo) {
    const parts = etDateParts(fixed);
    let targetYear = now.getFullYear();
    const trial = easternWallTimeToUtc(
      `${targetYear}-${pad2(parts.month)}-${pad2(parts.day)}${iso.includes("T") ? iso.slice(iso.indexOf("T")) : "T00:00:00"}`
    );
    if (trial && trial < now) targetYear += 1;
    const timeSuffix = iso.includes("T") ? iso.slice(iso.indexOf("T")) : "T00:00:00";
    fixed =
      easternWallTimeToUtc(
        `${targetYear}-${pad2(parts.month)}-${pad2(parts.day)}${timeSuffix}`
      ) || fixed;
  }
  return fixed;
}

/** Shift ISO calendar date so its Eastern weekday matches expected (0–6). */
export function shiftIsoToWeekday(
  iso: string,
  expectedWeekday: number
): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return iso;

  const noonIso = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T12:00:00`;
  const atNoon = easternWallTimeToUtc(noonIso);
  if (!atNoon) return iso;

  const actual = easternWeekday(atNoon);
  let delta = expectedWeekday - actual;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  if (delta === 0) return iso;

  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + delta)
  );
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}${parts.timeSuffix}`;
}

/** Next occurrence of targetWeekday (0–6) on or after anchor date in Eastern time. */
export function nextWeekdayOnOrAfterEt(
  anchorUtc: Date,
  targetWeekday: number
): { year: number; month: number; day: number } {
  const anchor = etDateParts(anchorUtc);
  const noonAnchor = easternWallTimeToUtc(
    `${anchor.year}-${pad2(anchor.month)}-${pad2(anchor.day)}T12:00:00`
  );
  const anchorWd = noonAnchor ? easternWeekday(noonAnchor) : easternWeekday(anchorUtc);
  let delta = targetWeekday - anchorWd;
  if (delta < 0) delta += 7;
  const shifted = new Date(
    Date.UTC(anchor.year, anchor.month - 1, anchor.day + delta)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Replace calendar day in meeting ISO with the next targetWeekday on/after call date.
 * Preserves time portion from meetingIso.
 */
export function anchorMeetingIsoToCallWeekday(
  meetingIso: string,
  callAnchorDate: Date,
  targetWeekday: number
): string {
  const parts = parseIsoDateParts(meetingIso);
  if (!parts) return meetingIso;
  const next = nextWeekdayOnOrAfterEt(callAnchorDate, targetWeekday);
  return `${next.year}-${pad2(next.month)}-${pad2(next.day)}${parts.timeSuffix}`;
}
