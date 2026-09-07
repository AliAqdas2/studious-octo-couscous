/**
 * Build assignee dropdown options from active RoleAssignment rows.
 * Dedupes by user_id; label is "Name — Role".
 */

/**
 * @typedef {{
 *   userId: string,
 *   label: string,
 *   role: string,
 *   name: string,
 * }} TeamMemberOption
 */

/**
 * @param {unknown[]} assignments
 * @returns {TeamMemberOption[]}
 */
export function buildTeamMemberOptions(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  /** @type {Map<string, TeamMemberOption>} */
  const byUser = new Map();

  for (const raw of list) {
    const row = raw && typeof raw === 'object' ? raw : {};
    const active = row.is_active ?? row.isActive;
    if (active === false) continue;
    const userId = row.user_id || row.userId;
    if (!userId) continue;
    const role = String(row.role || '').trim() || 'Team';
    const name = String(
      row.user_name ||
        row.userName ||
        row.contact_name ||
        row.contactName ||
        row.user_email ||
        row.userEmail ||
        'Team member'
    ).trim();
    const label = `${name} — ${role}`;
    const existing = byUser.get(userId);
    if (!existing) {
      byUser.set(userId, { userId, label, role, name });
      continue;
    }
    // Prefer keeping Marketing/Sales/Ops style roles over duplicate weaker labels
    if (!existing.role || existing.role === 'Team') {
      byUser.set(userId, { userId, label, role, name });
    }
  }

  return [...byUser.values()].sort((a, b) => {
    const roleCmp = a.role.localeCompare(b.role);
    if (roleCmp !== 0) return roleCmp;
    return a.name.localeCompare(b.name);
  });
}

/**
 * @param {number | null | undefined} minutes
 * @returns {string}
 */
export function formatEstimatedMinutes(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '0m';
  const m = Math.max(0, Math.floor(Number(minutes)));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export const DURATION_STEP_MINUTES = 15;

/**
 * Build Task.update payload when assigning a person from the dropdown.
 * @param {{
 *   task: Record<string, unknown>,
 *   nextUserId: string | null,
 *   actorUserId: string,
 * }} args
 */
export function buildAssignUpdate({ task, nextUserId, actorUserId }) {
  const now = new Date().toISOString();
  if (!nextUserId) {
    return {
      assigned_user: null,
      status: 'Not Acknowledged',
      acknowledged_timestamp: null,
      override_flag: false,
      override_timestamp: null,
      overridden_by: null,
      previous_assignee: task.assigned_user || null,
    };
  }

  const prev = task.assigned_user || null;
  if (prev && prev !== nextUserId) {
    return {
      previous_assignee: prev,
      assigned_user: nextUserId,
      status: task.status === 'Done' ? task.status : 'Working On It',
      override_flag: true,
      override_timestamp: now,
      overridden_by: actorUserId,
      acknowledged_timestamp: task.acknowledged_timestamp || now,
    };
  }

  return {
    assigned_user: nextUserId,
    status: task.status === 'Done' ? task.status : 'Working On It',
    acknowledged_timestamp: task.acknowledged_timestamp || now,
  };
}
