import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Clock,
  Edit,
  HandMetal,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import ThreadView from '@/components/thread/ThreadView';
import TaskAssignControls from '@/components/events/TaskAssignControls';
import WorkflowTaskExtras, {
  PHASE_LABELS,
} from '@/components/events/WorkflowTaskExtras';
import {
  buildAssignUpdate,
  buildTeamMemberOptions,
  enrichTeamMemberOptions,
} from '@/lib/taskTeamMembers';
import {
  isFullEventTaskViewer,
  isMyAssignedTask,
  sortTasksMineFirst,
} from '@/lib/taskMineHighlight';

const PHASE_ORDER = [
  'upon_deposit',
  'two_point_five_weeks',
  'ros',
  'three_weeks',
  'two_weeks',
  'one_week_before',
  'staff_checkin_72_48h',
  'twenty_four_h',
  'during',
  'post',
];

/**
 * Event Detail Tasks tab — assignable workflow + checklist (mirrors /Tasks).
 *
 * @param {{
 *   eventId: string,
 *   user: Record<string, unknown> | null,
 *   roleAssignments?: unknown[],
 *   onGenerate?: () => void,
 *   generatePending?: boolean,
 *   onRegenerate?: () => void,
 *   regeneratePending?: boolean,
 *   canRegenerate?: boolean,
 * }} props
 */
