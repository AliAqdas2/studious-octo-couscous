import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ExternalLink, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

export function buildDaveHandoff(candidate, availabilityNotes) {
  const name = candidate?.name || 'Candidate';
  const role = candidate?.job_role || 'open role';
  const email = (candidate?.email || '').trim() || '—';
  const phone = (candidate?.phone || '').trim() || '—';
  const hireType = candidate?.hire_type || '—';
  const source = candidate?.source || '—';
  const notes = (availabilityNotes || '').trim() || '(none provided)';

  const subject = `Mangia DC - secondary approval: ${name} (${role})`;
  const body = [
    'Hi Dave,',
    '',
    `Please review this candidate for secondary approval after interview.`,
    '',
    `Name: ${name}`,
    `Role: ${role}`,
    `Hire type: ${hireType}`,
    `Source: ${source}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    candidate?.resume_url ? `Resume: ${candidate.resume_url}` : null,
    '',
    'Availability & interview notes:',
    notes,
    '',
    'Thanks,',
    'Mangia DC Hiring',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, body };
}

function mailtoHref(subject, body) {
  // No hardcoded Dave address — user picks recipient in the mail client.
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const actionBtnClass =
  'w-full justify-start h-10 border-orange-200 hover:bg-orange-50 hover:text-[#C84B31] hover:border-[#C84B31]/40';

export default function SendToDaveDialog({
  open,
  onOpenChange,
  candidate,
  onConfirm,
  isPending,
}) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setNotes(candidate?.notes || '');
    }
  }, [open, candidate?.id, candidate?.notes]);

  const resumeUrl = (candidate?.resume_url || '').trim();
  const email = (candidate?.email || '').trim();
  const phone = (candidate?.phone || '').trim();

  const { subject, body } = useMemo(
    () => buildDaveHandoff(candidate, notes),
    [candidate, notes]
  );

  const notesReady = notes.trim().length > 0;

  const copyHandoff = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success(onboardingStrings.sendToDaveCopied);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleConfirm = () => {
    if (!notesReady) {
      toast.error(onboardingStrings.sendToDaveNotesRequired);
      return;
    }
    onConfirm?.(notes.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.sendToDaveTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.sendToDaveSubtitle}
          </p>

          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            {phone ? <p className="text-muted-foreground">{phone}</p> : null}
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-to-dave-notes">
              {onboardingStrings.sendToDaveNotesLabel}
            </Label>
            <Textarea
              id="send-to-dave-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={onboardingStrings.sendToDaveNotesPlaceholder}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Button variant="outline" className={actionBtnClass} asChild>
              <a href={mailtoHref(subject, body)}>
                <Mail className="h-4 w-4 mr-2 text-[#C84B31]" />
                {onboardingStrings.sendToDaveEmail}
                <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              className={actionBtnClass}
              onClick={copyHandoff}
            >
              <Copy className="h-4 w-4 mr-2 text-[#C84B31]" />
              {onboardingStrings.sendToDaveCopy}
            </Button>

            {resumeUrl ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={resumeUrl} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.sendToDaveResume}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <FileText className="h-4 w-4 mr-2" />
                {onboardingStrings.sendToDaveNoResume}
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
            {onboardingStrings.sendToDaveCancel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !notesReady}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {isPending ? 'Saving…' : onboardingStrings.sendToDaveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
