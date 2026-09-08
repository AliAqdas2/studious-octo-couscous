import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Minus, Plus } from 'lucide-react';
import {
  DURATION_STEP_MINUTES,
  formatEstimatedMinutes,
} from '@/lib/taskTeamMembers';

const UNASSIGNED = '__unassigned__';

/**
 * Who / duration / due-date controls for a workflow task card.
 *
 * @param {{
 *   task: Record<string, unknown>,
 *   teamMembers: Array<{ userId: string, label: string, name?: string, role?: string }>,
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
  const assignedId = String(task.assigned_user || task.assignedUser || '');
  const minutes =
    task.estimated_minutes != null
      ? Number(task.estimated_minutes)
      : task.estimatedMinutes != null
        ? Number(task.estimatedMinutes)
        : 0;
  const dueRaw = task.due_date || task.dueDate || '';
  const dueValue = dueRaw ? String(dueRaw).slice(0, 10) : '';
  const selected = teamMembers.find((m) => m.userId === assignedId);
  const sortedMembers = React.useMemo(
    () =>
      [...teamMembers].sort((a, b) =>
        String(a.name || a.label).localeCompare(String(b.name || b.label))
      ),
    [teamMembers]
  );

  const bumpDuration = (delta) => {
    const next = Math.max(0, (Number.isFinite(minutes) ? minutes : 0) + delta);
    onDurationChange(next);
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Assignee</Label>
          <Select
            value={assignedId || UNASSIGNED}
            disabled={disabled}
            onValueChange={(value) =>
              onAssign(value === UNASSIGNED ? null : value)
            }
          >
            <SelectTrigger className="h-9 w-full bg-white">
              <SelectValue placeholder="Choose teammate…">
                {selected ? (
                  <span className="truncate text-left">
                    <span className="font-medium">{selected.name || selected.label}</span>
                    {selected.role ? (
                      <span className="text-muted-foreground"> · {selected.role}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Choose teammate…</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {sortedMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <span className="flex flex-col items-start gap-0.5 py-0.5">
                    <span className="font-medium leading-tight">
                      {m.name || m.label}
                    </span>
                    {m.role ? (
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        {m.role}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Duration</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
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
              className="h-9 w-9 p-0"
              disabled={disabled}
              onClick={() => bumpDuration(DURATION_STEP_MINUTES)}
              title={`+${DURATION_STEP_MINUTES} min`}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Due date</Label>
          <Input
            type="date"
            className="h-9 text-sm bg-white"
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
