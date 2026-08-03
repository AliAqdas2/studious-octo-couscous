import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Phone, Mail, FileText, Volume2, User, Building2, Clock, Calendar, RefreshCw, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CallStatusBadge from '@/components/automation/CallStatusBadge';
import LeadEmailActivityDialog from '@/components/automation/LeadEmailActivityDialog';
import { Eye } from 'lucide-react';

function useQueryParam(name) {
  const [val, setVal] = React.useState(() => new URLSearchParams(window.location.search).get(name));
  React.useEffect(() => {
    const handler = () => setVal(new URLSearchParams(window.location.search).get(name));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [name]);
  return val;
}

export default function AutomatedCallDetail() {
  const callId = useQueryParam('id');
  const queryClient = useQueryClient();
  const [selectedEmailActivity, setSelectedEmailActivity] = React.useState(null);

  const { data: call, isLoading } = useQuery({
    queryKey: ['call-log', callId],
    queryFn: () => base44.entities.CallLog.get(callId),
    enabled: !!callId
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('analyzeCall', {
        call_log_id: callId,
        reanalyze: true
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Re-analysis complete');
      queryClient.invalidateQueries({ queryKey: ['call-log', callId] });
    },
    onError: (e) => toast.error(`Re-analyze failed: ${e.message}`)
  });

  const { data: lead } = useQuery({
    queryKey: ['lead', call?.lead_id],
    queryFn: () => base44.entities.Lead.get(call.lead_id),
    enabled: !!call?.lead_id
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['lead-email-logs', call?.lead_id],
    queryFn: () => base44.entities.ActivityLog.filter(
      { entity_type: 'Lead', entity_id: call.lead_id },
      '-timestamp',
      100
    ),
    enabled: !!call?.lead_id
  });

  const emailActivities = emailLogs.filter((l) =>
    /email|sent|draft|reply/i.test(l.action || '')
  );

  if (!callId) {
    return <div className="p-6 text-sm text-gray-500">No call ID specified.</div>;
  }

  if (isLoading || !call) {
    return <div className="p-6 text-sm text-gray-500">Loading call…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/AutomatedCallsDashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to calls
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="w-6 h-6 text-[#C84B31]" />
            Call to {call.lead_name || 'Lead'}
          </h1>
          <p className="text-sm text-gray-500">
            Attempt #{call.attempt_number || 1} ·{' '}
            {call.created_date ? format(new Date(call.created_date), 'PPpp') : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!call.recording_url || reanalyzeMutation.isPending}
            onClick={() => reanalyzeMutation.mutate()}
          >
            {reanalyzeMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Re-analyze
          </Button>
          <CallStatusBadge status={call.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Lead Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={User} label="Name" value={lead?.name || call.lead_name} />
            <Row icon={Building2} label="Company" value={lead?.company || call.lead_company} />
            <Row icon={Mail} label="Email" value={lead?.email} />
            <Row icon={Phone} label="Phone" value={call.lead_phone} />
            <Row icon={Calendar} label="Stage" value={lead?.stage} />
            {lead && (
              <Link
                to={`/LeadDetail?id=${lead.id}`}
                className="text-[#C84B31] hover:underline text-sm inline-block mt-2"
              >
                Open lead →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Call info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4" /> Call Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={Phone} label="Rep Phone" value={call.rep_phone} mono />
            <Row icon={Mail} label="Rep Email" value={call.rep_email} />
            <Row icon={Clock} label="Started" value={call.started_at ? format(new Date(call.started_at), 'PPpp') : '—'} />
            <Row icon={Clock} label="Ended" value={call.ended_at ? format(new Date(call.ended_at), 'PPpp') : '—'} />
            {call.error_message && (
              <div className="text-xs text-red-600 mt-2">Error: {call.error_message}</div>
            )}
          </CardContent>
        </Card>

        {/* Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Recording
            </CardTitle>
          </CardHeader>
          <CardContent>
            {call.recording_url ? (
              <div className="space-y-2">
                <audio controls className="w-full">
                  <source src={call.recording_url} />
                </audio>
                <a
                  href={call.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#C84B31] hover:underline break-all"
                >
                  {call.recording_url}
                </a>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No recording available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extracted fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Extracted Fields</CardTitle>
        </CardHeader>
        <CardContent>
          {call.summary || call.extracted_next_stage ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Summary" value={call.summary} full />
              <Field label="Next Stage" value={call.extracted_next_stage} />
              <Field label="Budget" value={call.extracted_budget} />
              <Field label="Headcount" value={call.extracted_headcount} />
              <Field label="Timing" value={call.extracted_timing} />
              <Field label="Notes" value={call.extracted_notes} full />
            </div>
          ) : (
            <div className="text-sm text-gray-500">No analysis yet — will appear after the call is completed and transcribed.</div>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Full Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          {call.transcript ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700 leading-relaxed">
              {call.transcript}
            </pre>
          ) : (
            <div className="text-sm text-gray-500">No transcript yet.</div>
          )}
        </CardContent>
      </Card>

      {/* Emails sent for this lead */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> Emails Related to This Lead ({emailActivities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {emailActivities.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No emails sent for this lead.</div>
          ) : (
            <ul className="divide-y">
              {emailActivities.map((a) => (
                <li key={a.id} className="p-4 text-sm hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-gray-500 whitespace-nowrap text-xs">
                          {a.timestamp ? format(new Date(a.timestamp), 'MMM d, HH:mm') : ''}
                        </span>
                      </div>
                      {a.details?.subject && (
                        <div className="text-gray-600 mt-1 truncate">{a.details.subject}</div>
                      )}
                      {a.user_name && (
                        <div className="text-xs text-gray-400 mt-1">by {a.user_name}</div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => setSelectedEmailActivity(a)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedEmailActivity && (
        <LeadEmailActivityDialog
          activity={selectedEmailActivity}
          onClose={() => setSelectedEmailActivity(null)}
        />
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-gray-900 break-words ${mono ? 'font-mono text-xs' : ''}`}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-1">{label}</div>
      <div className="text-gray-900 whitespace-pre-wrap">{value || '—'}</div>
    </div>
  );
}