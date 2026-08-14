import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayoutGrid, List, BookOpen, Plus, Search, UserPlus } from 'lucide-react';
import CandidateFormDialog from '@/components/onboarding/CandidateFormDialog';
import CandidatePhaseBoard from '@/components/onboarding/CandidatePhaseBoard';
import CandidateListView from '@/components/onboarding/CandidateListView';
import HireSourcesPanel from '@/components/onboarding/HireSourcesPanel';
import { CLOSED_STAGES } from '@/components/onboarding/phaseBoardConfig';
import {
  HIRE_SOURCES,
  HIRE_TYPES,
  JOB_ROLES,
  onboardingStrings,
} from '@/components/onboarding/strings';

function SkeletonBoard() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

function tabClass(active) {
  return `h-8 gap-1.5 ${
    active
      ? 'bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white shadow-md hover:opacity-90 hover:text-white'
      : 'text-gray-700 hover:bg-orange-50 hover:text-[#C84B31]'
  }`;
}

export default function Recruitment() {
  const navigate = useNavigate();
  const [view, setView] = useState('board');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [hireTypeFilter, setHireTypeFilter] = useState('all');
  const [showHired, setShowHired] = useState(false);
  /** open | declined | withdrawn | closed */
  const [outcomeFilter, setOutcomeFilter] = useState('open');

  const candidatesQueryEnabled = view === 'board' || view === 'list';

  const { data: candidates = [], isLoading, isError, error } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => base44.entities.Candidate.list('-created_date', 500),
    enabled: candidatesQueryEnabled,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const stage = c.stage || 'Application Received';
      if (outcomeFilter === 'open' && CLOSED_STAGES.includes(stage)) return false;
      if (outcomeFilter === 'declined' && stage !== 'Declined') return false;
      if (outcomeFilter === 'withdrawn' && stage !== 'Withdrawn') return false;
      if (
        outcomeFilter === 'closed' &&
        stage !== 'Declined' &&
        stage !== 'Withdrawn'
      ) {
        return false;
      }
      // Hide Active unless "Show hired" (applies to board + list when in-pipeline)
      if (outcomeFilter === 'open' && !showHired && stage === 'Active') {
        return false;
      }
      if (roleFilter !== 'all' && c.job_role !== roleFilter) return false;
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
      if (hireTypeFilter !== 'all' && c.hire_type !== hireTypeFilter) return false;
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    });
  }, [
    candidates,
    search,
    roleFilter,
    sourceFilter,
    hireTypeFilter,
    outcomeFilter,
    showHired,
  ]);

  const showCandidateChrome = view === 'board' || view === 'list';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{onboardingStrings.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{onboardingStrings.pageSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-orange-100 bg-white p-0.5 shadow-sm">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={tabClass(view === 'board')}
              onClick={() => setView('board')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {onboardingStrings.tabPipeline}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={tabClass(view === 'list')}
              onClick={() => setView('list')}
            >
              <List className="h-3.5 w-3.5" />
              {onboardingStrings.tabList}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={tabClass(view === 'sources')}
              onClick={() => setView('sources')}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {onboardingStrings.tabHireSources}
            </Button>
          </div>
          {showCandidateChrome && (
            <Button
              onClick={() => setOpen(true)}
              className="shrink-0 h-9 bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
            >
              <Plus className="h-4 w-4 mr-1" />
              {onboardingStrings.newCandidate}
            </Button>
          )}
        </div>
      </div>

      {view === 'sources' ? (
        <HireSourcesPanel />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={onboardingStrings.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={onboardingStrings.filtersRole} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{onboardingStrings.filtersAll} roles</SelectItem>
                {JOB_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={onboardingStrings.filtersSource} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{onboardingStrings.filtersAll} sources</SelectItem>
                {HIRE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hireTypeFilter} onValueChange={setHireTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={onboardingStrings.filtersHireType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{onboardingStrings.filtersAll} types</SelectItem>
                {HIRE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={onboardingStrings.outcomeFilter} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{onboardingStrings.outcomeOpen}</SelectItem>
                <SelectItem value="declined">{onboardingStrings.outcomeDeclined}</SelectItem>
                <SelectItem value="withdrawn">{onboardingStrings.outcomeWithdrawn}</SelectItem>
                <SelectItem value="closed">{onboardingStrings.outcomeClosed}</SelectItem>
              </SelectContent>
            </Select>
            {outcomeFilter === 'open' && (
              <label className="flex items-center gap-2 text-sm whitespace-nowrap px-1">
                <Checkbox
                  checked={showHired}
                  onCheckedChange={(v) => setShowHired(!!v)}
                />
                <Label className="font-normal cursor-pointer">
                  {onboardingStrings.showHired}
                </Label>
              </label>
            )}
          </div>

          {isLoading && <SkeletonBoard />}
          {isError && (
            <Card>
              <CardContent className="py-8 text-sm text-destructive">
                Failed to load candidates: {error?.message || 'Unknown error'}
              </CardContent>
            </Card>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <UserPlus className="h-10 w-10 mx-auto text-muted-foreground" />
                <h2 className="font-medium">{onboardingStrings.emptyTitle}</h2>
                <p className="text-sm text-muted-foreground">{onboardingStrings.emptyBody}</p>
                <Button
                  onClick={() => setOpen(true)}
                  className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
                >
                  {onboardingStrings.newCandidate}
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoading &&
            !isError &&
            filtered.length > 0 &&
            view === 'board' &&
            outcomeFilter === 'open' && (
              <CandidatePhaseBoard
                candidates={filtered}
                showHired={showHired}
              />
            )}

          {!isLoading &&
            !isError &&
            filtered.length > 0 &&
            (view === 'list' || outcomeFilter !== 'open') && (
              <CandidateListView candidates={filtered} />
            )}
        </>
      )}

      <CandidateFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(data) => {
          if (data?.id) {
            navigate(createPageUrl(`CandidateDetail?id=${data.id}`));
          }
        }}
      />
    </div>
  );
}
