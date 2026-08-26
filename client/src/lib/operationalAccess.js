/**
 * Operational-role based nav + page allowlists.
 * System admin (user.role === 'admin') always has full access.
 */

/** Pages Ops (Operations) may open. */
export const OPS_ALLOWED_PAGES = [
  'Events',
  'EventDetail',
  'CalendarView',
  'Settings',
];

export const OPS_HOME_PATH = '/Events';

export function isSystemAdmin(user) {
  return user?.role === 'admin';
}

export function isOpsRole(assignment) {
  return (
    assignment?.role === 'Ops' &&
    assignment?.is_active !== false
  );
}

/**
 * Whether the current page is allowed for this user + assignment.
 * System admins: always true.
 * Ops: OPS_ALLOWED_PAGES only.
 * Others: unrestricted by this helper (Layout keeps sparse nav).
 */
export function isPageAllowed(pageName, user, assignment) {
  if (!pageName) return true;
  if (isSystemAdmin(user)) return true;
  if (isOpsRole(assignment)) {
    return OPS_ALLOWED_PAGES.includes(pageName);
  }
  return true;
}

/**
 * @returns {'admin' | 'ops' | 'default'}
 */
export function getNavProfile(user, assignment) {
  if (isSystemAdmin(user)) return 'admin';
  if (isOpsRole(assignment)) return 'ops';
  return 'default';
}

/** Ops may manage house venues + inventory catalog in Settings. */
export function canAccessOpsSettings(user, assignment) {
  return isSystemAdmin(user) || isOpsRole(assignment);
}
