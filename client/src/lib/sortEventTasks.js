/**
 * Deterministic Event Detail task ordering (CRM-23):
 * overdue open → active open → completed (collapsed in UI).
 * Mine-first within open buckets; completion date desc within done.
 */

import { isMyAssignedTask } from '@/lib/taskMineHighlight';

/**
 * @param {unknown} task
 * @returns {task is Record<string, unknown>}
 */
function asTask(task) {
  return Boolean(task && typeof task === 'object');
}

/**
 * @param {unknown} task
 */
export function isTaskCompleted(task) {
  if (!asTask(task)) return false;
  const status = task.status;
  return status === 'Done' || status === 'Completed';
}

/**
 * @param {unknown} task
 * @returns {Date | null}
 */
export function getTaskDueDate(task) {
  if (!asTask(task)) return null;
  const raw = task.due_date ?? task.dueDate;
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(/** @type {string | number | Date} */ (raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {unknown} task
 * @returns {Date | null}
 */
export function getTaskCompletionDate(task) {
  if (!asTask(task)) return null;
  const raw =
    task.completion_timestamp ??
    task.completionTimestamp ??
    task.updated_date ??
    task.updatedDate;
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(/** @type {string | number | Date} */ (raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Open task with due date before start of local today.
 * @param {unknown} task
 * @param {Date} [now]
 */
export function isTaskOverdue(task, now = new Date()) {
  if (isTaskCompleted(task)) return false;
  const due = getTaskDueDate(task);
  if (!due) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return due < startOfToday;
}

/**
 * @param {unknown} task
 */
function taskOrder(task) {
  if (!asTask(task)) return 0;
  const o = task.order;
  return typeof o === 'number' && Number.isFinite(o) ? o : 0;
}

/**
 * @param {unknown} task
 */
function taskTitle(task) {
  if (!asTask(task)) return '';
  return String(task.title || '');
}

/**
 * Bucket: 0 overdue open, 1 active open, 2 completed.
 * @param {unknown} task
 * @param {Date} [now]
 */
function bucketRank(task, now = new Date()) {
  if (isTaskCompleted(task)) return 2;
  if (isTaskOverdue(task, now)) return 0;
  return 1;
}

/**
 * Sort event tasks for Event Detail lists.
 * @param {unknown[]} list
 * @param {string | null | undefined} userId
 * @param {{ now?: Date }} [options]
 * @returns {unknown[]}
 */
export function sortEventTasks(list, userId, options = {}) {
  const arr = Array.isArray(list) ? [...list] : [];
  const now = options.now instanceof Date ? options.now : new Date();

  return arr.sort((a, b) => {
    const bucketDiff = bucketRank(a, now) - bucketRank(b, now);
    if (bucketDiff !== 0) return bucketDiff;

    const completed = isTaskCompleted(a);
    if (completed) {
      const ca = getTaskCompletionDate(a)?.getTime() ?? 0;
      const cb = getTaskCompletionDate(b)?.getTime() ?? 0;
      if (cb !== ca) return cb - ca;
      return taskTitle(a).localeCompare(taskTitle(b));
    }

    const mineA = isMyAssignedTask(a, userId) ? 0 : 1;
    const mineB = isMyAssignedTask(b, userId) ? 0 : 1;
    if (mineA !== mineB) return mineA - mineB;

    const dueA = getTaskDueDate(a);
    const dueB = getTaskDueDate(b);
    if (dueA && dueB) {
      const dueDiff = dueA.getTime() - dueB.getTime();
      if (dueDiff !== 0) return dueDiff;
    } else if (dueA && !dueB) {
      return -1;
    } else if (!dueA && dueB) {
      return 1;
    }

    const orderDiff = taskOrder(a) - taskOrder(b);
    if (orderDiff !== 0) return orderDiff;

    return taskTitle(a).localeCompare(taskTitle(b));
  });
}

/**
 * Split a sorted (or unsorted) list into active vs completed.
 * @param {unknown[]} list
 * @returns {{ active: unknown[], completed: unknown[] }}
 */
export function partitionEventTasks(list) {
  const active = [];
  const completed = [];
  for (const task of Array.isArray(list) ? list : []) {
    if (isTaskCompleted(task)) completed.push(task);
    else active.push(task);
  }
  return { active, completed };
}
