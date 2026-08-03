import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ALL_STAGES } from '@/components/leads/pipelineConfig';

export default function EmailTemplateDialog({ template, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    template_name: template?.template_name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    pipeline_stage: template?.pipeline_stage || '',
    channel: template?.channel || 'Both',
    customer_type: template?.customer_type || "Doesn't matter",
    category: template?.category || 'Lead Follow-Up',
    is_active: template?.is_active ?? true,
    send_automatically: template?.send_automatically ?? false,
    send_mode: template?.send_mode || 'draft'
  });

  const mutation = useMutation({
    mutationFn: (data) => template
      ? base44.entities.EmailTemplate.update(template.id, data)
      : base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success(template ? 'Template updated' : 'Template created');
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#C84B31]">
            {template ? 'Edit Email Template' : 'New Email Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
          <div>
            <Label>Template Name *</Label>
            <Input
              required
              value={formData.template_name}
              onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              placeholder="e.g. B2B Initial Outreach"
            />
          </div>

          <div>
            <Label>Pipeline Stage *</Label>
            <select
              required
              value={formData.pipeline_stage}
              onChange={(e) => setFormData({ ...formData, pipeline_stage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">— Select a stage —</option>
              {ALL_STAGES.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Channel</Label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="Both">Both (B2B & B2C)</option>
                <option value="B2B">B2B Only</option>
                <option value="B2C">B2C Only</option>
              </select>
            </div>
            <div>
              <Label>Customer Type</Label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="Doesn't matter">Doesn't matter</option>
                <option value="New">New</option>
                <option value="Old">Old</option>
                <option value="Referred">Referred</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Subject *</Label>
            <Input
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject line"
            />
          </div>

          <div>
            <Label>Body *</Label>
            <Textarea
              required
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={10}
              placeholder="Use {{name}}, {{company}}, {{event_type}}, {{preferred_date}}, {{headcount}}, {{phone}} for dynamic values"
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables: {'{{name}}'}, {'{{company}}'}, {'{{event_type}}'}, {'{{preferred_date}}'}, {'{{headcount}}'}, {'{{phone}}'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-create Gmail draft when stage matches</Label>
              <p className="text-xs text-gray-500">Automatically create a Gmail draft when a lead enters this stage</p>
            </div>
            <Switch
              checked={formData.send_automatically}
              onCheckedChange={(c) => setFormData({ ...formData, send_automatically: c, send_mode: 'draft' })}
            />
          </div>

          {formData.subject && formData.body && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">TEMPLATE PREVIEW</p>
              <p className="text-sm font-medium text-gray-900 mb-1">Subject: {formData.subject}</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap border-t pt-3 mt-2">{formData.body}</div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {mutation.isPending ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}