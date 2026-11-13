import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Edit, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import EventFormDialog from '@/components/events/EventFormDialog';
import { toast } from 'sonner';
import {
  EVENT_FILTER_STAGES,
  getEventStageColor,
  isTerminalEventStage,
  normalizeEventStage,
} from '@/components/events/eventPipelineConfig';

function readStagesFromParams(searchParams) {
  const raw = searchParams.getAll('stage');
  if (raw.length === 0) {
    const single = searchParams.get('stage');
    if (single) return [normalizeEventStage(single)];
    return [];
  }
  return [...new Set(raw.map((s) => normalizeEventStage(s)))];
}

function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(status) {
  if (!status) return '—';
  if (status === 'pending') return 'Pending';
  if (status === 'done') return 'Done';
  return status;
}

function Cell({ children, className = '' }) {
  return (
    <td
      className={`px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap align-top border-b border-orange-50 ${className}`}
    >
      {children}
    </td>
  );
}

function GroupHeader({ label, colSpan, tone }) {
  const tones = {
    client: 'bg-sky-50 text-sky-900 border-sky-100',
    ops: 'bg-amber-50 text-amber-950 border-amber-100',
    post: 'bg-indigo-50 text-indigo-900 border-indigo-100',
    identity: 'bg-orange-50 text-[#C84B31] border-orange-100',
  };
  return (
    <th
      colSpan={colSpan}
      className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide border-b ${tones[tone] || tones.identity}`}
    >
      {label}
    </th>
  );
}

function ColHeader({ children, sticky = false }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-orange-100 bg-white whitespace-nowrap ${
        sticky ? 'sticky left-0 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''
      }`}
    >
      {children}
    </th>
  );
}

