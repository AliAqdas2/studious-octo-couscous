import React, { useEffect, useState } from 'react';
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
import { onboardingStrings } from './strings';

export default function OfferDeclinedDialog({
  open,
  onOpenChange,
  candidate,
  onConfirm,
  isPending,
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setNote('');
    }
  }, [open, candidate?.id]);

  const handleConfirm = () => {
    const trimmed = note.trim();
    const existing = (candidate?.notes || '').trim();
    let notes;
    if (trimmed) {
      const stamp = `Offer declined: ${trimmed}`;
      notes = existing ? `${existing}\n\n${stamp}` : stamp;
    }
    onConfirm?.(notes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.offerDeclinedTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.offerDeclinedSubtitle}
          </p>
          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-declined-note">
              {onboardingStrings.offerDeclinedNotesLabel}
            </Label>
            <Textarea
              id="offer-declined-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={onboardingStrings.offerDeclinedNotesPlaceholder}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {onboardingStrings.offerDeclinedCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : onboardingStrings.offerDeclinedConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
