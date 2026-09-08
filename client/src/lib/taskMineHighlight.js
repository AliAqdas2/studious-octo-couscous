/**
 * Helpers for “Yours” task highlighting / full-list viewers (admin & Ops).
 */

/**
 * @param {{ role?: string } | null | undefined} user
 * @param {Array<{ role?: string }> | null | undefined} roleAssignments
 */
export function isFullEventTaskViewer(user, roleAssignments) {
  if (user?.role === 'admin') return true;
  const roles = Array.isArray(roleAssignments) ? roleAssignments : [];
  return roles.some((r) =>
    ['Ops', 'Ops Manager', 'Admin'].includes(String(r?.role || ''))
  );
}

/**
 * @param {unknown} task
 * @param {string | null | undefined} userId
 */
export function isMyAssignedTask(task, userId) {
  if (!userId || !task || typeof task !== 'object') return false;
  const t = /** @type {Record<string, unknown>} */ (task);
  return t.assigned_user === userId || t.assignedUser === userId;
}

/**
 * Sort: my open tasks first, then my done, then others (stable by existing order).
 * @param {unknown[]} list
 * @param {string | null | undefined} userId
 * @returns {unknown[]}
 */
export function sortTasksMineFirst(list, userId) {
  const arr = Array.isArray(list) ? [...list] : [];
  if (!userId) return arr;
  const rank = (task) => {
    const mine = isMyAssignedTask(task, userId);
    const done =
      task &&
      typeof task === 'object' &&
      (/** @type {Record<string, unknown>} */ (task).status === 'Done' ||
        /** @type {Record<string, unknown>} */ (task).status === 'Completed');
    if (mine && !done) return 0;
    if (mine) return 1;
    return 2;
  };
  return arr.sort((a, b) => rank(a) - rank(b));
}
