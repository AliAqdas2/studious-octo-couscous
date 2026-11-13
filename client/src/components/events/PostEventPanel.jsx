import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Save } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { postEventComplete } from '@/lib/opsPanelCompletion';

/**
 * During / post-event ops capture: staff hours, costs, photos, CRM follow-ups.
 * Client outreach emails live in Client Communication.
 */
export default function PostEventPanel({ event, canEdit = false }) {
  const eventId = event?.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['post-event', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPostEvent', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!data?.state) return;
    const s = data.state;
    setForm({
      staffHoursNotes: s.staffHoursNotes || '',
      additionalEventDetails: s.additionalEventDetails || '',
      laborCost: s.laborCost ?? '',
      venueFees: s.venueFees ?? '',
      suppliesCost: s.suppliesCost ?? '',
      photosUploaded: Boolean(s.photosUploaded),
      photoDownloadUrl: s.photoDownloadUrl || '',
      // Preserved for API compatibility — edited in Client Communication
      thankYouVariant: s.thankYouVariant || '',
      thankYouSent: Boolean(s.thankYouSent),
      eventTrackerNote: s.eventTrackerNote || '',
      linkedInRequested: Boolean(s.linkedInRequested),
      tshirtSize: s.tshirtSize || '',
      tshirtRequested: Boolean(s.tshirtRequested),
      receiptTiming: s.receiptTiming || '',
      invoiceTimingNote: s.invoiceTimingNote || '',
      email2: {
        nextEventPlanned: s.email2?.nextEventPlanned || '',
        introThreeIndividuals: s.email2?.introThreeIndividuals || '',
        newsletterInterest: Boolean(s.email2?.newsletterInterest),
        buildAnotherLead: Boolean(s.email2?.buildAnotherLead),
        newLeadId: s.email2?.newLeadId || null,
      },
    });
  }, [data]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const num = (v) =>
        v === '' || v == null
          ? null
          : Number.isFinite(Number(v))
            ? Number(v)
            : null;
      const res = await base44.functions.invoke('savePostEvent', {
        eventId,
        createLead: false,
        staffHoursNotes: form.staffHoursNotes || null,
        additionalEventDetails: form.additionalEventDetails || null,
        laborCost: num(form.laborCost),
        venueFees: num(form.venueFees),
        suppliesCost: num(form.suppliesCost),
        photosUploaded: form.photosUploaded,
        photoDownloadUrl: form.photoDownloadUrl || null,
        thankYouVariant: form.thankYouVariant || null,
        thankYouSent: form.thankYouSent,
        eventTrackerNote: form.eventTrackerNote || null,
        linkedInRequested: form.linkedInRequested,
        tshirtSize: form.tshirtSize || null,
        tshirtRequested: form.tshirtRequested,
        receiptTiming: form.receiptTiming || null,
        invoiceTimingNote: form.invoiceTimingNote || null,
        email2: {
          nextEventPlanned: form.email2.nextEventPlanned || null,
          introThreeIndividuals: form.email2.introThreeIndividuals || null,
          newsletterInterest: form.email2.newsletterInterest,
          buildAnotherLead: form.email2.buildAnotherLead,
        },
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['post-event', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      toast.success('Post-event details saved');
    },
    onError: () => toast.error('Failed to save post-event details'),
  });

  if (!eventId || isLoading || !form) {
    return (
      <OpsPanelShell title="During & post-event" icon={ClipboardList} forceOpen>
        <div className="h-24 animate-pulse bg-slate-100 rounded" />
      </OpsPanelShell>
    );
  }

  const features = data?.features || {};
  const panelComplete = postEventComplete({
    ...event,
    staff_hours_notes: form.staffHoursNotes,
    staffHoursNotes: form.staffHoursNotes,
    photos_uploaded: form.photosUploaded,
    photosUploaded: form.photosUploaded,
    post_event: {
      photosUploaded: form.photosUploaded,
    },
    postEvent: {
      photosUploaded: form.photosUploaded,
    },
  });

  return (
    <OpsPanelShell
      title="During & post-event"
      icon={ClipboardList}
      complete={panelComplete}
      doneBadge={panelComplete}
      forceOpen={!panelComplete}
    >
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Ops wrap-up after the event. Client thank-you and outreach emails are
          in Client Communication.
        </p>

        <section className="space-y-2">
          <Label className="text-sm font-semibold">Admin morning-after</Label>
          <div>
            <Label className="text-xs text-gray-500">Staff hours of the event</Label>
            <Textarea
              disabled={!canEdit}
              rows={2}
              value={form.staffHoursNotes}
              onChange={(e) => set('staffHoursNotes', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Additional details</Label>
            <Textarea
              disabled={!canEdit}
              rows={2}
              value={form.additionalEventDetails}
              onChange={(e) => set('additionalEventDetails', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-gray-500">Labor hours / cost</Label>
              <Input
                type="number"
                disabled={!canEdit}
                value={form.laborCost}
                onChange={(e) => set('laborCost', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Venue fees</Label>
              <Input
                type="number"
                disabled={!canEdit}
                value={form.venueFees}
                onChange={(e) => set('venueFees', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Supplies purchased</Label>
              <Input
                type="number"
                disabled={!canEdit}
                value={form.suppliesCost}
                onChange={(e) => set('suppliesCost', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              Receipts: EOM with invoice or immediately after event
            </Label>
            <Select
              value={form.receiptTiming}
              disabled={!canEdit}
              onValueChange={(v) => set('receiptTiming', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Receipt timing…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eom_with_invoice">
                  EOM with invoice
                </SelectItem>
                <SelectItem value="immediate_after_event">
                  Immediately after event
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-2 border-t pt-4">
          <Label className="text-sm font-semibold">Photos</Label>
          <div>
            <Label className="text-xs text-gray-500">Photo download link</Label>
            <Input
              disabled={!canEdit}
              value={form.photoDownloadUrl}
              onChange={(e) => set('photoDownloadUrl', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.photosUploaded}
              disabled={!canEdit}
              onCheckedChange={(v) => set('photosUploaded', Boolean(v))}
            />
            Photos uploaded to digital database / Drive
          </label>
        </section>

        {(features.linkedInFollowUp !== false ||
          features.tshirtThreeMonth !== false) && (
          <section className="space-y-3 border-t pt-4">
            <Label className="text-sm font-semibold">CRM follow-ups</Label>
            {features.linkedInFollowUp !== false && (
              <div className="space-y-2 rounded border border-slate-100 p-3 bg-slate-50">
                <div>
                  <Label className="text-xs text-gray-500">Event tracker note</Label>
                  <Textarea
                    disabled={!canEdit}
                    rows={2}
                    value={form.eventTrackerNote}
                    onChange={(e) => set('eventTrackerNote', e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.linkedInRequested}
                    disabled={!canEdit}
                    onCheckedChange={(v) =>
                      set('linkedInRequested', Boolean(v))
                    }
                  />
                  LinkedIn connection requested
                </label>
              </div>
            )}
            {features.tshirtThreeMonth !== false && (
              <div className="space-y-2 rounded border border-slate-100 p-3">
                <Label className="text-xs font-semibold">+3 months — T-shirt</Label>
                <Input
                  disabled={!canEdit}
                  placeholder="T-shirt size"
                  value={form.tshirtSize}
                  onChange={(e) => set('tshirtSize', e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.tshirtRequested}
                    disabled={!canEdit}
                    onCheckedChange={(v) =>
                      set('tshirtRequested', Boolean(v))
                    }
                  />
                  Mangia DC T-shirt offered
                </label>
              </div>
            )}
          </section>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        )}
      </div>
    </OpsPanelShell>
  );
}
