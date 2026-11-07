/** Canonical event pipeline stages (plan 01 / CRM-01). */
export const EVENT_PIPELINE_STAGES = [
  'Deposit Received',
  'Planning',
  'Run Of Show Scheduled',
  'Pre-Event Ready',
  'In Progress',
  'Post-Event',
  'Completed',
];

/** Terminal / exit stages shown in filters but not on the main strip. */
export const EVENT_TERMINAL_STAGES = ['Lost', 'Canceled'];

/** All stages used for list filters (canonical + terminal). */
export const EVENT_FILTER_STAGES = [
  ...EVENT_PIPELINE_STAGES,
  ...EVENT_TERMINAL_STAGES,
];

export const EVENT_STAGE_COLORS = {
  'Deposit Received': 'bg-blue-100 text-blue-800 border-blue-200',
  Planning: 'bg-purple-100 text-purple-800 border-purple-200',
  'Run Of Show Scheduled': 'bg-violet-100 text-violet-800 border-violet-200',
  'Pre-Event Ready': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'In Progress': 'bg-red-100 text-red-800 border-red-200',
  'Post-Event': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Lost: 'bg-slate-100 text-slate-800 border-slate-200',
  Canceled: 'bg-gray-100 text-gray-800 border-gray-200',
};

/** Badge colors without border (Dashboard pills). */
export const EVENT_STAGE_COLORS_SOFT = {
  'Deposit Received': 'bg-blue-100 text-blue-800',
  Planning: 'bg-purple-100 text-purple-800',
  'Run Of Show Scheduled': 'bg-violet-100 text-violet-800',
  'Pre-Event Ready': 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-red-100 text-red-800',
  'Post-Event': 'bg-indigo-100 text-indigo-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Lost: 'bg-slate-100 text-slate-800',
  Canceled: 'bg-gray-100 text-gray-800',
};

const LEGACY_STAGE_MAP = {
  'Pre-Event Planning': 'Planning',
  'Inventory Ordering': 'Planning',
  'Staff Confirmed': 'Run Of Show Scheduled',
  '72hr Final Check': 'Pre-Event Ready',
  'Event Day': 'In Progress',
  'Post-Event Processing': 'Post-Event',
  Cancelled: 'Canceled',
};

/** Map legacy / raw DB stage → canonical label for display & filtering. */
export function normalizeEventStage(stage) {
  if (!stage) return 'Deposit Received';
  if (LEGACY_STAGE_MAP[stage]) return LEGACY_STAGE_MAP[stage];
  return stage;
}

export function getEventStageColor(stage, soft = false) {
  const canonical = normalizeEventStage(stage);
  const map = soft ? EVENT_STAGE_COLORS_SOFT : EVENT_STAGE_COLORS;
  return map[canonical] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Workflow phases belonging to each pipeline stage.
 * Pre-Event Ready is a gate: remaining incomplete pre-event work.
 */
export const PHASES_BY_STAGE = {
  'Deposit Received': ['upon_deposit'],
  Planning: ['two_point_five_weeks', 'three_weeks', 'two_weeks', 'ros'],
  'Run Of Show Scheduled': [
    'one_week_before',
    'staff_checkin_72_48h',
    'twenty_four_h',
  ],
  'Pre-Event Ready': [
    'upon_deposit',
    'two_point_five_weeks',
    'three_weeks',
    'two_weeks',
    'ros',
    'one_week_before',
    'staff_checkin_72_48h',
    'twenty_four_h',
  ],
  'In Progress': ['during'],
  'Post-Event': ['post'],
  Completed: [],
  Lost: [],
  Canceled: [],
};

const PRE_EVENT_PHASES = new Set([
  'upon_deposit',
  'two_point_five_weeks',
  'three_weeks',
  'two_weeks',
  'ros',
  'one_week_before',
  'staff_checkin_72_48h',
  'twenty_four_h',
]);

export function getPhasesForStage(stage) {
  const canonical = normalizeEventStage(stage);
  return PHASES_BY_STAGE[canonical] || [];
}

export function isPreEventPhase(phase) {
  return PRE_EVENT_PHASES.has(phase);
}

export const EVENT_STAGE_TRANSITIONS = {
  'Deposit Received': ['Planning', 'Lost', 'Canceled'],
  Planning: ['Run Of Show Scheduled', 'Pre-Event Ready', 'Lost', 'Canceled'],
  'Run Of Show Scheduled': ['Pre-Event Ready', 'In Progress', 'Lost', 'Canceled'],
  'Pre-Event Ready': ['In Progress', 'Lost', 'Canceled'],
  'In Progress': ['Post-Event', 'Completed', 'Lost', 'Canceled'],
  'Post-Event': ['Completed', 'Lost', 'Canceled'],
  Completed: [],
  Lost: [],
  Canceled: [],
};

export function getNextEventStages(stage) {
  const canonical = normalizeEventStage(stage);
  return EVENT_STAGE_TRANSITIONS[canonical] || [];
}

export const EVENT_STAGE_META = {
  'Deposit Received': 'Deposit in; intake and upon-deposit workflow.',
  Planning: 'Planning window — ROS prep and mid-timeline tasks.',
  'Run Of Show Scheduled': 'ROS locked; week-of and 72h/24h checks.',
  'Pre-Event Ready': 'Pre-event work complete or nearly complete; ready for event day.',
  'In Progress': 'Event day — during-event tasks.',
  'Post-Event': 'Wrap-up, surveys, and follow-ups.',
  Completed: 'Event closed.',
  Lost: 'Event lost.',
  Canceled: 'Event canceled.',
};

export function getEventStageMeta(stage) {
  const canonical = normalizeEventStage(stage);
  return EVENT_STAGE_META[canonical] || '';
}

/** True if stage is terminal (exclude from default active list). */
export function isTerminalEventStage(stage) {
  const canonical = normalizeEventStage(stage);
  return (
    canonical === 'Completed' ||
    canonical === 'Lost' ||
    canonical === 'Canceled'
  );
}

/**
 * Filter tasks for the current stage.
 * Pre-Event Ready: incomplete pre-event workflow tasks only.
 */
export function filterTasksForStage(tasks, stage) {
  const canonical = normalizeEventStage(stage);
  const list = Array.isArray(tasks) ? tasks : [];

  if (canonical === 'Completed' || canonical === 'Lost' || canonical === 'Canceled') {
    return [];
  }

  if (canonical === 'Pre-Event Ready') {
    return list.filter((t) => {
      if (t.category === 'Checklist') return false;
      const phase = t.workflow_phase || t.workflowPhase;
      if (!phase || !isPreEventPhase(phase)) return false;
      return t.status !== 'Done' && t.status !== 'Completed';
    });
  }

  const phases = new Set(getPhasesForStage(canonical));
  return list.filter((t) => {
    if (t.category === 'Checklist') return false;
    const phase = t.workflow_phase || t.workflowPhase;
    return phase && phases.has(phase);
  });
}
