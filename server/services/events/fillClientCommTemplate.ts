/**
 * Replace <<placeholders>> in client-comm templates with event / lead data.
 */

export type ClientCommFillSource = {
  eventName?: string | null;
  eventType?: string | null;
  eventDate?: Date | string | null;
  startTime?: string | null;
  venue?: string | null;
  venueAddress?: string | null;
  pocName?: string | null;
  pocEmail?: string | null;
  pocPhone?: string | null;
  depositPaymentUrl?: string | null;
  company?: string | null;
};

function asDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBefore(eventDate: Date, days: number): Date {
  const d = new Date(eventDate);
  d.setDate(d.getDate() - days);
  return d;
}

function weekdayName(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Build a map of placeholder tokens (without << >>) → replacement.
 */
export function buildClientCommReplacements(
  src: ClientCommFillSource
): Record<string, string> {
  const eventDate = asDate(src.eventDate);
  const name = String(src.pocName || "").trim();
  const company = String(src.company || "").trim();
  const eventName = String(src.eventName || "").trim();
  const eventType = String(src.eventType || "").trim();
  const depositLink = String(src.depositPaymentUrl || "").trim();
  const pocPhone = String(src.pocPhone || "").trim();
  const startTime = String(src.startTime || "").trim();
  const venue = String(src.venueAddress || src.venue || "").trim();

  const map: Record<string, string> = {
    name: name || "<<name>>",
    "insert Client name": name || "<<insert Client name>>",
    POC: name || "<<POC>>",
    "event name": eventName || "<<event name>>",
    event: eventType || eventName || "<<event>>",
    "company name": company || eventName || "<<company name>>",
    "deposit Link": depositLink || "<<deposit Link>>",
    "deposit link": depositLink || "<<deposit link>>",
    "POC Number": pocPhone || "<<POC Number>>",
    "POC number": pocPhone || "<<POC number>>",
    time: startTime || "<<time>>",
    date: eventDate ? formatShortDate(eventDate) : "<<date>>",
    "event date": eventDate ? formatLongDate(eventDate) : "<<event date>>",
    "day of event": eventDate
      ? weekdayName(eventDate)
      : "<<day of event>>",
  };

  if (eventDate) {
    map["14th day before the event"] = formatLongDate(
      daysBefore(eventDate, 14)
    );
    map["13th day before the event"] = formatLongDate(
      daysBefore(eventDate, 13)
    );
    map["13th day bvefore the event"] = formatLongDate(
      daysBefore(eventDate, 13)
    );
    map["12th day before the event"] = formatLongDate(
      daysBefore(eventDate, 12)
    );
    map["12th day bvefore the event"] = formatLongDate(
      daysBefore(eventDate, 12)
    );
  }

  // Non-<< >> literals used in some scripts
  map["__INSERT_EVENT_DATE__"] = eventDate
    ? formatLongDate(eventDate)
    : "Insert Event Date";
  map["__STARTING_LOCATION__"] = venue || "(INSERT STARTING LOCATION)";
  map["__REMAINING_BALANCE_LINK__"] = depositLink
    ? depositLink
    : "(Remaining Balance Link:)";

  return map;
}

/**
 * Replace <<token>> occurrences; also a few literal CRM script markers.
 */
export function fillClientCommTemplate(
  template: string,
  src: ClientCommFillSource
): string {
  if (!template) return "";
  const map = buildClientCommReplacements(src);
  let out = String(template);

  out = out.replace(/<<([^>]+)>>/g, (full, key: string) => {
    const k = String(key).trim();
    if (Object.prototype.hasOwnProperty.call(map, k)) {
      return map[k];
    }
    // case-insensitive fallback
    const found = Object.keys(map).find(
      (m) => m.toLowerCase() === k.toLowerCase()
    );
    return found ? map[found] : full;
  });

  out = out.replace(/Insert Event Date/g, map["__INSERT_EVENT_DATE__"]);
  out = out.replace(
    /\(INSERT STARTING LOCATION\)/gi,
    map["__STARTING_LOCATION__"]
  );
  out = out.replace(
    /\(Remaining Balance Link:\)/gi,
    map["__REMAINING_BALANCE_LINK__"]
  );

  return out;
}

export function fillClientCommSubjectAndBody(
  subject: string | null | undefined,
  body: string | null | undefined,
  src: ClientCommFillSource
): { subject: string; body: string; to: string } {
  return {
    subject: fillClientCommTemplate(subject || "", src).trim() || "(No subject)",
    body: fillClientCommTemplate(body || "", src),
    to: String(src.pocEmail || "").trim(),
  };
}
