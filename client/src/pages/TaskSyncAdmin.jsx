import React from 'react';
import { base44 } from '@/api/base44Client';
import TaskSyncDashboard from '../components/tasks/TaskSyncDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function TaskSyncAdmin() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!user || user.role !== 'admin') {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Task Sync Health Dashboard</h1>
        <p className="text-gray-600">Monitor and maintain task synchronization integrity</p>
      </div>

      <TaskSyncDashboard />

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>System Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✓ All tasks must exist in Event Tasks – Operations board</p>
          <p>✓ Every event must have linked tasks</p>
          <p>✓ Tasks cannot be deleted without admin approval</p>
          <p>✓ Status changes sync instantly between tasks and events</p>
          <p>✓ Bi-directional linking enforced at all times</p>
        </CardContent>
      </Card>
    </div>
  );
}