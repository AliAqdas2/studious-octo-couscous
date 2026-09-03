/**
 * Shared BEO HTML helpers (print-ready Mangia branding).
 */

export const TEAL = '#2A9B9F';
export const TEAL_DARK = '#1F7A7D';
export const BORDER = '#1a1a1a';
export const STRIPE = '#f3f7f7';

/** Same labels as ROS multimedia permissions (stored as snake_case codes). */
export const MEDIA_PERMISSION_LABELS = {
  marketing_ok: 'OK for client + marketing use',
  internal_only: 'OK internal only, not marketing',
  no_photos: 'No photos',
};

export function mediaPermissionLabel(value) {
  if (!value) return '';
  const key = String(value);
  return MEDIA_PERMISSION_LABELS[key] || key.replace(/_/g, ' ');
}

export function esc(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function yn(v) {
  return v ? 'Yes' : 'No';
}

export function asRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function cell(label, value, opts = {}) {
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

export function sectionBar(title) {
  return `<tr>
    <td colspan="2" style="padding:7px 10px;background:${TEAL};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid ${TEAL_DARK};">
      ${esc(title)}
    </td>
  </tr>`;
}

export function sectionTable(title, rowsHtml) {
  return `<table class="beo-keep" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;">
    ${sectionBar(title)}
    ${rowsHtml}
  </table>`;
}

export function openSection(title, innerHtml, opts = {}) {
  const keep = opts.keep ? ' beo-keep' : '';
  return `<div class="beo-section${keep}">
    <div class="beo-section-title">${esc(title)}</div>
    <div class="beo-section-body">${innerHtml}</div>
  </div>`;
}

export function listBlock(items) {
  if (!items.length) {
    return `<p style="margin:0;padding:8px;min-height:36px;font-size:12px;color:#666;">&nbsp;</p>`;
  }
  return `<ul style="margin:6px 0 6px 18px;padding:0;font-size:12px;line-height:1.45;">
    ${items.map((i) => `<li>${esc(i)}</li>`).join('')}
  </ul>`;
}

function inventoryItemLabel(item) {
  const r = item && typeof item === 'object' ? item : {};
  const qty = r.quantity != null ? ` ×${r.quantity}` : '';
  const hint = r.quantity_hint || r.quantityHint ? ` (${r.quantity_hint || r.quantityHint})` : '';
  return `${r.name || ''}${qty}${hint}`.trim();
}

function checkboxColumn(lines) {
  if (!lines.length) {
    return '&nbsp;';
  }
  return lines
    .map(
      (line) =>
        `<div style="font-size:12px;line-height:1.55;padding:1px 0;">☐ ${esc(line)}</div>`
    )
    .join('');
}

function twoColumnChecklist(lines) {
  const mid = Math.ceil(lines.length / 2);
  const left = lines.slice(0, mid);
  const right = lines.slice(mid);
  return `<table class="beo-keep" style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0 8px 0 0;">${checkboxColumn(left)}</td>
      <td style="width:50%;vertical-align:top;padding:0 0 0 8px;">${checkboxColumn(right)}</td>
    </tr>
  </table>`;
}

/** Two-column empty-checkbox inventory, grouped by section. */
export function inventoryChecklistHtml(items) {
  const groups = [];
  const bySection = new Map();
  for (const item of asArray(items)) {
    const key = item.section || 'Cooking Supplies';
    if (!bySection.has(key)) {
      bySection.set(key, []);
      groups.push(key);
    }
    bySection.get(key).push(item);
  }
  if (!groups.length) {
    return `<p style="margin:0;font-size:12px;color:#666;">No inventory checklist items yet.</p>`;
  }
  return groups
    .map((section) => {
      const lines = (bySection.get(section) || [])
        .map(inventoryItemLabel)
        .filter(Boolean);
      const heading = `<p style="margin:8px 0 4px;font-size:12px;font-weight:700;">${esc(section)}</p>`;
      return `<div class="beo-keep beo-inv-group">${heading}${twoColumnChecklist(lines)}</div>`;
    })
    .join('');
}

export function bulletBlock(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  return listBlock(lines);
}

const GUIDELINES_ALLOWED_TAGS = new Set([
  'P',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'B',
  'EM',
  'I',
  'A',
  'BR',
  'H1',
  'H2',
  'H3',
]);

/**
 * Allowlist-sanitize venue guidelines HTML for safe BEO injection.
 * Falls back to bulletBlock for plain text.
 */
export function guidelinesBlock(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return '<p style="margin:0;font-size:12px;color:#666;">No guidelines saved for this venue.</p>';
  }
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    return bulletBlock(text);
  }

  if (typeof document === 'undefined') {
    // SSR / build-time: strip tags that look dangerous, keep structure loosely.
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  const doc = new DOMParser().parseFromString(
    `<div id="root">${text}</div>`,
    'text/html'
  );
  const root = doc.getElementById('root');
  if (!root) return bulletBlock(text);

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 3) continue; // text
      if (child.nodeType !== 1) {
        child.remove();
        continue;
      }
      const el = /** @type {Element} */ (child);
      const tag = el.tagName.toUpperCase();
      if (!GUIDELINES_ALLOWED_TAGS.has(tag)) {
        // Unwrap: keep children, drop the wrapper
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el);
        }
        el.remove();
        continue;
      }
      // Strip all attributes except href on anchors
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (tag === 'A' && attr.name.toLowerCase() === 'href') {
          const href = attr.value.trim();
          if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
            el.removeAttribute(attr.name);
          } else {
            el.setAttribute('href', href);
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          el.removeAttribute(attr.name);
        }
      }
      walk(el);
    }
  };
  walk(root);
  const html = root.innerHTML.trim();
  return html || bulletBlock(text);
}

