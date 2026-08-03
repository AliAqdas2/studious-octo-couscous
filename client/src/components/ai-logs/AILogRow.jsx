import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, Phone, Bot, Mail, UserPlus, Calendar as CalIcon,
  Sparkles, Eye, ExternalLink, ShieldAlert
} from 'lucide-react';

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

export default function AILogRow({ log, leadName, lead, onView }) {
  const cat = categorize(log.action);
  const Icon = cat.icon;
  const details = log.details || {};

  // Source email viewer — opens the existing in-app EmailViewModal which fetches
  // the message from Gmail only when clicked (no LLM credits). We need a
  // gmail_message_id for that modal; lead-created/appended/spam-routed logs
  // carry it directly. Classification logs don't, so they fall back to a plain
  // Gmail thread link if the lead has a thread id.
  const gmailMessageId = details.gmail_message_id || null;
  const gmailThreadId = details.gmail_thread_id || lead?.gmail_thread_id || null;
  const canOpenInApp = !!gmailMessageId && ['lead-created', 'lead-appended', 'spam-routed'].includes(cat.kind);
  const gmailFallbackUrl = !canOpenInApp && gmailThreadId
    ? `https://mail.google.com/mail/u/0/#all/${gmailThreadId}`
    : null;
  const showInAppViewer = canOpenInApp;
  const showGmailFallback = !!gmailFallbackUrl && ['classification', 'lead-created', 'lead-appended', 'spam-routed'].includes(cat.kind);

  const summaryLines = [];
  if (cat.kind === 'survey-draft') {
    if (details.recipient) summaryLines.push(`Sent draft to ${details.recipient}`);
    if (details.proposed_meeting_time_et) summaryLines.push(`Proposed: ${details.proposed_meeting_time_et}`);
    if (details.reason) summaryLines.push(`Reason: ${details.reason.replace(/_/g, ' ')}`);
  } else if (cat.kind === 'classification') {
    // autoDetectLeadType logs: channel, priority_tag, is_returning, estimate_detected, auto_stage
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
  }

  const canViewDraft = cat.kind === 'survey-draft' && !!details.draft_id;
  const canViewCall = cat.kind === 'call' && !!details.call_log_id;
  const leadLink = log.entity_type === 'Lead' && log.entity_id ? createPageUrl(`LeadDetail?id=${log.entity_id}`) : null;
  const eventLink = log.entity_type === 'Event' && log.entity_id ? createPageUrl(`EventDetail?id=${log.entity_id}`) : null;

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
            {showInAppViewer && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView({
                  type: 'email',
                  log,
                  lead,
                  email: {
                    id: gmailMessageId,
                    subject: details.subject || '',
                    from: details.from || '',
                    to: '',
                    snippet: details.body_snippet || ''
                  }
                })}
              >
                <Mail className="w-3.5 h-3.5 mr-1" /> View Source Email
              </Button>
            )}
            {showGmailFallback && (
              <a href={gmailFallbackUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <Mail className="w-3.5 h-3.5 mr-1" /> View Source Email
                </Button>
              </a>
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