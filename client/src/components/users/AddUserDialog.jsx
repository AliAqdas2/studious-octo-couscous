import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function AddUserDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Sales',
    portal_access: false
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async (data) => {
      // If portal access is checked, invite them to the Base44 app
      if (data.portal_access) {
        await base44.users.inviteUser(data.email, data.role === 'Admin' ? 'admin' : 'user');
      }

      // Create the RoleAssignment with contact details
      return base44.entities.RoleAssignment.create({
        role: data.role,
        user_email: data.email,
        user_name: data.name,
        contact_name: data.name,
        contact_email: data.email,
        contact_phone: data.phone,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User added successfully');
      onClose();
    },
    onError: (err) => {
      setError(err?.message || 'Failed to add user');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name?.trim()) { setError('Name is required'); return; }
    if (!formData.email?.trim()) { setError('Email is required'); return; }
    if (!formData.phone?.trim()) { setError('Phone is required'); return; }

    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            Add User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Full name"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="Email address"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Phone *</Label>
            <Input
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="Phone number"
              className="mt-1"
            />
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

          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              id="portal-access"
              checked={formData.portal_access}
              onCheckedChange={(checked) => setFormData({...formData, portal_access: !!checked})}
              className="border-[#C84B31] data-[state=checked]:bg-[#C84B31] data-[state=checked]:text-white"
            />
            <Label htmlFor="portal-access" className="text-sm text-blue-800 cursor-pointer">
              Grant portal access (invite to app)
            </Label>
          </div>

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
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {mutation.isPending ? 'Adding...' : 'Add User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}