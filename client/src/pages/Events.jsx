import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Calendar,
  Users,
  MapPin,
  Trash2,
  AlertCircle,
  Clock,
  Edit,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import EventFormDialog from '@/components/events/EventFormDialog';
import { toast } from 'sonner';
import {
  daysUntilEvent,
  formatDaysUntilEvent,
  getTopEventAlerts,
} from '@/lib/eventMilestones';
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

  const handleEdit = (event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date'),
  });

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
      toast.success('Event and associated tasks deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const filteredEvents = events.filter((event) => {
    const canonical = normalizeEventStage(event.stage);
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
      event.poc_name?.toLowerCase().includes(q) ||
      event.event_format?.toLowerCase().includes(q) ||
      canonical.toLowerCase().includes(q)
    );
  });

  const formatLabel = (format) => {
    if (!format) return null;
    if (format === 'Virtual') return 'Remote';
    return format;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Events</h1>
          <p className="text-gray-600">
            Manage your event operations and workflows
          </p>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search events..."
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <p className="text-center py-12 text-gray-500 col-span-2">
            Loading events...
          </p>
        ) : filteredEvents.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100 col-span-2">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No events found</p>
            </CardContent>
          </Card>
        ) : (
          filteredEvents.map((event) => {
            const days = daysUntilEvent(event.event_date);
            const countdown = formatDaysUntilEvent(days);
            const alerts = getTopEventAlerts(event, {}, 2);
            const stageLabel = normalizeEventStage(event.stage);
            const isPast =
              isTerminalEventStage(stageLabel) ||
              (days != null && days < 0);

            return (
              <Card
                key={event.id}
                className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-lg transition-all hover:border-[#C84B31] h-full"
              >
                <CardContent className="p-6">
                  <Link to={createPageUrl(`EventDetail?id=${event.id}`)}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {event.event_name}
                          </h3>
                          {event.poc_name ? (
                            <p className="text-sm text-gray-700 mb-1">
                              {event.poc_name}
                            </p>
                          ) : null}
                          {formatLabel(event.event_format) ? (
                            <p className="text-gray-600">
                              {formatLabel(event.event_format)}
                            </p>
                          ) : null}
                          {event.event_type ? (
                            <p className="text-gray-600">{event.event_type}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Badge
                            className={`${getEventStageColor(stageLabel)} border font-medium`}
                            title={stageLabel}
                          >
                            {stageLabel}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit event"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(event);
                            }}
                            className="text-gray-600 hover:text-[#C84B31] hover:bg-orange-50 h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(event.event_date).toLocaleDateString(
                              'en-US',
                              {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              }
                            )}
                          </span>
                        </div>
                        {countdown && !isPast ? (
                          <div className="flex items-center gap-2 text-[#C84B31] font-medium">
                            <Clock className="w-4 h-4" />
                            <span>{countdown}</span>
                          </div>
                        ) : null}
                        {event.venue && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{event.venue}</span>
                          </div>
                        )}
                        {event.headcount && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{event.headcount} guests</span>
                          </div>
                        )}
                      </div>

                      {!isPast && alerts.length > 0 ? (
                        <div className="space-y-1.5 pt-2 border-t border-amber-100">
                          {alerts.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-start gap-2 text-xs text-amber-900"
                            >
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                              <span>
                                {a.label}
                                {a.daysLeft != null && a.daysLeft < 0
                                  ? ` · overdue`
                                  : a.daysLeft != null && a.id !== 'deposit'
                                    ? ` · ${a.daysLeft === 0 ? 'due today' : `${a.daysLeft}d left`}`
                                    : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {event.deposit_received && (
                        <div className="pt-3 border-t border-gray-200">
                          <span className="text-xs text-green-600 font-medium">
                            ✓ Deposit Received
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {showForm && (
        <EventFormDialog event={editingEvent} onClose={handleCloseForm} />
      )}
    </div>
  );
}
