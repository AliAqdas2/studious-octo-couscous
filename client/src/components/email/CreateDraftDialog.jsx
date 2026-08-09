import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateDraftDialog({ lead, templates, onClose }) {
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    to: lead?.email || '',
    subject: '',
    body: ''
  });

  const createDraftMutation = useMutation({
    mutationFn: async (data) => {
      if (isSending) throw new Error('Already in progress');
      setIsSending(true);
      const response = await base44.functions.invoke('createGmailDraft', {
        ...data,
        leadId: lead?.id
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Draft saved in Gmail!');
      queryClient.invalidateQueries(['activities']);
      onClose();
    },
    onError: (err) => {
      if (err.message !== 'Already in progress') toast.error('Failed to create draft. Make sure Gmail is connected.');
    },
    onSettled: () => setIsSending(false)
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data) => {
      if (isSending) throw new Error('Already in progress');
      setIsSending(true);
      const response = await base44.functions.invoke('sendGmailEmail', {
        ...data,
        leadId: lead?.id
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Email sent successfully!');
      queryClient.invalidateQueries(['activities']);
      onClose();
    },
    onError: (err) => {
      if (err.message !== 'Already in progress') toast.error('Failed to send email. Make sure Gmail is connected.');
    },
    onSettled: () => setIsSending(false)
  });

  const handleTemplateSelect = async (template) => {
    let body = template.body;
    let subject = template.subject;

    if (lead) {
      body = body.replace(/{{name}}/g, lead.name || '');
      body = body.replace(/{{company}}/g, lead.company || '');
      body = body.replace(/{{email}}/g, lead.email || '');
      subject = subject.replace(/{{name}}/g, lead.name || '');
      subject = subject.replace(/{{company}}/g, lead.company || '');
      subject = subject.replace(/{{email}}/g, lead.email || '');
    }

    if (/<<\s*Sales Manager Availability\s*>>/i.test(body) || /<<\s*Sales Manager Availability\s*>>/i.test(subject)) {
      try {
        const slot = await base44.calendar.getNextSlot();
        const formatted = slot?.formatted || '<Meeting Date And Time>';
        body = body.replace(/<<\s*Sales Manager Availability\s*>>/gi, formatted);
        subject = subject.replace(/<<\s*Sales Manager Availability\s*>>/gi, formatted);
      } catch {
        body = body.replace(/<<\s*Sales Manager Availability\s*>>/gi, '<Meeting Date And Time>');
        subject = subject.replace(/<<\s*Sales Manager Availability\s*>>/gi, '<Meeting Date And Time>');
      }
    }

    setFormData({
      ...formData,
      subject,
      body
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            Create Gmail Draft
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!isSending) sendEmailMutation.mutate(formData);
        }} className="space-y-6">
          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <Label>Use Template (Optional)</Label>
              <select
                onChange={(e) => {
                  const template = templates.find(t => t.id === e.target.value);
                  if (template) handleTemplateSelect(template);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
              >
                <option value="">Select a template...</option>
                {templates.filter(t => t.is_active).map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} - {template.category}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>To *</Label>
            <Input
              required
              type="email"
              value={formData.to}
              onChange={(e) => setFormData({...formData, to: e.target.value})}
              placeholder="recipient@example.com"
            />
          </div>

          <div>
            <Label>Subject *</Label>
            <Input
              required
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="Email subject"
            />
          </div>

          <div>
            <Label>Body *</Label>
            <Textarea
              required
              value={formData.body}
              onChange={(e) => setFormData({...formData, body: e.target.value})}
              rows={12}
              placeholder="Email body..."
            />
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSending}
                onClick={() => { if (!isSending) createDraftMutation.mutate(formData); }}
              >
                {createDraftMutation.isPending ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save to Draft
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={isSending}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                {sendEmailMutation.isPending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}