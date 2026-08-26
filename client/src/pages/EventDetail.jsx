import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Calendar, MapPin, Users, DollarSign, Truck, Wine,
  Package, CheckSquare, Clock, AlertCircle, Sparkles, HandMetal, Edit, MessageCircle, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import ThreadView from '@/components/thread/ThreadView';
import DepositIntakeForm from '@/components/events/DepositIntakeForm';
import EventInventoryChecklist from '@/components/events/EventInventoryChecklist';
import RunOfShowForm from '@/components/events/RunOfShowForm';
import BeoDocumentPanel from '@/components/events/BeoDocumentPanel';
import EventArtifactsPanel from '@/components/events/EventArtifactsPanel';
import PostEventPanel from '@/components/events/PostEventPanel';
import WorkflowTaskExtras from '@/components/events/WorkflowTaskExtras';
import { PHASE_LABELS } from '@/components/events/WorkflowTaskExtras';

export default function EventDetail() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
  const [user, setUser] = useState(null);
  const [editingNotes, setEditingNotes] = useState({});
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [dueDateValue, setDueDateValue] = useState('');
  const [expandedThread, setExpandedThread] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const events = await base44.entities.Event.filter({ id: eventId });
      return events[0];
    },
    enabled: !!eventId
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: () => base44.entities.Task.filter({ event_id: eventId }),
    enabled: !!eventId
  });

  const { data: roleAssignments = [] } = useQuery({
    queryKey: ['roleAssignment', user?.id],
    queryFn: () => base44.entities.RoleAssignment.filter({ user_id: user.id }),
    enabled: !!user && user?.role !== 'admin'
  });

  const { data: opsFeaturesData } = useQuery({
    queryKey: ['event-ops-features'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventOpsFeatures', {});
      return res?.data ?? res;
    },
  });
  const opsFeatures = opsFeaturesData?.features || {};

  const { data: experienceInfo } = useQuery({
    queryKey: ['event-experience', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventExperience', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });
  const experience = experienceInfo?.experience;
  const zachTaskDone = tasks.some(
    (t) =>
      (t.trace_id === 'Z001' || t.traceId === 'Z001') &&
      (t.status === 'Done' || t.status === 'Completed')
  );
  // Matrix flags incomplete/stub experiences; clear per-event when Z001 is Done.
  const needsZach =
    Boolean(experienceInfo?.needsZachReview) && !zachTaskDone;
  // Meeting: ROS is shared across experiences (not Cooking-only).
  const hasRos = Boolean(event?.event_type);

  const generateWorkflowMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateEventWorkflow', { eventId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      queryClient.invalidateQueries(['event-inventory', eventId]);
      queryClient.invalidateQueries(['event-experience', eventId]);
      toast.success('Event workflow generated successfully');
    },
    onError: () => {
      toast.error('Failed to generate workflow');
    }
  });

  const regenerateWorkflowMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('regenerateEventWorkflow', {
        eventId,
        confirm: true,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      queryClient.invalidateQueries(['event-inventory', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-experience', eventId]);
      const body = res?.data ?? res;
      toast.success(
        `Workflow regenerated (${body?.deletedOpenTasks ?? 0} open tasks replaced)`
      );
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to regenerate workflow');
    },
  });

  const acknowledgeTaskMutation = useMutation({
    mutationFn: async ({ taskId, task }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Get user's operational role
      const userOperationalRole = roleAssignments[0]?.role;
      
      // Ensure role is loaded for non-admin users
      if (user.role !== 'admin' && !userOperationalRole) {
        throw new Error('Role information loading. Please try again.');
      }
      
      // Non-admin users can only acknowledge tasks matching their role
      if (user.role !== 'admin' && task.responsible_role !== userOperationalRole) {
        throw new Error('You can only acknowledge tasks assigned to your role');
      }
      
      // Case 2: Non-admin trying to acknowledge already assigned task
      if (task.assigned_user && user.role !== 'admin') {
        throw new Error('Task already acknowledged');
      }
      
      // Case 3: Admin override
      if (task.assigned_user && user.role === 'admin') {
        return base44.entities.Task.update(taskId, {
          previous_assignee: task.assigned_user,
          assigned_user: user.id,
          status: 'Working On It',
          override_flag: true,
          override_timestamp: new Date().toISOString(),
          overridden_by: user.id,
          acknowledged_timestamp: new Date().toISOString()
        });
      }
      
      // Case 1: Unassigned task
      return base44.entities.Task.update(taskId, {
        assigned_user: user.id,
        status: 'Working On It',
        acknowledged_timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      toast.success('Task acknowledged');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }) => {
      const updates = { status: newStatus };
      if (newStatus === 'Done') {
        updates.completion_timestamp = new Date().toISOString();
      }
      return base44.entities.Task.update(taskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
    }
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ taskId, notes }) => {
      return base44.entities.Task.update(taskId, { progress_notes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      setEditingNotes({});
      toast.success('Notes updated');
    }
  });

  const updateWorkflowMetaMutation = useMutation({
    mutationFn: async ({ taskId, workflow_meta }) => {
      return base44.entities.Task.update(taskId, { workflow_meta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update task');
    }
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }) => {
      return base44.entities.Task.update(taskId, {
        due_date: dueDate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      setEditingDueDate(null);
      setDueDateValue('');
      toast.success('Due date updated');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  if (isLoading || !event) {
    return <div className="text-center py-12">Loading event...</div>;
  }

  // Role-based task filtering for non-admin users
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
  
  const visibleTasks = (user?.role === 'admin' ? tasks : tasks.filter(task => {
    const matchesRole = task.responsible_role === userOperationalRole;
    const assignedToUser = task.assigned_user === user?.id;
    return matchesRole || assignedToUser;
  })).filter((t) => !featureHidden(t));

  const checklistTasks = visibleTasks.filter(t => t.category === 'Checklist').sort((a, b) => 
    (a.order || 0) - (b.order || 0)
  );
  const preEventTasks = visibleTasks.filter(t => t.category === 'Pre-Event').sort((a, b) => 
    new Date(a.due_date) - new Date(b.due_date)
  );
  const eventDayTasks = visibleTasks.filter(t => t.category === 'Event-Day');
  const postEventTasks = visibleTasks.filter(t => t.category === 'Post-Event').sort((a, b) => 
    new Date(a.due_date) - new Date(b.due_date)
  );

  const checklistCompleted = checklistTasks.filter(t => t.status === 'Done').length;
  const preEventCompleted = preEventTasks.filter(t => t.status === 'Done').length;
  const eventDayCompleted = eventDayTasks.filter(t => t.status === 'Done').length;
  const postEventCompleted = postEventTasks.filter(t => t.status === 'Done').length;
  
  const completedCount = checklistCompleted + preEventCompleted + eventDayCompleted + postEventCompleted;
  const totalTasks = visibleTasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

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

  const workflowTasks = visibleTasks.filter((t) => t.category !== 'Checklist');
  const hasPhases = workflowTasks.some((t) => t.workflow_phase);
  const tasksByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase] || phase,
    tasks: workflowTasks
      .filter((t) => t.workflow_phase === phase)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || new Date(a.due_date || 0) - new Date(b.due_date || 0)),
  })).filter((g) => g.tasks.length > 0);
  const unphasedWorkflow = workflowTasks.filter((t) => !t.workflow_phase);

  const renderTaskCard = (task) => {
    const isAcknowledged = !!task.assigned_user;
    const canAcknowledge = !isAcknowledged || user?.role === 'admin';
    const isOwner = task.assigned_user === user?.id;
    const isEditing = editingNotes[task.id];

    return (
      <div 
        key={task.id}
        className="p-4 bg-white rounded-lg border hover:shadow-md transition-all"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className={`font-medium text-gray-900 mb-1 ${task.status === 'Done' ? 'line-through text-gray-400' : ''}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {task.responsible_role}
              </Badge>
              <Badge className={
                task.status === 'Not Acknowledged' ? 'bg-gray-200 text-gray-700' :
                task.status === 'Working On It' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }>
                {task.status}
              </Badge>
              {task.override_flag && (
                <Badge className="bg-amber-100 text-amber-700">
                  Admin Override
                </Badge>
              )}
              {task.due_date ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </span>
                  {user?.role === 'admin' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingDueDate(task.id);
                        setDueDateValue(task.due_date.split('T')[0]);
                      }}
                      className="h-5 px-1"
                    >
                      <Calendar className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ) : user?.role === 'admin' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingDueDate(task.id);
                    setDueDateValue('');
                  }}
                  className="h-5 px-1 text-xs text-gray-400 hover:text-[#C84B31]"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Set due date
                </Button>
              ) : null}
            </div>
          </div>
          
          {canAcknowledge && (
            <Button
              size="sm"
              onClick={() => acknowledgeTaskMutation.mutate({ taskId: task.id, task })}
              disabled={acknowledgeTaskMutation.isPending}
              className={isAcknowledged ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#C84B31] hover:bg-[#A03A23]'}
            >
              <HandMetal className="w-4 h-4 mr-1" />
              {isAcknowledged ? 'Override' : 'Acknowledge'}
            </Button>
          )}
        </div>

        <WorkflowTaskExtras
          task={task}
          canEdit={isOwner || user?.role === 'admin'}
          onMetaChange={(workflow_meta) =>
            updateWorkflowMetaMutation.mutate({ taskId: task.id, workflow_meta })
          }
        />

        {/* Due Date Editor for Admin */}
        {user?.role === 'admin' && editingDueDate === task.id && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <label className="text-sm font-medium text-gray-700">Edit Due Date</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dueDateValue}
                onChange={(e) => setDueDateValue(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => updateDueDateMutation.mutate({ taskId: task.id, dueDate: dueDateValue })}
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
                {task.acknowledged_timestamp ? new Date(task.acknowledged_timestamp).toLocaleString() : 'N/A'}
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

            {task.previous_assignee && (
              <div className="bg-amber-50 p-2 rounded text-xs">
                <span className="text-amber-700">Previously assigned to user: {task.previous_assignee}</span>
              </div>
            )}
          </div>
        )}

        {isOwner && task.status !== 'Done' && (
          <div className="mt-3 border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Progress Notes</label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingNotes({ ...editingNotes, [task.id]: !isEditing })}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editingNotes[`${task.id}_text`] || task.progress_notes || ''}
                  onChange={(e) => setEditingNotes({ 
                    ...editingNotes, 
                    [`${task.id}_text`]: e.target.value 
                  })}
                  placeholder="Add progress notes..."
                  className="text-sm"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateNotesMutation.mutate({ 
                      taskId: task.id, 
                      notes: editingNotes[`${task.id}_text`] 
                    })}
                    className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingNotes({ ...editingNotes, [task.id]: false })}
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
                onClick={() => updateStatusMutation.mutate({ 
                  taskId: task.id, 
                  newStatus: 'Done' 
                })}
                className="flex-1"
              >
                Mark as Done
              </Button>
            )}
            {task.status === 'Done' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatusMutation.mutate({ 
                  taskId: task.id, 
                  newStatus: 'Working On It' 
                })}
                className="flex-1"
              >
                Reopen Task
              </Button>
            )}
          </div>
        )}

        {/* Thread Toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpandedThread(expandedThread === task.id ? null : task.id)}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">{event.event_name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#7A9D54] text-white">{event.event_type}</Badge>
            <Badge variant="outline">{event.stage}</Badge>
            {experience?.timelineFamily && (
              <Badge variant="outline" className="text-xs">
                Timeline {experience.timelineFamily}
              </Badge>
            )}
            {needsZach && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-200">
                Needs Zach inventory review
              </Badge>
            )}
            {experience?.docQuality && experience.docQuality !== 'complete' && (
              <Badge variant="outline" className="text-xs capitalize">
                Doc: {String(experience.docQuality).replace('_', '-')}
              </Badge>
            )}
          </div>
          {needsZach && experience?.flagNote && (
            <p className="text-xs text-amber-800 mt-2 max-w-xl">{experience.flagNote}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {preEventTasks.length === 0 && eventDayTasks.length === 0 && postEventTasks.length === 0 && (
            <Button
              onClick={() => generateWorkflowMutation.mutate()}
              disabled={generateWorkflowMutation.isPending}
              className="bg-[#C84B31] hover:bg-[#A03A23]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateWorkflowMutation.isPending ? 'Generating...' : 'Generate Event Workflow'}
            </Button>
          )}
          {(preEventTasks.length > 0 || eventDayTasks.length > 0 || postEventTasks.length > 0) &&
            (user?.role === 'admin' ||
              roleAssignments.some((r) => ['Ops', 'Ops Manager', 'Admin'].includes(r.role))) && (
              <Button
                variant="outline"
                disabled={regenerateWorkflowMutation.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    'Regenerating deletes OPEN (non-Done) tasks and rebuilds from the current event type template (including shared ROS). Done tasks are kept. Continue?'
                  );
                  if (ok) regenerateWorkflowMutation.mutate();
                }}
              >
                {regenerateWorkflowMutation.isPending
                  ? 'Regenerating…'
                  : 'Regenerate workflow'}
              </Button>
            )}
        </div>
      </div>

      {/* Deposit Intake — Sales meeting capture (plan 02) */}
      <DepositIntakeForm event={event} user={user} />

      {/* Inventory checklist — any experience with matching catalog experience_keys */}
      {event?.event_type && (
        <EventInventoryChecklist
          eventId={eventId}
          event={event}
          experienceKey={event.event_type}
          canEdit={
            user?.role === 'admin' ||
            roleAssignments.some((r) =>
              ['Ops', 'Ops Manager', 'Intern'].includes(r.role)
            )
          }
        />
      )}

      <EventArtifactsPanel
        event={event}
        canEditAdmin={
          user?.role === 'admin' ||
          roleAssignments.some((r) => r.role === 'Admin')
        }
        canEditOps={
          user?.role === 'admin' ||
          roleAssignments.some((r) =>
            ['Ops', 'Ops Manager', 'Admin'].includes(r.role)
          )
        }
      />

      {hasRos && (
        <RunOfShowForm
          event={event}
          user={user}
          canEdit={
            user?.role === 'admin' ||
            roleAssignments.some((r) =>
              ['Ops', 'Ops Manager', 'Sales', 'Admin'].includes(r.role)
            )
          }
        />
      )}

      <BeoDocumentPanel
        event={event}
        canEdit={
          user?.role === 'admin' ||
          roleAssignments.some((r) =>
            ['Ops', 'Ops Manager', 'Sales', 'Admin'].includes(r.role)
          )
        }
      />

      <PostEventPanel
        event={event}
        canEdit={
          user?.role === 'admin' ||
          roleAssignments.some((r) =>
            ['Ops', 'Ops Manager', 'Sales', 'Admin', 'Event Host'].includes(
              r.role
            )
          )
        }
      />

      {/* Progress Bar */}
      {visibleTasks.length > 0 && (
        <Card className="hidden bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">Workflow Progress</h3>
              <span className="text-2xl font-bold text-green-600">{progressPercent}%</span>
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

      <div className="hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Details */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardHeader>
            <CardTitle>Event Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm">
                {new Date(event.event_date).toLocaleDateString()} at{' '}
                {new Date(event.event_date).toLocaleTimeString()}
              </span>
            </div>

            {event.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{event.venue}</span>
              </div>
            )}

            {event.virtual_platform && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-sm">Platform: {event.virtual_platform}</span>
              </div>
            )}

            {event.headcount_min != null || event.headcount_max != null ? (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  {event.headcount_min ?? '?'}–{event.headcount_max ?? '?'} participants
                </span>
              </div>
            ) : event.headcount ? (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{event.headcount} participants</span>
              </div>
            ) : null}

            {event.can_view_deposit_amount && event.deposit_amount != null && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  Deposit ${Number(event.deposit_amount).toLocaleString()}
                </span>
              </div>
            )}

            {event.alcohol_preference && (
              <div className="flex items-center gap-2">
                <Wine className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{event.alcohol_preference}</span>
              </div>
            )}

            {event.transportation_needed && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-400" />
                <span className="text-sm">Transportation required</span>
              </div>
            )}

            {event.poc_name && user?.role === 'admin' && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-1">Point of Contact</p>
                <p className="font-medium">{event.poc_name}</p>
                {event.poc_email && <p className="text-sm text-gray-600">{event.poc_email}</p>}
                {event.poc_phone && <p className="text-sm text-gray-600">{event.poc_phone}</p>}
              </div>
            )}

            {event.dietary_restrictions && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-1">Dietary Restrictions</p>
                <p className="text-sm">{event.dietary_restrictions}</p>
              </div>
            )}

            {event.special_requests && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-1">Special Requests</p>
                <p className="text-sm">{event.special_requests}</p>
              </div>
            )}

            {event.custom_addons && event.custom_addons.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-2">Custom Add-ons</p>
                <div className="flex flex-wrap gap-1">
                  {event.custom_addons.map((addon, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">{addon}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Workflow */}
        <div className="lg:col-span-2 space-y-6">
          {/* Default Checklist */}
          {checklistTasks.length > 0 && (
            <Card className="bg-orange-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-orange-600" />
                  Event Checklist ({checklistCompleted}/{checklistTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checklistTasks.map(renderTaskCard)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pre-Event / Phase checklist */}
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
                    <CardTitle className="flex items-center gap-2 text-base">
                      Other workflow tasks
                    </CardTitle>
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
                      Pre-Event Tasks ({preEventCompleted}/{preEventTasks.length})
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
                      <CheckSquare className="w-5 h-5 text-amber-600" />
                      Event Day Tasks ({eventDayCompleted}/{eventDayTasks.length})
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
                      <AlertCircle className="w-5 h-5 text-green-600" />
                      Post-Event Tasks ({postEventCompleted}/{postEventTasks.length})
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

          {preEventTasks.length === 0 && eventDayTasks.length === 0 && postEventTasks.length === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No event-specific workflow generated yet</p>
                <p className="text-sm text-gray-400">
                  Click "Generate Event Workflow" to create dynamic tasks based on event type
                </p>
              </CardContent>
            </Card>
          )}

          {visibleTasks.length === 0 && tasks.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No tasks assigned to your role</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}