export function imageBlock(images) {
  const list = asArray(images).filter((img) => img?.image_url || img?.imageUrl);
  if (!list.length) {
    return `<p style="margin:0;font-size:12px;color:#666;">No floor map on file for this venue.</p>`;
  }
  return `<div style="display:flex;flex-wrap:wrap;gap:10px;">
    ${list
      .map((img) => {
        const src = esc(img.image_url || img.imageUrl);
        const cap = esc(img.caption || '');
        return `<figure class="beo-floor-map beo-keep" style="margin:0;max-width:48%;">
          <img src="${src}" alt="${cap || 'Floor map'}" style="display:block;max-width:100%;height:auto;border:1px solid ${BORDER};" />
          ${cap ? `<figcaption style="font-size:11px;color:#555;margin-top:4px;">${cap}</figcaption>` : ''}
        </figure>`;
      })
      .join('')}
  </div>`;
}

export function attendeeTable(participationUrl, attendees = [], rowCount = 12) {
  const list = Array.isArray(attendees) ? attendees : [];
  const link = participationUrl
    ? `<p style="margin:0 0 8px;font-size:12px;">Participation list: <a href="${esc(participationUrl)}">${esc(participationUrl)}</a></p>`
    : list.length
      ? ''
      : `<p style="margin:0 0 8px;font-size:12px;color:#666;">Add attendees on Event Detail (or a participation spreadsheet link on Artifacts). Blank rows below for day-of notes.</p>`;
  const header = `<tr>
    <th style="border:1px solid ${BORDER};padding:6px 8px;font-size:11px;text-align:left;background:${STRIPE};width:40%;">Name</th>
    <th style="border:1px solid ${BORDER};padding:6px 8px;font-size:11px;text-align:left;background:${STRIPE};width:35%;">Allergies</th>
    <th style="border:1px solid ${BORDER};padding:6px 8px;font-size:11px;text-align:left;background:${STRIPE};width:25%;">Phone Number</th>
  </tr>`;
  const filled = list.map((row) => {
    const r = row && typeof row === 'object' ? row : {};
    const name = r.name || r.Name || '';
    const allergies = r.allergies || r.Allergies || r.dietary || '';
    const phone = r.phone || r.Phone || r.phone_number || '';
    return `<tr>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">${esc(String(name)) || '&nbsp;'}</td>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">${esc(String(allergies)) || '&nbsp;'}</td>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">${esc(String(phone)) || '&nbsp;'}</td>
  </tr>`;
  });
  const extra = filled.length === 0 ? 4 : 2;
  const cap = rowCount || 12;
  const blankNeeded =
    filled.length >= cap ? 0 : Math.min(extra, cap - filled.length);
  const blanks = Array.from({ length: blankNeeded }, () => `<tr>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
    <td style="border:1px solid ${BORDER};padding:10px 8px;font-size:12px;">&nbsp;</td>
  </tr>`);
  return `${link}
  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
    ${header}
    ${[...filled, ...blanks].join('')}
  </table>`;
}

export function headerBlock(logoSrc, printDate) {
  return `<table class="beo-keep" style="width:100%;border-collapse:collapse;margin-bottom:14px;">
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
  </table>`;
}

