import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  getOnboardingFocus,
  getPaperworkStep,
  getVideoStep,
} from '@/components/onboarding/onboardingFocus';
import MyOnboardingHero from '@/components/onboarding/MyOnboardingHero';
import MyOnboardingPaperwork from '@/components/onboarding/MyOnboardingPaperwork';
import MyOnboardingWhatsNext, {
  MyOnboardingComingUp,
} from '@/components/onboarding/MyOnboardingWhatsNext';
import MyOnboardingTimeline from '@/components/onboarding/MyOnboardingTimeline';
import TrainingVideoModule, {
  parseVideoProgress,
} from '@/components/onboarding/TrainingVideoModule';
import { onboardingStrings } from '@/components/onboarding/strings';
import '@/components/onboarding/myOnboarding.css';

export default function MyOnboarding() {
  const [checklistOpen, setChecklistOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-onboarding'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getMyOnboarding');
      return response?.data;
    },
  });

  const steps = data?.steps ?? [];
  const candidate = data?.candidate;

  const focus = useMemo(() => getOnboardingFocus(steps), [steps]);
  const paperworkStep = useMemo(() => getPaperworkStep(steps), [steps]);
  const videoStep = useMemo(() => getVideoStep(steps), [steps]);

  const paperworkComplete = paperworkStep?.status === 'done';
  const videoComplete = videoStep?.status === 'done';
  const paperworkIsFocus = focus.currentJourney?.phase === 'Paperwork';
  const trainingIsFocus = focus.currentJourney?.phase === 'Virtual Training';
  const laterPhaseFocus =
    focus.currentJourney?.phase === 'Shadow Training' ||
    focus.currentJourney?.phase === 'Evaluation';

  const activeVideoStep = videoStep && !videoComplete ? videoStep : null;

  const videoProgress = useMemo(
    () => parseVideoProgress(activeVideoStep?.notes),
    [activeVideoStep?.notes]
  );

  const trainingModules = (activeVideoStep?.resources ?? []).filter(
    (r) =>
      r.type === 'video' &&
      r.url?.startsWith('/videos/') &&
      ['fareharbor-beo', 'invoice-template', 'mangia-structure'].includes(r.slug)
  );

  const allVideosWatched =
    trainingModules.length > 0 &&
    trainingModules.every((m) => videoProgress[m.slug]?.watched);

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  if (isLoading) {
    return (
      <div className="mo-portal">
        <div className="mo-header">
          <div className="mo-header-inner">
            <div className="mo-topbar">
              <div className="mo-brand">Mangia</div>
            </div>
            <p className="mo-subtitle">{onboardingStrings.myOnboardingLoading}</p>
          </div>
        </div>
        <div className="mo-body">
          <div className="h-8 w-48 bg-stone-200/80 rounded animate-pulse mb-4" />
          <div className="h-40 w-full bg-stone-200/60 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    const msg =
      error?.body?.error ||
      error?.message ||
      onboardingStrings.myOnboardingError;

    return (
      <div className="mo-center">
        <div className="mo-error-box">
          <AlertCircle className="w-10 h-10 text-[#C84B31] mx-auto mb-3" />
          <p>{msg}</p>
          <button type="button" className="mo-ghost-btn" onClick={() => refetch()}>
            Try again
          </button>
          <div className="mt-3">
            <button type="button" className="mo-link-btn" onClick={handleLogout}>
              {onboardingStrings.onboardingWelcomeLogout}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const welcomeName = candidate?.name || 'there';

  return (
    <div className="mo-portal">
      <header className="mo-header">
        <div className="mo-header-inner">
          <div className="mo-topbar">
            <div className="mo-brand">Mangia</div>
            <div className="mo-topbar-meta">
              <button type="button" className="mo-logout" onClick={handleLogout}>
                {onboardingStrings.onboardingWelcomeLogout}
              </button>
            </div>
          </div>
          <MyOnboardingHero focus={focus} welcomeName={welcomeName} />
        </div>
      </header>

      <main className="mo-body">
        {paperworkComplete && !paperworkIsFocus ? (
          <MyOnboardingPaperwork
            step={paperworkStep}
            candidate={candidate}
            isComplete
          />
        ) : null}

        {paperworkIsFocus ? (
          <MyOnboardingPaperwork
            step={paperworkStep}
            candidate={candidate}
            isComplete={false}
          />
        ) : null}

        {trainingIsFocus ? (
          <section className="mo-section mo-fade-in">
            <h3 className="mo-section-title">
              {onboardingStrings.myOnboardingVirtualTraining}
            </h3>
            <p className="mo-section-hint">
              {onboardingStrings.myOnboardingVirtualTrainingHint}
            </p>
            {activeVideoStep ? (
              <>
                <TrainingVideoModule
                  step={activeVideoStep}
                  videoProgress={videoProgress}
                  onProgressUpdated={() => refetch()}
                />
                {allVideosWatched ? (
                  <p className="mo-banner">{onboardingStrings.myOnboardingAllVideosWatched}</p>
                ) : null}
                <p className="mo-footnote">{onboardingStrings.myOnboardingWaitingManager}</p>
              </>
            ) : null}
          </section>
        ) : null}

        {videoComplete && !trainingIsFocus && !laterPhaseFocus && !focus.allDone ? (
          <p className="mo-status-line">
            <strong>{onboardingStrings.myOnboardingVirtualTraining}</strong>
            {' — '}
            {onboardingStrings.myOnboardingAllVideosWatched}
          </p>
        ) : null}

        {laterPhaseFocus ? <MyOnboardingWhatsNext focus={focus} /> : null}

        {focus.allDone ? (
          <section className="mo-section mo-fade-in">
            <h3 className="mo-section-title">
              {onboardingStrings.myOnboardingAllStepsComplete}
            </h3>
            <p className="mo-prose">{onboardingStrings.myOnboardingAllStepsCompleteHint}</p>
          </section>
        ) : null}

        <MyOnboardingComingUp upcoming={focus.upcoming} />

        <div>
          <button
            type="button"
            className="mo-footer-toggle"
            onClick={() => setChecklistOpen((v) => !v)}
          >
            {checklistOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {onboardingStrings.myOnboardingSeeFullChecklist}
          </button>
          {checklistOpen ? (
            <div className="pb-2">
              <MyOnboardingTimeline steps={steps} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
