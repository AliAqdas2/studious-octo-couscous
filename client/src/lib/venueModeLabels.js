/**
 * User-facing venue mode labels (CRM-18).
 * DB enum stays house_venue | go_to_them.
 */

export const VENUE_MODE_OUR = 'house_venue';
export const VENUE_MODE_CLIENT = 'go_to_them';

/** @param {string | null | undefined} mode */
export function venueModeLabel(mode) {
  const m = String(mode || '').trim();
  if (m === VENUE_MODE_CLIENT || m === 'go_to_them') return 'Client Venue';
  if (m === VENUE_MODE_OUR || m === 'house_venue') return 'Our Venue';
  return '';
}

/** @param {Record<string, unknown> | null | undefined} event */
export function isClientVenue(event) {
  const m =
    event?.venue_mode ||
    event?.venueMode ||
    '';
  return String(m).trim() === VENUE_MODE_CLIENT;
}
