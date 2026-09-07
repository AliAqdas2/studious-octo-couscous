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
  .beo-section { margin: 0 0 16px 0; }
  .beo-section-title {
    padding: 0 0 6px 0;
    background: none;
    color: #134f5c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: normal;
    text-transform: none;
    border: none;
    break-after: avoid;
    page-break-after: avoid;
  }
  .beo-section-body {
    border: none;
    padding: 0 0 2px 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .beo-grid { border-collapse: collapse; }
  .beo-sheet img { max-width: 100%; height: auto; }
  .beo-keep { break-inside: avoid; page-break-inside: avoid; }
  .beo-print-frame { width: 100%; border: none; border-collapse: collapse; }
  .beo-print-frame td { padding: 0; vertical-align: top; }
  .beo-print-pad { display: none; height: 0; overflow: hidden; }
  .beo-run-bar, .beo-first-page-mask { display: none; }
  @page {
    size: letter;
    margin: 0.4in 0.5in 0.6in 0.5in;
    @bottom-center {
      content: counter(page);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #444;
    }
  }
  @page :first {
    margin-top: 0.4in;
  }
  @media print {
    html, body { height: auto !important; max-width: none !important; }
    body { margin: 0; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .beo-sheet { border: none !important; max-width: none; padding: 0 !important; }
    .beo-sheet img { max-height: 4.2in; width: auto; object-fit: contain; }
    .beo-floor-map img { max-height: 4.2in; }
    .beo-print-pad { display: block; height: 0.15in; }
    td.beo-print-inner { padding: 0 0.5in !important; }
    td.beo-run-cell { padding: 0 0.5in !important; }
    .beo-run-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 2px 0 8px 0;
      border-bottom: 1px solid #134f5c;
      margin: 0 0 10px 0;
    }
    .beo-run-bar img {
      display: block;
      height: 36px;
      width: auto;
      max-height: 36px;
      max-width: 130px;
      object-fit: contain;
      image-rendering: auto;
    }
    .beo-run-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 700;
      color: #134f5c;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .beo-first-page-mask {
      display: block;
      height: 58px;
      margin-top: -58px;
      background: #fff;
      position: relative;
      z-index: 5;
    }
  }
`;

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Full HTML document for iframe srcDoc / download / print.
 * @param {string} beoHtml Inner BEO markup (typically .beo-sheet)
 * @param {{ title?: string, eventTitle?: string, logoSrc?: string, editable?: boolean }} [opts]
 */
export function wrapBeoDocument(beoHtml, opts = {}) {
  const title = opts.title || 'BEO';
  const eventTitle = opts.eventTitle || title;
  const logoSrc = opts.logoSrc || '/mangiadc-logo.png';
  const editableAttr = opts.editable ? ' contenteditable="true"' : '';
  const framed = `<table class="beo-print-frame">
  <thead><tr><td class="beo-run-cell">
    <div class="beo-run-bar">
      <img src="${escHtml(logoSrc)}" alt="Mangia DC" />
      <span class="beo-run-title">${escHtml(eventTitle)}</span>
    </div>
  </td></tr></thead>
  <tfoot><tr><td><div class="beo-print-pad">&nbsp;</div></td></tr></tfoot>
  <tbody><tr><td class="beo-print-inner"${editableAttr}>
    <div class="beo-first-page-mask" aria-hidden="true"></div>
    ${beoHtml || ''}
  </td></tr></tbody>
</table>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>${BEO_PRINT_CSS}
  html, body { height: 100%; }
  body { max-width: 920px; margin: 0 auto; padding: 12px 8px; }
  .beo-print-inner[contenteditable="true"]:focus { outline: none; }
</style></head><body>${framed}</body></html>`;
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
