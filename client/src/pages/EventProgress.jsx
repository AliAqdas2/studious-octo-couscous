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
import OverdueQueue from '@/components/event-progress/OverdueQueue';
import PanelBottleneckBars from '@/components/event-progress/PanelBottleneckBars';
import ProgressKpiStrip from '@/components/event-progress/ProgressKpiStrip';
import TeamWorkloadTable from '@/components/event-progress/TeamWorkloadTable';
import {
  buildEventProgressGroups,
  buildOverdueQueue,
  buildPanelBottlenecks,
  buildTasksByEvent,
  buildTeamStats,
  computeKpis,
  filterEventGroups,
} from '@/lib/eventProgressStats';
import {
  buildTeamMemberOptions,
  enrichTeamMemberOptions,
} from '@/lib/taskTeamMembers';

/**
 * Admin ops dashboard: KPIs, overdue queue, team workload, bottlenecks,
 * and per-event panel progress.
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

  const tasksByEvent = useMemo(() => buildTasksByEvent(tasks), [tasks]);

  const allGroups = useMemo(
    () =>
      buildEventProgressGroups({
        events,
        tasksByEvent,
        sideByEvent,
        activeWindowOnly: true,
      }),
    [events, tasksByEvent, sideByEvent]
  );

  const kpis = useMemo(() => computeKpis(allGroups), [allGroups]);
  const overdueItems = useMemo(
    () => buildOverdueQueue(allGroups),
    [allGroups]
  );
  const teamRows = useMemo(
    () => buildTeamStats(allGroups, nameFor),
    [allGroups, teamMembers]
  );
  const bottleneckRows = useMemo(
    () => buildPanelBottlenecks(allGroups),
    [allGroups]
  );

  const groups = useMemo(
    () =>
      filterEventGroups(allGroups, {
        search,
        assigneeFilter,
        statusFilter,
        nameFor,
      }),
    [allGroups, search, assigneeFilter, statusFilter, teamMembers]
  );

  const isLoading = eventsLoading || tasksLoading || flagsLoading;

  const handleKpiSelect = (key) => {
    setSearch('');
    if (key === 'all') {
      setStatusFilter('all');
      setAssigneeFilter('all');
      return;
    }
    if (key === 'done') {
      setStatusFilter('done');
      return;
    }
    setStatusFilter(key);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#C84B31] flex items-center gap-2">
          <Activity className="w-8 h-8" />
          Event Progress
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Ops dashboard for Event Detail panels — completion, overdue work, and
          team workload (next 60 days).
        </p>
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-gray-500">Loading dashboard…</p>
      ) : (
        <>
          <ProgressKpiStrip
            kpis={kpis}
            activeFilter={statusFilter}
            onSelect={handleKpiSelect}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1">
              <OverdueQueue items={overdueItems} nameFor={nameFor} />
            </div>
            <div className="xl:col-span-1">
              <TeamWorkloadTable
                rows={teamRows}
                onSelectAssignee={(userId) => {
                  setAssigneeFilter(userId);
                  setStatusFilter('all');
                }}
              />
            </div>
            <div className="xl:col-span-1">
              <PanelBottleneckBars rows={bottleneckRows} />
            </div>
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
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_today">Due today</SelectItem>
                  <SelectItem value="unassigned">Unassigned open</SelectItem>
                  <SelectItem value="at_risk">At-risk events</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Events
              <span className="ml-2 text-sm font-normal text-gray-500">
                {groups.length} shown · at-risk first, then soonest date
              </span>
            </h2>

            {groups.length === 0 ? (
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
                    className={`bg-white/90 border-orange-100 overflow-hidden ${
                      group.atRisk ? 'ring-1 ring-amber-300' : ''
                    }`}
                  >
                    <CardHeader className="pb-2 bg-orange-50/50">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg flex flex-wrap items-center gap-2">
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
                            {group.atRisk ? (
                              <Badge className="bg-amber-100 text-amber-800 font-normal">
                                At risk
                              </Badge>
                            ) : null}
                          </CardTitle>
                          {group.eventDate ? (
                            <p className="text-xs text-gray-500 mt-1">
                              Event date:{' '}
                              {new Date(group.eventDate).toLocaleDateString()}
                            </p>
                          ) : null}
                          <div className="mt-2 h-1.5 max-w-xs rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full ${
                                group.pct >= 80
                                  ? 'bg-green-500'
                                  : group.pct >= 50
                                    ? 'bg-[#C84B31]'
                                    : 'bg-amber-500'
                              }`}
                              style={{ width: `${group.pct}%` }}
                            />
                          </div>
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
                              <th className="px-4 py-2 font-medium">
                                Assigned to
                              </th>
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
                                          : m.due.kind === 'today' &&
                                              !m.complete
                                            ? 'text-amber-700 font-medium'
                                            : 'text-gray-600'
                                      }
                                    >
                                      {m.complete ? '—' : m.due.text}
                                    </span>
                                    {!m.complete && m.dueRaw ? (
                                      <span className="block text-[11px] text-gray-400">
                                        {new Date(
                                          m.dueRaw
                                        ).toLocaleDateString()}
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
        </>
      )}
    </div>
  );
}
