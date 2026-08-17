import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, ExternalLink, FileText, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

const DOC_ITEMS = [
  { id: 'resume', labelKey: 'needMoreInfoItemResume' },
  { id: 'eligibility', labelKey: 'needMoreInfoItemEligibility' },
  { id: 'availability', labelKey: 'needMoreInfoItemAvailability' },
  { id: 'references', labelKey: 'needMoreInfoItemReferences' },
  { id: 'other', labelKey: 'needMoreInfoItemOther' },
];

export function buildNeedMoreInfoRequest(candidate, selectedIds) {
  const name = candidate?.name || 'there';
  const role = candidate?.job_role || 'the open role';
  const selected = DOC_ITEMS.filter((item) => selectedIds.includes(item.id));
  const list =
    selected.length > 0
      ? selected.map((item) => `• ${onboardingStrings[item.labelKey]}`).join('\n')
      : '• Any remaining application materials we may be missing';

  const subject = `Mangia DC - additional information needed (${role})`;
  const body = [
    `Hi ${name},`,
    '',
    `Thank you for applying to Mangia DC for the ${role} position. To continue reviewing your application, could you please reply with the following?`,
    '',
    list,
    '',
    'You can reply to this email with attachments or links. Let us know if you have any questions.',
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

export default function NeedMoreInfoDialog({ open, onOpenChange, candidate }) {
  const [selected, setSelected] = useState(['resume', 'availability']);

  useEffect(() => {
    if (open) {
      setSelected(['resume', 'availability']);
    }
  }, [open, candidate?.id]);

  const email = (candidate?.email || '').trim();
  const phone = (candidate?.phone || '').trim();
  const resumeUrl = (candidate?.resume_url || '').trim();

  const { subject, body } = useMemo(
    () => buildNeedMoreInfoRequest(candidate, selected),
    [candidate, selected]
  );

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success(onboardingStrings.needMoreInfoCopied);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.needMoreInfoTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.needMoreInfoSubtitle}
          </p>

          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            {phone ? <p className="text-muted-foreground">{phone}</p> : null}
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C84B31] mb-2">
              {onboardingStrings.needMoreInfoChecklist}
            </p>
            <div className="space-y-2">
              {DOC_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    className="mt-0.5"
                  />
                  <span>{onboardingStrings[item.labelKey]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {email ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={mailtoHref(email, subject, body)}>
                  <Mail className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.needMoreInfoEmail}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Mail className="h-4 w-4 mr-2" />
                {onboardingStrings.needMoreInfoNoEmail}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className={actionBtnClass}
              onClick={copyRequest}
            >
              <Copy className="h-4 w-4 mr-2 text-[#C84B31]" />
              {onboardingStrings.needMoreInfoCopy}
            </Button>

            {phone ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                  <Phone className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.needMoreInfoCall}
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <Phone className="h-4 w-4 mr-2" />
                {onboardingStrings.needMoreInfoNoPhone}
              </Button>
            )}

            {resumeUrl ? (
              <Button variant="outline" className={actionBtnClass} asChild>
                <a href={resumeUrl} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4 mr-2 text-[#C84B31]" />
                  {onboardingStrings.needMoreInfoResume}
                  <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className={actionBtnClass} disabled>
                <FileText className="h-4 w-4 mr-2" />
                {onboardingStrings.needMoreInfoNoResume}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {onboardingStrings.needMoreInfoDone}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
