/**
 * Aggregators for Event Progress ops dashboard (panel milestones + workflow tasks).
 */

import { isFoodTourExperience } from '@/lib/foodTourExperiences';
import { isOpsPanelComplete } from '@/lib/opsPanelCompletion';
import {
  findOpsPanelTask,
  OPS_PANEL_MILESTONES,
} from '@/lib/opsPanelTasks';

const CANCELED_STAGES = new Set([
  'Lost',
  'Canceled',
  'Cancelled',
  'Lost/Canceled',
]);

/** Active window: event date from 7 days ago through 60 days ahead. */
export const ACTIVE_WINDOW_PAST_DAYS = 7;
export const ACTIVE_WINDOW_FUTURE_DAYS = 60;
export const AT_RISK_DAYS_OUT = 14;
export const AT_RISK_PCT_THRESHOLD = 50;

/**
 * @param {unknown} dueRaw
 * @param {Date} [now]
 */
export function daysDeltaLabel(dueRaw, now = new Date()) {
  if (!dueRaw) return { text: 'No due date', kind: 'none', days: null };
  const due = new Date(/** @type {string|number|Date} */ (dueRaw));
  if (Number.isNaN(due.getTime())) {
    return { text: 'No due date', kind: 'none', days: null };
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days === 0) return { text: 'Due today', kind: 'today', days: 0 };
  if (days > 0) {
    return {
      text: `${days} day${days === 1 ? '' : 's'} remaining`,
      kind: 'future',
      days,
    };
  }
  const overdue = Math.abs(days);
  return {
    text: `${overdue} day${overdue === 1 ? '' : 's'} overdue`,
    kind: 'overdue',
    days,
  };
}

/**
 * @param {unknown} task
 */
export function taskAssigneeId(task) {
  if (!task || typeof task !== 'object') return null;
  const t = /** @type {Record<string, unknown>} */ (task);
  return t.assigned_user || t.assignedUser || null;
}

/**
 * @param {unknown} task
 */
export function taskDue(task) {
  if (!task || typeof task !== 'object') return null;
  const t = /** @type {Record<string, unknown>} */ (task);
  return t.due_date || t.dueDate || null;
}

/**
 * @param {Date} [now]
 */
