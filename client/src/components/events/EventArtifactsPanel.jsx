import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, FileText, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import AttendeeListStatus from '@/components/events/AttendeeListStatus';
import {
  artifactsComplete,
  getPanelMilestoneLabel,
} from '@/lib/eventMilestones';

const emptyForm = () => ({
  postEventSurveyUrl: '',
  workflowCrmUrl: '',
  beoUrl: '',
  beoUrlLabel: 'BEO',
  beoShellUrl: '',
  fareharborLink: '',
  rosTemplateUrl: '',
});

function formFromArtifacts(a) {
  if (!a) return emptyForm();
  return {
    postEventSurveyUrl: a.postEventSurveyUrl || '',
    workflowCrmUrl: a.workflowCrmUrl || '',
    beoUrl: a.beoUrl || '',
    beoUrlLabel: a.beoUrlLabel || 'BEO',
    beoShellUrl: a.beoShellUrl || '',
    fareharborLink: a.fareharborLink || '',
    rosTemplateUrl: a.rosTemplateUrl || '',
  };
}

function linkRows(form, artifacts) {
  const beoLabel = (form.beoUrlLabel || 'BEO').trim() || 'BEO';
  const beoSavedAt =
    artifacts?.beoUrlSavedAt || artifacts?.beo_url_saved_at || null;
  const beoSavedBy =
    artifacts?.beoUrlSavedByName ||
    artifacts?.beo_url_saved_by_name ||
    null;
  const rows = [
    form.beoUrl
      ? {
          label: `BEO · ${beoLabel}`,
          value: form.beoUrl,
          meta:
            beoSavedAt || beoSavedBy
              ? [
                  beoSavedAt
                    ? `Saved ${new Date(beoSavedAt).toLocaleString()}`
                    : null,
                  beoSavedBy ? `by ${beoSavedBy}` : null,
                ]
                  .filter(Boolean)
                  .join(' ')
              : null,
        }
      : null,
    { label: 'ROS template URL', value: form.rosTemplateUrl },
    { label: 'Post-event survey', value: form.postEventSurveyUrl },
    { label: 'Event workflow link', value: form.workflowCrmUrl },
    { label: 'BEO Shell URL', value: form.beoShellUrl },
    { label: 'FareHarbor item', value: form.fareharborLink },
  ].filter(Boolean);
  return rows.filter((r) => r.value);
}

/**
 * Admin BEO vs Ops BEO shell artifact URLs (plan 05 / CRM-16).
 * Hosted BEO link only here — Generate lives in BeoDocumentPanel.
 */
