/**
 * Fill BEO host MC script placeholders from event / instructor context.
 */

/**
 * @param {string} template
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function fillBeoHostScript(template, vars = {}) {
  const raw = typeof template === "string" ? template : "";
  if (!raw.trim()) return "";
  return raw.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key) => {
    const k = String(key).toLowerCase();
    const val = vars[k];
    return val != null && String(val).trim() !== "" ? String(val) : `{{${k}}}`;
  });
}

/**
 * @param {string} eventType
 * @returns {string}
 */
export function experienceActivityPhrase(eventType) {
  const t = String(eventType || "").toLowerCase();
  if (t.includes("paint")) return "painting";
  if (t.includes("mixology")) return "mixology";
  if (t.includes("chocolate")) return "chocolate making";
  if (t.includes("terrarium")) return "terrarium crafting";
  if (t.includes("lend a hand")) return "lending a hand for good";
  if (t.includes("pottery")) return "pottery";
  if (t.includes("cheeseboard") || t.includes("cheese")) return "cheeseboard making";
  if (t.includes("gingerbread")) return "gingerbread";
  if (t.includes("yoga")) return "yoga & UnWined";
  if (t.includes("monument")) return "monuments touring";
  if (t.includes("food tour") || t.includes("flavors") || t.includes("foodie")) {
    return "tasting and touring";
  }
  if (t.includes("cooking")) return "cooking";
  return t || "today's experience";
}

/**
 * @param {unknown} staffAssigned
 * @returns {string}
 */
export function hostNameFromStaff(staffAssigned) {
  const list = Array.isArray(staffAssigned) ? staffAssigned : [];
  const asObj = (s) =>
    typeof s === "string" ? { name: s, role: "" } : s && typeof s === "object" ? s : null;
  const rows = list.map(asObj).filter(Boolean);
  const host =
    rows.find((r) =>
      /event\s*host|host/i.test(String(r.role || ""))
    ) || rows[0];
  const name = host?.name ? String(host.name).trim() : "";
  return name || "Host";
}

/**
 * Build placeholder map for the host MC script.
 * @param {{
 *   event?: Record<string, unknown>,
 *   instructor?: { name?: string, bio?: string } | null,
 *   client?: { name?: string, company?: string } | null,
 *   runOfShow?: Record<string, unknown>,
 * }} input
 */
export function buildHostScriptVars(input = {}) {
  const event = input.event || {};
  const instructor = input.instructor || {};
  const client = input.client || {};
  const ros = input.runOfShow || {};

  const clientName =
    client.company ||
    client.name ||
    event.poc_name ||
    event.pocName ||
    "Client";

  const eventName =
    event.event_name || event.eventName || "today's Mangia DC event";

  const eventType = event.event_type || event.eventType || "";

  const menu = ros.menu && typeof ros.menu === "object" ? ros.menu : {};
  const activity =
    ros.activityConfirm && typeof ros.activityConfirm === "object"
      ? ros.activityConfirm
      : ros.activity_confirm && typeof ros.activity_confirm === "object"
        ? ros.activity_confirm
        : {};

  const dishParts = [menu.app, menu.entree, menu.dessert].filter(Boolean);
  const dishOrDrink =
    dishParts.join(" / ") ||
    activity.notes ||
    event.menu ||
    "dish/drink";

  return {
    client_name: String(clientName),
    host_name: hostNameFromStaff(
      event.staff_assigned || event.staffAssigned
    ),
    event_name: String(eventName),
    experience_activity: experienceActivityPhrase(String(eventType)),
    instructor_name: instructor.name
      ? String(instructor.name)
      : "(Instructor name)",
    instructor_bio: instructor.bio ? String(instructor.bio) : "",
    dish_or_drink: String(dishOrDrink),
  };
}

/**
 * Render host script as BEO HTML section body.
 * @param {string | null | undefined} templateBody
 * @param {Record<string, string>} vars
 * @param {{ missingInstructor?: boolean }} opts
 */
export function hostScriptSectionHtml(templateBody, vars, opts = {}) {
  const filled = fillBeoHostScript(templateBody || "", vars);
  const note = opts.missingInstructor
    ? `<p style="margin:0 0 10px;font-size:12px;color:#666;">Select an instructor on Event Detail (Instructor &amp; attendees) to fill bio placeholders.</p>`
    : "";
  if (!filled.trim()) {
    return `${note}<p style="margin:0;font-size:12px;color:#666;">No host script template configured. Add one under Settings → BEO Host Script.</p>`;
  }
  // Escape is done by caller if needed — template is ops-authored plain text.
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `${note}<div style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5;">${esc(
    filled
  )}</div>`;
}
