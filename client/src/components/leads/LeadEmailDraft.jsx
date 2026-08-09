import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, FileText, ChevronDown, ChevronUp, Loader2, X, Save } from 'lucide-react';
import { toast } from 'sonner';

function replaceLeadVariables(text, lead) {
  if (!text) return '';
  return text
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{company\}\}/g, lead.company || '')
    .replace(/\{\{email\}\}/g, lead.email || '')
    .replace(/\{\{event_type\}\}/g, lead.event_type_interest || '')
    .replace(/\{\{preferred_date\}\}/g, lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString() : '')
    .replace(/\{\{headcount\}\}/g, lead.headcount_estimate || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '');
}

async function replaceVariables(text, lead) {
  let out = replaceLeadVariables(text, lead);
  if (/<<\s*Sales Manager Availability\s*>>/i.test(out)) {
    try {
      const slot = await base44.calendar.getNextSlot();
      const formatted = slot?.formatted || '<Meeting Date And Time>';
      out = out.replace(/<<\s*Sales Manager Availability\s*>>/gi, formatted);
    } catch {
      out = out.replace(/<<\s*Sales Manager Availability\s*>>/gi, '<Meeting Date And Time>');
    }
  }
  return out;
}

/** Reply subject for thread: if already "Re: ..." keep as-is, else add "Re: " (keeps email trail correct) */
function getReplySubject(emailDetail) {
  if (!emailDetail?.subject) return 'Re: (No Subject)';
  const s = emailDetail.subject.trim();
  return s.startsWith('Re:') ? s : `Re: ${s}`;
}

// Pipeline stage order for sorting the template dropdown
const STAGE_ORDER = [
  'New Inquiry',
  'Survey Sent',
  'No Survey Response – Follow-Up 1',
  'No Response – Follow-Up 2',
  '2nd Follow-Up – Off Radar',
  'Calendar Invite Sent',
  'Survey Completed – Calendar Invite Sent',
  'Calendar Invite Resent',
  'Awaiting Calendar Acceptance',
  'After Meeting Follow-Up',
  'After Meeting Follow-Up',
  'Deposit Requested',
  'Confirmed Sales',
  'Pre-Event',
  'Post-Event',
  'Cancelled',
];

function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    const ai = STAGE_ORDER.findIndex(s => a.pipeline_stage?.includes(s) || s.includes(a.pipeline_stage || '___'));
    const bi = STAGE_ORDER.findIndex(s => b.pipeline_stage?.includes(s) || s.includes(b.pipeline_stage || '___'));
    const aIdx = ai === -1 ? 999 : ai;
    const bIdx = bi === -1 ? 999 : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (a.template_name || '').localeCompare(b.template_name || '');
  });
}

