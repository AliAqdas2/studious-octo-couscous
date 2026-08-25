import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Clock, AlertCircle, Search, Filter, ExternalLink, HandMetal, MessageCircle, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ThreadView from '@/components/thread/ThreadView';
import WorkflowTaskExtras, { PHASE_LABELS } from '@/components/events/WorkflowTaskExtras';

export default function Tasks() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('mine'); // mine | role | phase
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [expandedThread, setExpandedThread] = useState(null);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [dueDateValue, setDueDateValue] = useState('');

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await base44.entities.Task.list('-due_date');
      return data.map(task => task.data ? { 
        ...task.data, 
        id: task.id, 
        created_date: task.created_date, 
        updated_date: task.updated_date 
      } : task);
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: roleAssignments = [], isLoading: isLoadingRole } = useQuery({
    queryKey: ['roleAssignment', user?.id],
    queryFn: () => base44.entities.RoleAssignment.filter({ user_id: user.id }),
    enabled: !!user && user.role !== 'admin'
  });

  const acknowledgeTaskMutation = useMutation({
    mutationFn: async ({ taskId, task }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Ensure role is loaded for non-admin users
      if (user.role !== 'admin' && !userOperationalRole) {
        throw new Error('Role information loading. Please try again.');
      }
      
      // Non-admin users can only acknowledge tasks matching their role
      if (user.role !== 'admin' && task.responsible_role !== userOperationalRole) {
        throw new Error('You can only acknowledge tasks assigned to your role');
      }
      
      if (task.assigned_user && user.role !== 'admin') {
        throw new Error('Task already acknowledged');
      }
      
      const isOverride = task.assigned_user && user.role === 'admin';
      
      if (isOverride) {
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
      
      return base44.entities.Task.update(taskId, {
        assigned_user: user.id,
        status: 'Working On It',
        acknowledged_timestamp: new Date().toISOString()
      });
    },
    onSuccess: async (_, { taskId, task }) => {
      const isOverride = task.assigned_user && user.role === 'admin';
      await base44.functions.invoke('postSystemMessage', {
        taskId,
        action: isOverride ? 'override' : 'acknowledged',
        metadata: isOverride ? { previous_assignee: task.assigned_user } : {}
      });
      queryClient.invalidateQueries(['tasks']);
      toast.success('Task acknowledged');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId) => {
      return base44.entities.Task.update(taskId, {
        status: 'Done',
        completion_timestamp: new Date().toISOString()
      });
    },
    onSuccess: async (_, taskId) => {
      // Post system message
      await base44.functions.invoke('postSystemMessage', {
        taskId,
        action: 'completed',
        metadata: {}
      });
      queryClient.invalidateQueries(['tasks']);
      toast.success('Task marked as done');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }) => {
      return base44.entities.Task.update(taskId, {
        due_date: dueDate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
      setEditingDueDate(null);
      setDueDateValue('');
      toast.success('Due date updated');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateWorkflowMetaMutation = useMutation({
    mutationFn: async ({ taskId, workflow_meta }) => {
      return base44.entities.Task.update(taskId, { workflow_meta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update');
    }
  });



  const userOperationalRole = roleAssignments[0]?.role;

  const filteredTasks = tasks.filter(task => {
    // Role-based visibility: Non-admin users only see tasks for their role or assigned to them
    if (user && user.role !== 'admin') {
      const matchesRole = task.responsible_role === userOperationalRole;
      const assignedToUser = task.assigned_user === user.id;
      if (!matchesRole && !assignedToUser) return false;
    }

    // View modes: My Tasks | Role inbox | By phase
    if (viewMode === 'mine' && user) {
      const assignedToMe = task.assigned_user === user.id;
      const unassignedInMyRole =
        !task.assigned_user &&
        task.responsible_role ===
          (user.role === 'admin' ? task.responsible_role : userOperationalRole) &&
        (user.role !== 'admin' || activeTab === 'all' || task.responsible_role === activeTab);
      if (user.role === 'admin') {
        // Admin "My": assigned to me; if a role tab is selected, also unassigned in that role
        if (activeTab === 'all') {
          if (!assignedToMe) return false;
        } else if (
          !assignedToMe &&
          !( !task.assigned_user && task.responsible_role === activeTab)
        ) {
          return false;
        }
      } else if (!assignedToMe && !unassignedInMyRole) {
        return false;
      }
    } else if (viewMode === 'role') {
      if (activeTab !== 'all' && task.responsible_role !== activeTab) return false;
    } else if (viewMode === 'phase') {
      if (phaseFilter !== 'all' && task.workflow_phase !== phaseFilter) return false;
    } else if (activeTab !== 'all' && task.responsible_role !== activeTab) {
      return false;
    }
    
    // Status filter
    if (statusFilter === 'acknowledged' && task.status === 'Not Acknowledged') return false;
    if (statusFilter === 'working' && task.status !== 'Working On It') return false;
    if (statusFilter === 'done' && task.status !== 'Done') return false;
    if (statusFilter === 'not-acknowledged' && task.status !== 'Not Acknowledged') return false;
    
    // Event filter
    if (eventFilter !== 'all' && task.event_id !== eventFilter) return false;
    
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  const getEventName = (eventId) => {
    const event = events.find(e => e.id === eventId);
    return event?.event_name || 'Unknown Event';
  };

  const statusColors = {
    'Not Acknowledged': 'bg-gray-200 text-gray-700',
    'Working On It': 'bg-blue-100 text-blue-700',
    'Done': 'bg-green-100 text-green-700'
  };

  const categoryColors = {
    'Pre-Event': 'bg-purple-100 text-purple-800',
    'Event-Day': 'bg-orange-100 text-orange-800',
    'Post-Event': 'bg-indigo-100 text-indigo-800',
    'Checklist': 'bg-amber-100 text-amber-800'
  };

  const isOverdue = (task) => {
    return task.status !== 'Done' && new Date(task.due_date) < new Date();
  };

  const roles = ['Admin', 'Sales', 'Ops', 'Marketing', 'Chef', 'Event Host', 'Finance'];
  const phases = Object.keys(PHASE_LABELS);
  const uniqueEvents = [...new Set(tasks.map(t => t.event_id))].filter(Boolean);

  // Show loading if tasks or role info still loading
  if (isLoading || (user && user.role !== 'admin' && isLoadingRole)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading tasks...</p>
      </div>
    );
  }

  const tasksByStatus = {
    'Not Acknowledged': tasks.filter(t => t.status === 'Not Acknowledged').length,
    'Working On It': tasks.filter(t => t.status === 'Working On It').length,
    'Done': tasks.filter(t => t.status === 'Done').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Event Tasks – Operations</h1>
          <p className="text-gray-600">Central task management across all events</p>
        </div>
      </div>

      {/* Task Status Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Acknowledge</p>
                <p className="text-2xl font-bold text-gray-900">{tasksByStatus['Not Acknowledged']}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Working On It</p>
                <p className="text-2xl font-bold text-gray-900">{tasksByStatus['Working On It']}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100">
                <TrendingUp className="w-6 h-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Done</p>
                <p className="text-2xl font-bold text-gray-900">{tasksByStatus['Done']}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-100">
                <CheckCircle2 className="w-6 h-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View mode: My Tasks | Role inbox | By phase */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <TabsList className="bg-white/80">
          <TabsTrigger value="mine">My Tasks</TabsTrigger>
          <TabsTrigger value="role">Role inbox</TabsTrigger>
          <TabsTrigger value="phase">By phase</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not-acknowledged">Not Acknowledged</SelectItem>
                <SelectItem value="working">Working On It</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>

            {/* Event Filter */}
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {uniqueEvents.map(eventId => {
                  const event = events.find(e => e.id === eventId);
                  return event ? (
                    <SelectItem key={eventId} value={eventId}>{event.event_name}</SelectItem>
                  ) : null;
                })}
              </SelectContent>
            </Select>

            {viewMode === 'phase' && (
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All phases</SelectItem>
                  {phases.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PHASE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Tabs - admin or role inbox */}
      {(user?.role === 'admin' || viewMode === 'role') && viewMode !== 'phase' && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 bg-white/80 backdrop-blur-sm overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {roles.map(role => (
              <TabsTrigger key={role} value={role}>{role}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {renderTaskList()}
          </TabsContent>
        </Tabs>
      )}

      {/* Phase / My view without nested role tabs */}
      {(viewMode === 'phase' || (viewMode === 'mine' && user?.role !== 'admin')) && (
        <div className="mt-6">
          {renderTaskList()}
        </div>
      )}

      {viewMode === 'mine' && user?.role === 'admin' && (
        <div className="mt-2 text-sm text-gray-500">
          Showing tasks assigned to you{activeTab !== 'all' ? ` (plus unassigned ${activeTab})` : ''}.
        </div>
      )}
    </div>
  );
  
  function renderTaskList() {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center py-12 text-gray-500">Loading tasks...</p>
        ) : filteredTasks.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No tasks found</p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={`bg-white/80 backdrop-blur-sm border-orange-100 ${
                isOverdue(task) ? 'border-red-300 bg-red-50/50' : ''
              }`}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex flex-col md:flex-row items-start md:justify-between mb-3 gap-3">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`text-lg font-bold ${
                            task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}>
                            {task.title}
                          </h3>
                          {task.override_flag && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">Admin Override</Badge>
                          )}
                        </div>
                        
                        <Link 
                          to={createPageUrl('EventDetail') + `?id=${task.event_id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
                        >
                          {getEventName(task.event_id)}
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {task.responsible_role}
                          </Badge>
                          <Badge className={categoryColors[task.category]}>
                            {task.category}
                          </Badge>
                          <Badge className={statusColors[task.status]}>
                            {task.status}
                          </Badge>
                          {task.due_date && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                {isOverdue(task) && <AlertCircle className="w-3 h-3 inline mr-1" />}
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
                                  className="h-6 px-2"
                                >
                                  <CalendarIcon className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <WorkflowTaskExtras
                          task={task}
                          canEdit={
                            task.assigned_user === user?.id || user?.role === 'admin'
                          }
                          onMetaChange={(workflow_meta) =>
                            updateWorkflowMetaMutation.mutate({
                              taskId: task.id,
                              workflow_meta,
                            })
                          }
                        />
                      </div>

                      <div className="flex gap-2 flex-wrap w-full md:w-auto">
                        {(!task.assigned_user || (user?.role === 'admin' && task.assigned_user === user.id) || (user?.role === 'admin' && task.assigned_user)) && (
                          <Button
                            size="sm"
                            onClick={() => acknowledgeTaskMutation.mutate({ taskId: task.id, task })}
                            disabled={acknowledgeTaskMutation.isPending}
                            className={`min-h-[44px] flex-1 md:flex-none ${
                              user?.role === 'admin' && task.assigned_user !== user.id && task.assigned_user
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-[#C84B31] hover:bg-[#A03A23]'
                            }`}
                          >
                            <HandMetal className="w-4 h-4 mr-1" />
                            {user?.role === 'admin' && task.assigned_user !== user.id && task.assigned_user ? 'Override' : 'Acknowledge'}
                          </Button>
                        )}
                        {task.assigned_user && task.status !== 'Done' && (
                          <Button
                            size="sm"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            disabled={completeTaskMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 min-h-[44px] flex-1 md:flex-none"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark as Done
                          </Button>
                        )}
                      </div>
                    </div>

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

                    {task.assigned_user && (
                       <>
                         <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                           Acknowledged: {task.acknowledged_timestamp ? new Date(task.acknowledged_timestamp).toLocaleString() : 'N/A'}
                           {task.completion_timestamp && (
                             <span className="ml-3 text-green-600">
                               • Completed: {new Date(task.completion_timestamp).toLocaleString()}
                             </span>
                           )}
                         </div>

                         {/* Thread Toggle */}
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => setExpandedThread(expandedThread === task.id ? null : task.id)}
                           className="text-gray-500 hover:text-[#C84B31] mt-2 min-h-[44px]"
                         >
                           <MessageCircle className="w-4 h-4 mr-1" />
                           Thread
                         </Button>

                         {/* Thread */}
                         {expandedThread === task.id && (
                           <div className="border-t pt-4 mt-4">
                             <ThreadView 
                               taskId={task.id}
                               user={user}
                             />
                           </div>
                         )}
                       </>
                     )}
                       </div>
                       </div>
                       </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }
}