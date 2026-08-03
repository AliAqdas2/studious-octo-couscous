import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Clock, User, FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import EmailBodyRenderer from '@/components/email/EmailBodyRenderer';

export default function LeadEmailActivityDialog({ activity, onClose }) {
  const d = activity?.details || {};

  // Best-effort field mapping across the different email-related activity shapes
  // we log on a Lead (survey sent, draft created, reply sent, contact-form intake).
  const subject = d.subject || '';
  const recipient = d.recipient || d.to || d.from || '';
  const direction = d.direction || '';
  const template = d.template || '';
  const channel = d.channel || '';
  const fallbackBody = d.body || d.snippet || '';
  const draftId = d.draft_id || '';
  const gmailMessageId = d.gmail_message_id || '';

  // Fetch the full email body from Gmail when we have an identifier.
  // Prefer message ID (sent/received) — fall back to draft ID.
  const fetchType = gmailMessageId ? 'message' : draftId ? 'draft' : null;
  const fetchId = gmailMessageId || draftId;

  const { data: fullEmail, isLoading, isError, error } = useQuery({
    queryKey: ['lead-email-full', fetchType, fetchId],
    queryFn: async () => {
      if (fetchType === 'message') {
        const res = await base44.functions.invoke('getEmailDetail', { messageId: fetchId });
        return res.data.email;
      }
      if (fetchType === 'draft') {
        const res = await base44.functions.invoke('getDraftDetail', { draftId: fetchId });
        return res.data.email;
      }
      return null;
    },
    enabled: !!activity && !!fetchId,
    staleTime: 60_000
  });

  if (!activity) return null;

  const bodyContent = fullEmail?.body || fallbackBody;
  const bodyMimeType = fullEmail?.bodyMimeType || 'text/plain';
  const displaySubject = fullEmail?.subject || subject;
  const displayFrom = fullEmail?.from || '';
  const displayTo = fullEmail?.to || recipient;
  const displayDate = fullEmail?.date || activity.timestamp;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#C84B31] flex items-center gap-2 pr-6">
            <Mail className="w-5 h-5" />
            {displaySubject || activity.action || 'Email Activity'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <Row label="Action" value={activity.action} />
            {displayFrom && <Row icon={User} label="From" value={displayFrom} />}
            {displayTo && <Row icon={User} label="To" value={displayTo} />}
            {direction && <Row label="Direction" value={direction} />}
            {template && <Row icon={FileText} label="Template" value={template} />}
            {channel && <Row label="Channel" value={channel} />}
            <Row
              icon={Clock}
              label="Time"
              value={displayDate ? safeDate(displayDate) : '—'}
            />
            {activity.user_name && <Row label="By" value={activity.user_name} />}
          </div>

          {/* Body */}
          <div className="border rounded-lg bg-white overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#C84B31]" />
              </div>
            ) : isError ? (
              <div className="p-4 text-sm text-red-600 bg-red-50 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  Couldn't load the full email from Gmail.
                  {error?.message && <div className="text-xs mt-1 opacity-75">{error.message}</div>}
                  {fallbackBody && (
                    <div className="mt-3 text-gray-700">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Logged snippet
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans">{fallbackBody}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : bodyContent ? (
              <EmailBodyRenderer content={bodyContent} mimeType={bodyMimeType} />
            ) : !fetchId ? (
              <div className="p-4 text-sm text-gray-500">
                The full email body wasn't captured for this activity. Only the metadata above
                was logged.
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-500">(no content)</div>
            )}
          </div>

          {/* Gmail link for drafts */}
          {draftId && (
            <div className="text-xs">
              <a
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#C84B31] hover:underline"
              >
                Open draft in Gmail <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function safeDate(dateStr) {
  try {
    return format(new Date(dateStr), 'PPpp');
  } catch {
    return String(dateStr);
  }
}

function Row({ icon: Icon, label, value, bold }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-gray-900 break-words ${bold ? 'font-semibold' : ''}`}>{value}</div>
      </div>
    </div>
  );
}