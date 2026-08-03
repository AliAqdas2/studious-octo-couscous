import React from 'react';
import { Info } from 'lucide-react';
import { getStageMeta, STATUS_COLORS } from './stageMetadata';

export default function StageInfoBanner({ stage }) {
  const { description, status } = getStageMeta(stage);
  if (!description && !status) return null;

  const statusColor = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-300';

  return (
    <div className="flex items-start gap-3 bg-gradient-to-r from-orange-50/60 to-amber-50/60 border border-orange-200 rounded-lg p-3 w-full">
      <Info className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-gray-800">{stage}</span>
          {status && (
            <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusColor}`}>
              {status}
            </span>
          )}
        </div>
        {description && <p className="text-sm text-gray-700 leading-snug">{description}</p>}
      </div>
    </div>
  );
}