export default function EventArtifactsPanel({
  event,
  canEditAdmin = false,
  canEditOps = false,
}) {
  const eventId = event?.id;
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ['run-of-show', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRunOfShow', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const a = state?.artifacts;
    if (!a) return;
    setForm(formFromArtifacts(a));
  }, [state]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('saveEventArtifacts', {
        eventId,
        postEventSurveyUrl: form.postEventSurveyUrl || null,
        workflowCrmUrl: form.workflowCrmUrl || null,
        beoUrl: form.beoUrl || null,
        beoUrlLabel: form.beoUrl ? form.beoUrlLabel || 'BEO' : null,
        beoShellUrl: form.beoShellUrl || null,
        fareharborLink: form.fareharborLink || null,
        rosTemplateUrl: form.rosTemplateUrl || null,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['run-of-show', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      setIsEditing(false);
      toast.success('Artifact links saved');
    },
    onError: () => toast.error('Failed to save artifacts'),
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const canEdit = canEditAdmin || canEditOps;

  const eventForComplete = useMemo(
    () => ({
      ...event,
      beo_shell_url: form.beoShellUrl || event?.beo_shell_url,
      beoShellUrl: form.beoShellUrl || event?.beoShellUrl,
      fareharbor_link: form.fareharborLink || event?.fareharbor_link,
      fareharborLink: form.fareharborLink || event?.fareharborLink,
    }),
    [event, form.beoShellUrl, form.fareharborLink]
  );

  const complete = artifactsComplete(eventForComplete);
  const showSummary = complete && !isEditing;
  const milestoneLabel = getPanelMilestoneLabel(
    'artifacts',
    eventForComplete
  );
  const summaryRows = linkRows(form, state?.artifacts);
  const beoSavedAt =
    state?.artifacts?.beoUrlSavedAt ||
    state?.artifacts?.beo_url_saved_at ||
    null;
  const beoSavedByName =
    state?.artifacts?.beoUrlSavedByName ||
    state?.artifacts?.beo_url_saved_by_name ||
    null;
  const hasBeoLink = Boolean(String(form.beoUrl || '').trim());

  const openEdit = () => setIsEditing(true);

  const cancelEdit = () => {
    setForm(formFromArtifacts(state?.artifacts));
    setIsEditing(false);
  };

  if (isLoading && !state) {
    return (
      <OpsPanelShell title="BEO & artifact links" icon={FileText} forceOpen>
        <div className="h-24 animate-pulse bg-slate-100 rounded" />
      </OpsPanelShell>
    );
  }

  return (
    <OpsPanelShell
      title="BEO & artifact links"
      icon={FileText}
      complete={showSummary}
      forceOpen={!showSummary}
      doneBadge={showSummary}
      milestoneLabel={milestoneLabel}
    >
      {showSummary ? (
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium text-green-900">Artifact links saved</p>
              <p className="text-sm text-green-700">
                BEO Shell and FareHarbor are on file for day-of.
              </p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-300 text-green-800 hover:bg-green-100"
                onClick={openEdit}
              >
                View / Edit
              </Button>
            ) : null}
          </div>
          {summaryRows.length > 0 ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {summaryRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-green-700">
                    {row.label}
                  </dt>
                  <dd className="mt-1 break-all">
                    {row.href ||
                    (row.value && String(row.value).startsWith('http')) ? (
                      <a
                        href={row.href || row.value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1 text-[#C84B31] underline underline-offset-2 font-medium hover:text-[#A03A23]"
                      >
                        <span className="line-clamp-2">{row.value}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      </a>
                    ) : (
                      <span className="text-green-950 font-medium">
                        {row.value}
                      </span>
                    )}
                    {row.meta ? (
                      <p className="mt-1 text-xs text-green-700 font-normal">
                        {row.meta}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <AttendeeListStatus eventId={eventId} event={event} />
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Generate and download the BEO in the BEO document section. Paste the
            hosted final URL here for shared access. Ops owns the BEO Shell and
            FareHarbor embed.
          </p>

          <AttendeeListStatus eventId={eventId} event={event} />

          <section className="space-y-3">
            <Label className="text-sm font-semibold text-[#C84B31]">
              Admin artifacts
            </Label>

            <div className="rounded-md border border-orange-100 bg-orange-50/40 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#C84B31]">
                    Type: BEO
                  </p>
                  <p className="text-xs text-gray-500">
                    Hosted final BEO link (Drive, Fair Harbor, etc.) — not a
                    second generator.
                  </p>
                </div>
                {hasBeoLink ? (
                  <a
                    href={form.beoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C84B31] underline underline-offset-2"
                  >
                    Open link
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
              <div>
                <Label className="text-xs text-gray-500">
                  {hasBeoLink ? 'BEO link' : 'Add BEO Link'}
                </Label>
                <Input
                  disabled={!canEditAdmin}
                  value={form.beoUrl}
                  onChange={(e) => set('beoUrl', e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Label</Label>
                <Input
                  disabled={!canEditAdmin}
                  value={form.beoUrlLabel}
                  onChange={(e) => set('beoUrlLabel', e.target.value)}
                  placeholder="BEO"
                />
              </div>
              {beoSavedAt || beoSavedByName ? (
                <p className="text-xs text-gray-600">
                  Saved
                  {beoSavedAt
                    ? ` ${new Date(beoSavedAt).toLocaleString()}`
                    : ''}
                  {beoSavedByName ? ` by ${beoSavedByName}` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Saved date and by appear after you save a link.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-gray-500">ROS template URL</Label>
              <Input
                disabled={!canEditAdmin}
                value={form.rosTemplateUrl}
                onChange={(e) => set('rosTemplateUrl', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Post-event survey URL
              </Label>
              <Input
                disabled={!canEditAdmin}
                value={form.postEventSurveyUrl}
                onChange={(e) => set('postEventSurveyUrl', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">CRM workflow link</Label>
              <Input
                disabled={!canEditAdmin}
                value={form.workflowCrmUrl}
                onChange={(e) => set('workflowCrmUrl', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-2 border-t pt-4">
            <Label className="text-sm font-semibold text-[#7A9D54]">
              Ops artifacts
            </Label>
            <div>
              <Label className="text-xs text-gray-500">BEO Shell URL</Label>
              <Input
                disabled={!canEditOps}
                value={form.beoShellUrl}
                onChange={(e) => set('beoShellUrl', e.target.value)}
                placeholder="Shell doc — distinct from Admin BEO"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                FareHarbor item (embed BEO / shell)
              </Label>
              <Input
                disabled={!canEditOps}
                value={form.fareharborLink}
                onChange={(e) => set('fareharborLink', e.target.value)}
              />
            </div>
          </section>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-[#C84B31] hover:bg-[#A03A23]"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <Link2 className="w-4 h-4 mr-1" />
                {mutation.isPending ? 'Saving…' : 'Save artifact links'}
              </Button>
              {complete && isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </OpsPanelShell>
  );
}
