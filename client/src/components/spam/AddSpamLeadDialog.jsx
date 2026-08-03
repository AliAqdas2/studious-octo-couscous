import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Sales Pitch', 'SEO/Marketing', 'Web Design', 'Promotion', 'Gibberish', 'Other'];

export default function AddSpamLeadDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    from: '',
    subject: '',
    body: '',
    spam_category: 'Other',
    spam_reason: '',
    page_url: '',
  });

  const resetForm = () => setForm({
    from: '', subject: '', body: '', spam_category: 'Other', spam_reason: '', page_url: '',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SpamEmail.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spam-emails'] });
      queryClient.invalidateQueries({ queryKey: ['spam-emails-count'] });
      toast.success('Spam lead added');
      resetForm();
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Failed to add: ${e.message}`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.from.trim() || !form.subject.trim()) {
      toast.error('From and Subject are required');
      return;
    }
    const senderEmailMatch = form.from.match(/<([^>]+)>/);
    const senderEmail = (senderEmailMatch ? senderEmailMatch[1] : form.from).trim().toLowerCase();
    createMutation.mutate({
      from: form.from.trim(),
      sender_email: senderEmail,
      subject: form.subject.trim(),
      body: form.body.trim(),
      spam_category: form.spam_category,
      spam_reason: form.spam_reason.trim(),
      page_url: form.page_url.trim(),
      received_at: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Spam Lead</DialogTitle>
          <DialogDescription>Manually record a spam submission.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="from">From *</Label>
            <Input
              id="from"
              placeholder="Name &lt;email@example.com&gt;"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.spam_category}
              onValueChange={(v) => setForm({ ...form, spam_category: v })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Why is this spam?"
              value={form.spam_reason}
              onChange={(e) => setForm({ ...form, spam_reason: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="page_url">Page URL</Label>
            <Input
              id="page_url"
              placeholder="https://..."
              value={form.page_url}
              onChange={(e) => setForm({ ...form, page_url: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-[#C84B31] hover:bg-[#A03A23]">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Spam Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}