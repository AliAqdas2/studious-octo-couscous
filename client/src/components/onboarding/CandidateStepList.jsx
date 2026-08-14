import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

const TRAINING_SLUGS = ['fareharbor-beo', 'invoice-template', 'mangia-structure'];

function parseVideoProgress(notes) {
  if (!notes?.trim()) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed?.videoProgress ?? {};
  } catch {
    return {};
  }
}

function getTrainingVideoCount(step) {
  const resources = step.resources ?? [];
  const modules = resources.filter(
    (r) =>
      r.type === 'video' &&
      r.url?.startsWith('/videos/') &&
      TRAINING_SLUGS.includes(r.slug)
  );
  if (modules.length === 0) return null;
  const progress = parseVideoProgress(step.notes);
  const watched = modules.filter((m) => progress[m.slug]?.watched).length;
  return { watched, total: modules.length };
}

function VideoProgressSummary({ step }) {
  if (step.step_type !== 'video') return null;
  const stats = getTrainingVideoCount(step);
  if (!stats || stats.watched === 0) return null;

  return (
    <p className="text-xs text-[#C84B31] mt-1">
      {onboardingStrings.myOnboardingManagerVideoProgress
        .replace('{watched}', String(stats.watched))
        .replace('{total}', String(stats.total))}
    </p>
  );
}

function ResourceList({ resources }) {
  if (!Array.isArray(resources) || resources.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {resources.map((r, i) => (
        <li key={`${r.label}-${i}`} className="text-sm">
          {r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              {r.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-medium">{r.label}</span>
          )}
          {r.detail && (
            <p className="text-muted-foreground text-xs mt-0.5">{r.detail}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function StepRow({ step, candidateId }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const done = step.status === 'done';

  const mutation = useMutation({
    mutationFn: async (status) => {
      await base44.entities.CandidateStep.update(step.id, {
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      toast.success('Step updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update step'),
  });

  return (
    <div className={`border rounded-md ${done ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white'}`}>
      <button
        type="button"
        className="w-full flex items-start gap-2 p-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{step.title}</span>
            {step.is_gate && (
              <Badge variant="outline" className="text-[10px]">
                Gate
              </Badge>
            )}
            {step.owner_role && (
              <Badge variant="secondary" className="text-[10px]">
                {step.owner_role}
              </Badge>
            )}
            {done && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{step.phase}</p>
          <VideoProgressSummary step={step} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pl-9 border-t">
          {step.instructions && (
            <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">
              {step.instructions}
            </p>
          )}
          <ResourceList resources={step.resources} />
          <div className="mt-3 flex gap-2">
            {!done ? (
              <Button
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate('done')}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
              >
                {onboardingStrings.markStepDone}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate('pending')}
              >
                {onboardingStrings.markStepPending}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CandidateStepList({ steps, candidateId }) {
  if (!steps?.length) return null;

  const byPhase = steps.reduce((acc, step) => {
    const key = step.phase || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(step);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{onboardingStrings.workflowChecklist}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(byPhase).map(([phase, phaseSteps]) => (
          <div key={phase} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {phase}
            </h3>
            <div className="space-y-2">
              {phaseSteps.map((step) => (
                <StepRow key={step.id} step={step} candidateId={candidateId} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