function startOfDay(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * @param {unknown} eventDate
 * @param {Date} [now]
 * @returns {number|null}
 */
export function daysUntilEventDate(eventDate, now = new Date()) {
  if (!eventDate) return null;
  const event = new Date(/** @type {string|number|Date} */ (eventDate));
  if (Number.isNaN(event.getTime())) return null;
  const today = startOfDay(now);
  const e = startOfDay(event);
  return Math.round((e.getTime() - today.getTime()) / 86400000);
}

/**
 * @param {unknown} event
 */
export function isCanceledStage(event) {
  const e = event && typeof event === 'object' ? event : {};
  const stage = String(e.stage || '');
  return CANCELED_STAGES.has(stage);
}

/**
 * @param {unknown} event
 * @param {Date} [now]
 */
export function isInActiveWindow(event, now = new Date()) {
  if (isCanceledStage(event)) return false;
  const e = event && typeof event === 'object' ? event : {};
  const eventDate = e.event_date || e.eventDate;
  const days = daysUntilEventDate(eventDate, now);
  if (days == null) return false;
  return days >= -ACTIVE_WINDOW_PAST_DAYS && days <= ACTIVE_WINDOW_FUTURE_DAYS;
}

/**
 * @param {{ pct: number, milestones: Array<{ overdue?: boolean }>, eventDate?: unknown }} group
 * @param {Date} [now]
 */
export function isAtRiskEvent(group, now = new Date()) {
  if (group.milestones?.some((m) => m.overdue)) return true;
  const days = daysUntilEventDate(group.eventDate, now);
  if (days == null) return false;
  return (
    days >= 0 &&
    days <= AT_RISK_DAYS_OUT &&
    (group.pct ?? 0) < AT_RISK_PCT_THRESHOLD
  );
}

/**
 * @param {unknown[]} tasks
 * @returns {Map<string, unknown[]>}
 */
export function buildTasksByEvent(tasks) {
  const map = new Map();
  for (const task of tasks || []) {
    if (!task || typeof task !== 'object') continue;
    const t = /** @type {Record<string, unknown>} */ (task);
    if (t.category === 'Checklist') continue;
    const eid = /** @type {string|undefined} */ (t.event_id || t.eventId);
    if (!eid) continue;
    if (!map.has(eid)) map.set(eid, []);
    map.get(eid).push(task);
  }
  return map;
}

/**
 * @param {object} opts
 * @param {unknown[]} opts.events
 * @param {Map<string, unknown[]>} opts.tasksByEvent
 * @param {Record<string, { hasInventory?: boolean, attendeeCount?: number, stopCount?: number }>} opts.sideByEvent
 * @param {Date} [opts.now]
 * @param {boolean} [opts.activeWindowOnly]
 */
export function buildEventProgressGroups({
  events,
  tasksByEvent,
  sideByEvent = {},
  now = new Date(),
  activeWindowOnly = true,
}) {
  /** @type {Array<{
   *   eventId: string,
   *   event: unknown,
   *   eventName: string,
   *   eventDate: unknown,
   *   milestones: Array<{
   *     panelId: string,
   *     label: string,
   *     task: unknown,
   *     complete: boolean,
   *     assigneeId: unknown,
   *     dueRaw: unknown,
   *     due: ReturnType<typeof daysDeltaLabel>,
   *     overdue: boolean,
   *     dueToday: boolean,
   *   }>,
   *   done: number,
   *   total: number,
   *   pct: number,
   *   atRisk: boolean,
   * }>} */
  const rows = [];

  for (const event of events || []) {
    if (!event || typeof event !== 'object') continue;
    const e = /** @type {Record<string, unknown>} */ (event);
    if (activeWindowOnly && !isInActiveWindow(event, now)) continue;

    const eventId = String(e.id);
    const eventName = String(e.event_name || e.eventName || 'Unknown event');
    const eventDate = e.event_date || e.eventDate || null;
    const showFoodTour = isFoodTourExperience(
      /** @type {string} */ (e.event_type || e.eventType)
    );
    const eventTasks = tasksByEvent.get(eventId) || [];
    const flags = sideByEvent[eventId] || {
      hasInventory: false,
      attendeeCount: 0,
      stopCount: 0,
    };

    const milestones = OPS_PANEL_MILESTONES.filter(
      (m) => !m.foodTourOnly || showFoodTour
    ).map((m) => {
      const task = findOpsPanelTask(m.panelId, eventTasks);
      const complete = isOpsPanelComplete(m.panelId, event, flags);
      const dueRaw = taskDue(task);
      const assigneeId = taskAssigneeId(task);
      const due = daysDeltaLabel(dueRaw, now);
      const overdue =
        !complete &&
        Boolean(dueRaw) &&
        !Number.isNaN(new Date(/** @type {string|number|Date} */ (dueRaw)).getTime()) &&
        new Date(/** @type {string|number|Date} */ (dueRaw)) < now;
      const dueToday = !complete && due.kind === 'today';
      return {
        panelId: m.panelId,
        label: m.label,
        task,
        complete,
        assigneeId,
        dueRaw,
        due,
        overdue,
        dueToday,
      };
    });

    const done = milestones.filter((m) => m.complete).length;
    const total = milestones.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const group = {
      eventId,
      event,
      eventName,
      eventDate,
      milestones,
      done,
      total,
      pct,
      atRisk: false,
    };
    group.atRisk = isAtRiskEvent(group, now);
    rows.push(group);
  }

  return rows;
}

/**
 * @param {ReturnType<typeof buildEventProgressGroups>} groups
 */
export function computeKpis(groups) {
  let panelDone = 0;
  let panelTotal = 0;
  let overduePanels = 0;
  let dueToday = 0;
  let unassignedOpen = 0;
  let atRiskEvents = 0;

  for (const g of groups) {
    panelDone += g.done;
    panelTotal += g.total;
    if (g.atRisk) atRiskEvents += 1;
    for (const m of g.milestones) {
      if (m.overdue) overduePanels += 1;
      if (m.dueToday) dueToday += 1;
      if (!m.complete && !m.assigneeId) unassignedOpen += 1;
    }
  }

  return {
    eventsTracked: groups.length,
    panelsCompletePct: panelTotal
      ? Math.round((panelDone / panelTotal) * 100)
      : 0,
    panelDone,
    panelTotal,
    overduePanels,
    dueToday,
    unassignedOpen,
    atRiskEvents,
  };
}

/**
 * @param {ReturnType<typeof buildEventProgressGroups>} groups
 */
export function buildOverdueQueue(groups) {
  /** @type {Array<{
   *   eventId: string,
   *   eventName: string,
   *   panelId: string,
   *   label: string,
   *   assigneeId: unknown,
   *   dueRaw: unknown,
   *   daysOverdue: number,
   * }>} */
  const items = [];
  for (const g of groups) {
    for (const m of g.milestones) {
      if (!m.overdue) continue;
      const daysOverdue =
        m.due.days != null ? Math.abs(m.due.days) : 0;
      items.push({
        eventId: g.eventId,
        eventName: g.eventName,
        panelId: m.panelId,
        label: m.label,
        assigneeId: m.assigneeId,
        dueRaw: m.dueRaw,
        daysOverdue,
      });
    }
  }
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return items;
}

/**
 * @param {ReturnType<typeof buildEventProgressGroups>} groups
 * @param {(userId: unknown) => string|null} nameFor
 */
export function buildTeamStats(groups, nameFor) {
  /** @type {Map<string, { userId: string|null, name: string, assigned: number, done: number, open: number, overdue: number }>} */
  const map = new Map();

  const bump = (userId, patch) => {
    const key = userId ? String(userId) : '__unassigned__';
    if (!map.has(key)) {
      map.set(key, {
        userId: userId ? String(userId) : null,
        name: userId ? nameFor(userId) || String(userId).slice(0, 8) : 'Unassigned',
        assigned: 0,
        done: 0,
        open: 0,
        overdue: 0,
      });
    }
    const row = map.get(key);
    row.assigned += 1;
    if (patch.done) row.done += 1;
    if (patch.open) row.open += 1;
    if (patch.overdue) row.overdue += 1;
  };

  for (const g of groups) {
    for (const m of g.milestones) {
      bump(m.assigneeId, {
        done: m.complete,
        open: !m.complete,
        overdue: m.overdue,
      });
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      pct: row.assigned ? Math.round((row.done / row.assigned) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.open !== a.open) return b.open - a.open;
      return a.name.localeCompare(b.name);
    });
}

/**
 * @param {ReturnType<typeof buildEventProgressGroups>} groups
 */
export function buildPanelBottlenecks(groups) {
  /** @type {Map<string, { panelId: string, label: string, open: number, overdue: number, done: number, total: number }>} */
  const map = new Map();

  for (const def of OPS_PANEL_MILESTONES) {
    map.set(def.panelId, {
      panelId: def.panelId,
      label: def.label,
      open: 0,
      overdue: 0,
      done: 0,
      total: 0,
    });
  }

  for (const g of groups) {
    for (const m of g.milestones) {
      const row = map.get(m.panelId);
      if (!row) continue;
      row.total += 1;
      if (m.complete) row.done += 1;
      else row.open += 1;
      if (m.overdue) row.overdue += 1;
    }
  }

  return [...map.values()]
    .filter((r) => r.total > 0)
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      return b.open - a.open;
    });
}

