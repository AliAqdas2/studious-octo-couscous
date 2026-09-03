/**
 * Food-tour BEO (restaurant stops / orders) — Group, Flavors of DC, Italian,
 * Georgetown Foodie, Private, Indoor.
 */
import { formatOrderLine, normalizeOrderLines } from '../eateryOrders.js';
import {
  approvalsBlock,
  asArray,
  asRecord,
  attendeeTable,
  BORDER,
  contactInfoTable,
  esc,
  eventCoreFields,
  eventInfoTable,
  formatDate,
  headerBlock,
  inventoryChecklistHtml,
  logisticsTable,
  openSection,
  wrapSheet,
} from './shared.js';

function ordersHtml(stops) {
  const list = asArray(stops);
  if (!list.length) {
    return `<p style="margin:0;font-size:12px;color:#666;">No food-tour stops selected yet. Add restaurants on Event Detail.</p>`;
  }
  return list
    .map((stop) => {
      const time = stop.stop_time || stop.stopTime || 'X:XX PM';
      const guests = stop.guest_count ?? stop.guestCount;
      const mode = stop.order_mode || stop.orderMode || 'PRE-ORDERED';
      const guestsLabel =
        guests != null ? `${guests} people` : 'XX people';
      const lines = normalizeOrderLines(stop.order_lines || stop.orderLines)
        .map((line) => `<li>${esc(formatOrderLine(line, guests))}</li>`)
        .join('');
      const drink = stop.drink_option || stop.drinkOption;
      return `<div style="margin:0 0 14px;">
        <p style="margin:0 0 2px;font-size:14px;font-family:Georgia,'Times New Roman',serif;color:#134f5c;">
          ${esc(stop.name || '')} — ${esc(time)}
        </p>
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;">
          ${esc(mode)} — ${esc(guestsLabel)}
        </p>
        <ul style="margin:0 0 6px 18px;padding:0;font-size:12px;line-height:1.45;">
          ${lines || '<li>&nbsp;</li>'}
        </ul>
        ${
          drink
            ? `<p style="margin:0;font-size:12px;">Alcohol option — ${esc(drink)}</p>`
            : ''
        }
      </div>`;
    })
    .join('');
}

function orderKeyTable(stops) {
  const list = asArray(stops);
  const header = `<tr>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;width:24%;">Restaurant</th>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;">Dishes</th>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;width:28%;">Drink (if applicable)</th>
  </tr>`;
  const rows = (list.length ? list : [{ name: '', order_key_dishes: '', drink_option: '' }, { name: '', order_key_dishes: '', drink_option: '' }])
    .map(
      (stop) => `<tr>
        <td style="border:1px solid ${BORDER};padding:8px;font-size:12px;vertical-align:top;">${esc(stop.name || '') || '&nbsp;'}</td>
        <td style="border:1px solid ${BORDER};padding:8px;font-size:12px;vertical-align:top;">${esc(stop.order_key_dishes || stop.orderKeyDishes || '') || '&nbsp;'}</td>
        <td style="border:1px solid ${BORDER};padding:8px;font-size:12px;vertical-align:top;">${esc(stop.drink_option || stop.drinkOption || '') || '&nbsp;'}</td>
      </tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
    ${header}
    ${rows}
  </table>`;
}

function routeScaffold() {
  const header = `<tr>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;width:16%;">Leg</th>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;width:28%;">Location</th>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;width:28%;">Address</th>
    <th style="border:1px solid ${BORDER};padding:5px 8px;font-size:10px;text-align:left;font-weight:700;">Instructions</th>
  </tr>`;
  const labels = ['Meet', 'Stop', 'Walk', 'Stop', 'Walk', 'Stop', 'Walk', 'Final stop'];
  const rows = labels
    .map(
      (leg) => `<tr>
        <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">${esc(leg)}</td>
        <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
        <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
        <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
      </tr>`
    )
    .join('');
  return `<p style="margin:0 0 8px;font-size:12px;color:#666;">Route changes per booking — fill start, stops, and walking notes here.</p>
  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
    ${header}
    ${rows}
  </table>`;
}

export function buildFoodTourBeoHtml(input) {
  const core = eventCoreFields(input);
  const logoSrc = input?.logoSrc || '/mangiadc-logo.png';
  const printDate = formatDate(new Date().toISOString());
  const stops = asArray(input?.eateryStops);

  const detailBits = [];
  if (core.ros.notes) detailBits.push(core.ros.notes);
  if (core.additional) detailBits.push(core.additional);
  if (core.dietary) detailBits.push(`Dietary restrictions: ${core.dietary}`);
  const activityNotes = asRecord(core.ros.activityConfirm).notes;
  if (activityNotes) detailBits.push(activityNotes);

  const inner = `
    ${headerBlock(logoSrc, printDate)}
    <table class="beo-keep" style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding:0 6px 0 0;">${eventInfoTable(core)}</td>
        <td style="width:50%;vertical-align:top;padding:0 0 0 6px;">${contactInfoTable(core)}</td>
      </tr>
    </table>
    ${openSection(
      'Client-Specific Details',
      core.special ? `<p style="margin:0;">${esc(core.special)}</p>` : '&nbsp;',
      { keep: true }
    )}
    ${logisticsTable(core)}
    ${openSection(
      'Details',
      detailBits.length
        ? detailBits.map((t) => `<p style="margin:0 0 8px;">${esc(t)}</p>`).join('')
        : '<p style="margin:0;">HIGH-LEVEL NOTES:</p><p style="margin:0;">&nbsp;</p>',
      { keep: true }
    )}
    ${openSection('Orders', ordersHtml(stops))}
    ${openSection('Food Stops Order Key', orderKeyTable(stops))}
    ${openSection('Tour Route', routeScaffold(), { keep: true })}
    ${
      asArray(input?.inventory).length
        ? openSection('Inventory', inventoryChecklistHtml(input.inventory))
        : ''
    }
    ${openSection('Attendees', attendeeTable(core.participationUrl, input?.attendees))}
    ${approvalsBlock()}
  `;

  return wrapSheet(inner).trim();
}
