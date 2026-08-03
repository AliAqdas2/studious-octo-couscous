import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function TaskSyncDashboard() {
  const queryClient = useQueryClient();

  const { data: syncReport, isLoading, refetch } = useQuery({
    queryKey: ['task-sync-validation'],
    queryFn: async () => {
      const response = await base44.functions.invoke('validateTaskSync', {});
      return response.data.report;
    }
  });

  const repairMutation = useMutation({
    mutationFn: (eventId) => base44.functions.invoke('autoRepairTaskSync', { eventId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['task-sync-validation']);
      toast.success('Task sync repaired successfully');
    },
    onError: (error) => {
      toast.error('Failed to repair task sync');
    }
  });

  if (isLoading) {
    return <div className="text-center py-6">Loading sync status...</div>;
  }

  if (!syncReport) return null;

  return (
    <div className="space-y-4">
      <Card className={`border-2 ${
        syncReport.health_status === 'HEALTHY' 
          ? 'border-green-200 bg-green-50' 
          : 'border-amber-200 bg-amber-50'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {syncReport.health_status === 'HEALTHY' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
              Task Sync Health
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{syncReport.total_events}</p>
              <p className="text-sm text-gray-600">Total Events</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{syncReport.healthy_events}</p>
              <p className="text-sm text-gray-600">Healthy</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{syncReport.events_missing_tasks.length}</p>
              <p className="text-sm text-gray-600">Missing Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">{syncReport.orphaned_tasks.length}</p>
              <p className="text-sm text-gray-600">Orphaned Tasks</p>
            </div>
          </div>

          {syncReport.events_missing_tasks.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Events Missing Tasks
              </h4>
              <div className="space-y-2">
                {syncReport.events_missing_tasks.map((event) => (
                  <div key={event.event_id} className="flex items-center justify-between bg-white p-3 rounded border">
                    <div>
                      <p className="font-medium">{event.event_name}</p>
                      <p className="text-xs text-gray-500">
                        {event.event_type} • {new Date(event.event_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => repairMutation.mutate(event.event_id)}
                      disabled={repairMutation.isPending}
                      className="bg-[#C84B31] hover:bg-[#A03A23]"
                    >
                      <Wrench className="w-4 h-4 mr-1" />
                      Repair
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {syncReport.events_with_incomplete_tasks.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-semibold text-amber-700 mb-2">
                Events With Incomplete Task Templates
              </h4>
              <div className="space-y-2">
                {syncReport.events_with_incomplete_tasks.map((event) => (
                  <div key={event.event_id} className="bg-white p-3 rounded border">
                    <p className="font-medium">{event.event_name}</p>
                    <p className="text-xs text-gray-600">
                      Has {event.task_count} tasks (expected minimum: {event.expected_min})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {syncReport.orphaned_tasks.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-semibold text-amber-700 mb-2">
                Orphaned Tasks (No Event Link)
              </h4>
              <div className="space-y-2">
                {syncReport.orphaned_tasks.map((task) => (
                  <div key={task.task_id} className="bg-white p-3 rounded border">
                    <p className="font-medium">{task.task_title}</p>
                    <p className="text-xs text-gray-600">Event ID: {task.event_id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}