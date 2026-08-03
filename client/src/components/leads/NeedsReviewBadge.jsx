import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Compact visual indicator for leads that were auto-imported (e.g. via the
 * website contact form) and have not yet been reviewed by a human.
 *
 * Renders as a small pulsing amber dot. Hover to see the explanation.
 */
export default function NeedsReviewBadge() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="relative inline-flex items-center justify-center cursor-help shrink-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Needs review"
          >
            <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-slate-900 text-white border-slate-900 shadow-lg">
          <p className="text-xs font-semibold mb-1">Needs review · Auto-added lead</p>
          <p className="text-xs text-slate-200 leading-relaxed">
            This lead was created automatically from the website contact form.
            Open it to review the parsed details — opening the lead will mark it as reviewed.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}