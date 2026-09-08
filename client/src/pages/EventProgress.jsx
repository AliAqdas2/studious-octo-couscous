import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity, ExternalLink, Search } from 'lucide-react';
import { isFoodTourExperience } from '@/lib/foodTourExperiences';
import { isOpsPanelComplete } from '@/lib/opsPanelCompletion';
import {
  findOpsPanelTask,
  OPS_PANEL_MILESTONES,
} from '@/lib/opsPanelTasks';
import {
  buildTeamMemberOptions,
  enrichTeamMemberOptions,
} from '@/lib/taskTeamMembers';

function daysDeltaLabel(dueRaw) {
  if (!dueRaw) return { text: 'No due date', kind: 'none' };
  const due = new Date(dueRaw);
  if (Number.isNaN(due.getTime())) return { text: 'No due date', kind: 'none' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days === 0) return { text: 'Due today', kind: 'today' };
  if (days > 0) {
    return {
      text: `${days} day${days === 1 ? '' : 's'} remaining`,
      kind: 'future',
    };
  }
  const overdue = Math.abs(days);
  return {
    text: `${overdue} day${overdue === 1 ? '' : 's'} overdue`,
    kind: 'overdue',
  };
}

function taskAssigneeId(task) {
  if (!task) return null;
  return task.assigned_user || task.assignedUser || null;
}

function taskDue(task) {
  if (!task) return null;
  return task.due_date || task.dueDate || null;
}

/**
 * Admin dashboard: per-event ops-panel progress (mirrors Event Detail panels).
 */
export default function EventProgress() {
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-event_date', 500),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date', 2000),
  });

  const { data: sideFlagsBody, isLoading: flagsLoading } = useQuery({
    queryKey: ['ops-panel-side-flags'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOpsPanelSideFlags', {});
      return res?.data ?? res;
    },
  });

  const sideByEvent = sideFlagsBody?.byEventId || {};

  const { data: roleAssignments = [] } = useQuery({
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
      enrichTeamMemberOptions(buildTeamMemberOptions(roleAssignments), users),
    [roleAssignments, users]
  );

  const nameFor = (userId) => {
    if (!userId) return null;
    return (
      teamMembers.find((m) => m.userId === userId)?.name ||
      teamMembers.find((m) => m.userId === userId)?.label ||
      String(userId).slice(0, 8)
    );
  };

  const tasksByEvent = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      if (task.category === 'Checklist') continue;
      const eid = task.event_id || task.eventId;
      if (!eid) continue;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid).push(task);
    }
    return map;
  }, [tasks]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [];

    for (const event of events) {
      const eventId = event.id;
      const eventName = event.event_name || event.eventName || 'Unknown event';
      const eventDate = event.event_date || event.eventDate || null;
      const showFoodTour = isFoodTourExperience(
        event.event_type || event.eventType
      );
      const eventTasks = tasksByEvent.get(eventId) || [];
      const flags = sideByEvent[eventId] || {
        hasInventory: false,
        attendeeCount: 0,
        stopCount: 0,
      };

      const milestones = OPS_PANEL_MILESTONES.filter(
        (m) => !m.foodTourOnly || showFoodTour
      ).map((m) => {
        const task = findOpsPanelTask(m.panelId, eventTasks);
        const complete = isOpsPanelComplete(m.panelId, event, flags);
        const dueRaw = taskDue(task);
        const assigneeId = taskAssigneeId(task);
        const due = daysDeltaLabel(dueRaw);
        const overdue =
          !complete &&
          dueRaw &&
          !Number.isNaN(new Date(dueRaw).getTime()) &&
          new Date(dueRaw) < new Date();
        return {
          panelId: m.panelId,
          label: m.label,
          task,
          complete,
          assigneeId,
          dueRaw,
          due,
          overdue,
        };
      });

      if (assigneeFilter !== 'all') {
        const hasAssignee = milestones.some(
          (m) => m.assigneeId === assigneeFilter
        );
        if (!hasAssignee) continue;
      }

      let visible = milestones;
      if (statusFilter === 'open') {
        visible = visible.filter((m) => !m.complete);
      } else if (statusFilter === 'done') {
        visible = visible.filter((m) => m.complete);
      } else if (statusFilter === 'overdue') {
        visible = visible.filter((m) => m.overdue);
      }

      if (assigneeFilter !== 'all' && statusFilter !== 'all') {
        visible = visible.filter((m) => m.assigneeId === assigneeFilter);
      }

      if (statusFilter !== 'all' && visible.length === 0) continue;

      if (q) {
        const hay = [
          eventName,
          ...milestones.map((m) => m.label),
          ...milestones.map((m) => nameFor(m.assigneeId)),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const done = milestones.filter((m) => m.complete).length;
      const total = milestones.length;
      rows.push({
        eventId,
        event,
        eventName,
        eventDate,
        milestones: statusFilter === 'all' ? milestones : visible,
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : 0,
      });
    }

    rows.sort((a, b) => {
      const da = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const db = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return db - da;
    });
    return rows;
  }, [
    events,
    tasksByEvent,
    sideByEvent,
    search,
    assigneeFilter,
    statusFilter,
    teamMembers,
  ]);

  const isLoading = eventsLoading || tasksLoading || flagsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#C84B31] flex items-center gap-2">
          <Activity className="w-8 h-8" />
          Event Progress
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Ops panels from Event Detail (Deposit, ROS, Inventory, BEO, and the
          rest) — done when the panel data is filled in.
        </p>
      </div>

      <Card className="bg-white/80 border-orange-100">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search event, panel, or assignee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name || m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center py-12 text-gray-500">Loading progress…</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            No events match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card
              key={group.eventId}
              className="bg-white/90 border-orange-100 overflow-hidden"
            >
              <CardHeader className="pb-2 bg-orange-50/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link
                        to={
                          createPageUrl('EventDetail') +
                          `?id=${group.eventId}`
                        }
                        className="text-[#C84B31] hover:underline inline-flex items-center gap-1"
                      >
                        {group.eventName}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </CardTitle>
                    {group.eventDate ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Event date:{' '}
                        {new Date(group.eventDate).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-700">
                      {group.pct}%
                    </p>
                    <p className="text-xs text-gray-600">
                      {group.done}/{group.total} panels done
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2 font-medium">Panel</th>
                        <th className="px-4 py-2 font-medium">Assigned to</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.milestones.map((m) => {
                        const assignee = nameFor(m.assigneeId);
                        return (
                          <tr
                            key={m.panelId}
                            className="border-b last:border-0 hover:bg-orange-50/30"
                          >
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {m.label}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {assignee || (
                                <span className="text-gray-400">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={
                                  m.complete
                                    ? 'bg-green-100 text-green-700'
                                    : m.overdue
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                                }
                              >
                                {m.complete
                                  ? 'Done'
                                  : m.overdue
                                    ? 'Overdue'
                                    : 'Open'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={
                                  m.due.kind === 'overdue' && !m.complete
                                    ? 'text-red-600 font-medium'
                                    : m.due.kind === 'today' && !m.complete
                                      ? 'text-amber-700 font-medium'
                                      : 'text-gray-600'
                                }
                              >
                                {m.complete ? '—' : m.due.text}
                              </span>
                              {!m.complete && m.dueRaw ? (
                                <span className="block text-[11px] text-gray-400">
                                  {new Date(m.dueRaw).toLocaleDateString()}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
