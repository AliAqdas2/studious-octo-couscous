import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { KeyRound } from 'lucide-react';
import { onboardingStrings } from './strings';

export default function MarkActiveDialog({
  open,
  onOpenChange,
  candidate,
  onConfirm,
  isPending,
}) {
  const email = (candidate?.email || '').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#C84B31]">
            {onboardingStrings.markActiveTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {onboardingStrings.markActiveSubtitle}
          </p>
          <div className="rounded-md border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm">
            <p className="font-semibold text-gray-900">{candidate?.name}</p>
            <p className="text-muted-foreground truncate">{email || '—'}</p>
            <p className="text-xs text-[#C84B31] mt-1">{candidate?.job_role}</p>
          </div>

          <div className="flex gap-2 rounded-md border border-dashed border-orange-200 bg-white/60 px-3 py-3 text-sm text-gray-700">
            <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-[#C84B31]" />
            <p>{onboardingStrings.credentialsNote}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {onboardingStrings.markActiveCancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md"
          >
            {isPending ? 'Saving…' : onboardingStrings.markActiveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
