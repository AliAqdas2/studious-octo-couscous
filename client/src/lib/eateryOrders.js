/**
 * Food tour order-line helpers shared by the event stops panel and the BEO.
 *
 * `perGuests` is how many guests a single order serves, so an order line for
 * "1 order for every 2 people" is `perGuests: 2`. A null `perGuests` marks an
 * instruction line that carries no quantity.
 */

export const TIME_LABELS = ['Reservation Time', 'Arrival Time'];
export const ORDER_MODES = ['PRE-ORDERED', 'ORDERING AT'];

export function normalizeOrderLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l) => l && typeof l === 'object')
    .map((l) => ({
      label: String(l.label || '').trim(),
      perGuests:
        l.perGuests == null || l.perGuests === ''
          ? null
          : Number(l.perGuests) || null,
      note: l.note ? String(l.note).trim() : null,
    }))
    .filter((l) => l.label);
}

/** Orders needed for a line at this guest count, or null for instructions. */
export function orderLineQuantity(line, guestCount) {
  const per = Number(line?.perGuests);
  const guests = Number(guestCount);
  if (!per || per <= 0 || !guests || guests <= 0) return null;
  return Math.ceil(guests / per);
}

/** Human-readable order line, e.g. "6 Fire Cracker Shrimp (1 per 2 guests)". */
export function formatOrderLine(line, guestCount) {
  const qty = orderLineQuantity(line, guestCount);
  const parts = [];
  if (qty != null) parts.push(String(qty));
  parts.push(line?.label || '');
  let text = parts.join(' ').trim();

  const detail = [];
  const per = Number(line?.perGuests);
  if (per === 1) detail.push('1 per guest');
  else if (per > 1) detail.push(`1 for every ${per} guests`);
  if (line?.note) detail.push(line.note);
  if (detail.length) text += ` (${detail.join('; ')})`;

  return text;
}

/** Short ratio label for editors and summaries. */
export function perGuestsLabel(perGuests) {
  const per = Number(perGuests);
  if (!per || per <= 0) return 'No quantity';
  if (per === 1) return '1 per guest';
  return `1 per ${per} guests`;
}