export function approvalsBlock() {
  return `<table class="beo-keep" style="width:100%;border-collapse:collapse;margin-top:8px;font-family:Arial,Helvetica,sans-serif;">
    ${sectionBar('Approvals')}
    <tr>
      <td style="width:50%;border:1px solid ${BORDER};padding:14px 10px;font-size:12px;vertical-align:bottom;">
        Sales / Ops initials: ______________________
      </td>
      <td style="width:50%;border:1px solid ${BORDER};padding:14px 10px;font-size:12px;vertical-align:bottom;">
        Client signature: ______________________ &nbsp; Date: __________
      </td>
    </tr>
  </table>`;
}

export function wrapSheet(inner) {
  return `<div class="beo-sheet" style="max-width:900px;margin:0 auto;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;border:2px solid ${BORDER};box-sizing:border-box;">
  ${inner}
  <p style="margin:10px 0 0;font-size:10px;color:#666;">
    Follow this BEO for layout, inventory, and client details on event day. Generated from Mangia CRM.
  </p>
</div>`;
}

export function eventCoreFields(input) {
  const event = asRecord(input?.event);
  const ros = asRecord(input?.runOfShow);
  const name = event.event_name || event.eventName || '';
  const type = event.event_type || event.eventType || '';
  const venue = event.venue || '';
  const venueMode = event.venue_mode || event.venueMode;
  const venueLabel = venue
    ? venueMode
      ? `${venue} (${venueMode})`
      : venue
    : '';
  const eventDateRaw = event.event_date || event.eventDate;
  const startTimeRaw = event.start_time || event.startTime || '';
  const eventDate =
    ros.timeChanged && ros.newEventDate ? ros.newEventDate : eventDateRaw;
  const startTime =
    ros.timeChanged && ros.newStartTime
      ? String(ros.newStartTime).trim()
      : startTimeRaw;
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

  const media = mediaPermissionLabel(
    ros.mediaPermission ||
      event.media_permission ||
      event.mediaPermission ||
      ''
  );

  const staff = asArray(event.staff_assigned || event.staffAssigned)
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean)
    .join(', ');

  const instructorName = asRecord(input?.instructor).name || '';

  return {
    event,
    ros,
    name,
    type,
    venue,
    venueLabel,
    venueRestrictions: event.venue_restrictions || event.venueRestrictions || '',
    eventDate,
    startTime,
    headcount,
    pocName,
    pocEmail,
    pocPhone,
    dayOf,
    dayOfEmail,
    dayOfPhone,
    timeChangeLabel,
    transportNeeded,
    transportCompany,
    media,
    staff,
    instructorName,
    special: event.special_requests || event.specialRequests || '',
    dietary: event.dietary_restrictions || event.dietaryRestrictions || '',
    additional:
      event.additional_event_details || event.additionalEventDetails || '',
    isCompetition: Boolean(event.is_competition ?? event.isCompetition),
    participationUrl:
      event.participation_list_url || event.participationListUrl || '',
  };
}

export function eventInfoTable(core) {
  return sectionTable(
    'Event information',
    cell('Event name', core.name, { stripe: true }) +
      cell('Experience', core.type) +
      cell('Location / venue', core.venueLabel, { stripe: true }) +
      cell('Event date', formatDate(core.eventDate)) +
      cell('Start time', core.startTime, { stripe: true }) +
      cell('Guest count', core.headcount) +
      cell('Staff', core.staff || core.instructorName)
  );
}

export function contactInfoTable(core) {
  return sectionTable(
    'Contact info',
    cell('Organizer', core.pocName, { stripe: true }) +
      cell('Phone', core.pocPhone) +
      cell('Email', core.pocEmail, { stripe: true }) +
      cell('Day-of contact', core.dayOf) +
      cell('Day-of phone', core.dayOfPhone, { stripe: true }) +
      cell('Day-of email', core.dayOfEmail)
  );
}

export function logisticsTable(core) {
  return sectionTable(
    'Logistics',
    cell('Arrival', core.ros.arrivalMethod || '', { stripe: true }) +
      cell('Time change', core.timeChangeLabel) +
      cell(
        'Transport',
        core.transportNeeded
          ? `Yes${core.transportCompany ? ` — ${core.transportCompany}` : ''}`
          : core.transportNeeded === false
            ? 'No'
            : '',
        { stripe: true }
      ) +
      cell(
        'Seating',
        core.ros.seatingCurated || core.event.seatingCurated
          ? `Curated${
              core.ros.seatingStyle || core.event.seatingStyle
                ? ` — ${core.ros.seatingStyle || core.event.seatingStyle}`
                : ''
            }`
          : ''
      ) +
      cell('Multimedia', core.media, { stripe: true }) +
      cell('Venue restrictions', core.venueRestrictions)
  );
}

export function foodLines(food) {
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

export function addonLines(addons) {
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
