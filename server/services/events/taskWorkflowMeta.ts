/** Structured extras on workflow tasks (plan 03). */
export interface TaskWorkflowMeta {
  /** C038–C040 staff availability */
  staffStatus?: "contacted" | "awaiting" | "confirmed" | "escalated" | null;
  reachedOutBy?: string | null;
  /** C092 remaining supplies */
  supplyPickupMethod?: "in_person" | "curbside" | "rush_shipping" | null;
  /** C094 ice */
  iceAcquired?: boolean | null;
  /** 24h assignee hint */
  assigneeHint?: "Ops Manager" | "Intern" | null;
}

export const STAFF_STATUS_OPTIONS = [
  "contacted",
  "awaiting",
  "confirmed",
  "escalated",
] as const;

export const SUPPLY_PICKUP_OPTIONS = [
  { value: "in_person", label: "In-person shopping" },
  { value: "curbside", label: "Curbside delivery" },
  { value: "rush_shipping", label: "Rush shipping" },
] as const;
