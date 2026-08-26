/**
 * Mangia-branded Banquet Event Order HTML (print-ready).
 * Prefills from deposit + ROS; empty cells stay editable blank lines.
 */

const TEAL = '#2A9B9F';
const TEAL_DARK = '#1F7A7D';
const BORDER = '#1a1a1a';
const STRIPE = '#f3f7f7';

/** Same labels as ROS multimedia permissions (stored as snake_case codes). */
const MEDIA_PERMISSION_LABELS = {
  marketing_ok: 'OK for client + marketing use',
  internal_only: 'OK internal only, not marketing',
  no_photos: 'No photos',
};

function mediaPermissionLabel(value) {
  if (!value) return '';
  const key = String(value);
  return MEDIA_PERMISSION_LABELS[key] || key.replace(/_/g, ' ');
}

function esc(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function yn(v) {
  return v ? 'Yes' : 'No';
}

function asRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function cell(label, value, opts = {}) {
  const v =
    value == null || value === ''
      ? opts.blank
        ? '&nbsp;'
        : '—'
      : esc(value);
  const bg = opts.stripe ? `background:${STRIPE};` : '';
  return `<tr>
    <td style="width:34%;padding:6px 8px;border:1px solid ${BORDER};font-size:11px;font-weight:700;color:#333;${bg}">${esc(label)}</td>
    <td style="padding:6px 8px;border:1px solid ${BORDER};font-size:12px;${bg}">${v}</td>
  </tr>`;
}

function sectionBar(title) {
  return `<tr>
    <td colspan="2" style="padding:7px 10px;background:${TEAL};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid ${TEAL_DARK};">
      ${esc(title)}
    </td>
  </tr>`;
}

function sectionTable(title, rowsHtml) {
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
    ${sectionBar(title)}
    ${rowsHtml}
  </table>`;
}

function listBlock(items) {
  if (!items.length) {
    return `<p style="margin:0;padding:8px;min-height:36px;font-size:12px;color:#666;">&nbsp;</p>`;
  }
  return `<ul style="margin:6px 0 6px 18px;padding:0;font-size:12px;line-height:1.45;">
    ${items.map((i) => `<li>${esc(i)}</li>`).join('')}
  </ul>`;
}

function foodLines(food) {
  const f = asRecord(food);
  const labels = {
    charcuterie: 'Charcuterie',
    additionalProtein: 'Additional protein',
    mysteryIngredients: 'Mystery ingredients',
    alternativeSauces: 'Alternative sauces',
    flavorsOfDcWarmMeal: 'FoDC / warm meal',
  };
  const out = [];
  for (const [key, label] of Object.entries(labels)) {
    const row = asRecord(f[key]);
    if (!row.enabled) continue;
    const bits = [label];
    if (row.amount != null && row.amount !== '') bits.push(`×${row.amount}`);
    if (row.style) bits.push(`(${row.style})`);
    out.push(bits.join(' '));
  }
  return out;
}

function addonLines(addons) {
  const a = asRecord(addons);
  const labels = {
    embroideredAprons: 'Embroidered aprons',
    engravedGlassware: 'Engraved glassware',
    cheeseboard: 'Cheeseboard',
    chocolateMold: 'Chocolate mold',
    chefHats: 'Chef hats',
    berets: 'Berets',
  };
  const out = [];
  for (const [key, label] of Object.entries(labels)) {
    const row = asRecord(a[key]);
    if (!row.enabled && !row.progress) continue;
    const bits = [label];
    if (row.amount != null && row.amount !== '') bits.push(`×${row.amount}`);
    if (row.customName) bits.push('(custom name)');
    if (row.logoOrdered || row.logoSentToEmbroiderist) bits.push('(logo)');
    if (row.embroidered) bits.push('(embroidered)');
    out.push(bits.join(' '));
  }
  return out;
}

/**
 * @param {{ event?: Record<string, unknown>, runOfShow?: Record<string, unknown>, rosConfirmLabel?: string, logoSrc?: string }} input
 * @returns {string} HTML
 */
export function buildBeoHtml(input) {
  const event = asRecord(input?.event);
  const ros = asRecord(input?.runOfShow);
  const logoSrc = input?.logoSrc || '/mangiadc-logo.png';
  const isCooking =
    event.event_type === 'In-Person Cooking' ||
    event.eventType === 'In-Person Cooking';

  const name = event.event_name || event.eventName || '';
  const type = event.event_type || event.eventType || '';
  const venue = event.venue || '';
  const venueMode = event.venue_mode || event.venueMode;
  const venueLabel = venue
    ? venueMode
      ? `${venue} (${venueMode})`
      : venue
    : '';
  const venueRestrictions =
    event.venue_restrictions || event.venueRestrictions || '';
  const eventDateRaw = event.event_date || event.eventDate;
  const startTimeRaw = event.start_time || event.startTime || '';
  const eventDate =
    ros.timeChanged && ros.newEventDate
      ? ros.newEventDate
      : eventDateRaw;
  const startTime =
    ros.timeChanged && ros.newStartTime
      ? String(ros.newStartTime).trim()
      : startTimeRaw;
  const timeChangeBits = [];
  if (ros.newEventDate) timeChangeBits.push(formatDate(ros.newEventDate));
  if (ros.newStartTime) timeChangeBits.push(String(ros.newStartTime).trim());
  const timeChangeLabel = ros.timeChanged
    ? timeChangeBits.length
      ? `Yes → ${timeChangeBits.join(' · ')}`
      : 'Yes'
    : ros.timeChanged === false
      ? 'No'
      : '';
  const hcMin = event.headcount_min ?? event.headcountMin;
  const hcMax = event.headcount_max ?? event.headcountMax;
  const headcount =
    ros.headcountConfirmed != null
      ? String(ros.headcountConfirmed)
      : hcMin != null || hcMax != null
        ? `${hcMin ?? '?'}–${hcMax ?? '?'}`
        : event.headcount != null
          ? String(event.headcount)
          : '';

  const pocName = event.poc_name || event.pocName || '';
  const pocEmail = event.poc_email || event.pocEmail || '';
  const pocPhone = event.poc_phone || event.pocPhone || '';

  const dayOf =
    asRecord(ros.dayOfPoc).name ||
    event.day_of_poc_name ||
    event.dayOfPocName ||
    '';
  const dayOfEmail =
    asRecord(ros.dayOfPoc).email ||
    event.day_of_poc_email ||
    event.dayOfPocEmail ||
    '';
  const dayOfPhone =
    asRecord(ros.dayOfPoc).phone ||
    event.day_of_poc_phone ||
    event.dayOfPocPhone ||
    '';

  const alcohol = Boolean(event.alcohol_included ?? event.alcoholIncluded);
  const bar = asRecord(event.bar_details || event.barDetails);
  const rosBar = asRecord(ros.bar);
  const transportNeeded = Boolean(
    asRecord(ros.transport).needed ??
      event.transportation_needed ??
      event.transportationNeeded
  );
  const transportCompany =
    asRecord(ros.transport).company ||
    asRecord(event.transportation_details || event.transportationDetails)
      .company ||
    '';

  const food = foodLines(event.food_additions || event.foodAdditions);
  const addons = addonLines(event.custom_addons || event.customAddons);
  const menu = asRecord(ros.menu);
  const activity = asRecord(ros.activityConfirm);
  const confirmLabel = input?.rosConfirmLabel || 'Menu / activity';
  const media = mediaPermissionLabel(
    ros.mediaPermission ||
      event.media_permission ||
      event.mediaPermission ||
      ''
  );
  const special =
    event.special_requests || event.specialRequests || '';
  const dietary =
    event.dietary_restrictions || event.dietaryRestrictions || '';

  const printDate = formatDate(new Date().toISOString());

  let menuRows = '';
  if (isCooking) {
    menuRows =
      cell('App', menu.app, { stripe: true }) +
      cell('Entree', menu.entree) +
      cell('Dessert', menu.dessert, { stripe: true }) +
      cell('Confirmed', menu.confirmed != null ? yn(menu.confirmed) : '');
  } else {
    menuRows =
      cell(confirmLabel, activity.notes || '', { stripe: true }) +
      cell('Confirmed', activity.confirmed != null ? yn(activity.confirmed) : '');
  }

  const barRows =
    cell('Alcohol included', yn(alcohol), { stripe: true }) +
    cell(
      'Handling (ROS)',
      rosBar.handling != null ? yn(rosBar.handling) : ''
    ) +
    cell(
      'Consumption tracking',
      rosBar.consumption != null ? yn(rosBar.consumption) : '',
      { stripe: true }
    ) +
    cell(
      'Wine / beer / notes',
      rosBar.wineOrBeer || bar.paymentMode || bar.mixedDrinks || ''
    );

  const logisticsRows =
    cell('Arrival', ros.arrivalMethod || '', { stripe: true }) +
    cell(
      'Time change',
      timeChangeLabel
    ) +
    cell(
      'Transport',
      transportNeeded
        ? `Yes${transportCompany ? ` — ${transportCompany}` : ''}`
        : transportNeeded === false
          ? 'No'
          : '',
      { stripe: true }
    ) +
    cell(
      'Seating',
      ros.seatingCurated || event.seatingCurated
        ? `Curated${ros.seatingStyle || event.seatingStyle ? ` — ${ros.seatingStyle || event.seatingStyle}` : ''}`
        : ''
    ) +
    cell('Multimedia', media, { stripe: true }) +
    cell('Venue restrictions', venueRestrictions);

  const leftCol = `
    ${sectionTable(confirmLabel.toUpperCase(), menuRows)}
    <table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
      ${sectionBar('Food additions')}
      <tr><td style="border:1px solid ${BORDER};padding:4px 0;">${listBlock(food)}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
      ${sectionBar('Custom add-ons')}
      <tr><td style="border:1px solid ${BORDER};padding:4px 0;">${listBlock(addons)}</td></tr>
    </table>
  `;

  const notesBody = [ros.notes, special, dietary]
    .filter(Boolean)
    .map((t) => esc(t))
    .join('<br/><br/>');

  const rightCol = `
    ${sectionTable('Beverage / bar', barRows)}
    <table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
      ${sectionBar('Setup & notes')}
      <tr><td style="border:1px solid ${BORDER};padding:8px;min-height:72px;font-size:12px;vertical-align:top;">
        ${notesBody || '&nbsp;'}
      </td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
      ${sectionBar('Staffing notes')}
      <tr><td style="border:1px solid ${BORDER};padding:8px;font-size:12px;line-height:1.7;">
        Host / Instructor: ____________________________<br/>
        Ops / Support: ________________________________<br/>
        Other: ________________________________________
      </td></tr>
    </table>
  `;

  return `
<div class="beo-sheet" style="max-width:900px;margin:0 auto;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;border:2px solid ${BORDER};box-sizing:border-box;">
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <td style="width:140px;vertical-align:middle;padding:0 12px 0 0;">
        <img src="${esc(logoSrc)}" alt="Mangia DC" width="120" height="auto" style="display:block;width:120px;height:auto;" />
      </td>
      <td style="vertical-align:middle;">
        <div style="font-size:22px;font-weight:800;letter-spacing:0.02em;color:#1a1a1a;">Banquet Event Order</div>
        <div style="font-size:13px;color:${TEAL_DARK};font-weight:600;margin-top:2px;">Mangia DC</div>
      </td>
      <td style="width:140px;vertical-align:top;text-align:right;font-size:11px;color:#444;">
        <div><strong>Print date</strong></div>
        <div>${esc(printDate)}</div>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0 6px 0 0;">
        ${sectionTable(
          'Event information',
          cell('Event name', name, { stripe: true }) +
            cell('Experience', type) +
            cell('Location / venue', venueLabel, { stripe: true }) +
            cell('Event date', formatDate(eventDate)) +
            cell('Start time', startTime, { stripe: true }) +
            cell('Guest count', headcount)
        )}
      </td>
      <td style="width:50%;vertical-align:top;padding:0 0 0 6px;">
        ${sectionTable(
          'Client information',
          cell('Planner / contact', pocName, { stripe: true }) +
            cell('Phone', pocPhone) +
            cell('Email', pocEmail, { stripe: true }) +
            cell('On-site / day-of POC', dayOf) +
            cell('Day-of phone', dayOfPhone, { stripe: true }) +
            cell('Day-of email', dayOfEmail)
        )}
      </td>
    </tr>
  </table>

  ${sectionTable('Logistics', logisticsRows)}

  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0 6px 0 0;">${leftCol}</td>
      <td style="width:50%;vertical-align:top;padding:0 0 0 6px;">${rightCol}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:8px;font-family:Arial,Helvetica,sans-serif;">
    ${sectionBar('Approvals')}
    <tr>
      <td style="width:50%;border:1px solid ${BORDER};padding:14px 10px;font-size:12px;vertical-align:bottom;">
        Sales / Ops initials: ______________________
      </td>
      <td style="width:50%;border:1px solid ${BORDER};padding:14px 10px;font-size:12px;vertical-align:bottom;">
        Client signature: ______________________ &nbsp; Date: __________
      </td>
    </tr>
  </table>

  <p style="margin:10px 0 0;font-size:10px;color:#666;">
    Follow this BEO for layout, inventory, and client details on event day. Generated from Mangia CRM.
  </p>
</div>`.trim();
}

/**
 * Shared CSS for editor preview + download/print wrappers.
 */
export const BEO_PRINT_CSS = `
  body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
  .beo-sheet { box-sizing: border-box; }
  .beo-sheet table { page-break-inside: avoid; }
  .beo-sheet img { max-width: 120px; height: auto; }
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