/**
 * Filter event groups for the list section.
 * @param {ReturnType<typeof buildEventProgressGroups>} groups
 * @param {{
 *   search?: string,
 *   assigneeFilter?: string,
 *   statusFilter?: string,
 *   nameFor?: (id: unknown) => string|null,
 * }} filters
 */
export function filterEventGroups(groups, filters = {}) {
  const q = (filters.search || '').trim().toLowerCase();
  const assigneeFilter = filters.assigneeFilter || 'all';
  const statusFilter = filters.statusFilter || 'all';
  const nameFor = filters.nameFor || (() => null);

  const rows = [];
  for (const group of groups) {
    if (assigneeFilter !== 'all') {
      const hasAssignee = group.milestones.some(
        (m) => m.assigneeId === assigneeFilter
      );
      if (!hasAssignee) continue;
    }

    let visible = group.milestones;
    if (statusFilter === 'open') {
      visible = visible.filter((m) => !m.complete);
    } else if (statusFilter === 'done') {
      visible = visible.filter((m) => m.complete);
    } else if (statusFilter === 'overdue') {
      visible = visible.filter((m) => m.overdue);
    } else if (statusFilter === 'due_today') {
      visible = visible.filter((m) => m.dueToday);
    } else if (statusFilter === 'unassigned') {
      visible = visible.filter((m) => !m.complete && !m.assigneeId);
    } else if (statusFilter === 'at_risk') {
      if (!group.atRisk) continue;
      visible = group.milestones;
    }

    if (assigneeFilter !== 'all' && statusFilter !== 'all' && statusFilter !== 'at_risk') {
      visible = visible.filter((m) => m.assigneeId === assigneeFilter);
    }

    if (
      statusFilter !== 'all' &&
      statusFilter !== 'at_risk' &&
      visible.length === 0
    ) {
      continue;
    }

    if (q) {
      const hay = [
        group.eventName,
        ...group.milestones.map((m) => m.label),
        ...group.milestones.map((m) => nameFor(m.assigneeId)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    rows.push({
      ...group,
      milestones:
        statusFilter === 'all' || statusFilter === 'at_risk'
          ? group.milestones
          : visible,
    });
  }

  rows.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    const da = a.eventDate ? new Date(/** @type {string|number|Date} */ (a.eventDate)).getTime() : Infinity;
    const db = b.eventDate ? new Date(/** @type {string|number|Date} */ (b.eventDate)).getTime() : Infinity;
    return da - db;
  });

  return rows;
}

function isTaskDone(status) {
  return status === 'Done' || status === 'Completed';
}

/**
 * Workflow tasks (non-checklist) grouped by event in the active window.
 * @param {object} opts
 * @param {unknown[]} opts.events
 * @param {Map<string, unknown[]>} opts.tasksByEvent
 * @param {Date} [opts.now]
 * @param {boolean} [opts.activeWindowOnly]
 */
export function buildWorkflowTaskGroups({
  events,
  tasksByEvent,
  now = new Date(),
  activeWindowOnly = true,
}) {
  /** @type {Array<{
   *   eventId: string,
   *   eventName: string,
   *   eventDate: unknown,
   *   tasks: Array<{
   *     id: string,
   *     title: string,
   *     status: string,
   *     assigneeId: unknown,
   *     dueRaw: unknown,
   *     due: ReturnType<typeof daysDeltaLabel>,
   *     complete: boolean,
   *     overdue: boolean,
   *     dueToday: boolean,
   *   }>,
   *   done: number,
   *   total: number,
   *   pct: number,
   *   atRisk: boolean,
   * }>} */
  const rows = [];

  for (const event of events || []) {
    if (!event || typeof event !== 'object') continue;
    if (activeWindowOnly && !isInActiveWindow(event, now)) continue;
    const e = /** @type {Record<string, unknown>} */ (event);
    const eventId = String(e.id);
    const eventName = String(e.event_name || e.eventName || 'Unknown event');
    const eventDate = e.event_date || e.eventDate || null;
    const rawTasks = tasksByEvent.get(eventId) || [];

    const mapped = rawTasks.map((task) => {
      const t = /** @type {Record<string, unknown>} */ (task);
      const status = String(t.status || 'Open');
      const complete = isTaskDone(status);
      const dueRaw = taskDue(task);
      const due = daysDeltaLabel(dueRaw, now);
      const overdue =
        !complete &&
        Boolean(dueRaw) &&
        !Number.isNaN(
          new Date(/** @type {string|number|Date} */ (dueRaw)).getTime()
        ) &&
        new Date(/** @type {string|number|Date} */ (dueRaw)) < now;
      return {
        id: String(t.id),
        title: String(t.title || 'Untitled'),
        status,
        assigneeId: taskAssigneeId(task),
        dueRaw,
        due,
        complete,
        overdue,
        dueToday: !complete && due.kind === 'today',
      };
    });

    if (!mapped.length) continue;

    mapped.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const da = a.dueRaw
        ? new Date(/** @type {string|number|Date} */ (a.dueRaw)).getTime()
        : Infinity;
      const db = b.dueRaw
        ? new Date(/** @type {string|number|Date} */ (b.dueRaw)).getTime()
        : Infinity;
      return da - db;
    });

    const done = mapped.filter((t) => t.complete).length;
    const total = mapped.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const hasOverdue = mapped.some((t) => t.overdue);
    const days = daysUntilEventDate(eventDate, now);
    const atRisk =
      hasOverdue ||
      (days != null &&
        days >= 0 &&
        days <= AT_RISK_DAYS_OUT &&
        pct < AT_RISK_PCT_THRESHOLD);

    rows.push({
      eventId,
      eventName,
      eventDate,
      tasks: mapped,
      done,
      total,
      pct,
      atRisk,
    });
  }

  return rows;
}

