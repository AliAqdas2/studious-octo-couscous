import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import CandidateStateMachine from '@/components/onboarding/CandidateStateMachine';
import CandidateNotes from '@/components/onboarding/CandidateNotes';
import CandidateStepList from '@/components/onboarding/CandidateStepList';
import ComingSoonWorkflow from '@/components/onboarding/ComingSoonWorkflow';
import { STAGE_COLORS, onboardingStrings } from '@/components/onboarding/strings';

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-24 bg-muted rounded" />
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}

export default function CandidateDetail() {
  const [params] = useSearchParams();
  const id = params.get('id') || new URLSearchParams(window.location.search).get('id');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['candidate', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: detail } = await base44.functions.invoke('getOnboardingCandidate', {
        id,
      });
      return detail;
    },
  });

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Missing candidate id.</p>
        <Button asChild variant="link" className="px-0">
          <Link to={createPageUrl('Recruitment')}>Back to Recruitment</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-destructive">
          {error?.message || 'Candidate not found'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={createPageUrl('Recruitment')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  const workflowReady = data.workflow_status === 'ready' && (data.steps?.length || 0) > 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={createPageUrl('Recruitment')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Recruitment
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <Badge className={STAGE_COLORS[data.stage] || ''} variant="outline">
            {data.stage}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.email}
          {data.phone ? ` · ${data.phone}` : ''}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-[#C84B31]/25 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C84B31]">
                {onboardingStrings.metaRole}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 break-words">
                {data.job_role}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C84B31]">
                {onboardingStrings.metaHireType}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 break-words">
                {data.hire_type}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C84B31]">
                {onboardingStrings.metaSource}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 break-words">
                {data.source}
                {data.source_detail ? (
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                    {data.source_detail}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {data.resume_url ? (
            <Button
              asChild
              className="shrink-0 h-auto min-h-10 sm:self-center bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md px-4"
            >
              <a href={data.resume_url} target="_blank" rel="noreferrer">
                {onboardingStrings.openResume}
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          ) : (
            <div className="shrink-0 sm:self-center rounded-lg border border-dashed border-orange-200 bg-white px-4 py-2.5 text-sm text-muted-foreground">
              {onboardingStrings.noResume}
            </div>
          )}
        </div>

        {data.decline_reason && (
          <Card>
            <CardContent className="py-3 text-sm">
              <span className="font-medium">{onboardingStrings.declineReason}: </span>
              {data.decline_reason}
            </CardContent>
          </Card>
        )}
      </div>

      <CandidateStateMachine candidate={data} />

      <CandidateNotes candidate={data} />

      {data.steps_backfilled && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {onboardingStrings.checklistBackfilled}
        </div>
      )}

      {workflowReady ? (
        <CandidateStepList steps={data.steps} candidateId={data.id} />
      ) : (
        <ComingSoonWorkflow jobRole={data.job_role} />
      )}

      {!data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}
    </div>
  );
}
