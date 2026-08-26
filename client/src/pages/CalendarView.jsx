import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { STAGE_COLORS, CHANNEL_COLORS } from '@/components/leads/pipelineConfig';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import { useAuth } from '@/lib/AuthContext';
import { isOpsRole, isSystemAdmin } from '@/lib/operationalAccess';

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function TodoCalendar({ currentDate, todos }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const todosByDay = {};
  todos.forEach(todo => {
    const d = new Date(todo.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!todosByDay[key]) todosByDay[key] = [];
    todosByDay[key].push(todo);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} className="min-h-[120px] bg-gray-50/50 border border-gray-100 rounded-lg" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const key = `${year}-${month}-${day}`;
    const dayTodos = todosByDay[key] || [];
    const isToday = isSameDay(dateObj, today);
    cells.push(
      <div key={day} className={`min-h-[120px] border rounded-lg p-1.5 ${isToday ? 'bg-orange-50 border-[#C84B31]' : 'bg-white border-gray-200 hover:border-orange-200'}`}>
        <div className={`text-xs font-semibold mb-1 px-1 ${isToday ? 'text-[#C84B31]' : 'text-gray-500'}`}>{day}</div>
        <div className="space-y-1 overflow-y-auto max-h-[90px]">
          {dayTodos.map(todo => (
            <Link key={todo.id} to={todo.link}>
              <div className={`px-1.5 py-1 rounded text-xs border transition-colors cursor-pointer ${
                  todo.warningType === 'no_response' ? 'bg-red-50 hover:bg-red-100 border-red-200' :
                  todo.warningType === 'no_email' ? 'bg-orange-50 hover:bg-orange-100 border-orange-200' :
                  'bg-blue-50 hover:bg-blue-100 border-blue-100'
                }`}>
                  <p className={`font-medium truncate flex items-center gap-1 ${todo.warningType === 'no_response' ? 'text-red-900' : todo.warningType === 'no_email' ? 'text-orange-900' : 'text-blue-900'}`}>
                    <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />{todo.title}
                  </p>
                  {todo.subtitle && <p className={`truncate ${todo.warningType === 'no_response' ? 'text-red-600' : 'text-orange-600'}`}>{todo.subtitle}</p>}
                </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const monthTodos = todos
    .filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === month; })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </div>

      {monthTodos.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">To-Dos this month ({monthTodos.length})</h3>
          <div className="space-y-2">
            {monthTodos.map(todo => (
              <Link key={todo.id} to={todo.link}>
                <div className={`flex items-center gap-4 p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer ${
                  todo.warningType === 'no_response' ? 'border-red-300 bg-red-50 hover:border-red-400' :
                  todo.warningType === 'no_email' ? 'border-orange-300 bg-orange-50 hover:border-orange-400' :
                  todo.warningType === 'followup' ? 'border-green-300 bg-green-50 hover:border-green-400' :
                  'border-gray-200 bg-white hover:border-blue-300'
                }`}>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-gray-500">{new Date(todo.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                    <p className={`text-lg font-bold ${
                      todo.warningType === 'no_response' ? 'text-red-600' :
                      todo.warningType === 'no_email' ? 'text-orange-600' :
                      todo.warningType === 'followup' ? 'text-green-600' : 'text-blue-600'
                    }`}>{new Date(todo.date).getDate()}</p>
                  </div>
                  {todo.warningType === 'followup'
                    ? <CalendarIcon className="w-5 h-5 flex-shrink-0 text-green-500" />
                    : <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${todo.warningType === 'no_response' ? 'text-red-500' : 'text-orange-500'}`} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{todo.title}</p>
                    {todo.subtitle && <p className="text-sm text-gray-500 truncate">{todo.subtitle}</p>}
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${
                      todo.warningType === 'no_response' ? 'text-red-600' :
                      todo.warningType === 'no_email' ? 'text-orange-600' :
                      'text-green-600'
                    }`}>{todo.warningText}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs ${
                      todo.warningType === 'no_response' ? 'bg-red-100 text-red-800' :
                      todo.warningType === 'no_email' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>{todo.status}</Badge>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-400 py-6 text-sm">No to-dos this month</p>
      )}
    </div>
  );
}

export default function CalendarView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignment } = useQuery({
    queryKey: ['user-assignment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (user.role === 'admin') return { is_active: true, role: 'Admin' };
      const assignments = await base44.entities.RoleAssignment.filter({
        user_id: user.id,
      });
      return assignments[0] || null;
    },
    enabled: !!user,
  });

  const eventsOnly = isOpsRole(assignment) && !isSystemAdmin(user);
  const [activeTab, setActiveTab] = useState(eventsOnly ? 'events' : 'leads');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState(null); // null = show all

  useEffect(() => {
    if (eventsOnly && activeTab !== 'events') {
      setActiveTab('events');
      setActiveFilter(null);
    }
  }, [eventsOnly, activeTab]);

  const handleLeadDateChange = async (leadId, newDate) => {
    await base44.entities.Lead.update(leadId, { meeting_date: newDate });
    queryClient.invalidateQueries(['leads']);
  };

  const handleEventDateChange = async (eventId, newDate) => {
    await base44.entities.Event.update(eventId, { event_date: newDate });
    queryClient.invalidateQueries(['events']);
  };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 500),
    enabled: !eventsOnly,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['lead-email-logs'],
    queryFn: () => base44.entities.ActivityLog.filter({ entity_type: 'Lead' }),
    enabled: !eventsOnly,
  });

  // Stage → wait hours before flagging "no response"
  // Awaiting stages inherit the same wait time as their preceding "sent" stage
  const STAGE_WAIT_HOURS = {
    // B2C stages
    'No Answer – 1st Email Sent': 24,
    'Awaiting Response After 1st Email': 24,          // same as above
    'Calendar Invite Sent': 48,
    'Awaiting Calendar Confirmation': 48,             // same as Calendar Invite Sent
    'Invite Not Accepted': 48,
    '2nd Follow-Up – Off Radar': 48,
    'Awaiting Response After 2nd Follow-Up': 48,      // same as 2nd Follow-Up
    'No Response – Final Email Sent': 72,
    'Awaiting Final Response': 72,                    // same as Final Email Sent
    'Invite Accepted – Survey Sent': 24,
    'Survey Sent': 24,
    'Awaiting Survey Response': 24,                   // same as Survey Sent
    'No Survey Response – Follow-Up 1': 48,
    'Awaiting Response After Follow-Up 1': 48,
    'No Response – Follow-Up 2': 48,
    'Awaiting Response After Follow-Up 2': 48,
    'Survey Completed – Calendar Invite Sent': 48,
    'Awaiting Calendar Acceptance': 48,               // same as Survey Completed – Calendar Invite Sent
    'Calendar Invite Resent': 48,
    'Awaiting Acceptance After Resend': 48,           // same as Calendar Invite Resent
    'After Meeting Follow-Up': 48,
    'Awaiting Response After Meeting Follow-Up': 48,  // same as After Meeting Follow-Up
    'Client Follow-Up – Review Template': 72,
    'Awaiting Client Decision': 72,                   // same as Client Follow-Up
    'Deposit Requested': 72,
    'Awaiting Deposit': 72,                           // same as Deposit Requested
  };

  const leadsWithMeeting = useMemo(() =>
    leads.filter(l => l.meeting_date && l.name && l.event_type_interest),
    [leads]
  );

  const eventsWithDate = useMemo(() =>
    events.filter(e => e.event_date && e.event_name && e.event_type),
    [events]
  );

  const todosWithDate = useMemo(() => {
    const now = new Date();
    const todos = [];

    // Group email logs by lead
    const logsByLead = {};
    emailLogs.forEach(a => {
      if (!logsByLead[a.entity_id]) logsByLead[a.entity_id] = [];
      logsByLead[a.entity_id].push(a);
    });

    // Add follow-up todos from post-meeting form
    leads.forEach(lead => {
      if (lead.followup_next_date) {
        const leadName = lead.channel === 'B2B' && lead.company ? lead.company : lead.name;
        todos.push({
          id: `followup-${lead.id}`,
          date: lead.followup_next_date,
          title: `Follow up with ${leadName}`,
          subtitle: lead.followup_experience_confirmation ? `Preferred: ${lead.followup_experience_confirmation}` : `Stage: ${lead.stage}`,
          leadId: lead.id,
          link: createPageUrl('LeadDetail') + '?id=' + lead.id,
          status: 'Follow-Up',
          warningType: 'followup',
          warningText: `Scheduled follow-up`,
        });
      }
    });

    leads.forEach(lead => {
      const waitHours = STAGE_WAIT_HOURS[lead.stage];
      if (!waitHours) return; // Stage not tracked

      const leadLogs = logsByLead[lead.id] || [];
      const leadName = lead.channel === 'B2B' && lead.company ? lead.company : lead.name;

      // Find when we entered this stage
      const stageChanges = leadLogs
        .filter(a => a.action === 'Stage Changed' && a.details?.new_stage === lead.stage)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const stageEnteredAt = stageChanges.length > 0
        ? new Date(stageChanges[0].timestamp)
        : new Date(lead.created_date);

      // Find outbound email sent after entering this stage
      const outboundEmail = leadLogs.find(a =>
        (a.action === 'Automated Email Sent' || a.action === 'Email Activity') &&
        new Date(a.timestamp) >= stageEnteredAt
      );

      if (!outboundEmail) {
        // No email sent yet — flag immediately on today's date
        todos.push({
          id: `no-email-${lead.id}`,
          date: now.toISOString(),
          title: `Send email to ${leadName}`,
          subtitle: `Stage "${lead.stage}" requires an email`,
          leadId: lead.id,
          link: createPageUrl('LeadDetail') + '?id=' + lead.id,
          status: 'Action Required',
          warningType: 'no_email',
          warningText: `No email sent in stage: ${lead.stage}`,
        });
        return;
      }

      // Email was sent — check if wait time has passed
      const emailSentAt = new Date(outboundEmail.timestamp);
      const waitUntil = new Date(emailSentAt.getTime() + waitHours * 60 * 60 * 1000);

      if (now < waitUntil) return; // Still within wait window — no todo yet

      // Check for inbound reply after the email was sent
      const gotReply = leadLogs.some(a =>
        a.action === 'Email Received' &&
        new Date(a.timestamp) > emailSentAt
      );

      if (!gotReply) {
        todos.push({
          id: `no-response-${lead.id}`,
          date: waitUntil.toISOString(),
          title: `No response from ${leadName}`,
          subtitle: `Sent email ${Math.round((now - emailSentAt) / 3600000)}h ago — no reply yet`,
          leadId: lead.id,
          link: createPageUrl('LeadDetail') + '?id=' + lead.id,
          status: 'No Response',
          warningType: 'no_response',
          warningText: `No reply after ${waitHours}h — stage: ${lead.stage}`,
        });
      }
    });

    return todos;
  }, [emailLogs, leads]);

  const goToPrevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Calendar</h1>
        <p className="text-gray-600">
          {eventsOnly
            ? 'View event schedules'
            : 'View lead meetings and event schedules'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {!eventsOnly ? (
          <TabsList className="bg-orange-50 border border-orange-200">
            <TabsTrigger
              value="leads"
              className="data-[state=active]:bg-[#C84B31] data-[state=active]:text-white"
              onClick={() => setActiveFilter(null)}
            >
              Leads
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="data-[state=active]:bg-[#C84B31] data-[state=active]:text-white"
              onClick={() => setActiveFilter(null)}
            >
              Events
            </TabsTrigger>
          </TabsList>
        ) : null}

        {/* Color Legend — clickable filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3 px-1">
          {activeTab === 'leads' && !eventsOnly ? (
            <>
              {[
                { key: 'meeting', dot: 'bg-orange-400', label: 'Meeting' },
                { key: 'followup', dot: 'bg-green-500', label: 'Scheduled Follow-Up' },
                { key: 'no_response', dot: 'bg-red-500', label: 'No Response' },
              ].map(({ key, dot, label }) => {
                const isActive = activeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(prev => prev === key ? null : key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shadow-sm ${
                      isActive
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`}></span>
                    {label}
                  </button>
                );
              })}
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  ✕ Clear filter
                </button>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
              Upcoming Event
            </span>
          )}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">{monthLabel}</h2>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
        </div>

        {!eventsOnly ? (
        <TabsContent value="leads">
          <CalendarGrid
            currentDate={currentDate}
            items={[
              ...(!activeFilter || activeFilter === 'meeting' ? leadsWithMeeting.map(l => ({
                id: l.id,
                date: l.meeting_date,
                title: l.channel === 'B2B' && l.company ? l.company : l.name,
                subtitle: l.event_type_interest,
                badge: l.channel,
                badgeClass: CHANNEL_COLORS[l.channel] || '',
                stageClass: STAGE_COLORS[l.stage] || 'bg-gray-100 text-gray-800',
                stage: l.stage,
                link: createPageUrl('LeadDetail') + '?id=' + l.id,
                name: l.name,
                company: l.company,
              })) : []),
              ...(!activeFilter || activeFilter !== 'meeting'
                ? todosWithDate
                    .filter(t => t.warningType !== 'no_email' && (!activeFilter || t.warningType === activeFilter))
                    .map(t => ({ ...t, isTodo: true }))
                : []),
            ]}
            type="lead"
            onDateChange={handleLeadDateChange}
          />

          {/* To-Dos section within Leads tab */}
          {todosWithDate.length > 0 && activeFilter !== 'meeting' && (() => {
            const sortedTodos = [...todosWithDate]
              .filter(t => t.warningType !== 'no_email' && (!activeFilter || t.warningType === activeFilter))
              .sort((a, b) => new Date(a.date) - new Date(b.date));
            return (
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-2 border-t border-dashed border-orange-200 pt-6">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Lead To-Dos ({sortedTodos.length})</h3>
                </div>
                <div className="space-y-2">
                  {sortedTodos.map(todo => (
                    <Link key={todo.id} to={todo.link}>
                      <div className={`flex items-center gap-4 p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer ${
                        todo.warningType === 'no_response' ? 'border-red-200 bg-red-50 hover:border-red-300' :
                        todo.warningType === 'no_email' ? 'border-blue-200 bg-blue-50 hover:border-blue-300' :
                        'border-green-200 bg-green-50 hover:border-green-300'
                      }`}>
                        <div className="text-center min-w-[50px]">
                          <p className="text-xs text-gray-500">{new Date(todo.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                          <p className={`text-lg font-bold ${
                            todo.warningType === 'no_response' ? 'text-red-600' :
                            todo.warningType === 'no_email' ? 'text-blue-600' : 'text-green-600'
                          }`}>{new Date(todo.date).getDate()}</p>
                        </div>
                        {todo.warningType === 'followup'
                          ? <CalendarIcon className="w-5 h-5 flex-shrink-0 text-green-500" />
                          : <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${todo.warningType === 'no_response' ? 'text-red-500' : 'text-blue-500'}`} />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{todo.title}</p>
                          {todo.subtitle && <p className="text-sm text-gray-500 truncate">{todo.subtitle}</p>}
                          <p className={`text-xs mt-0.5 ${
                            todo.warningType === 'no_response' ? 'text-red-600' :
                            todo.warningType === 'no_email' ? 'text-blue-600' : 'text-green-600'
                          }`}>{todo.warningText}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs ${
                            todo.warningType === 'no_response' ? 'bg-red-100 text-red-800' :
                            todo.warningType === 'no_email' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>{todo.status}</Badge>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </TabsContent>
        ) : null}

        <TabsContent value="events">

          <CalendarGrid
            currentDate={currentDate}
            items={eventsWithDate.map(e => ({
              id: e.id,
              date: e.event_date,
              title: e.event_name,
              subtitle: e.event_type,
              venue: e.venue,
              link: createPageUrl('EventDetail') + '?id=' + e.id,
              stageClass: 'bg-emerald-100 text-emerald-800',
              stage: e.stage,
            }))}
            type="event"
            onDateChange={handleEventDateChange}
          />
        </TabsContent>


      </Tabs>
    </div>
  );
}