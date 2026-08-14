import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { onboardingStrings } from './strings';

const ONBOARDING_PHASES = [
  'Paperwork',
  'Virtual Training',
  'Shadow Training',
  'Evaluation',
  'Active',
];

export default function MyOnboardingTimeline({ steps }) {
  if (!steps?.length) return null;

  const onboardingSteps = steps.filter((step) =>
    ONBOARDING_PHASES.some((phase) => step.phase === phase)
  );

  const byPhase = onboardingSteps.reduce((acc, step) => {
    const key = step.phase || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(step);
    return acc;
  }, {});

  const orderedPhases = ONBOARDING_PHASES.filter((p) => byPhase[p]?.length);

  return (
    <div className="space-y-5 pt-2">
      {orderedPhases.map((phase) => (
        <div key={phase} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {phase}
          </h3>
          <div className="space-y-2">
            {byPhase[phase].map((step) => {
              const done = step.status === 'done';
              return (
                <div key={step.id} className="flex items-start gap-2.5 py-1">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-[#C84B31] shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-stone-300 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800">{step.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {done
                        ? onboardingStrings.myOnboardingStepDone
                        : onboardingStrings.myOnboardingStepPending}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
