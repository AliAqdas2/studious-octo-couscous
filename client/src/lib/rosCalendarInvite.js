/** Run of Show invite via Google Calendar TEMPLATE URL (browser Google account; no CRM OAuth). */

/** Default ROS call length (minutes). */
export const ROS_MEETING_DURATION_MINUTES = 45;

export const ROS_CALENDAR_SAVE_HINT =
  'Review the event in Google Calendar, then click Save to invite the planner.';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Format Date as UTC calendar datetime: YYYYMMDDTHHMMSSZ */
export function toCalendarUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

/** @deprecated Use toCalendarUtc — kept as alias for any older imports. */
export const toIcsUtc = toCalendarUtc;

/**
 * Build Google Calendar create-event TEMPLATE URL.
 * @param {{ title: string, start: Date, end: Date, details?: string, location?: string, guestEmail?: string }} opts
 */
export function buildGoogleCalendarTemplateUrl({
  title,
  start,
  end,
  details,
  location,
  guestEmail,
}) {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title || 'Run of Show');
  params.set('dates', `${toCalendarUtc(start)}/${toCalendarUtc(end)}`);
  if (details) params.set('details', details);
  if (location) params.set('location', location);
  if (guestEmail) params.set('add', guestEmail);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function openGoogleCalendarTemplate(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildRosInviteDetails({
  eventName,
  eventType,
  pocName,
  confirmLabel,
  venue,
}) {
  return [
    `Run of Show meeting for ${eventName} (${eventType}).`,
    pocName ? `Planner: ${pocName}` : null,
    '',
    'On the call we will confirm:',
    `- ${confirmLabel || 'Activity details'}`,
    '- Timing, headcount, and day-of contact',
    '- Bar, arrival, seating, add-ons, and transportation (as applicable)',
    venue ? `\nEvent venue: ${venue}` : null,
    '',
    'Mangia DC Ops',
  ]
    .filter((line) => line != null)
    .join('\n');
}

/**
 * Open Google Calendar with a prefilled ROS event + guest.
 * Staff must click Save; Google emails the guest.
 * @returns {{ title: string, start: Date, end: Date, url: string }}
 */
export function sendRosCalendarInvite({
  eventName,
  eventType,
  pocName,
  pocEmail,
  venue,
  meetingStart,
  confirmLabel,
  durationMinutes = ROS_MEETING_DURATION_MINUTES,
}) {
  const start =
    meetingStart instanceof Date ? meetingStart : new Date(meetingStart);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid meeting date/time');
  }
  if (!pocEmail) {
    throw new Error('Planner email is required');
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const title = `Run of Show — ${eventName} (${eventType})`;
  const details = buildRosInviteDetails({
    eventName,
    eventType,
    pocName,
    confirmLabel,
    venue,
  });

  const url = buildGoogleCalendarTemplateUrl({
    title,
    start,
    end,
    details,
    location: venue || undefined,
    guestEmail: pocEmail,
  });
  openGoogleCalendarTemplate(url);

  return { title, start, end, url };
}

/**
 * Convert ISO / Date to value for `<input type="datetime-local" />`.
 */
export function toDatetimeLocalValue(isoOrDate) {
  if (!isoOrDate) return '';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Parse datetime-local value to ISO string. */
export function fromDatetimeLocalValue(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
