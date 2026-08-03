import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, Mail, CheckSquare, FolderOpen } from 'lucide-react';

export default function ActivityLog() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.ActivityLog.list('-timestamp'),
  });

  const entityIcons = {
    'Lead': Activity,
    'Event': Calendar,
    'Task': CheckSquare,
    'Email': Mail,
    'Drive': FolderOpen
  };

  const entityColors = {
    'Lead': 'bg-blue-100 text-blue-800',
    'Event': 'bg-purple-100 text-purple-800',
    'Task': 'bg-green-100 text-green-800',
    'Email': 'bg-yellow-100 text-yellow-800',
    'Drive': 'bg-indigo-100 text-indigo-800'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Activity Log</h1>
        <p className="text-gray-600">Complete audit trail of all system activity</p>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center py-12 text-gray-500">Loading activities...</p>
        ) : activities.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardContent className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No activity yet</p>
            </CardContent>
          </Card>
        ) : (
          activities.map((activity) => {
            const Icon = entityIcons[activity.entity_type] || Activity;
            return (
              <Card
                key={activity.id}
                className="bg-white/80 backdrop-blur-sm border-orange-100 hover:shadow-md transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${entityColors[activity.entity_type]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <h3 className="font-semibold text-gray-900">{activity.action}</h3>
                          <p className="text-sm text-gray-600">
                            {activity.user_name || 'System'} • {activity.entity_type}
                          </p>
                        </div>
                        <Badge className={entityColors[activity.entity_type]}>
                          {activity.entity_type}
                        </Badge>
                      </div>
                      {activity.details && (
                        <div className="mt-2 text-sm text-gray-600">
                          {JSON.stringify(activity.details)}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(activity.timestamp || activity.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}