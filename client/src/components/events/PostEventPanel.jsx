import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Mail, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * During / post-event capture: staff hours, thank-you V1/V2, EMAIL 2, lead (plan 06).
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
  const setEmail2 = (key, value) =>
    setForm((f) => ({ ...f, email2: { ...f.email2, [key]: value } }));

  const saveMutation = useMutation({
    mutationFn: async ({ createLead }) => {
      const num = (v) =>
        v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
      const res = await base44.functions.invoke('savePostEvent', {
        eventId,
        createLead: Boolean(createLead),
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
    onSuccess: (body, vars) => {
      queryClient.invalidateQueries(['post-event', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      if (vars.createLead && body.newLeadId) {
        toast.success(`Lead created (${body.newLeadId.slice(0, 8)}…)`);
      } else {
        toast.success('Post-event details saved');
      }
    },
    onError: () => toast.error('Failed to save post-event details'),
  });

  if (!eventId || isLoading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            During & post-event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const features = data?.features || {};
  const experienceName = data?.state?.experienceName || event.event_type;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              During & post-event
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Experience name for thank-you templates:{' '}
              <span className="font-medium text-gray-700">{experienceName}</span>
              {' '}(never hardcodes Paint & Sip).
            </p>
          </div>
          {form.thankYouVariant && (
            <Badge variant="outline" className="text-xs uppercase">
              Thank-you {form.thankYouVariant}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <Label className="text-sm font-semibold">Thank-you (Sales)</Label>
          <Select
            value={form.thankYouVariant}
            disabled={!canEdit}
            onValueChange={(v) => set('thankYouVariant', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="V1 general / V2 highly positive…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v1">V1 — general</SelectItem>
              <SelectItem value="v2">V2 — highly positive</SelectItem>
            </SelectContent>
          </Select>
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.thankYouSent}
              disabled={!canEdit}
              onCheckedChange={(v) => set('thankYouSent', Boolean(v))}
            />
            Thank-you sent / draft reviewed
          </label>

          {form.thankYouVariant === 'v2' && features.linkedInFollowUp !== false && (
            <div className="space-y-2 rounded border border-slate-100 p-3 bg-slate-50">
              <Label className="text-xs font-semibold">After V2 yes</Label>
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
                  onCheckedChange={(v) => set('linkedInRequested', Boolean(v))}
                />
                LinkedIn connection requested
              </label>
            </div>
          )}

          {form.thankYouVariant === 'v2' && features.tshirtThreeMonth !== false && (
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
                  onCheckedChange={(v) => set('tshirtRequested', Boolean(v))}
                />
                CEO thank-you + Mangia DC T-shirt offered
              </label>
            </div>
          )}
        </section>

        {features.email2FollowUps !== false && (
          <section className="space-y-2 border-t pt-4">
            <Label className="text-sm font-semibold">EMAIL 2 (good feedback)</Label>
            <div>
              <Label className="text-xs text-gray-500">
                When is their next event they plan?
              </Label>
              <Input
                disabled={!canEdit}
                value={form.email2.nextEventPlanned}
                onChange={(e) => setEmail2('nextEventPlanned', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Introduce us to three individuals who could benefit…
              </Label>
              <Textarea
                disabled={!canEdit}
                rows={2}
                value={form.email2.introThreeIndividuals}
                onChange={(e) =>
                  setEmail2('introThreeIndividuals', e.target.value)
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.email2.newsletterInterest}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setEmail2('newsletterInterest', Boolean(v))
                }
              />
              Interest in newsletter
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.email2.buildAnotherLead}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setEmail2('buildAnotherLead', Boolean(v))
                }
              />
              Build another lead into Sales CRM
            </label>
            {form.email2.newLeadId && (
              <p className="text-xs text-emerald-700">
                Lead created: {form.email2.newLeadId}
              </p>
            )}
          </section>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ createLead: false })}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            {features.email2FollowUps !== false &&
              form.email2.buildAnotherLead &&
              !form.email2.newLeadId && (
                <Button
                  className="bg-[#C84B31] hover:bg-[#A03A23]"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ createLead: true })}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Create lead
                </Button>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