/**
 * @param {ReturnType<typeof buildWorkflowTaskGroups>} groups
 */
export function computeWorkflowKpis(groups) {
  let taskDone = 0;
  let taskTotal = 0;
  let overdueTasks = 0;
  let dueToday = 0;
  let unassignedOpen = 0;
  let atRiskEvents = 0;

  for (const g of groups) {
    taskDone += g.done;
    taskTotal += g.total;
    if (g.atRisk) atRiskEvents += 1;
    for (const t of g.tasks) {
      if (t.overdue) overdueTasks += 1;
      if (t.dueToday) dueToday += 1;
      if (!t.complete && !t.assigneeId) unassignedOpen += 1;
    }
  }

  return {
    eventsTracked: groups.length,
    panelsCompletePct: taskTotal
      ? Math.round((taskDone / taskTotal) * 100)
      : 0,
    panelDone: taskDone,
    panelTotal: taskTotal,
    overduePanels: overdueTasks,
    dueToday,
    unassignedOpen,
    atRiskEvents,
  };
}

/**
 * @param {ReturnType<typeof buildWorkflowTaskGroups>} groups
 */
export function buildWorkflowOverdueQueue(groups) {
  /** @type {Array<{
   *   eventId: string,
   *   eventName: string,
   *   panelId: string,
   *   label: string,
   *   assigneeId: unknown,
   *   dueRaw: unknown,
   *   daysOverdue: number,
   * }>} */
  const items = [];
  for (const g of groups) {
    for (const t of g.tasks) {
      if (!t.overdue) continue;
      items.push({
        eventId: g.eventId,
        eventName: g.eventName,
        panelId: t.id,
        label: t.title,
        assigneeId: t.assigneeId,
        dueRaw: t.dueRaw,
        daysOverdue: t.due.days != null ? Math.abs(t.due.days) : 0,
      });
    }
  }
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return items;
}

