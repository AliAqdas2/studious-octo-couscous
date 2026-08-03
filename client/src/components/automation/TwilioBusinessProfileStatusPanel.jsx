import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

function statusStyle(status) {
  const s = (status || '').toLowerCase();
  if (['approved', 'twilio-approved', 'in-production'].includes(s)) {
    return { label: 'Approved', icon: ShieldCheck, cls: 'bg-green-50 text-green-700 border-green-200' };
  }
  if (['rejected', 'failed', 'twilio-rejected'].includes(s)) {
    return { label: status || 'Failed', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-200' };
  }
  return { label: status || 'Pending', icon: ShieldQuestion, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
}

export default function TwilioBusinessProfileStatusPanel() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['twilio-webhook-logs'],
    queryFn: () => base44.entities.TwilioWebhookLog.list('-received_at', 1),
    refetchInterval: 30000
  });

  const latest = logs[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Twilio Business Profile Status</CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Most recent status webhook received from Twilio.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : !latest ? (
          <div className="text-sm text-gray-500">
            No webhooks received yet. Once Twilio sends a status update, it will appear here.
          </div>
        ) : (
          (() => {
            const s = statusStyle(latest.status);
            const Icon = s.icon;
            return (
              <div className="space-y-3">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${s.cls}`}>
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{s.label}</span>
                </div>
                {latest.error_message && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                    <span className="font-medium">Error{latest.error_code ? ` ${latest.error_code}` : ''}:</span>{' '}
                    {latest.error_message}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Received {format(new Date(latest.received_at), 'MMM d, yyyy HH:mm')}
                  {latest.business_profile_sid ? ` • ${latest.business_profile_sid}` : ''}
                </div>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}