import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STAGE_COLORS } from './strings';
import {
  DEFAULT_BOARD_PHASE_IDS,
  PHASE_COLUMNS,
  groupCandidatesByPhase,
} from './phaseBoardConfig';

function CandidateCard({ candidate: c }) {
  const stage = c.stage || 'Application Received';
  return (
    <Link to={createPageUrl(`CandidateDetail?id=${c.id}`)} className="block">
      <Card className="hover:shadow-sm transition-shadow border-orange-100">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm font-medium truncate">{c.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1.5">
          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
          <Badge
            variant="outline"
            className={`text-[10px] font-normal ${STAGE_COLORS[stage] || ''}`}
          >
            {stage}
          </Badge>
          <p className="text-[11px] text-muted-foreground truncate">
            {c.job_role}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {c.hire_type} · {c.source}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CandidatePhaseBoard({
  candidates,
  showHired = false,
}) {
  const byPhase = groupCandidatesByPhase(candidates);
  const visible = PHASE_COLUMNS.filter(
    (p) => showHired || DEFAULT_BOARD_PHASE_IDS.includes(p.id)
  );

  return (
    <div
      className={`grid gap-3 pb-4 ${
        showHired
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {visible.map((phase) => {
        const items = byPhase[phase.id] || [];
        return (
          <div key={phase.id} className="min-w-0">
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#C84B31]">
                  {phase.title}
                </h3>
                <p className="text-[10px] text-muted-foreground truncate">
                  {phase.stages.join(' · ')}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {items.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[140px] rounded-lg bg-orange-50/40 border border-orange-100/80 p-2">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-2">
                  None
                </p>
              ) : (
                items.map((c) => <CandidateCard key={c.id} candidate={c} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