export default function LeadEmailDraft({ lead, templates, emailActivities }) {
  const queryClient = useQueryClient();
  const hasPrefilledSubjectFromLatestRef = useRef(false);

  const safeTemplates = Array.isArray(templates) ? templates : [];
  const safeEmailActivities = Array.isArray(emailActivities) ? emailActivities : [];

  // Latest email received FROM the lead (lead sent to us)
  const latestReceivedFromLead = safeEmailActivities
    .filter(a => a.action === 'Email Activity' && a.details?.direction === 'Received from Lead' && a.details?.gmail_message_id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;

  const latestMessageId = latestReceivedFromLead?.details?.gmail_message_id || null;

  const { data: latestEmailDetail, isLoading: isLoadingLatestEmail } = useQuery({
    queryKey: ['email-detail', latestMessageId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailDetail', { messageId: latestMessageId });
      return res.data?.email || null;
    },
    enabled: !!latestMessageId
  });

  /** When true, we're replying to latest email (subject stays reply subject; template only changes body) */
  const [isReplyToLatest, setIsReplyToLatest] = useState(true);

  // Match templates directly by pipeline_stage + channel + customer_type
  const matchingTemplates = safeTemplates.filter(t => {
    if (!t.is_active) return false;
    if (!t.pipeline_stage || t.pipeline_stage !== lead?.stage) return false;
    const channelMatch = !t.channel || t.channel === 'Both' || t.channel === lead?.channel;
    const customerTypeMatch = !t.customer_type || t.customer_type === "Doesn't matter" ||
      t.customer_type === lead?.client_type;
    return channelMatch && customerTypeMatch;
  });

  // All active templates as fallback
  const allTemplates = safeTemplates.filter(t => t.is_active);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [formData, setFormData] = useState({
    to: lead?.email || '',
    subject: '',
    body: ''
  });

  // No latest email → not in reply mode
  useEffect(() => {
    if (!latestMessageId) setIsReplyToLatest(false);
  }, [latestMessageId]);

  // Auto-populate first matching template when stage has automation.
  // Re-run when templates load (so we don't miss the match if templates arrive after the lead).
  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    (async () => {
      if (matchingTemplates.length > 0) {
        const first = matchingTemplates[0];
        setSelectedTemplateId(first.id);
        const subject = await replaceVariables(first.subject, lead);
        const body = await replaceVariables(first.body, lead);
        if (cancelled) return;
        setFormData({
          to: lead.email || '',
          subject,
          body
        });
        hasPrefilledSubjectFromLatestRef.current = false;
        setIsReplyToLatest(false);
      } else {
        setSelectedTemplateId('');
        setFormData({ to: lead.email || '', subject: '', body: '' });
        hasPrefilledSubjectFromLatestRef.current = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.stage, lead?.id, lead?.channel, lead?.client_type, safeTemplates.length]);

  // Prefill subject with correct reply subject when we have latest received email and no template
  useEffect(() => {
    if (!latestEmailDetail || hasPrefilledSubjectFromLatestRef.current) return;
    const replySubject = getReplySubject(latestEmailDetail);
    setFormData(prev => (prev.subject ? prev : { ...prev, subject: replySubject }));
    hasPrefilledSubjectFromLatestRef.current = true;
    setIsReplyToLatest(true);
  }, [latestEmailDetail]);

  const [showLatestEmailExpanded, setShowLatestEmailExpanded] = useState(false);

  const handleTemplateChange = async (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      const replySubject = isReplyToLatest && latestEmailDetail ? getReplySubject(latestEmailDetail) : '';
      setFormData({ to: lead?.email || '', subject: replySubject, body: '' });
      return;
    }
    const template = safeTemplates.find(t => t.id === templateId);
    if (template) {
      if (isReplyToLatest) {
        const body = await replaceVariables(template.body, lead);
        setFormData(prev => ({
          to: lead?.email || '',
          subject: prev.subject,
          body
        }));
      } else {
        const subject = await replaceVariables(template.subject, lead);
        const body = await replaceVariables(template.body, lead);
        setFormData({
          to: lead?.email || '',
          subject,
          body
        });
      }
    }
  };

  const handleCancelReply = async () => {
    setIsReplyToLatest(false);
    const templateId = selectedTemplateId;
    if (templateId) {
      const template = safeTemplates.find(t => t.id === templateId);
      if (template) {
        const subject = await replaceVariables(template.subject, lead);
        const body = await replaceVariables(template.body, lead);
        setFormData({
          to: lead?.email || '',
          subject,
          body
        });
      } else {
        setFormData(prev => ({ ...prev, subject: '' }));
      }
    } else {
      setFormData(prev => ({ ...prev, subject: '' }));
    }
  };

  const createDraftMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createGmailDraft', {
        ...data,
        leadId: lead.id
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Draft saved in Gmail!');
      queryClient.invalidateQueries(['activities']);
    },
    onError: () => toast.error('Failed to create draft')
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('sendGmailEmail', {
        ...data,
        leadId: lead.id
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Email sent!');
      queryClient.invalidateQueries(['activities']);
    },
    onError: () => toast.error('Failed to send email')
  });

  const isBusy = createDraftMutation.isPending || sendEmailMutation.isPending;
  const hasStageTemplates = matchingTemplates.length > 0;

  if (!lead) return null;

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#C84B31]" />
            Email Draft — {lead.stage}
          </CardTitle>
          {hasStageTemplates && (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <FileText className="w-3 h-3 mr-1" />
              {matchingTemplates.length} stage template{matchingTemplates.length > 1 ? 's' : ''} matched
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single panel: reply context or link to reply */}
        {latestMessageId && (
          <div className="border border-slate-200 rounded-lg bg-slate-50/80 overflow-hidden">
            {isReplyToLatest ? (
              <>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-sm text-slate-700">
                    <span className="font-medium text-slate-800">Replying to:</span>{' '}
                    {isLoadingLatestEmail ? '…' : (latestEmailDetail?.subject || formData.subject || '—')}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 text-slate-600 hover:text-slate-800"
                    onClick={handleCancelReply}
                  >
                    <X className="w-4 h-4 mr-1" />
                    New thread
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLatestEmailExpanded(!showLatestEmailExpanded)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100/80 border-t border-slate-200"
                >
                  {showLatestEmailExpanded ? <><ChevronUp className="w-3 h-3" /> Hide original</> : <><ChevronDown className="w-3 h-3" /> Show original email</>}
                </button>
                {showLatestEmailExpanded && (
                  <div className="border-t border-slate-200 px-3 py-3 text-sm bg-white max-h-40 overflow-y-auto">
                    {isLoadingLatestEmail ? (
                      <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                    ) : latestEmailDetail ? (
                      <>
                        <p className="text-xs text-slate-500 mb-1">{latestEmailDetail.from} · {latestEmailDetail.date ? new Date(latestEmailDetail.date).toLocaleString() : ''}</p>
                        <div className="text-slate-700 whitespace-pre-wrap break-words text-xs leading-relaxed">
                          {latestEmailDetail.body?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000) || latestEmailDetail.snippet || '—'}
                          {(latestEmailDetail.body?.length || 0) > 1000 && '…'}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm text-slate-600">Starting a new email thread.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 border-slate-300 text-slate-700"
                  onClick={() => {
                    setIsReplyToLatest(true);
                    if (latestEmailDetail) setFormData(prev => ({ ...prev, subject: getReplySubject(latestEmailDetail) }));
                  }}
                >
                  Reply to latest instead
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Template Dropdown */}
        <div>
          <Label>Email Template</Label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
          >
            <option value="">— No template (blank) —</option>
            {matchingTemplates.length > 0 && (
              <optgroup label="Stage Templates (matched)">
                {matchingTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.template_name}</option>
                ))}
              </optgroup>
            )}
            {allTemplates.filter(t => !matchingTemplates.find(mt => mt.id === t.id)).length > 0 && (
              <optgroup label="Other Templates">
                {sortTemplates(allTemplates.filter(t => !matchingTemplates.find(mt => mt.id === t.id))).map(t => (
                  <option key={t.id} value={t.id}>{t.template_name}{t.pipeline_stage ? ` — ${t.pipeline_stage}` : ''}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>To</Label>
            <Input
              type="email"
              value={formData.to}
              onChange={(e) => setFormData({...formData, to: e.target.value})}
            />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="Email subject"
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({...formData, body: e.target.value})}
              rows={8}
              placeholder="Write your email..."
            />
          </div>
        </div>

        {/* Email Preview */}
        {formData.subject && formData.body && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 mb-2">PREVIEW</p>
            <p className="text-sm font-medium text-gray-900 mb-1">To: {formData.to}</p>
            <p className="text-sm font-medium text-gray-900 mb-3">Subject: {formData.subject}</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap border-t pt-3">{formData.body}</div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            disabled={isBusy || !formData.to || !formData.subject}
            onClick={() => createDraftMutation.mutate(formData)}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
          >
            {createDraftMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (
              <><Save className="w-4 h-4 mr-2" />Save to Draft</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}