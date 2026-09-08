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
import { buildTeamMemberOptions, enrichTeamMemberOptions } from '@/lib/taskTeamMembers';

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

function isDone(status) {
  return status === 'Done' || status === 'Completed';
}

function isOverdue(task) {
  if (!task?.due_date || isDone(task.status)) return false;
  return new Date(task.due_date) < new Date();
}

/**
 * Admin dashboard: per-event task assignment & completion progress.
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

  const eventById = useMemo(() => {
    const map = new Map();
    for (const e of events) map.set(e.id, e);
    return map;
  }, [events]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.category === 'Checklist') return false;
      if (assigneeFilter !== 'all' && task.assigned_user !== assigneeFilter) {
        return false;
      }
      if (statusFilter === 'open' && isDone(task.status)) return false;
      if (statusFilter === 'done' && !isDone(task.status)) return false;
      if (statusFilter === 'overdue' && !isOverdue(task)) return false;
      if (q) {
        const event = eventById.get(task.event_id);
        const hay = [
          task.title,
          event?.event_name,
          event?.eventName,
          nameFor(task.assigned_user),
          nameFor(task.completed_by || task.completedBy),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, assigneeFilter, statusFilter, search, eventById, teamMembers]);

  const groups = useMemo(() => {
    const byEvent = new Map();
    for (const task of filteredTasks) {
      const eid = task.event_id;
      if (!byEvent.has(eid)) byEvent.set(eid, []);
      byEvent.get(eid).push(task);
    }
    const rows = [...byEvent.entries()].map(([eventId, eventTasks]) => {
      const event = eventById.get(eventId);
      const done = eventTasks.filter((t) => isDone(t.status)).length;
      const total = eventTasks.length;
      const eventDate = event?.event_date || event?.eventDate || null;
      return {
        eventId,
        event,
        eventTasks: [...eventTasks].sort(
          (a, b) =>
            new Date(a.due_date || 0).getTime() -
            new Date(b.due_date || 0).getTime()
        ),
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : 0,
        eventDate,
      };
    });
    rows.sort((a, b) => {
      const da = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const db = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return db - da;
    });
    return rows;
  }, [filteredTasks, eventById]);

  const isLoading = eventsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#C84B31] flex items-center gap-2">
          <Activity className="w-8 h-8" />
          Event Progress
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Team assignments, completion, and due timing across events.
        </p>
      </div>

      <Card className="bg-white/80 border-orange-100">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search event, task, or person…"
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
            No tasks match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const name =
              group.event?.event_name ||
              group.event?.eventName ||
              'Unknown event';
            return (
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
                          {name}
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
                        {group.done}/{group.total} done
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2 font-medium">Task</th>
                          <th className="px-4 py-2 font-medium">Assigned to</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Due</th>
                          <th className="px-4 py-2 font-medium">Completed by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.eventTasks.map((task) => {
                          const due = daysDeltaLabel(task.due_date);
                          const assignee = nameFor(task.assigned_user);
                          const completerId =
                            task.completed_by || task.completedBy;
                          const completer = nameFor(completerId);
                          return (
                            <tr
                              key={task.id}
                              className="border-b last:border-0 hover:bg-orange-50/30"
                            >
                              <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs">
                                {task.title}
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
                                    isDone(task.status)
                                      ? 'bg-green-100 text-green-700'
                                      : task.status === 'Working On It'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                                  }
                                >
                                  {task.status || 'Open'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={
                                    due.kind === 'overdue'
                                      ? 'text-red-600 font-medium'
                                      : due.kind === 'today'
                                        ? 'text-amber-700 font-medium'
                                        : 'text-gray-600'
                                  }
                                >
                                  {due.text}
                                </span>
                                {task.due_date ? (
                                  <span className="block text-[11px] text-gray-400">
                                    {new Date(
                                      task.due_date
                                    ).toLocaleDateString()}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">
                                {isDone(task.status) ? (
                                  <>
                                    {completer ||
                                      (assignee
                                        ? `Assigned: ${assignee}`
                                        : 'Unknown')}
                                    {task.completion_timestamp ? (
                                      <span className="block text-[11px] text-gray-400">
                                        {new Date(
                                          task.completion_timestamp
                                        ).toLocaleString()}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
