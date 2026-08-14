import React from 'react';
import { onboardingStrings } from './strings';

const PHASE_COPY = {
  'Shadow Training': {
    title: onboardingStrings.myOnboardingWhatsNextShadowTitle,
    body: onboardingStrings.myOnboardingWhatsNextShadow,
  },
  Evaluation: {
    title: onboardingStrings.myOnboardingWhatsNextEvalTitle,
    body: onboardingStrings.myOnboardingWhatsNextEval,
  },
};

export default function MyOnboardingWhatsNext({ focus }) {
  const { current, currentJourney } = focus;

  if (!current || !currentJourney) return null;

  const copy = PHASE_COPY[currentJourney.phase];
  if (!copy) return null;

  return (
    <section className="mo-section mo-fade-in">
      <h3 className="mo-section-title">{copy.title}</h3>
      <p className="mo-prose">{copy.body}</p>
      <p className="mo-footnote">{onboardingStrings.myOnboardingWaitingManager}</p>
    </section>
  );
}

export function MyOnboardingComingUp({ upcoming }) {
  if (!upcoming?.length) return null;

  return (
    <details className="mo-coming-up">
      <summary>{onboardingStrings.myOnboardingComingUp}</summary>
      <ul>
        {upcoming.map(({ journey }) => (
          <li key={journey.phase}>{journey.label}</li>
        ))}
      </ul>
    </details>
  );
}
