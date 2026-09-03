/** Mirrors FOOD_TOUR_EXPERIENCE_KEYS in server/services/events/experienceMatrix.ts */
export const FOOD_TOUR_EXPERIENCE_KEYS = [
  'In-Person Private Food Tour',
  'Flavors of DC',
  'In-Person Private Monuments',
];

export function isFoodTourExperience(eventType) {
  if (!eventType) return false;
  return FOOD_TOUR_EXPERIENCE_KEYS.includes(String(eventType));
}
