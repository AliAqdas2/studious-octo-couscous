import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EVENT_FILTER_STAGES,
  EVENT_PIPELINE_STAGES,
  EVENT_TERMINAL_STAGES,
  getEventStageColor,
  getEventStageMeta,
  getNextEventStages,
  normalizeEventStage,
} from '@/components/events/eventPipelineConfig';

/**
 * Named stage progression strip + optional manual advance / reopen.
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
  const isTerminal =
    EVENT_TERMINAL_STAGES.includes(current) || current === 'Completed';
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
          {canEdit && isTerminal ? (
            <p className="mt-2 text-xs text-amber-800">
              Reopen by choosing a stage below.
            </p>
          ) : null}
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

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2 max-w-sm">
          <div className="flex-1 min-w-[12rem] space-y-1">
            <Label className="text-xs text-gray-600">Change stage</Label>
            <Select
              value={current}
              disabled={pending}
              onValueChange={(value) => {
                if (value && value !== current) onStageChange?.(value);
              }}
            >
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Choose stage…" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_FILTER_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

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
