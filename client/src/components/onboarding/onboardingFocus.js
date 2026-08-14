/** New-hire journey gates (Chart 2) — order matters. */
export const NEW_HIRE_JOURNEY = [
  {
    phase: 'Paperwork',
    stepTypes: ['checklist'],
    label: 'Paperwork',
    actionHint: 'Complete each document below, then email HR when finished.',
  },
  {
    phase: 'Virtual Training',
    stepTypes: ['video'],
    label: 'Training videos',
    actionHint: 'Watch all training modules below in order.',
  },
  {
    phase: 'Shadow Training',
    stepTypes: ['action'],
    label: 'Shadow shifts',
    actionHint: 'Your manager will schedule supervised event shifts with you.',
  },
  {
    phase: 'Evaluation',
    stepTypes: ['action', 'checklist'],
    label: 'Evaluation',
    actionHint: 'Your trainer and manager will review your readiness.',
  },
];

const JOURNEY_PHASES = NEW_HIRE_JOURNEY.map((j) => j.phase);

function findStepForJourney(steps, journeyItem) {
  return steps.find(
    (s) =>
      s.phase === journeyItem.phase &&
      (!journeyItem.stepTypes?.length ||
        journeyItem.stepTypes.includes(s.step_type))
  );
}

export function getOnboardingFocus(steps) {
  const onboardingSteps = (steps ?? []).filter((s) =>
    JOURNEY_PHASES.includes(s.phase)
  );

  const completed = [];
  const upcoming = [];
  let current = null;
  let currentJourney = null;

  for (const journeyItem of NEW_HIRE_JOURNEY) {
    const step = findStepForJourney(onboardingSteps, journeyItem);
    if (!step) continue;

    const done = step.status === 'done';
    const entry = { journey: journeyItem, step };

    if (!current && !done) {
      current = step;
      currentJourney = journeyItem;
    } else if (done) {
      completed.push(entry);
    } else if (current) {
      upcoming.push(entry);
    }
  }

  const totalSteps = NEW_HIRE_JOURNEY.filter((j) =>
    findStepForJourney(onboardingSteps, j)
  ).length;

  const completedCount = completed.length;
  const stepNumber = current ? completedCount + 1 : totalSteps;
  const allDone = !current && completedCount > 0;

  return {
    current,
    currentJourney,
    completed,
    upcoming,
    stepNumber,
    totalSteps,
    completedCount,
    allDone,
  };
}

export function getPaperworkStep(steps) {
  return steps?.find(
    (s) =>
      s.phase === 'Paperwork' ||
      /paperwork/i.test(s.title || '') ||
      /^9A\b/i.test(s.title || '')
  );
}

export function getVideoStep(steps) {
  return steps?.find(
    (s) => s.phase === 'Virtual Training' && s.step_type === 'video'
  );
}
