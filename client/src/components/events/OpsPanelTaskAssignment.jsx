import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import TaskAssignControls from '@/components/events/TaskAssignControls';
import {
  buildAssignUpdate,
  buildTeamMemberOptions,
} from '@/lib/taskTeamMembers';
import { findOpsPanelTask } from '@/lib/opsPanelTasks';

/**
 * Who / duration / due for the workflow task linked to an ops panel.
 *
 * @param {{
 *   panelId: import('@/lib/opsPanelTasks').OpsPanelId,
 *   eventId?: string | null,
 * }} props
 */
const OpsPanelTaskAssignment = ({ panelId, eventId }) => {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => base44.auth.me(),
    staleTime: 60_000,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
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

  const teamMembers = React.useMemo(
    () => buildTeamMemberOptions(allRoleAssignments),
    [allRoleAssignments]
  );

  const task = React.useMemo(
    () => findOpsPanelTask(panelId, tasks),
    [panelId, tasks]
  );

  const invalidate = () => {
    queryClient.invalidateQueries(['event-tasks', eventId]);
  };

  const assignMutation = useMutation({
    mutationFn: async (nextUserId) => {
      if (!user) throw new Error('Not signed in');
      if (!task?.id) throw new Error('No workflow task for this panel');
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
    mutationFn: async (estimated_minutes) => {
      if (!task?.id) throw new Error('No workflow task for this panel');
      return base44.entities.Task.update(task.id, { estimated_minutes });
    },
    onSuccess: () => invalidate(),
    onError: (err) =>
      toast.error(err?.message || 'Failed to update duration'),
  });

  const dueMutation = useMutation({
    mutationFn: async (dueDate) => {
      if (!task?.id) throw new Error('No workflow task for this panel');
      return base44.entities.Task.update(task.id, { due_date: dueDate });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Due date updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update due date'),
  });

  if (!eventId) return null;

  if (tasksLoading) {
    return (
      <p className="text-xs text-gray-400 border-t pt-2 mt-1">
        Loading assignment…
      </p>
    );
  }

  if (!task) {
    return (
      <p className="text-xs text-gray-500 border-t pt-2 mt-1">
        Generate the event workflow to assign who / duration / due for this
        panel.
      </p>
    );
  }

  const busy =
    assignMutation.isPending ||
    durationMutation.isPending ||
    dueMutation.isPending;

  return (
    <div className="border-t pt-2 mt-1 space-y-1">
      <p className="text-[11px] text-gray-500 truncate" title={String(task.title || '')}>
        Task: {String(task.title || 'Workflow task')}
      </p>
      <TaskAssignControls
        task={task}
        teamMembers={teamMembers}
        disabled={busy}
        onAssign={(nextUserId) => assignMutation.mutate(nextUserId)}
        onDurationChange={(estimated_minutes) =>
          durationMutation.mutate(estimated_minutes)
        }
        onDueDateChange={(dueDate) => dueMutation.mutate(dueDate)}
      />
    </div>
  );
};

export default OpsPanelTaskAssignment;
