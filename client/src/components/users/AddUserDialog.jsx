import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';

export default function AddUserDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Sales',
    portal_access: true
  });
  const [error, setError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (data.portal_access) {
        return base44.users.inviteUser({
          email: data.email.trim(),
          full_name: data.name.trim(),
          phone: data.phone.trim(),
          role: data.role === 'Admin' ? 'admin' : 'user',
          operational_role: data.role,
        });
      }

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });

      if (formData.portal_access && result?.inviteUrl) {
        setInviteResult(result);
        toast.success(
          result.emailSent
            ? 'Invite sent — copy the link as backup'
            : 'User invited — copy the invite link'
        );
        return;
      }

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

  const handleCopy = async () => {
    if (!inviteResult?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteResult.inviteUrl);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (inviteResult?.inviteUrl) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#C84B31]">
              Invite ready
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {inviteResult.emailSent
                ? `An invite email was sent to ${inviteResult.user?.email || formData.email}. Share this link if they do not receive it:`
                : `Share this invite link with ${inviteResult.user?.email || formData.email} so they can set a password:`}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteResult.inviteUrl}
                className="text-xs font-mono"
              />
              <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Link expires in 7 days.</p>
            <div className="flex justify-end pt-2">
              <Button
                onClick={onClose}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
