/** User-facing labels for workflow timeline family codes (A/B/C stay internal). */
export const TIMELINE_FAMILY_LABELS = {
  A: 'Cooking timeline',
  B: 'Standard timeline (3–2–1 weeks)',
  C: 'Condensed timeline (1 week)',
};

/**
 * @param {string | null | undefined} code
 * @returns {string | null}
 */
export function timelineFamilyLabel(code) {
  if (!code) return null;
  return TIMELINE_FAMILY_LABELS[code] || `Timeline ${code}`;
}
