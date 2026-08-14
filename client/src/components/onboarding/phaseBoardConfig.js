/** Phase board columns — groups Chart 1 stages without changing stage strings. */

export const PHASE_COLUMNS = [
  {
    id: "applications",
    title: "Applications",
    stages: ["Application Received", "Under Review"],
  },
  {
    id: "interview",
    title: "Interview",
    stages: ["Interview Scheduled", "Interview Complete"],
  },
  {
    id: "decision",
    title: "Decision",
    stages: ["Pending Dave Approval", "Offer Extended", "Offer Accepted"],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    stages: ["Onboarding"],
  },
  {
    id: "hired",
    title: "Hired",
    stages: ["Active"],
  },
];

/** In-flight phases shown by default (Hired is opt-in). */
export const DEFAULT_BOARD_PHASE_IDS = PHASE_COLUMNS.filter(
  (p) => p.id !== "hired"
).map((p) => p.id);

export const CLOSED_STAGES = ["Declined", "Withdrawn"];

export function phaseForStage(stage) {
  const s = stage || "Application Received";
  return PHASE_COLUMNS.find((p) => p.stages.includes(s)) ?? null;
}

export function stagesInPhase(phaseId) {
  return PHASE_COLUMNS.find((p) => p.id === phaseId)?.stages ?? [];
}

export function groupCandidatesByPhase(candidates) {
  const map = Object.fromEntries(PHASE_COLUMNS.map((p) => [p.id, []]));
  for (const c of candidates) {
    const phase = phaseForStage(c.stage);
    if (phase) {
      map[phase.id].push(c);
    }
  }
  return map;
}
