import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CalendarPlus,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

export function buildInterviewInvite(candidate) {
  const name = candidate?.name || 'there';
  const role = candidate?.job_role || 'the open role';
  const subject = `Mangia DC interview - ${role}`;
  const body = [
    `Hi ${name},`,
    '',
    `Thank you for applying to Mangia DC for the ${role} position. We'd like to schedule an interview with you.`,
    '',
    'Could you please reply with a few times that work over the next few days (and your preferred time zone)? We can meet by Google Meet or phone.',
    '',
    'Looking forward to speaking with you.',
    '',
    'Best,',
    'Mangia DC Hiring',
  ].join('\n');
  return { subject, body };
}

function mailtoHref(email, subject, body) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function calendarHref(candidate, subject, body) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: subject,
    details: body,
  });
  if (candidate?.email) {
    params.set('add', candidate.email);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const actionBtnClass =
  'w-full justify-start h-10 border-orange-200 hover:bg-orange-50 hover:text-[#C84B31] hover:border-[#C84B31]/40';

export default function ScheduleInterviewDialog({
  open,
  onOpenChange,
  candidate,
  onConfirm,
  isPending,
}) {
  const email = (candidate?.email || '').trim();
  const phone = (candidate?.phone || '').trim();
  const { subject, body } = buildInterviewInvite(candidate);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success(onboardingStrings.scheduleInviteCopied);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.scheduleInterviewTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.scheduleInterviewSubtitle}
          </p>
          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            {phone ? (
              <p className="text-muted-foreground">{phone}</p>
            ) : null}
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <div className="space-y-2">
            {email ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={mailtoHref(email, subject, body)}>
                  <Mail className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.scheduleEmailInvite}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Mail className="h-4 w-4 mr-2" />
                {onboardingStrings.scheduleNoEmail}
              </Button>
            )}

            <Button variant="outline" className={actionBtnClass} asChild>
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
              >
                <Video className="h-4 w-4 mr-2 text-[#C84B31]" />
                {onboardingStrings.scheduleGoogleMeet}
                <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
              </a>
            </Button>

            <Button variant="outline" className={actionBtnClass} asChild>
              <a
                href={calendarHref(candidate, subject, body)}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarPlus className="h-4 w-4 mr-2 text-[#C84B31]" />
                {onboardingStrings.scheduleGoogleCalendar}
                <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
              </a>
            </Button>

            {phone ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                  <Phone className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.scheduleCall}
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Phone className="h-4 w-4 mr-2" />
                {onboardingStrings.scheduleNoPhone}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className={actionBtnClass}
              onClick={copyInvite}
            >
              <Copy className="h-4 w-4 mr-2 text-[#C84B31]" />
              {onboardingStrings.scheduleCopyInvite}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {onboardingStrings.scheduleCancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {isPending ? 'Saving…' : onboardingStrings.scheduleConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
