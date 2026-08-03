import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const CONTACT_REQUIRED_ROLES = ['Instructor', 'Event Host'];

export default function RoleAssignmentDialog({ users, assignments = [], onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    user_id: '',
    role: 'Sales',
    contact_name: '',
    contact_email: '',
    contact_phone: ''
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async (data) => {
      const user = users.find(u => u.id === data.user_id);
      
      // If assigning Admin role, update User.role to 'admin'
      if (data.role === 'Admin') {
        await base44.entities.User.update(data.user_id, { role: 'admin' });
      } else {
        // For other roles, ensure User.role is 'user'
        if (user.role !== 'user') {
          await base44.entities.User.update(data.user_id, { role: 'user' });
        }
      }
      
      return base44.entities.RoleAssignment.create({
        ...data,
        user_email: user.email,
        user_name: user.full_name,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    }
  });

  const needsContactDetails = CONTACT_REQUIRED_ROLES.includes(formData.role);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Check if user already has a role assignment
    const existingAssignment = assignments.find(a => a.user_id === formData.user_id);
    if (existingAssignment) {
      setError('This user already has a role assignment');
      return;
    }

    if (needsContactDetails) {
      if (!formData.contact_name?.trim()) {
        setError('Contact name is required for this role');
        return;
      }
      if (!formData.contact_email?.trim()) {
        setError('Contact email is required for this role');
        return;
      }
    }
    
    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            Assign Role
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>User</Label>
            <select
              required
              value={formData.user_id}
              onChange={(e) => setFormData({...formData, user_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
            >
              <option value="">Select a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Role</Label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
            >
              <option value="Admin">Admin</option>
              <option value="Sales">Sales</option>
              <option value="Ops">Ops</option>
              <option value="Chef">Chef</option>
              <option value="Event Host">Event Host</option>
              <option value="Finance">Finance</option>
              <option value="Instructor">Instructor</option>
            </select>
          </div>

          {needsContactDetails && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-800">Contact Details</p>
              <div>
                <Label>Contact Name</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                  placeholder="Full name for scheduling and communication"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  placeholder="Email for scheduling and communication"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  placeholder="Phone number for scheduling (optional)"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isLoading || !formData.user_id}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {mutation.isLoading ? 'Assigning...' : 'Assign Role'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}