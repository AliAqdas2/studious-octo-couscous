import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';
import {
  DURATION_STEP_MINUTES,
  formatEstimatedMinutes,
} from '@/lib/taskTeamMembers';

/**
 * Who / duration / due-date controls for a workflow task card.
 *
 * @param {{
 *   task: Record<string, unknown>,
 *   teamMembers: Array<{ userId: string, label: string }>,
 *   disabled?: boolean,
 *   onAssign: (userId: string | null) => void,
 *   onDurationChange: (minutes: number) => void,
 *   onDueDateChange: (dueDate: string | null) => void,
 * }} props
 */
const TaskAssignControls = ({
  task,
  teamMembers = [],
  disabled = false,
  onAssign,
  onDurationChange,
  onDueDateChange,
}) => {
  const assignedId = task.assigned_user || task.assignedUser || '';
  const minutes =
    task.estimated_minutes != null
      ? Number(task.estimated_minutes)
      : task.estimatedMinutes != null
        ? Number(task.estimatedMinutes)
        : 0;
  const dueRaw = task.due_date || task.dueDate || '';
  const dueValue = dueRaw ? String(dueRaw).slice(0, 10) : '';
  const assigneeLabel = teamMembers.find((m) => m.userId === assignedId)?.label;

  const bumpDuration = (delta) => {
    const next = Math.max(0, (Number.isFinite(minutes) ? minutes : 0) + delta);
    onDurationChange(next);
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Who is going to do this?</Label>
          <select
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            value={assignedId}
            disabled={disabled}
            onChange={(e) => onAssign(e.target.value || null)}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.label}
              </option>
            ))}
          </select>
          {assigneeLabel ? (
            <p className="text-[11px] text-gray-500 truncate">Assigned: {assigneeLabel}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-600">How long will it take?</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={disabled || minutes <= 0}
              onClick={() => bumpDuration(-DURATION_STEP_MINUTES)}
              title={`−${DURATION_STEP_MINUTES} min`}
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <span className="flex-1 text-center text-sm font-medium tabular-nums">
              {formatEstimatedMinutes(minutes)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={disabled}
              onClick={() => bumpDuration(DURATION_STEP_MINUTES)}
              title={`+${DURATION_STEP_MINUTES} min`}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Will do this by when?</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={dueValue}
            disabled={disabled}
            onChange={(e) => onDueDateChange(e.target.value || null)}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskAssignControls;
