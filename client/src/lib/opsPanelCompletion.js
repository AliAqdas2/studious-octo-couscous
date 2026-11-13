/**
 * Ops-panel “complete” checks — same signals Event Detail panels use.
 */

/** @typedef {import('./opsPanelTasks').OpsPanelId} OpsPanelId */

/**
 * @param {unknown} event
 * @returns {Record<string, unknown>}
 */
export function parseRos(event) {
  const e = event && typeof event === 'object' ? event : {};
  const raw = e.run_of_show ?? e.runOfShow;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  return {};
}

/**
 * @param {unknown} event
 * @returns {Record<string, unknown>}
 */
export function parsePostEvent(event) {
  const e = event && typeof event === 'object' ? event : {};
  const raw = e.post_event ?? e.postEvent;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  return {};
}

/**
 * @param {unknown} event
 */
export function hasDeposit(event) {
  const e = event && typeof event === 'object' ? event : {};
  return Boolean(
    e.deposit_received ||
      e.depositReceived ||
      e.deposit_received_at ||
      e.depositReceivedAt
  );
}

/**
 * @param {unknown} event
 */
export function depositComplete(event) {
  const e = event && typeof event === 'object' ? event : {};
  return Boolean(
    e.deposit_intake_completed_at || e.depositIntakeCompletedAt
  );
}

/**
 * Run of Show fully done: scheduled + meeting notes completed.
 * @param {unknown} event
 */
export function rosComplete(event) {
  const ros = parseRos(event);
  return Boolean(ros.scheduledAt) && Boolean(ros.completedAt || ros.completed);
}

/**
 * @param {unknown} event
 */
export function beoSaved(event) {
  const e = event && typeof event === 'object' ? event : {};
  return Boolean(
    e.beo_document_updated_at ||
      e.beoDocumentUpdatedAt ||
      e.beo_document_html ||
      e.beoDocumentHtml
  );
}

/** Ops day-of essentials: BEO Shell + FareHarbor embed. */
export function artifactsComplete(event) {
  const e = event && typeof event === 'object' ? event : {};
  const shell = String(e.beo_shell_url || e.beoShellUrl || '').trim();
  const fh = String(e.fareharbor_link || e.fareharborLink || '').trim();
  return Boolean(shell) && Boolean(fh);
}

/**
 * Site Visit (CRM-18): N/A complete for Our Venue; for Client Venue need date or notes.
 * @param {unknown} event
 */
export function siteVisitComplete(event) {
  const e = event && typeof event === 'object' ? event : {};
  const mode = String(e.venue_mode || e.venueMode || '').trim();
  if (mode !== 'go_to_them') return true;
  const date = e.site_visit_date || e.siteVisitDate;
  const notes = String(e.site_visit_notes || e.siteVisitNotes || '').trim();
  return Boolean(date) || Boolean(notes);
}

/**
 * Inventory panel: checklist has at least one row.
 * @param {{ hasInventory?: boolean }} [opts]
 */
export function inventoryComplete(opts = {}) {
  return Boolean(opts.hasInventory);
}

/**
 * @param {{ stopCount?: number }} [opts]
 */
export function foodTourStopsComplete(opts = {}) {
  return (opts.stopCount ?? 0) > 0;
}

/**
 * Instructor assigned + at least one guest on the list.
 * @param {unknown} event
 * @param {{ attendeeCount?: number }} [opts]
 */
export function attendeesComplete(event, opts = {}) {
  const e = event && typeof event === 'object' ? event : {};
  const instructorId = e.instructor_id || e.instructorId;
  return Boolean(instructorId) && (opts.attendeeCount ?? 0) > 0;
}

/**
 * Post-event: staff hours and/or photos captured (outreach emails are Client Comm).
 * @param {unknown} event
 */
export function postEventComplete(event) {
  const e = event && typeof event === 'object' ? event : {};
  const pe = parsePostEvent(event);
  const hours = String(
    e.staff_hours_notes || e.staffHoursNotes || ''
  ).trim();
  const photos = Boolean(
    e.photos_uploaded ||
      e.photosUploaded ||
      pe.photosUploaded ||
      pe.photos_uploaded
  );
  return Boolean(hours) || photos;
}

/**
 * @typedef {{
 *   hasInventory?: boolean,
 *   attendeeCount?: number,
 *   stopCount?: number,
 * }} OpsPanelSideFlags
 */

/**
 * @param {OpsPanelId} panelId
 * @param {unknown} event
 * @param {OpsPanelSideFlags} [opts]
 */
export function isOpsPanelComplete(panelId, event, opts = {}) {
  switch (panelId) {
    case 'deposit':
      return depositComplete(event);
    case 'ros':
      return rosComplete(event);
    case 'inventory':
      return inventoryComplete(opts);
    case 'beo':
      return beoSaved(event);
    case 'artifacts':
      return artifactsComplete(event);
    case 'site_visit':
      return siteVisitComplete(event);
    case 'food_tour_stops':
      return foodTourStopsComplete(opts);
    case 'attendees':
      return attendeesComplete(event, opts);
    case 'post_event':
      return postEventComplete(event);
    default:
      return false;
  }
}