export default function Events() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  const filterStages = useMemo(
    () => readStagesFromParams(searchParams),
    [searchParams]
  );

  const setFilterStages = (next) => {
    const stages = typeof next === 'function' ? next(filterStages) : next;
    const params = new URLSearchParams(searchParams);
    params.delete('stage');
    for (const s of stages) {
      params.append('stage', s);
    }
    setSearchParams(params, { replace: true });
  };

  const toggleStage = (stage) => {
    setFilterStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleEdit = async (event) => {
    try {
      const rows = await base44.entities.Event.filter({ id: event.id });
      const full = Array.isArray(rows) ? rows[0] : null;
      setEditingEvent(full || event);
      setShowForm(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to load event for edit');
    }
  };

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: boardPayload, isLoading } = useQuery({
    queryKey: ['events-flow-board'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventsFlowBoard', {});
      const body = res?.data ?? res;
      return Array.isArray(body?.events) ? body.events : [];
    },
  });

  const events = boardPayload || [];

  const deleteMutation = useMutation({
    mutationFn: async (eventId) => {
      const event = events.find((e) => e.id === eventId);

      if (normalizeEventStage(event.stage) === 'Completed') {
        throw new Error(
          'Cannot delete completed events. Please archive instead.'
        );
      }

      if (new Date(event.event_date) < new Date()) {
        throw new Error(
          'Cannot delete past events. Please contact admin to archive.'
        );
      }

      const tasks = await base44.entities.Task.filter({ event_id: eventId });
      await Promise.all(tasks.map((task) => base44.entities.Task.delete(task.id)));

      await base44.entities.Event.delete(eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['events-flow-board']);
      toast.success('Event and associated tasks deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const filteredEvents = events.filter((event) => {
    const canonical = normalizeEventStage(event.stage || event.operation_stage);
    if (filterStages.length > 0) {
      if (!filterStages.includes(canonical)) return false;
    } else if (isTerminalEventStage(canonical)) {
      return false;
    }

    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      event.event_name?.toLowerCase().includes(q) ||
      event.event_type?.toLowerCase().includes(q) ||
      event.client_name?.toLowerCase().includes(q) ||
      event.company_name?.toLowerCase().includes(q) ||
      event.phone_number?.toLowerCase().includes(q) ||
      event.client_assigned_task?.toLowerCase().includes(q) ||
      event.ops_assigned_task?.toLowerCase().includes(q) ||
      event.client_assigned_to?.toLowerCase().includes(q) ||
      event.ops_assigned_to?.toLowerCase().includes(q) ||
      canonical.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Events</h1>
          <p className="text-gray-600">
            Confirmed event flow — client interaction and operations in one list
          </p>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search events, company, assignee, tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Stage
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_FILTER_STAGES.map((stage) => {
                const active = filterStages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => toggleStage(stage)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                      active
                        ? `${getEventStageColor(stage)} ring-2 ring-[#C84B31]/30`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    {stage}
                  </button>
                );
              })}
              {filterStages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilterStages([])}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              ) : (
                <span className="text-xs text-gray-400 self-center ml-1">
                  Default: active events only
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-orange-100 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-12 text-gray-500">Loading events...</p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No events found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1400px] w-full border-collapse">
                <thead>
                  <tr>
                    <GroupHeader label="Event" colSpan={6} tone="identity" />
                    <GroupHeader
                      label="Client Interaction"
                      colSpan={4}
                      tone="client"
                    />
                    <GroupHeader label="Operations" colSpan={5} tone="ops" />
                    <GroupHeader label="Post-Event" colSpan={2} tone="post" />
                    <th className="px-3 py-2 border-b border-orange-100 bg-orange-50" />
                  </tr>
                  <tr>
                    <ColHeader sticky>Events Name</ColHeader>
                    <ColHeader>Company Name</ColHeader>
                    <ColHeader>Client Name</ColHeader>
                    <ColHeader>Phone Number</ColHeader>
                    <ColHeader>Event Date</ColHeader>
                    <ColHeader>Event Time</ColHeader>
                    <ColHeader>Assigned Task</ColHeader>
                    <ColHeader>Assigned To</ColHeader>
                    <ColHeader>Due Date</ColHeader>
                    <ColHeader>Status</ColHeader>
                    <ColHeader>Operation Stages</ColHeader>
                    <ColHeader>Assigned Task</ColHeader>
                    <ColHeader>Assigned To</ColHeader>
                    <ColHeader>Due Date</ColHeader>
                    <ColHeader>Status</ColHeader>
                    <ColHeader>Post-Event</ColHeader>
                    <ColHeader>Completed Date</ColHeader>
                    <ColHeader>Actions</ColHeader>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => {
                    const stageLabel = normalizeEventStage(
                      event.stage || event.operation_stage
                    );
                    return (
                      <tr
                        key={event.id}
                        className="hover:bg-orange-50/40 transition-colors"
                      >
                        <Cell className="sticky left-0 z-10 bg-white font-semibold text-gray-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          <Link
                            to={createPageUrl(`EventDetail?id=${event.id}`)}
                            className="text-[#C84B31] hover:underline"
                          >
                            {event.event_name || 'Untitled'}
                          </Link>
                        </Cell>
                        <Cell>{event.company_name || '—'}</Cell>
                        <Cell>{event.client_name || '—'}</Cell>
                        <Cell>{event.phone_number || '—'}</Cell>
                        <Cell>{formatShortDate(event.event_date)}</Cell>
                        <Cell>{event.event_time || '—'}</Cell>
                        <Cell className="max-w-[200px] whitespace-normal">
                          {event.client_assigned_task ||
                            event.client_interaction_stage ||
                            '—'}
                        </Cell>
                        <Cell>{event.client_assigned_to || '—'}</Cell>
                        <Cell>{formatShortDate(event.client_due_date)}</Cell>
                        <Cell>{formatStatus(event.client_status)}</Cell>
                        <Cell>
                          <Badge
                            className={`${getEventStageColor(stageLabel)} border font-medium`}
                          >
                            {stageLabel}
                          </Badge>
                        </Cell>
                        <Cell className="max-w-[200px] whitespace-normal">
                          {event.ops_assigned_task || '—'}
                        </Cell>
                        <Cell>{event.ops_assigned_to || '—'}</Cell>
                        <Cell>{formatShortDate(event.ops_due_date)}</Cell>
                        <Cell>{event.ops_status || '—'}</Cell>
                        <Cell>
                          {event.post_event ? (
                            <span className="text-indigo-700 font-medium">
                              In post-event
                            </span>
                          ) : (
                            '—'
                          )}
                        </Cell>
                        <Cell>{formatShortDate(event.completed_date)}</Cell>
                        <Cell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit event"
                              onClick={() => handleEdit(event)}
                              className="text-gray-600 hover:text-[#C84B31] hover:bg-orange-50 h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('Delete this event?')) {
                                    deleteMutation.mutate(event.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </Cell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <EventFormDialog
          event={editingEvent}
          onClose={() => {
            handleCloseForm();
            queryClient.invalidateQueries(['events-flow-board']);
          }}
        />
      )}
    </div>
  );
}
