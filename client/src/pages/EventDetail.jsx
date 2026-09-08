import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import DepositIntakeForm from '@/components/events/DepositIntakeForm';
import EventStaffingPanel from '@/components/events/EventStaffingPanel';
import EventInventoryChecklist from '@/components/events/EventInventoryChecklist';
import EventFoodTourStopsPanel from '@/components/events/EventFoodTourStopsPanel';
import EventAttendeesPanel from '@/components/events/EventAttendeesPanel';
import RunOfShowForm from '@/components/events/RunOfShowForm';
import BeoDocumentPanel from '@/components/events/BeoDocumentPanel';
import { isFoodTourExperience } from '@/lib/foodTourExperiences';
import EventArtifactsPanel from '@/components/events/EventArtifactsPanel';
import PostEventPanel from '@/components/events/PostEventPanel';
import EventFormDialog from '@/components/events/EventFormDialog';
import EventTasksPanel from '@/components/events/EventTasksPanel';

function readTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tab') === 'tasks' ? 'tasks' : 'details';
}

function setTabInUrl(tab) {
  const params = new URLSearchParams(window.location.search);
  if (tab === 'tasks') params.set('tab', 'tasks');
  else params.delete('tab');
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', next);
}

export default function EventDetail() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
  const [user, setUser] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [tab, setTab] = useState(readTabFromUrl);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const events = await base44.entities.Event.filter({ id: eventId });
      return events[0];
    },
    enabled: !!eventId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: () => base44.entities.Task.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  const { data: roleAssignments = [] } = useQuery({
    queryKey: ['roleAssignment', user?.id],
    queryFn: () => base44.entities.RoleAssignment.filter({ user_id: user.id }),
    enabled: !!user && user?.role !== 'admin',
  });

  const { data: experienceInfo } = useQuery({
    queryKey: ['event-experience', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventExperience', {
        eventId,
      });
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
  const needsZach =
    Boolean(experienceInfo?.needsZachReview) && !zachTaskDone;
  const hasRos = Boolean(event?.event_type);

  const canEditOps =
    user?.role === 'admin' ||
    roleAssignments.some((r) =>
      ['Ops', 'Ops Manager', 'Intern', 'Admin'].includes(r.role)
    );

  const hasWorkflowTasks = tasks.some((t) => t.category !== 'Checklist');
  const canRegenerate =
    user?.role === 'admin' ||
    roleAssignments.some((r) =>
      ['Ops', 'Ops Manager', 'Admin'].includes(r.role)
    );

  const generateWorkflowMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('generateEventWorkflow', { eventId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-tasks', eventId]);
      queryClient.invalidateQueries(['event-inventory', eventId]);
      queryClient.invalidateQueries(['event-experience', eventId]);
      toast.success('Event workflow generated successfully');
      setTab('tasks');
      setTabInUrl('tasks');
    },
    onError: () => toast.error('Failed to generate workflow'),
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

  const handleTabChange = (next) => {
    setTab(next);
    setTabInUrl(next);
  };

  if (isLoading || !event) {
    return <div className="text-center py-12">Loading event...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">
            {event.event_name}
          </h1>
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
          </div>
          {needsZach && experience?.flagNote && (
            <p className="text-xs text-amber-800 mt-2 max-w-xl">
              {experience.flagNote}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Event
          </Button>
          {!hasWorkflowTasks && (
            <Button
              onClick={() => generateWorkflowMutation.mutate()}
              disabled={generateWorkflowMutation.isPending}
              className="bg-[#C84B31] hover:bg-[#A03A23]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateWorkflowMutation.isPending
                ? 'Generating...'
                : 'Generate Event Workflow'}
            </Button>
          )}
        </div>
      </div>

      {showEditForm && (
        <EventFormDialog event={event} onClose={() => setShowEditForm(false)} />
      )}

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="bg-white/80 border border-orange-100">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          <EventStaffingPanel
            eventId={eventId}
            event={event}
            onGenerate={() => generateWorkflowMutation.mutate()}
            generatePending={generateWorkflowMutation.isPending}
          />

          <DepositIntakeForm event={event} user={user} />

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

          {isFoodTourExperience(event?.event_type) && (
            <EventFoodTourStopsPanel
              eventId={eventId}
              event={event}
              canEdit={canEditOps}
            />
          )}

          <EventAttendeesPanel
            eventId={eventId}
            event={event}
            canEdit={canEditOps}
          />

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
                [
                  'Ops',
                  'Ops Manager',
                  'Sales',
                  'Admin',
                  'Event Host',
                ].includes(r.role)
              )
            }
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <EventTasksPanel
            eventId={eventId}
            user={user}
            roleAssignments={roleAssignments}
            onGenerate={() => generateWorkflowMutation.mutate()}
            generatePending={generateWorkflowMutation.isPending}
            canRegenerate={canRegenerate}
            regeneratePending={regenerateWorkflowMutation.isPending}
            onRegenerate={() => {
              const ok = window.confirm(
                'Regenerating deletes OPEN (non-Done) tasks and rebuilds from the current event type template (including shared ROS). Done tasks are kept. Continue?'
              );
              if (ok) regenerateWorkflowMutation.mutate();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
