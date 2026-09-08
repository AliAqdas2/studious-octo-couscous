/**
 * Map ops panels → primary workflow task (by title / trace id).
 */

/** @typedef {'deposit' | 'ros' | 'inventory' | 'beo' | 'artifacts' | 'food_tour_stops' | 'attendees'} OpsPanelId */

/**
 * @type {Record<OpsPanelId, { titles: RegExp[], traceIds?: string[] }>}
 */
export const OPS_PANEL_TASK_MATCHERS = {
  deposit: {
    titles: [
      /^Sales intake meeting/i,
      /Email deposit notify/i,
      /deposit intake/i,
    ],
    traceIds: ['C001', 'C030'],
  },
  ros: {
    titles: [
      /^Schedule Run of Show with client/i,
      /Email client 2\.5 weeks before — schedule ROS/i,
      /^Schedule Run of Show/i,
    ],
    traceIds: ['C043', 'C042'],
  },
  inventory: {
    titles: [
      /^Order inventory \/ supplemental supplies/i,
      /^Order inventory/i,
      /Paint & Sip inventory/i,
      /24h inventory triple-check/i,
    ],
    traceIds: ['C067', 'C093'],
  },
  beo: {
    titles: [/^Create BEO \(Admin\)/i, /^Create BEO$/i, /^Create BEO\b/i],
    traceIds: ['C035'],
  },
  artifacts: {
    titles: [
      /Create BEO Shell and link to FareHarbor/i,
      /Email BEO to all event staff \+ embed in FareHarbor/i,
      /BEO Shell/i,
    ],
    traceIds: ['C037', 'C056'],
  },
  food_tour_stops: {
    titles: [
      /Confirm multi-stop locations/i,
      /Confirm restaurant reservations/i,
      /multi-stop/i,
    ],
  },
  attendees: {
    titles: [
      /Request attendee list/i,
      /Create participation link/i,
      /Confirm number of attendees/i,
    ],
    traceIds: ['C032'],
  },
};

/**
 * @param {unknown} task
 * @returns {string}
 */
function taskTitle(task) {
  const t = task && typeof task === 'object' ? task : {};
  return String(t.title || '');
}

/**
 * @param {unknown} task
 * @returns {string}
 */
function taskTraceId(task) {
  const t = task && typeof task === 'object' ? task : {};
  return String(t.trace_id || t.traceId || '');
}

/**
 * @param {unknown} task
 * @returns {number}
 */
function taskOrder(task) {
  const t = task && typeof task === 'object' ? task : {};
  const o = t.order ?? t.sort_order ?? t.sortOrder;
  return typeof o === 'number' ? o : 9999;
}

/**
 * Find the best workflow task for an ops panel.
 * @param {OpsPanelId} panelId
 * @param {unknown[]} tasks
 * @returns {Record<string, unknown> | null}
 */
export function findOpsPanelTask(panelId, tasks) {
  const matcher = OPS_PANEL_TASK_MATCHERS[panelId];
  if (!matcher) return null;
  const list = Array.isArray(tasks) ? tasks : [];
  const traceSet = new Set((matcher.traceIds || []).map(String));

  /** @type {Record<string, unknown>[]} */
  const scored = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const title = taskTitle(raw);
    const trace = taskTraceId(raw);
    let rank = -1;
    if (trace && traceSet.has(trace)) {
      rank = 0;
    } else {
      for (let i = 0; i < matcher.titles.length; i += 1) {
        if (matcher.titles[i].test(title)) {
          rank = i + 1;
          break;
        }
      }
    }
    if (rank < 0) continue;
    scored.push({ task: raw, rank });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return taskOrder(a.task) - taskOrder(b.task);
  });
  return /** @type {Record<string, unknown>} */ (scored[0].task);
}
