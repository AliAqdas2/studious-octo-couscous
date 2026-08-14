import React from 'react';
import { NEW_HIRE_JOURNEY } from './onboardingFocus';
import { onboardingStrings } from './strings';

export default function MyOnboardingHero({ focus, welcomeName }) {
  const {
    current,
    currentJourney,
    stepNumber,
    totalSteps,
    completedCount,
    allDone,
    completed,
  } = focus;

  const completedPhases = new Set(completed.map((c) => c.journey.phase));
  const currentPhase = currentJourney?.phase;

  const stepTitle = allDone
    ? onboardingStrings.myOnboardingAllStepsComplete
    : currentJourney
      ? onboardingStrings.myOnboardingStepOf
          .replace('{current}', String(stepNumber))
          .replace('{total}', String(totalSteps || NEW_HIRE_JOURNEY.length))
          .replace('{label}', currentJourney.label)
      : onboardingStrings.myOnboardingLoadingSteps;

  const subtitle = allDone
    ? onboardingStrings.myOnboardingAllStepsCompleteHint
    : currentJourney?.actionHint || '';

  return (
    <div className="mo-fade-in">
      <p className="mo-kicker">
        {onboardingStrings.myOnboardingWelcome.replace('{name}', welcomeName)}
      </p>
      <h2 className="mo-title">{stepTitle}</h2>
      {subtitle ? <p className="mo-subtitle">{subtitle}</p> : null}

      <div className="mo-steps" aria-label={onboardingStrings.myOnboardingProgress
        .replace('{done}', String(completedCount))
        .replace('{total}', String(totalSteps || NEW_HIRE_JOURNEY.length))}>
        {NEW_HIRE_JOURNEY.map((journey, index) => {
          const done = completedPhases.has(journey.phase);
          const isCurrent = journey.phase === currentPhase;
          const className = [
            'mo-step-dot',
            done ? 'is-done' : '',
            isCurrent ? 'is-current' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <React.Fragment key={journey.phase}>
              {index > 0 ? <span className="mo-step-line" aria-hidden /> : null}
              <span
                className={className}
                title={journey.label}
                aria-label={`${journey.label}${done ? ' complete' : isCurrent ? ' current' : ''}`}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
