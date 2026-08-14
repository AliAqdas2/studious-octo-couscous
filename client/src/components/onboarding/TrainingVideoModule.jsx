import React, { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { getAccessToken } from '@/api/apiClient';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

const TRAINING_VIDEO_SLUGS = new Set([
  'fareharbor-beo',
  'invoice-template',
  'mangia-structure',
]);

function parseVideoProgress(notes) {
  if (!notes?.trim()) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed?.videoProgress ?? {};
  } catch {
    return {};
  }
}

function authVideoUrl(url) {
  const token = getAccessToken();
  if (!token || !url?.startsWith('/videos/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

function isTrainingModule(resource) {
  return (
    resource?.type === 'video' &&
    resource?.url?.startsWith('/videos/') &&
    resource?.slug &&
    TRAINING_VIDEO_SLUGS.has(resource.slug)
  );
}

export default function TrainingVideoModule({
  step,
  videoProgress,
  onProgressUpdated,
}) {
  const mutation = useMutation({
    mutationFn: async ({ slug, watched }) => {
      const response = await base44.functions.invoke('updateMyVideoProgress', {
        stepId: step.id,
        slug,
        watched,
      });
      return response?.data;
    },
    onSuccess: (data) => {
      onProgressUpdated?.(data);
    },
    onError: (e) => {
      toast.error(e?.body?.error || e?.message || 'Could not save progress');
    },
  });

  const modules = useMemo(
    () => (step?.resources ?? []).filter(isTrainingModule),
    [step?.resources]
  );

  const watchedCount = modules.filter((m) => videoProgress[m.slug]?.watched).length;

  const markWatched = (slug) => {
    if (videoProgress[slug]?.watched || mutation.isPending) return;
    mutation.mutate({ slug, watched: true });
  };

  if (!modules.length) return null;

  return (
    <div className="mo-video-list">
      <p className="mo-section-hint" style={{ marginBottom: 0 }}>
        {onboardingStrings.myOnboardingVideoProgress
          .replace('{watched}', String(watchedCount))
          .replace('{total}', String(modules.length))}
      </p>

      {modules.map((module) => {
        const watched = Boolean(videoProgress[module.slug]?.watched);
        const src = authVideoUrl(module.url);

        return (
          <div key={module.slug} className="mo-video-module">
            <div className="mo-video-head">
              <h4 className="mo-video-title">{module.label}</h4>
              {watched ? (
                <span className="mo-video-watched">
                  <Check className="h-3.5 w-3.5" />
                  {onboardingStrings.myOnboardingVideoWatched}
                </span>
              ) : null}
            </div>

            <video
              key={src}
              className="mo-video-player"
              controls
              preload="metadata"
              src={src}
              onEnded={() => markWatched(module.slug)}
            >
              <track kind="captions" />
            </video>

            {!watched ? (
              <button
                type="button"
                className="mo-ghost-btn"
                disabled={mutation.isPending}
                onClick={() => markWatched(module.slug)}
              >
                {mutation.isPending ? (
                  <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                ) : null}
                {onboardingStrings.myOnboardingMarkWatched}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export { parseVideoProgress, TRAINING_VIDEO_SLUGS };
