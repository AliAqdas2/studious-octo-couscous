import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { CANDIDATE_STATE_MACHINE } from './pipelineConfig';
import { onboardingStrings } from './strings';
import ScheduleInterviewDialog from './ScheduleInterviewDialog';
import NeedMoreInfoDialog from './NeedMoreInfoDialog';
import SendToDaveDialog from './SendToDaveDialog';
import ExtendOfferDialog from './ExtendOfferDialog';
import OfferAcceptedDialog from './OfferAcceptedDialog';
import OfferDeclinedDialog from './OfferDeclinedDialog';
import BeginOnboardingDialog from './BeginOnboardingDialog';
import MarkActiveDialog from './MarkActiveDialog';

export default function CandidateStateMachine({ candidate }) {
  const queryClient = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [pendingDecline, setPendingDecline] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [needMoreInfoOpen, setNeedMoreInfoOpen] = useState(false);
  const [sendToDaveOpen, setSendToDaveOpen] = useState(false);
  const [pendingSendToDave, setPendingSendToDave] = useState(null);
  const [extendOfferOpen, setExtendOfferOpen] = useState(false);
  const [pendingExtendOffer, setPendingExtendOffer] = useState(null);
  const [offerAcceptedOpen, setOfferAcceptedOpen] = useState(false);
  const [pendingOfferAccepted, setPendingOfferAccepted] = useState(null);
  const [offerDeclinedOpen, setOfferDeclinedOpen] = useState(false);
  const [pendingOfferDeclined, setPendingOfferDeclined] = useState(null);
  const [beginOnboardingOpen, setBeginOnboardingOpen] = useState(false);
  const [pendingBeginOnboarding, setPendingBeginOnboarding] = useState(null);
  const [markActiveOpen, setMarkActiveOpen] = useState(false);
  const [pendingMarkActive, setPendingMarkActive] = useState(null);
  const [declineReason, setDeclineReason] = useState(candidate?.decline_reason || '');
  const [retain, setRetain] = useState(candidate?.retain_for_future !== false);
  const stage = candidate?.stage || 'Application Received';
  const config = CANDIDATE_STATE_MACHINE[stage] || { prompt: null, actions: [] };

  const mutation = useMutation({
    mutationFn: async ({ nextStage, needsDeclineReason, notes }) => {
      const patch = { stage: nextStage };
      if (needsDeclineReason) {
        if (!declineReason.trim()) {
          throw new Error('Decline reason is required');
        }
        patch.decline_reason = declineReason.trim();
        patch.retain_for_future = retain;
      }
      if (typeof notes === 'string') {
        patch.notes = notes;
      }
      await base44.entities.Candidate.update(candidate.id, patch);
      await base44.entities.ActivityLog.create({
        entity_type: 'Candidate',
        entity_id: candidate.id,
        action: `Stage → ${nextStage}`,
        details: { from: stage, to: nextStage },
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      toast.success('Stage updated');
      setDeclineOpen(false);
      setPendingDecline(null);
      setScheduleOpen(false);
      setPendingSchedule(null);
      setSendToDaveOpen(false);
      setPendingSendToDave(null);
      setExtendOfferOpen(false);
      setPendingExtendOffer(null);
      setOfferAcceptedOpen(false);
      setPendingOfferAccepted(null);
      setOfferDeclinedOpen(false);
      setPendingOfferDeclined(null);
      setBeginOnboardingOpen(false);
      setPendingBeginOnboarding(null);
      setMarkActiveOpen(false);
      setPendingMarkActive(null);
    },
    onError: (e) => toast.error(e.message || 'Update failed'),
  });

  if (!config.actions?.length && !config.prompt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stage === 'Active'
            ? 'This person is an active employee.'
            : `Current stage: ${stage}`}
        </CardContent>
      </Card>
    );
  }

  const openDeclineDialog = (action) => {
    setPendingDecline(action);
    setDeclineReason(candidate?.decline_reason || '');
    setRetain(candidate?.retain_for_future !== false);
    setDeclineOpen(true);
  };

  const confirmDecline = () => {
    if (!pendingDecline) return;
    mutation.mutate({
      nextStage: pendingDecline.nextStage,
      needsDeclineReason: true,
    });
  };

  const confirmPending = (pending) => {
    if (!pending) return;
    mutation.mutate({
      nextStage: pending.nextStage,
      needsDeclineReason: false,
    });
  };

  const confirmSendToDave = (notes) => {
    if (!pendingSendToDave) return;
    mutation.mutate({
      nextStage: pendingSendToDave.nextStage,
      needsDeclineReason: false,
      notes,
    });
  };

  const confirmOfferDeclined = (notes) => {
    if (!pendingOfferDeclined) return;
    mutation.mutate({
      nextStage: pendingOfferDeclined.nextStage,
      needsDeclineReason: false,
      ...(typeof notes === 'string' ? { notes } : {}),
    });
  };

  return (
    <>
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-[#C84B31]/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[#C84B31] text-base">
            Next step
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.prompt && (
            <p className="text-lg md:text-xl font-semibold text-gray-900 leading-snug tracking-tight">
              {config.prompt}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {config.actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={
                  action.needsDeclineReason || action.opensOfferDeclined
                    ? 'destructive'
                    : 'default'
                }
                className={
                  action.needsDeclineReason || action.opensOfferDeclined
                    ? undefined
                    : 'bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md'
                }
                disabled={mutation.isPending}
                onClick={() => {
                  if (action.needsDeclineReason) {
                    openDeclineDialog(action);
                    return;
                  }
                  if (action.opensScheduleInterview) {
                    setPendingSchedule(action);
                    setScheduleOpen(true);
                    return;
                  }
                  if (action.opensNeedMoreInfo) {
                    setNeedMoreInfoOpen(true);
                    return;
                  }
                  if (action.opensSendToDave) {
                    setPendingSendToDave(action);
                    setSendToDaveOpen(true);
                    return;
                  }
                  if (action.opensExtendOffer) {
                    setPendingExtendOffer(action);
                    setExtendOfferOpen(true);
                    return;
                  }
                  if (action.opensOfferAccepted) {
                    setPendingOfferAccepted(action);
                    setOfferAcceptedOpen(true);
                    return;
                  }
                  if (action.opensOfferDeclined) {
                    setPendingOfferDeclined(action);
                    setOfferDeclinedOpen(true);
                    return;
                  }
                  if (action.opensBeginOnboarding) {
                    setPendingBeginOnboarding(action);
                    setBeginOnboardingOpen(true);
                    return;
                  }
                  if (action.opensMarkActive) {
                    setPendingMarkActive(action);
                    setMarkActiveOpen(true);
                    return;
                  }
                  mutation.mutate({
                    nextStage: action.nextStage,
                    needsDeclineReason: false,
                  });
                }}
              >
                {action.label}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open);
          if (!open) setPendingDecline(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{onboardingStrings.declineDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label>{onboardingStrings.declineReason}</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={retain} onCheckedChange={(v) => setRetain(!!v)} />
              {onboardingStrings.retainForFuture}
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={mutation.isPending}
            >
              {onboardingStrings.declineDialogCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDecline}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? 'Saving…'
                : onboardingStrings.declineDialogConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleInterviewDialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setPendingSchedule(null);
        }}
        candidate={candidate}
        onConfirm={() => confirmPending(pendingSchedule)}
        isPending={mutation.isPending}
      />

      <NeedMoreInfoDialog
        open={needMoreInfoOpen}
        onOpenChange={setNeedMoreInfoOpen}
        candidate={candidate}
      />

      <SendToDaveDialog
        open={sendToDaveOpen}
        onOpenChange={(open) => {
          setSendToDaveOpen(open);
          if (!open) setPendingSendToDave(null);
        }}
        candidate={candidate}
        onConfirm={confirmSendToDave}
        isPending={mutation.isPending}
      />

      <ExtendOfferDialog
        open={extendOfferOpen}
        onOpenChange={(open) => {
          setExtendOfferOpen(open);
          if (!open) setPendingExtendOffer(null);
        }}
        candidate={candidate}
        onConfirm={() => confirmPending(pendingExtendOffer)}
        isPending={mutation.isPending}
      />

      <OfferAcceptedDialog
        open={offerAcceptedOpen}
        onOpenChange={(open) => {
          setOfferAcceptedOpen(open);
          if (!open) setPendingOfferAccepted(null);
        }}
        candidate={candidate}
        onConfirm={() => confirmPending(pendingOfferAccepted)}
        isPending={mutation.isPending}
      />

      <OfferDeclinedDialog
        open={offerDeclinedOpen}
        onOpenChange={(open) => {
          setOfferDeclinedOpen(open);
          if (!open) setPendingOfferDeclined(null);
        }}
        candidate={candidate}
        onConfirm={confirmOfferDeclined}
        isPending={mutation.isPending}
      />

      <BeginOnboardingDialog
        open={beginOnboardingOpen}
        onOpenChange={(open) => {
          setBeginOnboardingOpen(open);
          if (!open) setPendingBeginOnboarding(null);
        }}
        candidate={candidate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['candidates'] });
          queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
        }}
      />

      <MarkActiveDialog
        open={markActiveOpen}
        onOpenChange={(open) => {
          setMarkActiveOpen(open);
          if (!open) setPendingMarkActive(null);
        }}
        candidate={candidate}
        onConfirm={() => confirmPending(pendingMarkActive)}
        isPending={mutation.isPending}
      />
    </>
  );
}
