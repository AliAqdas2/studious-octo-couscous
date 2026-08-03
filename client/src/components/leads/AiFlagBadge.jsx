import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Small warning indicator shown next to leads that AI flagged as
 * non-customer-inquiries (job applications, unrelated outreach, etc.).
 * Hover reveals the category + reason. Leads with no flag render nothing.
 */
export default function AiFlagBadge({ category, reason }) {
  if (!category) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 cursor-help flex-shrink-0"
            aria-label={`AI flag: ${category}`}
          >
            <AlertTriangle className="w-3 h-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-gray-900 text-white border border-gray-700 shadow-lg opacity-100">
          <p className="font-semibold text-xs mb-0.5">{category}</p>
          {reason && <p className="text-xs text-gray-200">{reason}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}