/**
 * Mangia-branded Banquet Event Order HTML (print-ready).
 * Dispatches to cooking/class vs food-tour layouts.
 */
import { buildEventBeoHtml } from './beo/eventBeo.js';
import { buildFoodTourBeoHtml } from './beo/foodTourBeo.js';
import { isFoodTourExperience } from './foodTourExperiences.js';

/**
 * @param {{
 *   event?: Record<string, unknown>,
 *   runOfShow?: Record<string, unknown>,
 *   rosConfirmLabel?: string,
 *   logoSrc?: string,
 *   isFoodTour?: boolean,
 *   venue?: Record<string, unknown> | null,
 *   venueImages?: unknown[],
 *   instructor?: { name?: string, bio?: string } | null,
 *   inventory?: unknown[],
 *   eateryStops?: unknown[],
 *   attendees?: unknown[],
 * }} input
 * @returns {string} HTML
 */
export function buildBeoHtml(input) {
  const event = input?.event || {};
  const type = event.event_type || event.eventType || '';
  const foodTour =
    input?.isFoodTour === true || isFoodTourExperience(type);
  return foodTour ? buildFoodTourBeoHtml(input) : buildEventBeoHtml(input);
}

/**
 * Shared CSS for editor preview + download/print wrappers.
 */
export const BEO_PRINT_CSS = `
  body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
  .beo-sheet { box-sizing: border-box; }
  .beo-sheet table { page-break-inside: avoid; }
  .beo-sheet img { max-width: 100%; height: auto; }
  @media print {
    body { margin: 0; }
    .beo-sheet { border: none !important; max-width: none; padding: 0; }
  }
`;

/**
 * Full HTML document for iframe srcDoc / download / print.
 * @param {string} beoHtml Inner BEO markup (typically .beo-sheet)
 * @param {{ title?: string, editable?: boolean }} [opts]
 */
export function wrapBeoDocument(beoHtml, opts = {}) {
  const title = opts.title || 'BEO';
  const editableAttr = opts.editable ? ' contenteditable="true"' : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>${BEO_PRINT_CSS}
  html, body { height: 100%; }
  body { max-width: 920px; margin: 0 auto; padding: 12px 8px; }
  body[contenteditable="true"]:focus { outline: none; }
</style></head><body${editableAttr}>${beoHtml || ''}</body></html>`;
}

/**
 * Strip HTML to a short plain-text preview for summary cards.
 */
export function beoHtmlPreview(html, maxLen = 160) {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