const EventTasksPanel = ({
  eventId,
  user,
  roleAssignments = [],
  onGenerate,
  generatePending = false,
  onRegenerate,
  regeneratePending = false,
  canRegenerate = false,
}) => {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState({});
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [dueDateValue, setDueDateValue] = useState('');
  const [expandedThread, setExpandedThread] = useState(null);

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

  const { data: opsFeaturesData } = useQuery({
    queryKey: ['event-ops-features'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventOpsFeatures', {});
      return res?.data ?? res;
    },
  });
  const opsFeatures = opsFeaturesData?.features || {};

  const invalidate = () => {
    queryClient.invalidateQueries(['event-tasks', eventId]);
    queryClient.invalidateQueries(['tasks']);
  };

  const acknowledgeTaskMutation = useMutation({
    mutationFn: async ({ taskId, task }) => {
      if (!user) throw new Error('User not authenticated');
      const userOperationalRole = roleAssignments[0]?.role;
      if (user.role !== 'admin' && !userOperationalRole) {
        throw new Error('Role information loading. Please try again.');
      }
      if (
        user.role !== 'admin' &&
        task.responsible_role !== userOperationalRole
      ) {
        throw new Error('You can only acknowledge tasks assigned to your role');
      }
      if (task.assigned_user && user.role !== 'admin') {
        throw new Error('Task already acknowledged');
      }
      if (task.assigned_user && user.role === 'admin') {
        return base44.entities.Task.update(taskId, {
          previous_assignee: task.assigned_user,
          assigned_user: user.id,
          status: 'Working On It',
          override_flag: true,
          override_timestamp: new Date().toISOString(),
          overridden_by: user.id,
          acknowledged_timestamp: new Date().toISOString(),
        });
      }
      return base44.entities.Task.update(taskId, {
        assigned_user: user.id,
        status: 'Working On It',
        acknowledged_timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Task acknowledged');
    },
    onError: (error) => toast.error(error.message),
  });

  const assignTaskMutation = useMutation({
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

  const updateDurationMutation = useMutation({
    mutationFn: async ({ taskId, estimated_minutes }) =>
      base44.entities.Task.update(taskId, { estimated_minutes }),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Failed to update duration'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }) => {
      const updates = { status: newStatus };
      if (newStatus === 'Done') {
        updates.completion_timestamp = new Date().toISOString();
        if (user?.id) updates.completed_by = user.id;
      } else {
        updates.completion_timestamp = null;
        updates.completed_by = null;
      }
      return base44.entities.Task.update(taskId, updates);
    },
    onSuccess: () => invalidate(),
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ taskId, notes }) =>
      base44.entities.Task.update(taskId, { progress_notes: notes }),
    onSuccess: () => {
      invalidate();
      setEditingNotes({});
      toast.success('Notes updated');
    },
  });

  const updateWorkflowMetaMutation = useMutation({
    mutationFn: async ({ taskId, workflow_meta }) =>
      base44.entities.Task.update(taskId, { workflow_meta }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error.message || 'Failed to update task'),
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }) =>
      base44.entities.Task.update(taskId, { due_date: dueDate }),
    onSuccess: () => {
      invalidate();
      setEditingDueDate(null);
      setDueDateValue('');
      toast.success('Due date updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const userOperationalRole = roleAssignments[0]?.role;
  const featureHidden = (task) => {
    if (
      !opsFeatures.whatsappMedia &&
      (task.trace_id === 'C104' || /whatsapp/i.test(task.title || ''))
    ) {
      return true;
    }
    if (
      opsFeatures.email2FollowUps === false &&
      ['C115', 'C116', 'C117', 'C118'].includes(task.trace_id)
    ) {
      return true;
    }
    return false;
  };

  const seesAllTasks = isFullEventTaskViewer(user, roleAssignments);
  const visibleTasks = (
    seesAllTasks
      ? tasks
      : tasks.filter((task) => {
          const matchesRole = task.responsible_role === userOperationalRole;
          const assignedToUser = task.assigned_user === user?.id;
          return matchesRole || assignedToUser;
        })
  ).filter((t) => !featureHidden(t));

  const sortGroup = (list) => sortTasksMineFirst(list, user?.id);

  const checklistTasks = sortGroup(
    visibleTasks
      .filter((t) => t.category === 'Checklist')
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  );
  const workflowTasks = visibleTasks.filter((t) => t.category !== 'Checklist');
  const hasPhases = workflowTasks.some((t) => t.workflow_phase);
  const tasksByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase] || phase,
    tasks: sortGroup(
      workflowTasks
        .filter((t) => t.workflow_phase === phase)
        .sort(
          (a, b) =>
            (a.order || 0) - (b.order || 0) ||
            new Date(a.due_date || 0) - new Date(b.due_date || 0)
        )
    ),
  })).filter((g) => g.tasks.length > 0);
  const unphasedWorkflow = sortGroup(
    workflowTasks.filter((t) => !t.workflow_phase)
  );

  const preEventTasks = sortGroup(
    visibleTasks
      .filter((t) => t.category === 'Pre-Event')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  );
  const eventDayTasks = sortGroup(
    visibleTasks.filter((t) => t.category === 'Event-Day')
  );
  const postEventTasks = sortGroup(
    visibleTasks
      .filter((t) => t.category === 'Post-Event')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  );

  const checklistCompleted = checklistTasks.filter(
    (t) => t.status === 'Done'
  ).length;
  const completedCount = visibleTasks.filter(
    (t) => t.status === 'Done' || t.status === 'Completed'
  ).length;
  const totalTasks = visibleTasks.length;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const myOpenTasks = visibleTasks.filter(
    (t) =>
      isMyAssignedTask(t, user?.id) &&
      t.status !== 'Done' &&
      t.status !== 'Completed'
  );

  const hasWorkflow =
    preEventTasks.length > 0 ||
    eventDayTasks.length > 0 ||
    postEventTasks.length > 0 ||
    workflowTasks.length > 0;

  const assignDisabled =
    assignTaskMutation.isPending ||
    updateDurationMutation.isPending ||
    updateDueDateMutation.isPending;

  const renderTaskCard = (task) => {
    const isAcknowledged = !!task.assigned_user;
    const canAcknowledge = !isAcknowledged || user?.role === 'admin';
    const isOwner = task.assigned_user === user?.id;
    const isMine = isMyAssignedTask(task, user?.id);
    const isEditing = editingNotes[task.id];
    const assigneeName = teamMembers.find(
      (m) => m.userId === task.assigned_user
    )?.name;

    return (
      <div
        key={task.id}
        className={`p-4 bg-white rounded-lg border hover:shadow-md transition-all ${
          isMine
            ? 'border-[#C84B31] border-l-4 bg-orange-50/60 ring-1 ring-[#C84B31]/20'
            : ''
        }`}
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`font-medium text-gray-900 mb-1 ${
                task.status === 'Done' ? 'line-through text-gray-400' : ''
              }`}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {isMine ? (
                <Badge className="bg-[#C84B31] text-white text-xs">Yours</Badge>
              ) : null}
              <Badge variant="outline" className="text-xs">
                {task.responsible_role}
              </Badge>
              {assigneeName ? (
                <Badge
                  variant="outline"
                  className="text-xs border-[#C84B31]/text-[#C84B31]"
                >
                  {assigneeName}
                </Badge>
              ) : null}
              <Badge
                className={
                  task.status === 'Not Acknowledged'
                    ? 'bg-gray-200 text-gray-700'
                    : task.status === 'Working On It'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                }
              >
                {task.status}
              </Badge>
              {task.override_flag && (
                <Badge className="bg-amber-100 text-amber-700">
                  Admin Override
                </Badge>
              )}
            </div>
          </div>

          {canAcknowledge && (
            <Button
              size="sm"
              onClick={() =>
                acknowledgeTaskMutation.mutate({ taskId: task.id, task })
              }
              disabled={acknowledgeTaskMutation.isPending}
              className={
                isAcknowledged
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#C84B31] hover:bg-[#A03A23]'
              }
            >
              <HandMetal className="w-4 h-4 mr-1" />
              {isAcknowledged ? 'Override' : 'Acknowledge'}
            </Button>
          )}
        </div>

        <TaskAssignControls
          task={task}
          teamMembers={teamMembers}
          disabled={assignDisabled}
          onAssign={(nextUserId) =>
            assignTaskMutation.mutate({ task, nextUserId })
          }
          onDurationChange={(estimated_minutes) =>
            updateDurationMutation.mutate({
              taskId: task.id,
              estimated_minutes,
            })
          }
          onDueDateChange={(dueDate) =>
            updateDueDateMutation.mutate({ taskId: task.id, dueDate })
          }
        />

        <WorkflowTaskExtras
          task={task}
          canEdit={isOwner || user?.role === 'admin'}
          onMetaChange={(workflow_meta) =>
            updateWorkflowMetaMutation.mutate({
              taskId: task.id,
              workflow_meta,
            })
          }
        />

        {editingDueDate === task.id && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Edit Due Date
            </label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dueDateValue}
                onChange={(e) => setDueDateValue(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() =>
                  updateDueDateMutation.mutate({
                    taskId: task.id,
                    dueDate: dueDateValue,
                  })
                }
                disabled={updateDueDateMutation.isPending}
                className="bg-[#C84B31] hover:bg-[#A03A23]"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDueDate(null);
                  setDueDateValue('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isAcknowledged && (
          <div className="mt-3 space-y-2 text-sm border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Acknowledged:</span>
              <span className="font-medium">
                {task.acknowledged_timestamp
                  ? new Date(task.acknowledged_timestamp).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            {task.completion_timestamp && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Completed:</span>
                <span className="font-medium text-green-600">
                  {new Date(task.completion_timestamp).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {isOwner && task.status !== 'Done' && (
          <div className="mt-3 border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Progress Notes
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditingNotes({
                    ...editingNotes,
                    [task.id]: !isEditing,
                  })
                }
              >
                <Edit className="w-3 h-3" />
              </Button>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={
                    editingNotes[`${task.id}_text`] ||
                    task.progress_notes ||
                    ''
                  }
                  onChange={(e) =>
                    setEditingNotes({
                      ...editingNotes,
                      [`${task.id}_text`]: e.target.value,
                    })
                  }
                  placeholder="Add progress notes..."
                  className="text-sm"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      updateNotesMutation.mutate({
                        taskId: task.id,
                        notes: editingNotes[`${task.id}_text`],
                      })
                    }
                    className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditingNotes({ ...editingNotes, [task.id]: false })
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : task.progress_notes ? (
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {task.progress_notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes yet</p>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-3 flex gap-2">
            {task.status === 'Working On It' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateStatusMutation.mutate({
                    taskId: task.id,
                    newStatus: 'Done',
                  })
                }
                className="flex-1"
              >
                Mark as Done
              </Button>
            )}
            {task.status === 'Done' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateStatusMutation.mutate({
                    taskId: task.id,
                    newStatus: 'Working On It',
                  })
                }
                className="flex-1"
              >
                Reopen Task
              </Button>
            )}
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setExpandedThread(expandedThread === task.id ? null : task.id)
          }
          className="text-gray-500 hover:text-[#C84B31] mt-2 min-h-[36px]"
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          Thread
        </Button>

        {expandedThread === task.id && (
          <div className="border-t pt-4 mt-2">
            <ThreadView taskId={task.id} user={user} />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-600">
            Assign Who / Duration / Due — same controls as the Tasks page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasWorkflow && onGenerate ? (
            <Button
              onClick={onGenerate}
              disabled={generatePending}
              className="bg-[#C84B31] hover:bg-[#A03A23]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generatePending ? 'Generating...' : 'Generate Event Workflow'}
            </Button>
          ) : null}
          {hasWorkflow && canRegenerate && onRegenerate ? (
            <Button
              variant="outline"
              disabled={regeneratePending}
              onClick={onRegenerate}
            >
              {regeneratePending ? 'Regenerating…' : 'Regenerate workflow'}
            </Button>
          ) : null}
        </div>
      </div>

      {totalTasks > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">Workflow Progress</h3>
              <span className="text-2xl font-bold text-green-600">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {completedCount} of {totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>
      )}

      {myOpenTasks.length > 0 && (
        <div className="rounded-lg border border-[#C84B31]/bg-orange-50 px-4 py-3 text-sm text-[#A03A23]">
          You have <span className="font-semibold">{myOpenTasks.length}</span>{' '}
          open task{myOpenTasks.length === 1 ? '' : 's'} on this event
          {seesAllTasks ? ' — highlighted below as Yours' : ''}.
        </div>
      )}

      {checklistTasks.length > 0 && (
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600" />
              Event Checklist ({checklistCompleted}/{checklistTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">{checklistTasks.map(renderTaskCard)}</div>
          </CardContent>
        </Card>
      )}

      {hasPhases ? (
        <>
          {tasksByPhase.map((group) => {
            const done = group.tasks.filter((t) => t.status === 'Done').length;
            return (
              <Card key={group.phase} className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-blue-600" />
                    {group.label} ({done}/{group.tasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.tasks.map(renderTaskCard)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {unphasedWorkflow.length > 0 && (
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Other workflow tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unphasedWorkflow.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {preEventTasks.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Pre-Event (
                  {
                    preEventTasks.filter((t) => t.status === 'Done').length
                  }
                  /{preEventTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {preEventTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          )}
          {eventDayTasks.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Event Day (
                  {
                    eventDayTasks.filter((t) => t.status === 'Done').length
                  }
                  /{eventDayTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eventDayTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          )}
          {postEventTasks.length > 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Post-Event (
                  {
                    postEventTasks.filter((t) => t.status === 'Done').length
                  }
                  /{postEventTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {postEventTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {visibleTasks.length === 0 && tasks.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No tasks match your role. Ask an admin to assign you, or switch
            accounts.
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No workflow yet. Complete Deposit Intake or generate the event
            workflow to create tasks.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EventTasksPanel;
