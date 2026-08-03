import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { STAGE_COLORS, B2C_STAGES, B2B_STAGES, CHANNEL_COLORS } from '@/components/leads/pipelineConfig';
import { Badge } from '@/components/ui/badge';
import ReportFilters from '@/components/dashboard/ReportFilters';
import ConversionRateChart from '@/components/dashboard/ConversionRateChart';
import SalesCycleChart from '@/components/dashboard/SalesCycleChart';
import PipelineVelocityChart from '@/components/dashboard/PipelineVelocityChart';
import TeamPerformanceChart from '@/components/dashboard/TeamPerformanceChart';

export default function Dashboard() {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', channel: 'all', rep: 'all' });
  const [showReports, setShowReports] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-dashboard'],
    queryFn: () => base44.entities.User.list(),
  });

  // Filtered leads for reports
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (filters.channel !== 'all' && l.channel !== filters.channel) return false;
      if (filters.rep !== 'all' && l.assigned_sales_rep !== filters.rep && l.created_by !== filters.rep) return false;
      if (filters.dateFrom && new Date(l.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(l.created_date) > new Date(filters.dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [leads, filters]);

  const leadsByStageRaw = leads.reduce((acc, lead) => {
    acc[lead.stage] = (acc[lead.stage] || 0) + 1;
    return acc;
  }, {});

  // Order stages by pipeline order (B2C then B2B unique stages)
  const allPipelineStages = [...B2C_STAGES, ...B2B_STAGES.filter(s => !B2C_STAGES.includes(s))];
  const leadsByStage = {};
  allPipelineStages.forEach(stage => {
    if (leadsByStageRaw[stage]) leadsByStage[stage] = leadsByStageRaw[stage];
  });
  // Include any stages not in the defined pipelines
  Object.keys(leadsByStageRaw).forEach(stage => {
    if (!leadsByStage[stage]) leadsByStage[stage] = leadsByStageRaw[stage];
  });

  const eventsByStage = events.reduce((acc, event) => {
    acc[event.stage] = (acc[event.stage] || 0) + 1;
    return acc;
  }, {});

  const tasksByStatus = {
    'Not Acknowledged': tasks.filter(t => t.status === 'Not Acknowledged').length,
    'Working On It': tasks.filter(t => t.status === 'Working On It').length,
    'Done': tasks.filter(t => t.status === 'Done').length
  };

  const pendingTasksCount = tasksByStatus['Not Acknowledged'] + tasksByStatus['Working On It'];

  const overdueTasks = tasks.filter(task => 
    task.status !== 'Done' && 
    new Date(task.due_date) < new Date()
  );

  const upcomingEvents = events
    .filter(e => new Date(e.event_date) > new Date())
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 5);

  const stats = [
    {
      title: 'Active Leads',
      value: leads.filter(l => !['Confirmed Sales', 'Lost/Canceled'].includes(l.stage)).length,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      trend: '+12% this month',
      link: createPageUrl('Leads')
    },
    {
      title: 'Upcoming Events',
      value: upcomingEvents.length,
      icon: Calendar,
      color: 'from-[#C84B31] to-[#E8B55F]',
      trend: `${events.length} total`,
      link: createPageUrl('Events')
    },
    {
      title: 'Pending Tasks',
      value: pendingTasksCount,
      icon: CheckSquare,
      color: 'from-[#7A9D54] to-green-600',
      trend: `${tasks.length} total`,
      link: createPageUrl('Tasks')
    },
    {
      title: 'Overdue Items',
      value: overdueTasks.length,
      icon: AlertCircle,
      color: 'from-red-500 to-red-600',
      trend: overdueTasks.length > 0 ? 'Needs attention' : 'All good!',
      link: createPageUrl('Tasks')
    }
  ];

  const eventStageColors = {
    'Deposit Received': 'bg-blue-100 text-blue-800',
    'Pre-Event Planning': 'bg-purple-100 text-purple-800',
    'Inventory Ordering': 'bg-yellow-100 text-yellow-800',
    'Staff Confirmed': 'bg-green-100 text-green-800',
    '72hr Final Check': 'bg-orange-100 text-orange-800',
    'Event Day': 'bg-red-100 text-red-800',
    'Post-Event Processing': 'bg-indigo-100 text-indigo-800',
    'Completed': 'bg-emerald-100 text-emerald-800',
    'Cancelled': 'bg-gray-100 text-gray-800'
  };

  const stageColors = { ...STAGE_COLORS, ...eventStageColors };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Dashboard</h1>
        <p className="text-gray-600">Overview of your operations and upcoming events</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} to={stat.link}>
              <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {stat.trend}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Pipeline - B2B */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Leads Pipeline
              <Badge className="bg-indigo-100 text-indigo-800 text-xs">B2B</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const b2bLeads = leads.filter(l => l.channel === 'B2B');
                const stages = B2B_STAGES.filter(stage => b2bLeads.some(l => l.stage === stage));
                if (stages.length === 0) return <p className="text-gray-500 text-center py-6">No B2B leads</p>;
                return stages.map(stage => {
                  const count = b2bLeads.filter(l => l.stage === stage).length;
                  return (
                    <Link key={stage} to={createPageUrl('Leads') + `?stage=${encodeURIComponent(stage)}`}>
                      <div className="flex items-center justify-between p-2.5 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageColors[stage] || 'bg-gray-100 text-gray-800'}`}>
                          {stage}
                        </span>
                        <span className="text-base font-bold text-gray-900">{count}</span>
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Leads Pipeline - B2C */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Leads Pipeline
              <Badge className="bg-pink-100 text-pink-800 text-xs">B2C</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const b2cLeads = leads.filter(l => l.channel === 'B2C');
                const stages = B2C_STAGES.filter(stage => b2cLeads.some(l => l.stage === stage));
                if (stages.length === 0) return <p className="text-gray-500 text-center py-6">No B2C leads</p>;
                return stages.map(stage => {
                  const count = b2cLeads.filter(l => l.stage === stage).length;
                  return (
                    <Link key={stage} to={createPageUrl('Leads') + `?stage=${encodeURIComponent(stage)}`}>
                      <div className="flex items-center justify-between p-2.5 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageColors[stage] || 'bg-gray-100 text-gray-800'}`}>
                          {stage}
                        </span>
                        <span className="text-base font-bold text-gray-900">{count}</span>
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events by Stage */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Events Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(eventsByStage).map(([stage, count]) => (
                <Link key={stage} to={createPageUrl('Events') + `?stage=${encodeURIComponent(stage)}`}>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${stageColors[stage]}`}>
                      {stage}
                    </span>
                    <span className="text-lg font-bold text-gray-900">{count}</span>
                  </div>
                </Link>
              ))}
              {Object.keys(eventsByStage).length === 0 && (
                <p className="text-gray-500 text-center py-8">No events yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Status */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Tasks Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending Acknowledge
                </span>
                <span className="text-lg font-bold text-gray-900">{tasksByStatus['Not Acknowledged']}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Working On It
                </span>
                <span className="text-lg font-bold text-gray-900">{tasksByStatus['Working On It']}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Done
                </span>
                <span className="text-lg font-bold text-gray-900">{tasksByStatus['Done']}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Reports Toggle */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowReports(!showReports)}>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#C84B31]" />
              Advanced Reports
            </span>
            <span className="text-sm font-normal text-[#C84B31]">
              {showReports ? 'Hide Reports ▲' : 'Show Reports ▼'}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {showReports && (
        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
            <CardContent className="py-4">
              <ReportFilters filters={filters} onChange={setFilters} salesReps={allUsers} />
              <p className="text-xs text-gray-500 mt-2">{filteredLeads.length} leads match filters</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConversionRateChart leads={filteredLeads} />
            <SalesCycleChart leads={filteredLeads} />
          </div>

          <PipelineVelocityChart leads={filteredLeads} />

          <TeamPerformanceChart leads={filteredLeads} users={allUsers} />
        </div>
      )}

      {/* Upcoming Events */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#C84B31]" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={createPageUrl(`EventDetail?id=${event.id}`)}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl hover:shadow-md transition-all border border-orange-100"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{event.event_name}</h3>
                  <p className="text-sm text-gray-600">{event.event_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#C84B31]">
                    {new Date(event.event_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${stageColors[event.stage]}`}>
                    {event.stage}
                  </span>
                </div>
              </Link>
            ))}
            {upcomingEvents.length === 0 && (
              <p className="text-gray-500 text-center py-8">No upcoming events scheduled</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card className="bg-red-50 border-red-200 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTasks.slice(0, 10).map((task) => {
                const event = events.find(e => e.id === task.event_id);
                const lead = event?.source_lead_id ? leads.find(l => l.id === event.source_lead_id) : null;
                const leadName = lead ? (lead.channel === 'B2B' && lead.company ? lead.company : lead.name) : null;
                const leadChannel = lead?.channel;
                return (
                  <Link key={task.id} to={createPageUrl('EventDetail') + `?id=${task.event_id}`}>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-sm text-gray-600">{task.category} • {task.responsible_role}</p>
                          {leadName && (
                            <span className="text-sm text-gray-700 font-medium">• {leadName}</span>
                          )}
                          {leadChannel && (
                            <Badge className={`${CHANNEL_COLORS[leadChannel] || ''} text-xs`}>{leadChannel}</Badge>
                          )}
                        </div>
                      </div>
                      <Clock className="w-5 h-5 text-red-500 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}