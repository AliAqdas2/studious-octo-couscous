import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, ChevronRight, RefreshCw, Loader2, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import AutomationConfigCard from '@/components/automation/AutomationConfigCard';
import CallStatusBadge from '@/components/automation/CallStatusBadge';
import NoAnswerPanel from '@/components/automation/NoAnswerPanel';
import QueuedCallsPanel from '@/components/automation/QueuedCallsPanel';
import TwilioBusinessProfileStatusPanel from '@/components/automation/TwilioBusinessProfileStatusPanel';

export default function AutomatedCallsDashboard() {
  const queryClient = useQueryClient();
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['call-logs'],
    queryFn: () => base44.entities.CallLog.list('-created_date', 200),
    refetchInterval: 15000
  });

  const retryMutation = useMutation({
    mutationFn: async (leadId) => {
      const res = await base44.functions.invoke('triggerCallTwiML', { lead_id: leadId, skip_business_hours: true });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Retry initiated');
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
    onError: (e) => toast.error(`Retry failed: ${e.message}`)
  });

  // Group by lead: keep the most recent call per lead, and count total attempts.
  const { latestPerLead, attemptsByLead } = React.useMemo(() => {
    const counts = {};
    const latest = {};
    calls.forEach((c) => {
      counts[c.lead_id] = (counts[c.lead_id] || 0) + 1;
      const existing = latest[c.lead_id];
      if (!existing || new Date(c.created_date) > new Date(existing.created_date)) {
        latest[c.lead_id] = c;
      }
    });
    const sorted = Object.values(latest).sort(
      (a, b) => new Date(b.created_date) - new Date(a.created_date)
    );
    return { latestPerLead: sorted, attemptsByLead: counts };
  }, [calls]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="w-7 h-7 text-[#C84B31]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automated Calls</h1>
          <p className="text-sm text-gray-500">Calls triggered automatically by the lead automation flow.</p>
        </div>
      </div>

      <AutomationConfigCard />

      <QueuedCallsPanel calls={calls} />

      <NoAnswerPanel
        calls={calls}
        onRetry={(leadId) => retryMutation.mutate(leadId)}
        retryingLeadId={retryMutation.isPending ? retryMutation.variables : null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Call History ({latestPerLead.length})</CardTitle>
          <p className="text-xs text-gray-500 mt-1">One row per lead — showing the latest attempt. Click View for full attempt history.</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-gray-500">Loading calls…</div>
          ) : latestPerLead.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No calls yet. Calls will appear here when a lead is created with a company starting with the trigger prefix.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-3">Last Attempt</th>
                    <th className="text-left p-3">Lead</th>
                    <th className="text-left p-3">Company</th>
                    <th className="text-left p-3">Rep Phone</th>
                    <th className="text-left p-3">Rep Email</th>
                    <th className="text-left p-3">Attempts</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Next Retry</th>
                    <th className="p-3"></th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {latestPerLead.map((c) => {
                    const isRetrying = retryMutation.isPending && retryMutation.variables === c.lead_id;
                    return (
                    <tr key={c.id} className="border-t hover:bg-orange-50/30">
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {c.created_date ? format(new Date(c.created_date), 'MMM d, HH:mm') : '—'}
                      </td>
                      <td className="p-3 font-medium">{c.lead_name || '—'}</td>
                      <td className="p-3 text-gray-600">{c.lead_company || '—'}</td>
                      <td className="p-3 font-mono text-xs">{c.rep_phone || '—'}</td>
                      <td className="p-3 text-gray-600">{c.rep_email || '—'}</td>
                      <td className="p-3">{attemptsByLead[c.lead_id] || 1}</td>
                      <td className="p-3"><CallStatusBadge status={c.status} /></td>
                      <td className="p-3 text-xs">
                        {c.scheduled_retry_at && !c.retry_processed ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>in {formatDistanceToNow(new Date(c.scheduled_retry_at))}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRetrying || !c.lead_id}
                          onClick={() => retryMutation.mutate(c.lead_id)}
                        >
                          {isRetrying ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          {c.scheduled_retry_at && !c.retry_processed ? 'Retry now' : 'Retry'}
                        </Button>
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/AutomatedCallDetail?id=${c.id}`}
                          className="inline-flex items-center text-[#C84B31] hover:underline"
                        >
                          View <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}