/**
 * @param {ReturnType<typeof buildWorkflowTaskGroups>} groups
 * @param {(userId: unknown) => string|null} nameFor
 */
export function buildWorkflowTeamStats(groups, nameFor) {
  /** @type {Map<string, { userId: string|null, name: string, assigned: number, done: number, open: number, overdue: number }>} */
  const map = new Map();

  const bump = (userId, patch) => {
    const key = userId ? String(userId) : '__unassigned__';
    if (!map.has(key)) {
      map.set(key, {
        userId: userId ? String(userId) : null,
        name: userId
          ? nameFor(userId) || String(userId).slice(0, 8)
          : 'Unassigned',
        assigned: 0,
        done: 0,
        open: 0,
        overdue: 0,
      });
    }
    const row = map.get(key);
    row.assigned += 1;
    if (patch.done) row.done += 1;
    if (patch.open) row.open += 1;
    if (patch.overdue) row.overdue += 1;
  };

  for (const g of groups) {
    for (const t of g.tasks) {
      bump(t.assigneeId, {
        done: t.complete,
        open: !t.complete,
        overdue: t.overdue,
      });
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      pct: row.assigned ? Math.round((row.done / row.assigned) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.open !== a.open) return b.open - a.open;
      return a.name.localeCompare(b.name);
    });
}

/**
 * @param {ReturnType<typeof buildWorkflowTaskGroups>} groups
 * @param {{
 *   search?: string,
 *   assigneeFilter?: string,
 *   statusFilter?: string,
 *   nameFor?: (id: unknown) => string|null,
 * }} filters
 */
export function filterWorkflowTaskGroups(groups, filters = {}) {
  const q = (filters.search || '').trim().toLowerCase();
  const assigneeFilter = filters.assigneeFilter || 'all';
  const statusFilter = filters.statusFilter || 'all';
  const nameFor = filters.nameFor || (() => null);

  const rows = [];
  for (const group of groups) {
    if (assigneeFilter !== 'all') {
      const hasAssignee = group.tasks.some(
        (t) => t.assigneeId === assigneeFilter
      );
      if (!hasAssignee) continue;
    }

    let visible = group.tasks;
    if (statusFilter === 'open') {
      visible = visible.filter((t) => !t.complete);
    } else if (statusFilter === 'done') {
      visible = visible.filter((t) => t.complete);
    } else if (statusFilter === 'overdue') {
      visible = visible.filter((t) => t.overdue);
    } else if (statusFilter === 'due_today') {
      visible = visible.filter((t) => t.dueToday);
    } else if (statusFilter === 'unassigned') {
      visible = visible.filter((t) => !t.complete && !t.assigneeId);
    } else if (statusFilter === 'at_risk') {
      if (!group.atRisk) continue;
      visible = group.tasks;
    }

    if (
      assigneeFilter !== 'all' &&
      statusFilter !== 'all' &&
      statusFilter !== 'at_risk'
    ) {
      visible = visible.filter((t) => t.assigneeId === assigneeFilter);
    }

    if (
      statusFilter !== 'all' &&
      statusFilter !== 'at_risk' &&
      visible.length === 0
    ) {
      continue;
    }

    if (q) {
      const hay = [
        group.eventName,
        ...group.tasks.map((t) => t.title),
        ...group.tasks.map((t) => nameFor(t.assigneeId)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    rows.push({
      ...group,
      tasks:
        statusFilter === 'all' || statusFilter === 'at_risk'
          ? group.tasks
          : visible,
    });
  }

  rows.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    const da = a.eventDate
      ? new Date(/** @type {string|number|Date} */ (a.eventDate)).getTime()
      : Infinity;
    const db = b.eventDate
      ? new Date(/** @type {string|number|Date} */ (b.eventDate)).getTime()
      : Infinity;
    return da - db;
  });

  return rows;
}
