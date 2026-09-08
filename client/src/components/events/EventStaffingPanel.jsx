import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import TaskAssignControls from '@/components/events/TaskAssignControls';
import { isFoodTourExperience } from '@/lib/foodTourExperiences';
import {
  findOpsPanelTask,
  OPS_PANEL_MILESTONES,
} from '@/lib/opsPanelTasks';
import {
  buildAssignUpdate,
  buildTeamMemberOptions,
  enrichTeamMemberOptions,
} from '@/lib/taskTeamMembers';

/**
 * Compact Who / Duration / Due for each ops-panel milestone (not all workflow tasks).
 *
 * @param {{
 *   eventId?: string | null,
 *   event?: Record<string, unknown> | null,
 *   onGenerate?: () => void,
 *   generatePending?: boolean,
 * }} props
 */
const EventStaffingPanel = ({
  eventId,
  event = null,
  onGenerate,
  generatePending = false,
}) => {
  const queryClient = useQueryClient();
  const showFoodTour = isFoodTourExperience(
    event?.event_type || event?.eventType
  );

  const milestones = useMemo(
    () =>
      OPS_PANEL_MILESTONES.filter((m) => !m.foodTourOnly || showFoodTour),
    [showFoodTour]
  );

  const { data: user } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => base44.auth.me(),
    staleTime: 60_000,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: () => base44.entities.Task.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  const { data: allRoleAssignments = [] } = useQuery({
    queryKey: ['role-assignments-active'],
    queryFn: async () => {
      const rows = await base44.entities.RoleAssignment.filter({
        is_active: true,
      });
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list-assign'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
    staleTime: 60_000,
  });

  const teamMembers = useMemo(
    () =>
      enrichTeamMemberOptions(
        buildTeamMemberOptions(allRoleAssignments),
        users
      ),
    [allRoleAssignments, users]
  );

  const rows = useMemo(
    () =>
      milestones.map((m) => ({
        ...m,
        task: findOpsPanelTask(m.panelId, tasks),
      })),
    [milestones, tasks]
  );

  const matched = rows.filter((r) => r.task);
  const assignedCount = matched.filter(
    (r) => r.task?.assigned_user || r.task?.assignedUser
  ).length;
  const allAssigned =
    matched.length > 0 && assignedCount === matched.length;
  const noWorkflow = !isLoading && matched.length === 0;

  const invalidate = () => {
    queryClient.invalidateQueries(['event-tasks', eventId]);
  };

  const assignMutation = useMutation({
    mutationFn: async ({ task, nextUserId }) => {
      if (!user) throw new Error('Not signed in');
      const updates = buildAssignUpdate({
        task,
        nextUserId,
        actorUserId: user.id,
      });
      return base44.entities.Task.update(task.id, updates);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Assignee updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to assign'),
  });

  const durationMutation = useMutation({
    mutationFn: async ({ taskId, estimated_minutes }) =>
      base44.entities.Task.update(taskId, { estimated_minutes }),
    onSuccess: () => invalidate(),
    onError: (err) =>
      toast.error(err?.message || 'Failed to update duration'),
  });

  const dueMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }) =>
      base44.entities.Task.update(taskId, { due_date: dueDate }),
    onSuccess: () => {
      invalidate();
      toast.success('Due date updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update due date'),
  });

  const busy =
    assignMutation.isPending ||
    durationMutation.isPending ||
    dueMutation.isPending;

  const milestoneLabel = noWorkflow
    ? 'Generate workflow to assign'
    : `${assignedCount}/${matched.length} assigned`;

  return (
    <OpsPanelShell
      title="Task assignments"
      icon={Users}
      complete={allAssigned}
      forceOpen={noWorkflow || !allAssigned}
      doneBadge={allAssigned}
      milestoneLabel={milestoneLabel}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse bg-slate-100 rounded" />
      ) : noWorkflow ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Generate the event workflow to unlock Who / Duration / Due for each
            ops milestone (Deposit, ROS, Inventory, BEO, and the rest).
          </p>
          {typeof onGenerate === 'function' ? (
            <Button
              type="button"
              onClick={onGenerate}
              disabled={generatePending}
              className="bg-[#C84B31] hover:bg-[#A03A23]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generatePending ? 'Generating…' : 'Generate Event Workflow'}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Assign Who / Duration / Due for each ops panel milestone.
          </p>
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.panelId}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {row.label}
                  </p>
                  {row.task ? (
                    <p
                      className="text-[11px] text-gray-500 truncate"
                      title={String(row.task.title || '')}
                    >
                      Task: {String(row.task.title || 'Workflow task')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      No matching workflow task yet for this panel.
                    </p>
                  )}
                </div>
                {row.task ? (
                  <TaskAssignControls
                    task={row.task}
                    teamMembers={teamMembers}
                    disabled={busy}
                    onAssign={(nextUserId) =>
                      assignMutation.mutate({ task: row.task, nextUserId })
                    }
                    onDurationChange={(estimated_minutes) =>
                      durationMutation.mutate({
                        taskId: row.task.id,
                        estimated_minutes,
                      })
                    }
                    onDueDateChange={(dueDate) =>
                      dueMutation.mutate({
                        taskId: row.task.id,
                        dueDate,
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </OpsPanelShell>
  );
};

export default EventStaffingPanel;
