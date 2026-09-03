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
  .beo-section { margin: 0 0 12px 0; }
  .beo-section-title {
    padding: 7px 10px;
    background: #2A9B9F;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid #1F7A7D;
    break-after: avoid;
    page-break-after: avoid;
  }
  .beo-section-body {
    border: 1px solid #1a1a1a;
    border-top: none;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
  }
  .beo-sheet img { max-width: 100%; height: auto; }
  .beo-keep { break-inside: avoid; page-break-inside: avoid; }
  .beo-print-frame { width: 100%; border: none; border-collapse: collapse; }
  .beo-print-frame td { padding: 0; vertical-align: top; }
  .beo-print-pad { display: none; height: 0; overflow: hidden; }
  @page { size: letter; margin: 0.4in; }
  @media print {
    html, body { height: auto !important; max-width: none !important; }
    body { margin: 0; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .beo-sheet { border: none !important; max-width: none; padding: 0 !important; }
    .beo-sheet img { max-height: 4.2in; width: auto; object-fit: contain; }
    .beo-floor-map img { max-height: 4.2in; }
    .beo-print-pad { display: block; height: 0.45in; }
    .beo-print-inner { padding: 0 0.45in; }
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
  const framed = `<table class="beo-print-frame">
  <thead><tr><td><div class="beo-print-pad">&nbsp;</div></td></tr></thead>
  <tfoot><tr><td><div class="beo-print-pad">&nbsp;</div></td></tr></tfoot>
  <tbody><tr><td class="beo-print-inner">${beoHtml || ''}</td></tr></tbody>
</table>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>${BEO_PRINT_CSS}
  html, body { height: 100%; }
  body { max-width: 920px; margin: 0 auto; padding: 12px 8px; }
  body[contenteditable="true"]:focus { outline: none; }
</style></head><body${editableAttr}>${framed}</body></html>`;
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
