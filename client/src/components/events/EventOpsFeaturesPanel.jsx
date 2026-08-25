import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, Mail } from 'lucide-react';
import { toast } from 'sonner';

/** Visible thank-you / follow-up toggles (WhatsApp + legacy hidden). */
const UI_FEATURE_KEYS = [
  'thankYouAutoDraft',
  'linkedInFollowUp',
  'tshirtThreeMonth',
  'email2FollowUps',
];

const FALLBACK_LABELS = {
  thankYouAutoDraft: {
    label: 'Thank-you email draft',
    description:
      'When an event is marked Completed, create a thank-you draft in Gmail for the planner.',
  },
  linkedInFollowUp: {
    label: 'LinkedIn follow-up (after V2)',
    description:
      'If thank-you V2 is chosen, add a task to request LinkedIn / update the event tracker.',
  },
  tshirtThreeMonth: {
    label: 'Mangia T-shirt (~3 months)',
    description:
      'If thank-you V2 is chosen, schedule a reminder ~90 days later for a CEO thank-you and T-shirt.',
  },
  email2FollowUps: {
    label: 'Follow-up checklist (EMAIL 2)',
    description:
      'Add checklist tasks for next event, intros, newsletter, and creating another lead.',
  },
};

/**
 * Global thank-you & follow-up toggles (affects new workflow generation).
 * WhatsApp is removed from UI and forced off on the server.
 */
export default function EventOpsFeaturesPanel({ canEdit = false }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['event-ops-features'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventOpsFeatures', {});
      return res?.data ?? res;
    },
  });

  const [features, setFeatures] = useState(null);

  useEffect(() => {
    if (data?.features) setFeatures(data.features);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (partial) => {
      const res = await base44.functions.invoke('updateEventOpsFeatures', partial);
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      setFeatures(body.features);
      queryClient.setQueryData(['event-ops-features'], (prev) => ({
        ...(prev || data || {}),
        features: body.features,
      }));
      queryClient.invalidateQueries(['event-tasks']);
      toast.success('Settings updated');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update (admin only)');
    },
  });

  if (isLoading || !features) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Thank-you & follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const labels = data?.labels || {};

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Thank-you & follow-ups
        </CardTitle>
        <p className="text-xs text-gray-500">
          Global settings for new workflows. Admins only.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider delayDuration={150}>
          {UI_FEATURE_KEYS.map((key) => {
            const meta =
              labels[key] ||
              FALLBACK_LABELS[key] || { label: key, description: '' };
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Label className="text-sm font-medium">{meta.label}</Label>
                  {meta.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex text-gray-400 hover:text-gray-600 shrink-0"
                          aria-label={`About ${meta.label}`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-xs bg-slate-900 text-white border-0"
                      >
                        {meta.description}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <Switch
                  checked={Boolean(features[key])}
                  disabled={!canEdit || mutation.isPending}
                  onCheckedChange={(v) => {
                    const next = { ...features, [key]: Boolean(v) };
                    setFeatures(next);
                    mutation.mutate({ [key]: Boolean(v) });
                  }}
                />
              </div>
            );
          })}
        </TooltipProvider>
        {!canEdit && (
          <p className="text-xs text-gray-500">Admin only — view mode.</p>
        )}
      </CardContent>
    </Card>
  );
}
