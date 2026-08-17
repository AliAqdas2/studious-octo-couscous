import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, ExternalLink, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

export function buildOfferAcceptedEmail(candidate) {
  const name = candidate?.name || 'there';
  const role = candidate?.job_role || 'the open role';
  const subject = `Mangia DC - welcome aboard (${role})`;
  const body = [
    `Hi ${name},`,
    '',
    `Welcome to Mangia DC! We are excited you accepted the offer for the ${role} position.`,
    '',
    'Next we will begin onboarding (paperwork and training). We will follow up shortly with the details you need.',
    '',
    'If you have any questions in the meantime, just reply to this email.',
    '',
    'Welcome aboard,',
    'Mangia DC Hiring',
  ].join('\n');
  return { subject, body };
}

function mailtoHref(email, subject, body) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const actionBtnClass =
  'w-full justify-start h-10 border-orange-200 hover:bg-orange-50 hover:text-[#C84B31] hover:border-[#C84B31]/40';

export default function OfferAcceptedDialog({
  open,
  onOpenChange,
  candidate,
  onConfirm,
  isPending,
}) {
  const email = (candidate?.email || '').trim();
  const phone = (candidate?.phone || '').trim();
  const { subject, body } = buildOfferAcceptedEmail(candidate);

  const copyWelcome = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success(onboardingStrings.offerAcceptedCopied);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.offerAcceptedTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.offerAcceptedSubtitle}
          </p>
          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            {phone ? <p className="text-muted-foreground">{phone}</p> : null}
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <div className="space-y-2">
            {email ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={mailtoHref(email, subject, body)}>
                  <Mail className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.offerAcceptedEmail}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Mail className="h-4 w-4 mr-2" />
                {onboardingStrings.offerAcceptedNoEmail}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className={actionBtnClass}
              onClick={copyWelcome}
            >
              <Copy className="h-4 w-4 mr-2 text-[#C84B31]" />
              {onboardingStrings.offerAcceptedCopy}
            </Button>

            {phone ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                  <Phone className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.offerAcceptedCall}
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Phone className="h-4 w-4 mr-2" />
                {onboardingStrings.offerAcceptedNoPhone}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {onboardingStrings.offerAcceptedCancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {isPending ? 'Saving…' : onboardingStrings.offerAcceptedConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
