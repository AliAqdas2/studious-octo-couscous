/** Default days before an event start when a source becomes "active". */
export const EVENT_LEAD_DAYS = 7;

/** Maps RECRUITMENT_TIMELINE `when` labels to calendar months (1–12). */
export const TIMELINE_WHEN_MONTHS = {
  July: [7],
  August: [8],
  "Sept–Oct": [9, 10],
  November: [11],
  Spring: [3, 4, 5],
};

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {Date} local midnight
 */
export function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {Date} now
 * @param {string} startDate ISO YYYY-MM-DD
 * @param {string} endDate ISO YYYY-MM-DD
 * @param {number} leadDays days before startDate when window opens
 */
export function isDateInEventWindow(now, startDate, endDate, leadDays = EVENT_LEAD_DAYS) {
  if (!startDate || !endDate) return false;
  const today = startOfDay(now);
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const windowStart = new Date(start);
  windowStart.setDate(windowStart.getDate() - leadDays);
  return today >= windowStart && today <= end;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * @param {number} month 1–12
 * @param {number[]} activeMonths
 */
export function isMonthActive(month, activeMonths) {
  if (!activeMonths?.length) return false;
  return activeMonths.includes(month);
}

/**
 * @param {Date} now
 * @param {string} when RECRUITMENT_TIMELINE when label
 */
export function isTimelineWhenActive(now, when) {
  const months = TIMELINE_WHEN_MONTHS[when];
  if (!months?.length) return false;
  return months.includes(now.getMonth() + 1);
}

/**
 * @param {import('./hireSourcesCatalog.js').HIRE_SOURCES_CATALOG[number]} source
 * @param {Date} [now]
 * @returns {{ score: number, reason: 'event' | 'timeline' | null, eventTitle?: string }}
 */
export function getSourceRelevanceScore(source, now = new Date()) {
  for (const ev of source.events || []) {
    if (
      ev.startDate &&
      ev.endDate &&
      isDateInEventWindow(now, ev.startDate, ev.endDate)
    ) {
      return { score: 100, reason: "event", eventTitle: ev.title };
    }
  }

  const month = now.getMonth() + 1;
  if (isMonthActive(month, source.activeMonths)) {
    return { score: 50, reason: "timeline" };
  }

  return { score: 0, reason: null };
}

/**
 * Stable sort: higher score first; ties keep original catalog order.
 *
 * @param {typeof import('./hireSourcesCatalog.js').HIRE_SOURCES_CATALOG} catalog
 * @param {Date} [now]
 * @returns {{
 *   sorted: Array<typeof catalog[number] & { _relevance: ReturnType<typeof getSourceRelevanceScore>, _originalIndex: number }>,
 *   activeLabels: string[],
 *   topActive: typeof catalog[number] | null,
 * }}
 */
export function sortHireSourcesCatalog(catalog, now = new Date()) {
  const withMeta = catalog.map((source, originalIndex) => ({
    ...source,
    _relevance: getSourceRelevanceScore(source, now),
    _originalIndex: originalIndex,
  }));

  withMeta.sort((a, b) => {
    if (b._relevance.score !== a._relevance.score) {
      return b._relevance.score - a._relevance.score;
    }
    return a._originalIndex - b._originalIndex;
  });

  const activeLabels = withMeta
    .filter((s) => s._relevance.score > 0)
    .map((s) => s.label);

  const topActive =
    withMeta.find((s) => s._relevance.score > 0) ?? null;

  return {
    sorted: withMeta,
    activeLabels,
    topActive,
  };
}
