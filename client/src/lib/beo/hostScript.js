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
    // Present-but-empty (e.g. instructor_bio) clears the token; missing keys keep {{token}}.
    if (!Object.prototype.hasOwnProperty.call(vars, k)) return `{{${k}}}`;
    const val = vars[k];
    return val != null ? String(val) : "";
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

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Build placeholder map for the host MC / Standard Script.
 * Bios are intentionally empty — Group Leader Biography is a separate BEO section (CRM-17).
 * @param {{
 *   event?: Record<string, unknown>,
 *   instructor?: { name?: string, bio?: string } | null,
 *   instructor2?: { name?: string, bio?: string } | null,
 *   client?: { name?: string, company?: string } | null,
 *   runOfShow?: Record<string, unknown>,
 * }} input
 */
export function buildHostScriptVars(input = {}) {
  const event = input.event || {};
  const instructor = input.instructor || {};
  const instructor2 = input.instructor2 || {};
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

  const gl1Name = instructor.name ? String(instructor.name).trim() : "";
  const gl2Name = instructor2.name ? String(instructor2.name).trim() : "";

  const instructorName =
    gl1Name && gl2Name
      ? `${gl1Name} & ${gl2Name}`
      : gl1Name || "(Group Leader name)";

  return {
    client_name: String(clientName),
    host_name: hostNameFromStaff(
      event.staff_assigned || event.staffAssigned
    ),
    event_name: String(eventName),
    experience_activity: experienceActivityPhrase(String(eventType)),
    instructor_name: instructorName,
    // Bios live in Group Leader Biography section — leave empty for script fill.
    instructor_bio: "",
    instructor_2_name: gl2Name,
    instructor_2_bio: "",
    dish_or_drink: String(dishOrDrink),
  };
}

/**
 * Distinct Group Leader Biography section body (CRM-17).
 * @param {{ name?: string, bio?: string } | null | undefined} instructor
 * @param {{ name?: string, bio?: string } | null | undefined} instructor2
 */
export function groupLeaderBiographyHtml(instructor, instructor2) {
  const gl1 = instructor && typeof instructor === "object" ? instructor : {};
  const gl2 = instructor2 && typeof instructor2 === "object" ? instructor2 : {};
  const gl1Name = gl1.name ? String(gl1.name).trim() : "";
  const gl1Bio = gl1.bio ? String(gl1.bio).trim() : "";
  const gl2Name = gl2.name ? String(gl2.name).trim() : "";
  const gl2Bio = gl2.bio ? String(gl2.bio).trim() : "";

  if (!gl1Name && !gl1Bio && !gl2Name && !gl2Bio) {
    return `<p style="margin:0;font-size:12px;color:#666;">Select Group Leader(s) on Event Detail to include biographies. Manage bios under Settings → Group Leaders.</p>`;
  }

  const leaderBlock = (label, name, bio) => {
    if (!name && !bio) return "";
    return `<div style="margin:0 0 12px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#555;">${esc(
        label
      )}</p>
      ${
        name
          ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;">${esc(
              name
            )}</p>`
          : ""
      }
      ${
        bio
          ? `<div style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5;">${esc(
              bio
            )}</div>`
          : `<p style="margin:0;font-size:12px;color:#666;">No biography on file.</p>`
      }
    </div>`;
  };

  return `${leaderBlock("Group Leader 1", gl1Name, gl1Bio)}${leaderBlock(
    "Group Leader 2",
    gl2Name,
    gl2Bio
  )}`;
}

/**
 * Render Standard Script as BEO HTML section body (no embedded bios).
 * @param {string | null | undefined} templateBody
 * @param {Record<string, string>} vars
 * @param {{ missingInstructor?: boolean }} opts
 */
export function hostScriptSectionHtml(templateBody, vars, opts = {}) {
  const filled = fillBeoHostScript(templateBody || "", vars);
  const note = opts.missingInstructor
    ? `<p style="margin:0 0 10px;font-size:12px;color:#666;">Select Group Leader 1 on Event Detail to fill name placeholders in the script.</p>`
    : "";

  if (!filled.trim()) {
    return `${note}<p style="margin:0;font-size:12px;color:#666;">No host script template configured. Add one under Settings → BEO Host Script.</p>`;
  }
  return `${note}<div style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5;">${esc(
    filled
  )}</div>`;
}
