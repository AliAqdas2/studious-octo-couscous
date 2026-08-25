import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Link2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin BEO vs Ops BEO shell artifact URLs (plan 05).
 * Distinct fields — no shared "BEO" blob.
 */
export default function EventArtifactsPanel({
  event,
  canEditAdmin = false,
  canEditOps = false,
}) {
  const eventId = event?.id;
  const queryClient = useQueryClient();

  const { data: state } = useQuery({
    queryKey: ['run-of-show', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRunOfShow', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const [form, setForm] = useState({
    participationListUrl: '',
    participationListType: '',
    postEventSurveyUrl: '',
    workflowCrmUrl: '',
    beoUrl: '',
    beoShellUrl: '',
    fareharborLink: '',
    rosTemplateUrl: '',
  });

  useEffect(() => {
    const a = state?.artifacts;
    if (!a) return;
    setForm({
      participationListUrl: a.participationListUrl || '',
      participationListType: a.participationListType || '',
      postEventSurveyUrl: a.postEventSurveyUrl || '',
      workflowCrmUrl: a.workflowCrmUrl || '',
      beoUrl: a.beoUrl || '',
      beoShellUrl: a.beoShellUrl || '',
      fareharborLink: a.fareharborLink || '',
      rosTemplateUrl: a.rosTemplateUrl || '',
    });
  }, [state]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('saveEventArtifacts', {
        eventId,
        participationListUrl: form.participationListUrl || null,
        participationListType: form.participationListType || null,
        postEventSurveyUrl: form.postEventSurveyUrl || null,
        workflowCrmUrl: form.workflowCrmUrl || null,
        beoUrl: form.beoUrl || null,
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
      toast.success('Artifact links saved');
    },
    onError: () => toast.error('Failed to save artifacts'),
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const canEdit = canEditAdmin || canEditOps;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4" />
          BEO & artifact links
        </CardTitle>
        <p className="text-xs text-gray-500">
          Admin owns the BEO document + ROS template. Ops owns the BEO Shell and
          FareHarbor embed. Day-of Hosts follow the event-specific BEO (task).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2">
          <Label className="text-sm font-semibold text-[#C84B31]">
            Admin artifacts
          </Label>
          <div>
            <Label className="text-xs text-gray-500">BEO document URL</Label>
            <Input
              disabled={!canEditAdmin}
              value={form.beoUrl}
              onChange={(e) => set('beoUrl', e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">ROS template URL</Label>
            <Input
              disabled={!canEditAdmin}
              value={form.rosTemplateUrl}
              onChange={(e) => set('rosTemplateUrl', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">Participation link</Label>
              <Input
                disabled={!canEditAdmin}
                value={form.participationListUrl}
                onChange={(e) => set('participationListUrl', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Type</Label>
              <Select
                value={form.participationListType}
                disabled={!canEditAdmin}
                onValueChange={(v) => set('participationListType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sheets or Forms…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sheets">Sheets</SelectItem>
                  <SelectItem value="forms">Forms</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Post-event survey URL</Label>
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
          <Button
            size="sm"
            className="bg-[#C84B31] hover:bg-[#A03A23]"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Link2 className="w-4 h-4 mr-1" />
            Save artifact links
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
