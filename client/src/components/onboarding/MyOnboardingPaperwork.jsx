import React from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { getPaperworkDocuments } from './paperworkDocuments';
import { onboardingStrings } from './strings';

const HR_EMAIL = 'info@mangiadc.com';

function mailtoHref(email, subject, body) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildDocEmail(doc, candidate) {
  const name = candidate?.name || 'New hire';
  const role = candidate?.job_role || 'Event Support Associate';
  const subject = `Mangia DC onboarding — ${doc.label}`;
  const body = [
    `Hi Mangia DC team,`,
    '',
    `I'm ${name} (${role}) and I'm working on my onboarding paperwork.`,
    '',
    `I'd like help with: ${doc.label}`,
    '',
    doc.detail ? `Notes: ${doc.detail}` : '',
    '',
    'Please let me know the next step.',
    '',
    'Thank you,',
    name,
  ]
    .filter(Boolean)
    .join('\n');
  return mailtoHref(HR_EMAIL, subject, body);
}

function buildNotifyHrEmail(candidate, documents) {
  const name = candidate?.name || 'New hire';
  const role = candidate?.job_role || 'Event Support Associate';
  const subject = `Mangia DC onboarding — paperwork complete (${name})`;
  const docList = documents.map((d) => `- ${d.label}`).join('\n');
  const body = [
    `Hi Mangia DC team,`,
    '',
    `I'm ${name} (${role}). I have completed all required onboarding paperwork:`,
    '',
    docList,
    '',
    'Please confirm receipt and let me know when I can proceed to training.',
    '',
    'Thank you,',
    name,
  ].join('\n');
  return mailtoHref(HR_EMAIL, subject, body);
}

export default function MyOnboardingPaperwork({
  step,
  candidate,
  isComplete,
}) {
  if (!step) return null;

  const documents = getPaperworkDocuments(step, candidate?.hire_type);

  if (isComplete) {
    return (
      <div className="mo-status-line mo-fade-in">
        <CheckCircle2 className="h-4 w-4 text-[#C84B31] shrink-0" />
        <span>
          <strong>{onboardingStrings.myOnboardingPaperworkComplete}</strong>
          {' — '}
          {onboardingStrings.myOnboardingPaperworkCompleteHint}
        </span>
      </div>
    );
  }

  return (
    <section className="mo-section mo-fade-in">
      <h3 className="mo-section-title">{onboardingStrings.myOnboardingPaperworkTitle}</h3>
      <p className="mo-section-hint">{onboardingStrings.myOnboardingPaperworkAction}</p>

      <ol className="mo-doc-list">
        {documents.map((doc, index) => (
          <li key={doc.slug || doc.label} className="mo-doc-row">
            <span className="mo-doc-num">{index + 1}</span>
            <div className="mo-doc-main">
              <p className="mo-doc-label">{doc.label}</p>
              {doc.detail ? <p className="mo-doc-detail">{doc.detail}</p> : null}
            </div>
            <div className="mo-doc-actions">
              <a className="mo-link-btn" href={buildDocEmail(doc, candidate)}>
                {onboardingStrings.myOnboardingEmailAboutDoc}
              </a>
              {doc.url ? (
                <a
                  className="mo-link-btn"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {onboardingStrings.myOnboardingOpenForm}
                  <ExternalLink className="inline h-3 w-3 ml-1" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {documents.length > 0 ? (
        <>
          <a
            className="mo-primary-cta"
            href={buildNotifyHrEmail(candidate, documents)}
          >
            {onboardingStrings.myOnboardingNotifyHr}
          </a>
          <p className="mo-footnote">{onboardingStrings.myOnboardingWaitingManager}</p>
        </>
      ) : null}
    </section>
  );
}
