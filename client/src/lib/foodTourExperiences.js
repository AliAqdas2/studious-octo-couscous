/** Mirrors FOOD_TOUR_EXPERIENCE_KEYS in server/services/events/experienceMatrix.ts */
export const FOOD_TOUR_EXPERIENCE_KEYS = [
  'Group Food Tour',
  'Flavors of DC',
  'Italian Food Tour',
  'Georgetown Foodie Tour',
  'Private Food Tour',
  'Indoor Food Tour',
];

/** Legacy stored event_type values that still use the food-tour BEO. */
export const FOOD_TOUR_EXPERIENCE_ALIASES = [
  'In-Person Private Food Tour',
];

export function isFoodTourExperience(eventType) {
  if (!eventType) return false;
  const raw = String(eventType).trim();
  if (raw.toLowerCase() === 'flavors of dc') return true;
  return (
    FOOD_TOUR_EXPERIENCE_KEYS.includes(raw) ||
    FOOD_TOUR_EXPERIENCE_ALIASES.includes(raw)
  );
}
