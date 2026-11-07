import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EVENT_PIPELINE_STAGES,
  EVENT_TERMINAL_STAGES,
  getEventStageColor,
  getEventStageMeta,
  getNextEventStages,
  normalizeEventStage,
} from '@/components/events/eventPipelineConfig';

/**
 * Named stage progression strip + optional manual advance.
 *
 * @param {{
 *   stage: string,
 *   canEdit?: boolean,
 *   onStageChange?: (next: string) => void,
 *   pending?: boolean,
 * }} props
 */
export default function EventStagePipeline({
  stage,
  canEdit = false,
  onStageChange,
  pending = false,
}) {
  const current = normalizeEventStage(stage);
  const isTerminal = EVENT_TERMINAL_STAGES.includes(current) || current === 'Completed';
  const nextStages = getNextEventStages(current);
  const currentIndex = EVENT_PIPELINE_STAGES.indexOf(current);

  return (
    <div className="space-y-3 rounded-xl border border-orange-100 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Operations / Execution Stage
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              className={`${getEventStageColor(current)} border font-semibold`}
            >
              {current}
            </Badge>
            {getEventStageMeta(current) ? (
              <span className="text-sm text-gray-600">
                {getEventStageMeta(current)}
              </span>
            ) : null}
          </div>
        </div>
        {canEdit && nextStages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {nextStages.map((next) => (
              <Button
                key={next}
                size="sm"
                variant={
                  next === 'Lost' || next === 'Canceled' ? 'outline' : 'default'
                }
                disabled={pending}
                className={
                  next === 'Lost' || next === 'Canceled'
                    ? 'border-gray-300 text-gray-700'
                    : 'bg-[#C84B31] hover:bg-[#A03A23]'
                }
                onClick={() => onStageChange?.(next)}
              >
                → {next}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {!isTerminal ? (
        <div className="flex flex-wrap gap-1.5">
          {EVENT_PIPELINE_STAGES.map((s, i) => {
            const done = currentIndex >= 0 && i < currentIndex;
            const active = s === current;
            return (
              <div
                key={s}
                title={getEventStageMeta(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                  active
                    ? `${getEventStageColor(s)} ring-2 ring-[#C84B31]/40`
                    : done
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {s}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
