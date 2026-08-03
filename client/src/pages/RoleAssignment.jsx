import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, UserPlus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import RoleAssignmentDialog from '@/components/roles/RoleAssignmentDialog';

export default function RoleAssignment() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['role-assignments'],
    queryFn: () => base44.entities.RoleAssignment.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (assignmentId) => base44.entities.RoleAssignment.update(assignmentId, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast.success('User deactivated');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast.success('User deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete user');
    },
  });

  const roleColors = {
    'Admin': 'bg-purple-100 text-purple-800 border-purple-200',
    'Sales': 'bg-blue-100 text-blue-800 border-blue-200',
    'Ops': 'bg-green-100 text-green-800 border-green-200',
    'Chef': 'bg-orange-100 text-orange-800 border-orange-200',
    'Event Host': 'bg-pink-100 text-pink-800 border-pink-200',
    'Finance': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Instructor': 'bg-teal-100 text-teal-800 border-teal-200'
  };

  const rolesByType = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.role]) acc[assignment.role] = [];
    acc[assignment.role].push(assignment);
    return acc;
  }, {});

  const assignedUserIds = new Set(assignments.map(a => a.user_id));
  const unassignedUsers = users.filter(u => !assignedUserIds.has(u.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#C84B31] mb-2">Role Assignment</h1>
          <p className="text-gray-600">Manage roles, permissions, and team structure</p>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Role
        </Button>
      </div>

      {/* Role Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Admin', 'Sales', 'Ops', 'Chef', 'Event Host', 'Finance', 'Instructor'].map(role => {
          const count = rolesByType[role]?.length || 0;
          return (
            <Card key={role} className="bg-white/80 backdrop-blur-sm border-orange-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{role}</p>
                    <p className="text-3xl font-bold text-gray-900">{count}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${roleColors[role]}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unassigned Users */}
      {unassignedUsers.length > 0 && (
        <Card className="bg-red-50 border-red-200 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 border border-red-200 text-base">
                Unassigned
              </Badge>
              <span className="text-gray-500 text-sm font-normal">
                ({unassignedUsers.length} {unassignedUsers.length === 1 ? 'user' : 'users'})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unassignedUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200"
                >
                  <div>
                    <p className="font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDialog(true)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Assign Role
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteUserMutation.mutate(user.id)}
                      disabled={deleteUserMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments by Role */}
      <div className="space-y-6">
        {Object.entries(rolesByType).map(([role, assignments]) => (
          <Card key={role} className="bg-white/80 backdrop-blur-sm border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={`${roleColors[role]} border text-base`}>
                  {role}
                </Badge>
                <span className="text-gray-500 text-sm font-normal">
                  ({assignments.length} {assignments.length === 1 ? 'user' : 'users'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 bg-orange-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{assignment.user_name}</p>
                      <p className="text-sm text-gray-600">{assignment.user_email}</p>
                      {assignment.contact_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Contact: {assignment.contact_name}
                          {assignment.contact_email && ` · ${assignment.contact_email}`}
                          {assignment.contact_phone && ` · ${assignment.contact_phone}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {assignment.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                      {assignment.is_active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deactivateUserMutation.mutate(assignment.id)}
                          disabled={deactivateUserMutation.isPending}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete user ${assignment.user_name}?`)) {
                              deleteUserMutation.mutate(assignment.user_id);
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(rolesByType).length === 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardContent className="p-12 text-center">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No role assignments yet</p>
            <p className="text-sm text-gray-400">Start assigning roles to your team members</p>
          </CardContent>
        </Card>
      )}

      {showDialog && (
        <RoleAssignmentDialog users={users} assignments={assignments} onClose={() => setShowDialog(false)} />
      )}
    </div>
  );
}