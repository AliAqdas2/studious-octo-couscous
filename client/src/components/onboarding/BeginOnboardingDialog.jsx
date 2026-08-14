import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, ExternalLink, Mail, Phone, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

export function buildPaperworkKickoffEmail(candidate) {
  const name = candidate?.name || 'there';
  const role = candidate?.job_role || 'your new role';
  const subject = `Mangia DC — onboarding paperwork (${role})`;
  const body = [
    `Hi ${name},`,
    '',
    `Welcome again to Mangia DC. We are starting your onboarding for the ${role} position.`,
    '',
    'Please watch for follow-up with paperwork and training steps. Reply to this email if you have questions about documents, scheduling, or what comes next.',
    '',
    'Thank you,',
    'Mangia DC Hiring',
  ].join('\n');
  return { subject, body };
}

function mailtoHref(email, subject, body) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const actionBtnClass =
  'w-full justify-start h-10 border-orange-200 hover:bg-orange-50 hover:text-[#C84B31] hover:border-[#C84B31]/40';

function InviteLinkBlock({ inviteUrl, copied, onCopy }) {
  if (!inviteUrl) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {onboardingStrings.beginOnboardingLinkLabel}
      </p>
      <div className="flex gap-2">
        <Input readOnly value={inviteUrl} className="text-xs font-mono" />
        <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Link expires in 7 days.</p>
    </div>
  );
}

export default function BeginOnboardingDialog({
  open,
  onOpenChange,
  candidate,
  onSuccess,
}) {
  const email = (candidate?.email || '').trim();
  const phone = (candidate?.phone || '').trim();
  const { subject, body } = buildPaperworkKickoffEmail(candidate);
  const [outcome, setOutcome] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setOutcome(null);
      setCopied(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('beginOnboardingCandidate', {
        id: candidate.id,
      });
      return response?.data;
    },
    onSuccess: (result) => {
      setOutcome({
        inviteUrl: result?.inviteUrl ?? null,
        emailSent: result?.emailSent ?? false,
        error: null,
      });
      onSuccess?.(result);
      toast.success(
        result?.emailSent
          ? 'Login details emailed'
          : 'Account created — copy the invite link'
      );
    },
    onError: (e) => {
      const msg = e?.body?.error || e?.message || 'Failed to send login details';
      setOutcome({
        inviteUrl: e?.body?.inviteUrl ?? null,
        emailSent: e?.body?.emailSent ?? false,
        error: msg,
      });
      toast.error(msg);
    },
  });

  const copyKickoff = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success(onboardingStrings.beginOnboardingCopied);
    } catch {
      toast.error('Could not copy');
    }
  };

  const copyInviteLink = async () => {
    if (!outcome?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(outcome.inviteUrl);
      setCopied(true);
      toast.success(onboardingStrings.beginOnboardingLinkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    onOpenChange(false);
  };

  if (outcome !== null) {
    const hasLink = Boolean(outcome.inviteUrl);
    const isError = Boolean(outcome.error);

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C84B31]">
              {isError
                ? onboardingStrings.beginOnboardingErrorTitle
                : onboardingStrings.beginOnboardingInviteReady}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isError && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{outcome.error}</p>
              </div>
            )}

            {!isError && (
              <p className="text-sm text-muted-foreground">
                {outcome.emailSent
                  ? onboardingStrings.beginOnboardingInviteEmailSent
                  : onboardingStrings.beginOnboardingInviteManual}
              </p>
            )}

            {isError && hasLink && (
              <p className="text-sm text-muted-foreground">
                {onboardingStrings.beginOnboardingErrorWithLink}
              </p>
            )}

            <InviteLinkBlock
              inviteUrl={outcome.inviteUrl}
              copied={copied}
              onCopy={copyInviteLink}
            />

            {!hasLink && isError && (
              <p className="text-xs text-muted-foreground">
                No invite link is available for this error. Fix the issue above and try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
            >
              {onboardingStrings.beginOnboardingInviteDone}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.beginOnboardingTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.beginOnboardingSubtitle}
          </p>
          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            {phone ? <p className="text-muted-foreground">{phone}</p> : null}
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <p className="text-sm text-gray-700 rounded-md border border-dashed border-orange-200 bg-white/60 px-3 py-2">
            {onboardingStrings.beginOnboardingChecklistHint}
          </p>

          <div className="space-y-2">
            {email ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={mailtoHref(email, subject, body)}>
                  <Mail className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.beginOnboardingEmail}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Mail className="h-4 w-4 mr-2" />
                {onboardingStrings.beginOnboardingNoEmail}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className={actionBtnClass}
              onClick={copyKickoff}
            >
              <Copy className="h-4 w-4 mr-2 text-[#C84B31]" />
              {onboardingStrings.beginOnboardingCopy}
            </Button>

            {phone ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                  <Phone className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.beginOnboardingCall}
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Phone className="h-4 w-4 mr-2" />
                {onboardingStrings.beginOnboardingNoPhone}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            {onboardingStrings.beginOnboardingCancel}
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !email}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {mutation.isPending
              ? onboardingStrings.beginOnboardingSending
              : onboardingStrings.beginOnboardingConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
