import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

import { ALL_STAGES, B2B_STAGES, B2C_STAGES } from '@/components/leads/pipelineConfig';

const emailCategories = [
  "Lead Follow-Up",
  "Survey",
  "Reminder",
  "Proposal",
  "Event Confirmation",
  "Post-Event",
  "Re-Engagement"
];

export default function AutomationFormDialog({ mapping, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    stage: mapping?.stage || '',
    channel: mapping?.channel || 'Both',
    email_category: mapping?.email_category || '',
    is_active: mapping?.is_active ?? true,
    notes: mapping?.notes || ''
  });

  const mutation = useMutation({
    mutationFn: (data) => mapping
      ? base44.entities.StageEmailMapping.update(mapping.id, data)
      : base44.entities.StageEmailMapping.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-email-mappings'] });
      toast.success(mapping ? 'Automation updated' : 'Automation created');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#C84B31]">
            {mapping ? 'Edit Automation' : 'New Automation'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Channel</Label>
            <Select value={formData.channel} onValueChange={(v) => {
              const newData = { ...formData, channel: v };
              // Reset stage if it doesn't exist in the new channel's stages
              const availableStages = v === 'B2B' ? B2B_STAGES : v === 'B2C' ? B2C_STAGES : ALL_STAGES;
              if (formData.stage && !availableStages.includes(formData.stage)) {
                newData.stage = '';
              }
              setFormData(newData);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="B2B">B2B Only</SelectItem>
                <SelectItem value="B2C">B2C Only</SelectItem>
                <SelectItem value="Both">Both B2B & B2C</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Pipeline Stage</Label>
            <Select value={formData.stage} onValueChange={(v) => setFormData({...formData, stage: v})}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {(formData.channel === 'B2B' ? B2B_STAGES : formData.channel === 'B2C' ? B2C_STAGES : ALL_STAGES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Email Category</Label>
            <Select value={formData.email_category} onValueChange={(v) => setFormData({...formData, email_category: v})}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {emailCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="e.g., Sends survey within 24 hours"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({...formData, is_active: c})} />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              className="flex-1 bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={!formData.stage || !formData.email_category || !formData.channel || mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : mapping ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}