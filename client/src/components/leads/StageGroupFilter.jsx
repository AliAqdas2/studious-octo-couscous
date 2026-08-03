import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getStageMeta } from '@/components/leads/stageMetadata';
import StageTooltip from '@/components/leads/StageTooltip';

// Map categories to the actual pipeline stages
export const STAGE_CATEGORIES = [
  {
    id: 'lead',
    label: 'Lead',
    stages: [
      'New Inquiry',
      'Initial Outreach – Call to Schedule',
      'Outreach Initiated – Call Attempted',
      'No Answer – 1st Email Sent',
      'Survey Sent',
      'Awaiting Survey Response (24hr)',
      'No Survey Response – Follow-Up 1',
      'Awaiting Response After Follow-Up 1',
      'No Response – Follow-Up 2',
      'Awaiting Response After Follow-Up 2',
      'No Response – Final Email Sent',
      'Survey Completed – Calendar Invite Sent',
    ],
  },
  {
    id: 'proposal',
    label: 'Proposal',
    stages: [
      'Calendar Invite Sent',
      'Invite Not Accepted',
      '2nd Follow-Up – Off Radar',
      'Awaiting Calendar Acceptance',
      'Calendar Invite Resent',
      'Calendar Accepted',
      'Invite Accepted – Survey Sent',
      'Program Planning Discussion',
      'After Meeting Follow-Up',
    ],
  },
  {
    id: 'confirmed',
    label: 'Confirmed',
    stages: [
      'Deposit Requested',
      'Confirmed Sales',
    ],
  },
  {
    id: 'completed',
    label: 'Completed',
    stages: [
      'Completed',
      'Lost/Canceled',
    ],
  },
];

// Given selected stages, returns the list of actual stage strings to filter by
// (empty array = all)
export function getStagesToFilter(filterStages) {
  return filterStages;
}

export default function StageGroupFilter({ filterStages, setFilterStages }) {
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryState = (category) => {
    const selected = category.stages.filter(s => filterStages.includes(s));
    if (selected.length === 0) return 'none';
    if (selected.length === category.stages.length) return 'all';
    return 'partial';
  };

  const toggleCategory = (category) => {
    const state = getCategoryState(category);
    if (state === 'all') {
      // Deselect all stages in this category
      setFilterStages(prev => prev.filter(s => !category.stages.includes(s)));
    } else {
      // Select all stages in this category
      setFilterStages(prev => [...new Set([...prev, ...category.stages])]);
    }
  };

  const toggleStage = (stage) => {
    setFilterStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  return (
    <div className="space-y-0.5">
      {STAGE_CATEGORIES.map(category => {
        const state = getCategoryState(category);
        const isExpanded = expandedCategories[category.id];

        return (
          <div key={category.id}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer">
              <Checkbox
                checked={state === 'all'}
                data-state={state === 'partial' ? 'indeterminate' : state === 'all' ? 'checked' : 'unchecked'}
                onCheckedChange={() => toggleCategory(category)}
                className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-[#C84B31] data-[state=checked]:border-[#C84B31] data-[state=indeterminate]:bg-[#C84B31]/30 data-[state=indeterminate]:border-[#C84B31]/50"
              />
              <span
                className="text-sm text-gray-800 font-medium flex-1 leading-tight"
                onClick={() => toggleCategory(category)}
              >
                {category.label}
                {state === 'partial' && (
                  <span className="ml-1.5 text-xs text-[#C84B31] font-normal">
                    ({category.stages.filter(s => filterStages.includes(s)).length}/{category.stages.length})
                  </span>
                )}
              </span>
              <button
                onClick={(e) => toggleExpand(category.id, e)}
                className="p-0.5 rounded hover:bg-slate-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isExpanded && (
              <div className="ml-6 mt-0.5 mb-1 space-y-0.5 border-l border-slate-200 pl-3">
                {category.stages.map(stage => {
                  const meta = getStageMeta(stage);
                  return (
                    <label key={stage} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={filterStages.includes(stage)}
                        onCheckedChange={() => toggleStage(stage)}
                        className="h-3.5 w-3.5 rounded border-slate-300 data-[state=checked]:bg-[#C84B31] data-[state=checked]:border-[#C84B31]"
                      />
                      <span className="text-xs text-gray-600 leading-tight flex-1">{stage}</span>
                      {meta.description && (
                        <StageTooltip stage={stage} side="right">
                          <button
                            type="button"
                            onClick={(e) => e.preventDefault()}
                            className="text-gray-300 hover:text-[#C84B31] transition-colors cursor-help flex-shrink-0"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </StageTooltip>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}