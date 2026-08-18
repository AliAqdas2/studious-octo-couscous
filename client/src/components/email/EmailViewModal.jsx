import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, FileText, Reply, Clock, User, Mail } from 'lucide-react';
import { toast } from 'sonner';
import EmailBodyRenderer from './EmailBodyRenderer';
import EmailKindBadge from './EmailKindBadge';

export default function EmailViewModal({ email, lead, onClose }) {
  const queryClient = useQueryClient();
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const { data: emailDetail, isLoading } = useQuery({
    queryKey: ['email-detail', email.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailDetail', { messageId: email.id });
      return res.data.email;
    },
    enabled: !!email.id
  });

  const replyMutation = useMutation({
    mutationFn: async ({ action }) => {
      const detail = emailDetail || email;
      const res = await base44.functions.invoke('replyToEmail', {
        to: detail.from?.includes('<') ? detail.from.match(/<(.+)>/)?.[1] || detail.from : detail.from,
        subject: detail.subject?.startsWith('Re:') ? detail.subject : `Re: ${detail.subject}`,
        body: replyBody,
        threadId: detail.threadId,
        messageId: detail.messageIdHeader || '',
        leadId: lead?.id,
        action
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.type === 'draft') {
        toast.success('Draft saved in Gmail');
      } else {
        toast.success('Reply sent!');
      }
      queryClient.invalidateQueries(['activities']);
      setReplyBody('');
      setShowReply(false);
      onClose();
    },
    onError: () => {
      toast.error('Failed. Make sure Gmail is connected.');
    }
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const handleTemplateSelect = (templateId) => {
    if (!templateId) return;
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    let body = template.body;
    if (lead) {
      body = body.replace(/{{name}}/g, lead.name || '');
      body = body.replace(/{{company}}/g, lead.company || '');
      body = body.replace(/{{email}}/g, lead.email || '');
      body = body.replace(/{{phone}}/g, lead.phone || '');
      body = body.replace(/{{event_type}}/g, lead.event_type_interest || '');
      body = body.replace(/{{preferred_date}}/g, lead.preferred_date || '');
      body = body.replace(/{{headcount}}/g, String(lead.headcount_estimate || ''));
    }
    setReplyBody(body);
  };

  const extractName = (headerValue) => {
    if (!headerValue) return '';
    const match = headerValue.match(/^(.+?)\s*</);
    return match ? match[1].replace(/"/g, '').trim() : headerValue;
  };

  const extractEmail = (headerValue) => {
    if (!headerValue) return headerValue || '';
    const match = headerValue.match(/<(.+?)>/);
    return match ? match[1] : headerValue;
  };

  const bodyContent = emailDetail?.body ?? email.snippet ?? '';
  const bodyMimeType = emailDetail?.bodyMimeType || (emailDetail?.body ? undefined : 'text/plain');
  const kind = emailDetail?.kind || email.kind;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#C84B31] pr-6 flex items-center gap-2 flex-wrap">
            <span>{email.subject || '(No Subject)'}</span>
            <EmailKindBadge kind={kind} />
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#C84B31]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Email metadata */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C84B31]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-5 h-5 text-[#C84B31]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">
                      {extractName(emailDetail?.from || email.from)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDate(emailDetail?.date || email.date)}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{extractEmail(emailDetail?.from || email.from)}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <span>To:</span>
                    <span className="text-gray-700">{extractEmail(emailDetail?.to || email.to)}</span>
                  </div>
                  {emailDetail?.cc && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>Cc:</span>
                      <span className="text-gray-700">{emailDetail.cc}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email body */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <EmailBodyRenderer content={bodyContent} mimeType={bodyMimeType} />
            </div>

            {/* Reply section */}
            {!showReply ? (
              <Button
                onClick={() => setShowReply(true)}
                variant="outline"
                className="w-full border-dashed border-orange-300 text-[#C84B31] hover:bg-orange-50"
              >
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
            ) : (
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Reply to {extractName(emailDetail?.from || email.from)}</p>
                  {templates.filter(t => t.is_active).length > 0 && (
                    <Select onValueChange={handleTemplateSelect}>
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-white">
                        <SelectValue placeholder="Use template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.filter(t => t.is_active).map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.template_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={6}
                  placeholder="Type your reply or select a template..."
                  className="bg-white"
                  autoFocus
                />
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowReply(false); setReplyBody(''); }}
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!replyBody.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ action: 'draft' })}
                    >
                      {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
                      Save Draft
                    </Button>
                    <Button
                      size="sm"
                      disabled={!replyBody.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ action: 'send' })}
                      className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
                    >
                      {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}