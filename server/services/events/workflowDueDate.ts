import type { events } from "../../db/schema/events.js";

export type WorkflowPhase =
  | "upon_deposit"
  | "two_point_five_weeks"
  | "ros"
  | "three_weeks"
  | "two_weeks"
  | "one_week_before"
  | "staff_checkin_72_48h"
  | "twenty_four_h"
  | "during"
  | "post";

export type DueAnchor = "event_date" | "deposit_date" | "immediate";

export interface DueDateInputs {
  phase?: WorkflowPhase | null;
  dueAnchor?: DueAnchor | null;
  dueOffsetDays?: number | null;
  daysBefore?: number | null;
  daysAfter?: number | null;
  category?: string | null;
}

/**
 * Shared due-date math for workflow generation + reschedule (plan 03).
 * - immediate / deposit_date: offset from deposit/create
 * - event_date + post/during: add offset (or same day for during)
 * - event_date + pre phases: subtract offset (days before)
 */
export function computeWorkflowDueDate(
  def: DueDateInputs,
  event: Pick<
    typeof events.$inferSelect,
    "eventDate" | "depositReceivedAt" | "createdDate"
  >,
  fallback: "pre" | "day" | "post" = "pre"
): Date {
  const eventDate = new Date(event.eventDate);
  const depositDate =
    event.depositReceivedAt != null
      ? new Date(event.depositReceivedAt)
      : event.createdDate != null
        ? new Date(event.createdDate)
        : new Date();

  if (def.dueAnchor === "immediate") {
    const d = new Date(depositDate);
    d.setDate(d.getDate() + (def.dueOffsetDays ?? 0));
    return d;
  }
  if (def.dueAnchor === "deposit_date") {
    const d = new Date(depositDate);
    d.setDate(d.getDate() + (def.dueOffsetDays ?? 0));
    return d;
  }

  const phase = def.phase;
  if (phase === "post" || fallback === "post" || def.daysAfter != null) {
    const d = new Date(eventDate);
    d.setDate(d.getDate() + (def.dueOffsetDays ?? def.daysAfter ?? 0));
    return d;
  }
  if (phase === "during" || fallback === "day") {
    return eventDate;
  }

  const d = new Date(eventDate);
  const before = def.dueOffsetDays ?? def.daysBefore ?? 0;
  if (before >= 900) return depositDate;
  d.setDate(d.getDate() - before);
  return d;
}

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  upon_deposit: "Upon deposit",
  two_point_five_weeks: "~2.5 weeks before",
  ros: "Run of Show",
  three_weeks: "Three weeks before",
  two_weeks: "Two weeks before",
  one_week_before: "One week before",
  staff_checkin_72_48h: "Staff check-in (72–48h)",
  twenty_four_h: "24 hours before",
  during: "During event",
  post: "Post-event",
};

export const WORKFLOW_PHASE_ORDER: WorkflowPhase[] = [
  "upon_deposit",
  "two_point_five_weeks",
  "ros",
  "three_weeks",
  "two_weeks",
  "one_week_before",
  "staff_checkin_72_48h",
  "twenty_four_h",
  "during",
  "post",
];
