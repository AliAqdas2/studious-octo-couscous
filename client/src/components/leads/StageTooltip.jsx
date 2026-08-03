import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStageMeta, STATUS_COLORS } from './stageMetadata';

/**
 * Wraps children with a styled hover tooltip showing the stage's status + description.
 * Renders children unchanged if there's no metadata for the stage.
 */
export default function StageTooltip({ stage, children, side = 'top', align = 'center', asChild = true }) {
  const { description, status } = getStageMeta(stage);
  if (!description && !status) return <>{children}</>;

  const statusColor = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-300';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs bg-white text-gray-800 border border-orange-200 shadow-lg px-3 py-2 text-xs"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{stage}</span>
              {status && (
                <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${statusColor}`}>
                  {status}
                </span>
              )}
            </div>
            {description && <p className="text-gray-600 leading-snug">{description}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}