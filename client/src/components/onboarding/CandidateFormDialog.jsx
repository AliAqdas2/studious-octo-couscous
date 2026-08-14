import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  HIRE_SOURCES,
  HIRE_TYPES,
  JOB_ROLES,
  onboardingStrings,
} from './strings';

export default function CandidateFormDialog({ open, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    job_role: 'Event Support Associate',
    hire_type: 'Part-time',
    source: 'Indeed',
    source_detail: '',
    resume_url: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await base44.functions.invoke('createOnboardingCandidate', payload);
      return data;
    },
    onSuccess: async (data) => {
      await base44.entities.ActivityLog.create({
        entity_type: 'Candidate',
        entity_id: data.id,
        action: 'Candidate Added',
        details: {
          job_role: data.job_role,
          hire_type: data.hire_type,
          source: data.source,
        },
      }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate created');
      onCreated?.(data);
      onClose?.();
      setForm({
        name: '',
        email: '',
        phone: '',
        job_role: 'Event Support Associate',
        hire_type: 'Part-time',
        source: 'Indeed',
        source_detail: '',
        resume_url: '',
        notes: '',
      });
    },
    onError: (e) => toast.error(e.message || 'Failed to create candidate'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (form.source === 'Other' && !form.source_detail.trim()) {
      toast.error('Source detail is required when source is Other');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{onboardingStrings.newCandidate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-muted-foreground">{onboardingStrings.credentialsNote}</p>

          <div className="space-y-2">
            <Label>Role / stream</Label>
            <Select
              value={form.job_role}
              onValueChange={(job_role) => setForm((f) => ({ ...f, job_role }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                    {r !== 'Event Support Associate' ? ' (coming soon)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hire type</Label>
            <Select
              value={form.hire_type}
              onValueChange={(hire_type) => setForm((f) => ({ ...f, hire_type }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIRE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={form.source}
              onValueChange={(source) => setForm((f) => ({ ...f, source }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIRE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.source === 'Other' ||
            form.source === 'Employee referral' ||
            form.source === 'University / career fair') && (
            <div className="space-y-2">
              <Label>{onboardingStrings.sourceDetail}</Label>
              <Input
                value={form.source_detail}
                onChange={(e) => setForm((f) => ({ ...f, source_detail: e.target.value }))}
                placeholder={onboardingStrings.sourceDetailHint}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{onboardingStrings.resumeUrl}</Label>
            <Input
              value={form.resume_url}
              onChange={(e) => setForm((f) => ({ ...f, resume_url: e.target.value }))}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
            >
              {mutation.isPending ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
