import React from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ChevronRight, PhoneCall, Loader2, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

/**
 * Shows calls that are queued for a future retry — typically because they were
 * placed outside business hours, or are awaiting a scheduled retry attempt.
 *
 * Each row exposes a "Call Now" action that skips the wait: it marks the
 * scheduled retry as processed (so the cron job won't double-fire) and
 * immediately invokes triggerCallTwiML for the lead.
 */
export default function QueuedCallsPanel({ calls }) {
  const queryClient = useQueryClient();

  const queued = React.useMemo(() => {
    return calls
      .filter((c) => c.scheduled_retry_at && !c.retry_processed)
      .sort((a, b) => new Date(a.scheduled_retry_at) - new Date(b.scheduled_retry_at));
  }, [calls]);

  const cancelMutation = useMutation({
    mutationFn: async (call) => {
      await base44.entities.CallLog.update(call.id, {
        retry_processed: true,
        scheduled_retry_at: null,
        status: 'Failed',
        error_message: 'Cancelled manually'
      });
    },
    onSuccess: (_data, call) => {
      toast.success(`Cancelled queued call for ${call.lead_name || 'lead'}`);
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
    onError: (e) => toast.error(`Failed to cancel: ${e.message}`)
  });

  const callNowMutation = useMutation({
    mutationFn: async (call) => {
      // Mark processed FIRST so the scheduled retry cron won't also fire.
      // Mirrors the order used by processScheduledCallRetries.
      await base44.entities.CallLog.update(call.id, {
        retry_processed: true,
        scheduled_retry_at: null
      });
      return base44.functions.invoke('triggerCallTwiML', { lead_id: call.lead_id, skip_business_hours: true });
    },
    onSuccess: (_data, call) => {
      toast.success(`Calling ${call.lead_name || 'lead'} now`);
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
    onError: (e) => {
      toast.error(`Failed to start call: ${e.message}`);
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    }
  });

  if (queued.length === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="bg-amber-50/50">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
          <Clock className="w-5 h-5" />
          Queued Calls — Awaiting Retry ({queued.length})
        </CardTitle>
        <p className="text-xs text-amber-700/80 mt-1">
          Calls scheduled for a future time (e.g. queued outside business hours). They'll go out automatically, spaced 30s apart — or use <strong>Call Now</strong> to skip the wait.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Scheduled For</th>
                <th className="text-left p-3">In</th>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Attempt</th>
                <th className="text-left p-3">Reason</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queued.map((c) => {
                const isPending =
                  callNowMutation.isPending && callNowMutation.variables?.id === c.id;
                return (
                  <tr key={c.id} className="border-t hover:bg-amber-50/30">
                    <td className="p-3 text-gray-700 whitespace-nowrap">
                      {format(new Date(c.scheduled_retry_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="p-3 text-amber-700 whitespace-nowrap">
                      {formatDistanceToNow(new Date(c.scheduled_retry_at), { addSuffix: true })}
                    </td>
                    <td className="p-3 font-medium">{c.lead_name || '—'}</td>
                    <td className="p-3 text-gray-600">{c.lead_company || '—'}</td>
                    <td className="p-3 font-mono text-xs">{c.lead_phone || '—'}</td>
                    <td className="p-3">{c.attempt_number || 1}</td>
                    <td className="p-3 text-xs text-gray-500 max-w-xs truncate" title={c.error_message || ''}>
                      {c.error_message || '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-800 hover:bg-amber-100"
                          disabled={!c.lead_id || isPending || callNowMutation.isPending}
                          onClick={() => callNowMutation.mutate(c)}
                          title={!c.lead_id ? 'No lead linked to this call' : 'Skip the wait and call now'}
                        >
                          {isPending ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <PhoneCall className="w-4 h-4 mr-1" />
                          )}
                          Call Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          disabled={cancelMutation.isPending && cancelMutation.variables?.id === c.id}
                          onClick={() => cancelMutation.mutate(c)}
                          title="Cancel this queued call"
                        >
                          {cancelMutation.isPending && cancelMutation.variables?.id === c.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <X className="w-4 h-4 mr-1" />
                          )}
                          Cancel
                        </Button>
                        <Link
                          to={`/AutomatedCallDetail?id=${c.id}`}
                          className="inline-flex items-center text-[#C84B31] hover:underline"
                        >
                          View <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}