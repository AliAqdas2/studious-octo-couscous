import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Trash2, Mail, ShieldAlert, ExternalLink, Loader2, Plus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AddSpamLeadDialog from '@/components/spam/AddSpamLeadDialog';

const CATEGORY_COLORS = {
  'Sales Pitch': 'bg-orange-100 text-orange-800 border-orange-200',
  'SEO/Marketing': 'bg-purple-100 text-purple-800 border-purple-200',
  'Web Design': 'bg-blue-100 text-blue-800 border-blue-200',
  'Promotion': 'bg-pink-100 text-pink-800 border-pink-200',
  'Gibberish': 'bg-gray-100 text-gray-700 border-gray-200',
  'Other': 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function SpamEmails() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: spamEmails = [], isLoading } = useQuery({
    queryKey: ['spam-emails'],
    queryFn: () => base44.entities.SpamEmail.list('-received_at', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpamEmail.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spam-emails'] });
      queryClient.invalidateQueries({ queryKey: ['spam-emails-count'] });
      toast.success('Spam lead deleted');
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  // Move a spam record into the CRM. If a Lead already exists for this email
  // or Gmail thread, append the spam content as an ActivityLog on that Lead
  // instead of creating a duplicate. Either way the SpamEmail row is removed.
  const moveToCrmMutation = useMutation({
    mutationFn: async (spam) => {
      // Parse sender name + email from the "From" header (e.g. "John <a@b.com>")
      const senderEmailMatch = spam.from?.match(/<([^>]+)>/);
      const senderEmail = (
        spam.sender_email ||
        (senderEmailMatch ? senderEmailMatch[1] : spam.from) ||
        ''
      ).trim().toLowerCase();
      const senderName = (spam.from || '').replace(/<[^>]+>/, '').replace(/"/g, '').trim() || senderEmail || 'Unknown';

      if (!senderEmail) {
        throw new Error('No email found on this spam record');
      }

      // Dedupe: check for an existing Lead by gmail_thread_id first (strongest
      // signal — same conversation), then by email.
      let existingLead = null;
      if (spam.gmail_thread_id) {
        const byThread = await base44.entities.Lead.filter({ gmail_thread_id: spam.gmail_thread_id }, '-created_date', 1);
        if (byThread && byThread.length > 0) existingLead = byThread[0];
      }
      if (!existingLead) {
        const byEmail = await base44.entities.Lead.filter({ email: senderEmail }, '-created_date', 1);
        if (byEmail && byEmail.length > 0) existingLead = byEmail[0];
      }

      if (existingLead) {
        // Append as ActivityLog on the existing Lead — no duplicate.
        await base44.entities.ActivityLog.create({
          entity_type: 'Lead',
          entity_id: existingLead.id,
          action: 'Inbound Email Received (Recovered from Spam)',
          details: {
            from: spam.from,
            subject: spam.subject || '(no subject)',
            body_snippet: (spam.body || '').substring(0, 2000),
            page_url: spam.page_url || '',
            gmail_message_id: spam.gmail_message_id || '',
            gmail_thread_id: spam.gmail_thread_id || '',
            originally_classified_as: spam.spam_category || 'spam',
            originally_classified_reason: spam.spam_reason || '',
            match_reason: spam.gmail_thread_id && existingLead.gmail_thread_id === spam.gmail_thread_id
              ? 'same_gmail_thread'
              : 'same_email_address',
          },
          timestamp: new Date().toISOString(),
        });

        // Bump last_contact_date so the lead surfaces in recency-sorted views.
        await base44.entities.Lead.update(existingLead.id, {
          last_contact_date: new Date().toISOString(),
        });

        await base44.entities.SpamEmail.delete(spam.id);
        return { appended: true, leadId: existingLead.id, leadName: existingLead.name };
      }

      // No existing Lead — create one as before.
      const notesParts = [
        'Moved from Spam Leads',
        spam.page_url ? `Page URL: ${spam.page_url}` : null,
        `Original Subject: ${spam.subject || '(no subject)'}`,
        '',
        'Body:',
        spam.body || '(no body)',
      ].filter(Boolean);

      await base44.entities.Lead.create({
        name: senderName,
        email: senderEmail,
        source: 'Website',
        reviewed: false,
        stage: 'New Inquiry',
        notes: notesParts.join('\n'),
        gmail_thread_id: spam.gmail_thread_id || undefined,
        ai_flag_category: 'Possible Spam',
        ai_flag_reason: spam.spam_reason || `Originally classified as ${spam.spam_category || 'spam'}`,
      });

      await base44.entities.SpamEmail.delete(spam.id);
      return { appended: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['spam-emails'] });
      queryClient.invalidateQueries({ queryKey: ['spam-emails-count'] });
      if (result?.appended) {
        toast.success(`Appended to existing Lead "${result.leadName}" — no duplicate created`);
      } else {
        toast.success('Moved to CRM as a Lead');
      }
      setSelected(null);
    },
    onError: (e) => toast.error(`Move failed: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-[#C84B31]" />
            Spam Leads
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Submissions filtered out by the spam classifier — not added to Leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {spamEmails.length} {spamEmails.length === 1 ? 'lead' : 'leads'}
          </Badge>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Spam Lead
          </Button>
        </div>
      </div>

      <AddSpamLeadDialog open={addOpen} onOpenChange={setAddOpen} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtered Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#C84B31]" />
            </div>
          ) : spamEmails.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No spam leads captured yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {spamEmails.map((s) => (
                <div
                  key={s.id}
                  className="p-4 hover:bg-orange-50/50 transition-colors flex items-start gap-4 cursor-pointer"
                  onClick={() => setSelected(s)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-900 truncate">{s.from}</span>
                      {s.spam_category && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${CATEGORY_COLORS[s.spam_category] || CATEGORY_COLORS.Other}`}
                        >
                          {s.spam_category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{s.subject}</p>
                    {s.spam_reason && (
                      <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">
                        "{s.spam_reason}"
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 whitespace-nowrap">
                      {s.received_at ? format(new Date(s.received_at), 'MMM d, h:mm a') : ''}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[#C84B31] border-[#C84B31]/30 hover:bg-orange-50 h-8"
                        disabled={moveToCrmMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Move this spam lead into the CRM as a real Lead?')) {
                            moveToCrmMutation.mutate(s);
                          }
                        }}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        Move to CRM
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this spam lead?')) deleteMutation.mutate(s.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#C84B31]" />
              Spam Lead Details
            </DialogTitle>
            <DialogDescription>
              {selected?.received_at && format(new Date(selected.received_at), 'PPpp')}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">From</p>
                  <p className="text-gray-900 break-all">{selected.from}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Category</p>
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[selected.spam_category] || CATEGORY_COLORS.Other}
                  >
                    {selected.spam_category || 'Other'}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Subject</p>
                  <p className="text-gray-900">{selected.subject}</p>
                </div>
                {selected.page_url && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Page URL</p>
                    <a
                      href={selected.page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#C84B31] hover:underline inline-flex items-center gap-1 break-all"
                    >
                      {selected.page_url} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {selected.spam_reason && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-800 uppercase mb-1">Why it was flagged</p>
                  <p className="text-sm text-orange-900">{selected.spam_reason}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Body</p>
                <pre className="text-sm text-gray-800 bg-gray-50 border rounded-lg p-3 whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
                  {selected.body}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="text-[#C84B31] border-[#C84B31]/40 hover:bg-orange-50"
                  disabled={moveToCrmMutation.isPending}
                  onClick={() => {
                    if (confirm('Move this spam lead into the CRM as a real Lead?')) {
                      moveToCrmMutation.mutate(selected);
                    }
                  }}
                >
                  {moveToCrmMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Move to CRM
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this spam lead?')) {
                      deleteMutation.mutate(selected.id);
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}