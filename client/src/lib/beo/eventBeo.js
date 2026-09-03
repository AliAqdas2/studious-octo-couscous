/**
 * Cooking / class / mixology / paint / terrarium BEO (Eli Lilly layout).
 */
import {
  asRecord,
  attendeeTable,
  addonLines,
  approvalsBlock,
  contactInfoTable,
  esc,
  eventCoreFields,
  eventInfoTable,
  foodLines,
  formatDate,
  guidelinesBlock,
  headerBlock,
  imageBlock,
  inventoryChecklistHtml,
  logisticsTable,
  openSection,
  wrapSheet,
  yn,
} from './shared.js';

function menuSection(core, input) {
  const event = core.event;
  const ros = core.ros;
  const isCooking =
    event.event_type === 'In-Person Cooking' ||
    event.eventType === 'In-Person Cooking';
  const menu = asRecord(ros.menu);
  const activity = asRecord(ros.activityConfirm);
  const confirmLabel = input?.rosConfirmLabel || 'Menu / activity';

  const dish = event.dish_configuration || event.dishConfiguration || '';
  const menuText = event.menu || '';

  let body;
  if (isCooking) {
    const parts = [];
    if (menu.app) parts.push(`App: ${menu.app}`);
    if (menu.entree) parts.push(`Entrée: ${menu.entree}`);
    if (menu.dessert) parts.push(`Dessert: ${menu.dessert}`);
    const menuLine = parts.length ? parts.join(' / ') : '';
    const extra = [];
    if (dish) extra.push(`Dish configuration: ${dish}`);
    if (menu.confirmed != null) extra.push(`Confirmed: ${yn(menu.confirmed)}`);
    body = `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;"><strong>Menu:</strong> ${
      menuLine ? esc(menuLine) : '—'
    }</p>${
      extra.length
        ? extra.map((t) => `<p style="margin:0 0 4px;font-size:12px;">${esc(t)}</p>`).join('')
        : ''
    }`;
  } else {
    const notes = activity.notes || menuText || '';
    const confirmed =
      activity.confirmed != null ? `Confirmed: ${yn(activity.confirmed)}` : '';
    body = `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;"><strong>${esc(
      confirmLabel
    )}:</strong> ${notes ? esc(notes) : '—'}</p>${
      confirmed ? `<p style="margin:0;font-size:12px;">${esc(confirmed)}</p>` : ''
    }`;
  }
  return openSection('Details', body, { keep: true });
}

function eventFlowHtml(core) {
  const start = core.startTime || 'Start';
  const skeleton = [
    `${start} — Arrival &amp; mingling; host checks guests in and offers drinks.`,
    'Welcome / introductions — host introduces Mangia and the instructor.',
    'Appetizer / activity start.',
    'Instructor demonstration, then guests cook / create.',
    'Entree / main activity; team plates and (if a competition) presents.',
    'Dessert / wrap-up; group photo; event ends.',
  ];
  const notes = core.ros.notes ? `<p style="margin:8px 0 0;">${esc(core.ros.notes)}</p>` : '';
  return `<ul style="margin:6px 0 6px 18px;padding:0;font-size:12px;line-height:1.45;">
    ${skeleton.map((s) => `<li>${s}</li>`).join('')}
  </ul>${notes}`;
}

export function buildEventBeoHtml(input) {
  const core = eventCoreFields(input);
  const logoSrc = input?.logoSrc || '/mangiadc-logo.png';
  const printDate = formatDate(new Date().toISOString());
  const food = foodLines(core.event.food_additions || core.event.foodAdditions);
  const addons = addonLines(core.event.custom_addons || core.event.customAddons);
  const venueRow = asRecord(input?.venue);
  const instructor = asRecord(input?.instructor);

  const clientBits = [];
  if (core.isCompetition) clientBits.push('Cooking competition: YES');
  if (core.special) clientBits.push(core.special);
  if (core.additional) clientBits.push(core.additional);
  if (food.length) clientBits.push(`Food additions: ${food.join('; ')}`);
  if (addons.length) clientBits.push(`Custom add-ons: ${addons.join('; ')}`);

  const inner = `
    ${headerBlock(logoSrc, printDate)}
    <table class="beo-keep" style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding:0 6px 0 0;">${eventInfoTable(core)}</td>
        <td style="width:50%;vertical-align:top;padding:0 0 0 6px;">${contactInfoTable(core)}</td>
      </tr>
    </table>
    ${menuSection(core, input)}
    ${openSection(
      'Client-Specific Details',
      clientBits.length
        ? clientBits.map((t) => `<p style="margin:0 0 8px;">${esc(t)}</p>`).join('')
        : '&nbsp;',
      { keep: true }
    )}
    ${logisticsTable(core)}
    ${openSection('Event Flow', eventFlowHtml(core), { keep: true })}
    ${openSection('Cooking Supplies', inventoryChecklistHtml(input?.inventory))}
    ${openSection('Floor Map', imageBlock(input?.venueImages), { keep: true })}
    ${openSection(
      'Venue Guidelines',
      guidelinesBlock(venueRow.guidelines)
    )}
    ${openSection(
      'Instructor Bio / Script',
      instructor.name
        ? `<p style="margin:0 0 8px;font-weight:700;">${esc(instructor.name)}</p>
           <p style="margin:0;white-space:pre-wrap;">${esc(instructor.bio || '')}</p>`
        : '<p style="margin:0;font-size:12px;color:#666;">Select an instructor on Event Detail to pull their bio.</p>'
    )}
    ${openSection('Attendees', attendeeTable(core.participationUrl, input?.attendees))}
    ${approvalsBlock()}
  `;

  return wrapSheet(inner).trim();
}
