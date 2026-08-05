import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, Phone, Bot, Mail, UserPlus, Calendar as CalIcon,
  Sparkles, Eye, ExternalLink, ShieldAlert, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Maps an action label to a category + icon + color band, used to render
// each row in the AI Logs timeline.
function categorize(action) {
  if (action?.includes('Meeting Proposal Draft')) {
    return { kind: 'survey-draft', icon: FileText, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'AI Survey Draft' };
  }
  if (action === 'Auto-Classification') {
    return { kind: 'classification', icon: Sparkles, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'AI Lead Classification (B2B/B2C, priority)' };
  }
  if (action === 'Staff Auto-Assigned') {
    return { kind: 'staff', icon: UserPlus, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Auto Staff Assignment' };
  }
  if (action === 'Created from Direct Email') {
    return { kind: 'lead-created', icon: Mail, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'New Lead from Email' };
  }
  if (action === 'Created from Contact Form') {
    return { kind: 'lead-created', icon: Mail, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'New Lead from Website Form' };
  }
  if (action === 'Inbound Email Received (Follow-up)') {
    return { kind: 'lead-appended', icon: Mail, color: 'bg-teal-100 text-teal-700 border-teal-200', label: 'Follow-up Email on Existing Lead' };
  }
  if (action === 'Event Created' || action === 'Created from Won Lead') {
    return { kind: 'event', icon: CalIcon, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Auto Event Created' };
  }
  if (action === 'Call Analyzed') {
    return { kind: 'call', icon: Phone, color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'AI Call Analysis' };
  }
  if (action?.startsWith('Routed to Spam')) {
    return { kind: 'spam-routed', icon: ShieldAlert, color: 'bg-orange-100 text-orange-700 border-orange-200', label: action.replace('Routed to ', '') };
  }
  if (action === 'Intake Failed (Dead Letter)' || action === 'Intake Failed (Retry Queued)') {
    return { kind: 'intake-failure', icon: ShieldAlert, color: 'bg-red-100 text-red-700 border-red-200', label: action };
  }
  return { kind: 'other', icon: Bot, color: 'bg-gray-100 text-gray-700 border-gray-200', label: action };
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch { return ts; }
}

const SOURCE_EMAIL_KINDS = new Set([
  'classification',
  'lead-created',
  'lead-appended',
  'spam-routed',
  'intake-failure',
]);

/**
 * Resolve a Gmail message id for in-app EmailViewModal (never open Gmail).
 * Prefer details.gmail_message_id → spam entity → newest message in thread.
 */
async function resolveSourceMessageId({ details, lead, spamById }) {
  if (details.gmail_message_id) {
    return {
      id: details.gmail_message_id,
      subject: details.subject || '',
      from: details.from || '',
      snippet: details.body_snippet || '',
    };
  }

  const spamId = details.spam_email_id;
  if (spamId) {
    let spam = spamById?.[spamId];
    if (!spam) {
      const rows = await base44.entities.SpamEmail.filter({ id: spamId });
      spam = rows?.[0];
    }
    const msgId = spam?.gmail_message_id || spam?.gmailMessageId;
    if (msgId) {
      return {
        id: msgId,
        subject: spam.subject || details.subject || '',
        from: spam.from || details.from || '',
        snippet: details.body_snippet || '',
      };
    }
  }

  const threadId = details.gmail_thread_id || lead?.gmail_thread_id || null;
  if (threadId) {
    const response = await base44.functions.invoke('getGmailThread', { threadId });
    const messages = response?.data?.messages || [];
    const newest = messages[0];
    if (newest?.id) {
      return {
        id: newest.id,
        subject: newest.subject || details.subject || '',
        from: newest.from || details.from || '',
        to: newest.to || '',
        snippet: newest.snippet || details.body_snippet || '',
        date: newest.date || '',
      };
    }
  }

  return null;
}

export default function AILogRow({ log, leadName, lead, spamById, onView }) {
  const cat = categorize(log.action);
  const Icon = cat.icon;
  const details = log.details || {};
  const [resolving, setResolving] = useState(false);

  const gmailMessageId = details.gmail_message_id || null;
  const spamEmailId = details.spam_email_id || null;
  const gmailThreadId = details.gmail_thread_id || lead?.gmail_thread_id || null;
  const spamHasMessage =
    spamEmailId &&
    !!(spamById?.[spamEmailId]?.gmail_message_id || spamById?.[spamEmailId]?.gmailMessageId);
  const canTrySourceEmail =
    SOURCE_EMAIL_KINDS.has(cat.kind) &&
    !!(gmailMessageId || spamEmailId || spamHasMessage || gmailThreadId);

  const summaryLines = [];
  if (cat.kind === 'survey-draft') {
    if (details.recipient) summaryLines.push(`Sent draft to ${details.recipient}`);
    if (details.proposed_meeting_time_et) summaryLines.push(`Proposed: ${details.proposed_meeting_time_et}`);
    if (details.reason) summaryLines.push(`Reason: ${details.reason.replace(/_/g, ' ')}`);
  } else if (cat.kind === 'classification') {
    const parts = [];
    if (details.channel) parts.push(`Channel: ${details.channel}`);
    if (details.detected_channel) parts.push(`Channel: ${details.detected_channel}`);
    if (details.priority_tag) parts.push(`Priority: ${details.priority_tag}`);
    if (details.is_returning === true) parts.push('Returning client');
    if (details.is_returning === false) parts.push('New client');
    if (details.estimate_detected === true) parts.push('Estimate request detected');
    if (details.auto_stage) parts.push(`Stage: ${details.auto_stage}`);
    if (details.detected_inquiry_type) parts.push(`Inquiry: ${details.detected_inquiry_type}`);
    if (parts.length > 0) summaryLines.push(parts.join(' · '));
    summaryLines.push('System auto-classified this lead right after intake (sorts it into B2B vs B2C, flags priority, and detects returning clients).');
    if (details.reasoning) summaryLines.push(details.reasoning);
  } else if (cat.kind === 'lead-created' || cat.kind === 'lead-appended') {
    if (details.from) summaryLines.push(`From: ${details.from}`);
    if (details.subject) summaryLines.push(`Subject: ${details.subject}`);
    if (details.ai_category && details.ai_category !== 'Valid') summaryLines.push(`Flagged: ${details.ai_category}`);
    if (details.ai_reason) summaryLines.push(details.ai_reason);
  } else if (cat.kind === 'staff') {
    if (details.role) summaryLines.push(`Role: ${details.role}`);
    if (details.assigned_user_name) summaryLines.push(`Assigned: ${details.assigned_user_name}`);
  } else if (cat.kind === 'call') {
    if (details.summary) summaryLines.push(details.summary);
    if (details.extracted_next_stage) summaryLines.push(`Next stage: ${details.extracted_next_stage}`);
  } else if (cat.kind === 'event') {
    if (details.event_name) summaryLines.push(`Event: ${details.event_name}`);
    if (details.event_date) summaryLines.push(`Date: ${details.event_date}`);
  } else if (cat.kind === 'spam-routed') {
    if (details.from) summaryLines.push(`From: ${details.from}`);
    if (details.subject) summaryLines.push(`Subject: ${details.subject}`);
    if (details.sender_role) summaryLines.push(`Sender role: ${details.sender_role.replace(/_/g, ' ')}`);
    if (details.ai_category) summaryLines.push(`Category: ${details.ai_category}`);
    if (details.ai_reason) summaryLines.push(details.ai_reason);
  } else if (cat.kind === 'intake-failure') {
    if (details.from) summaryLines.push(`From: ${details.from}`);
    if (details.subject) summaryLines.push(`Subject: ${details.subject}`);
    if (details.attempt_count != null) summaryLines.push(`Attempt: ${details.attempt_count}`);
    if (details.error) summaryLines.push(`Error: ${details.error}`);
  }

  const canViewDraft = cat.kind === 'survey-draft' && !!details.draft_id;
  const canViewCall = cat.kind === 'call' && !!details.call_log_id;
  const leadLink = log.entity_type === 'Lead' && log.entity_id ? createPageUrl(`LeadDetail?id=${log.entity_id}`) : null;
  const eventLink = log.entity_type === 'Event' && log.entity_id ? createPageUrl(`EventDetail?id=${log.entity_id}`) : null;

  const handleViewSourceEmail = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      const email = await resolveSourceMessageId({ details, lead, spamById });
      if (!email?.id) {
        toast.error('No source email available');
        return;
      }
      onView({
        type: 'email',
        log,
        lead,
        email: {
          id: email.id,
          subject: email.subject || '',
          from: email.from || '',
          to: email.to || '',
          snippet: email.snippet || '',
          date: email.date || '',
        },
      });
    } catch {
      toast.error('Failed to load source email. Make sure Gmail is connected.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-orange-200 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${cat.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cat.color}>{cat.label}</Badge>
              <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
            </div>
            <p className="font-medium text-gray-900 mt-1 truncate">
              {leadName && <span>{leadName} — </span>}
              <span className="text-gray-600">{log.action}</span>
            </p>
            {summaryLines.length > 0 && (
              <ul className="mt-1 text-sm text-gray-600 space-y-0.5">
                {summaryLines.map((line, i) => (
                  <li key={i} className="truncate">• {line}</li>
                ))}
              </ul>
            )}
            {log.user_name && (
              <p className="text-xs text-gray-400 mt-1">By {
                log.user_name === 'Lead Auto-Detection' ? 'AI Lead Classifier' : log.user_name
              }</p>
            )}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            {canViewDraft && (
              <Button size="sm" variant="outline" onClick={() => onView({ type: 'draft', log })}>
                <Eye className="w-3.5 h-3.5 mr-1" /> View Draft
              </Button>
            )}
            {canTrySourceEmail && (
              <Button
                size="sm"
                variant="outline"
                disabled={resolving}
                onClick={handleViewSourceEmail}
              >
                {resolving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-1" />
                )}
                View Source Email
              </Button>
            )}
            {canViewCall && (
              <Link to={createPageUrl(`AutomatedCallDetail?id=${details.call_log_id}`)}>
                <Button size="sm" variant="outline">
                  <Phone className="w-3.5 h-3.5 mr-1" /> View Call
                </Button>
              </Link>
            )}
            {leadLink && (
              <Link to={leadLink}>
                <Button size="sm" variant="ghost" className="text-[#C84B31]">
                  Lead <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
            {eventLink && (
              <Link to={eventLink}>
                <Button size="sm" variant="ghost" className="text-[#C84B31]">
                  Event <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
