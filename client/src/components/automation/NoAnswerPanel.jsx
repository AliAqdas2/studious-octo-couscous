import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneOff, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

// All statuses that count as "contact not established" and need a retry.
const ALL_DECLINED = ['No Answer', 'Busy', 'Failed', 'Rep Declined'];

/**
 * Shows the most recent unanswered call per lead with a Retry button.
 * Click "View" to see all attempt details for that call.
 */
export default function NoAnswerPanel({ calls, onRetry, retryingLeadId }) {
  // Keep only the most recent unanswered call per lead so we don't show duplicates.
  const declinedByLead = React.useMemo(() => {
    const map = {};
    calls
      .filter((c) => ALL_DECLINED.includes(c.status))
      .forEach((c) => {
        const existing = map[c.lead_id];
        if (!existing || new Date(c.created_date) > new Date(existing.created_date)) {
          map[c.lead_id] = c;
        }
      });
    return Object.values(map).sort(
      (a, b) => new Date(b.created_date) - new Date(a.created_date)
    );
  }, [calls]);

  if (declinedByLead.length === 0) return null;

  return (
    <Card className="border-orange-200">
      <CardHeader className="bg-orange-50/50">
        <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
          <PhoneOff className="w-5 h-5" />
          Contact Not Established — Needs Retry ({declinedByLead.length})
        </CardTitle>
        <p className="text-xs text-orange-700/80 mt-1">
          Calls where contact was not established. Click Retry to call again, or View for full attempt details.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Last Attempt</th>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Attempts</th>
                <th className="p-3"></th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {declinedByLead.map((c) => {
                const isRetrying = retryingLeadId === c.lead_id;
                return (
                  <tr key={c.id} className="border-t hover:bg-orange-50/30">
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {c.created_date ? format(new Date(c.created_date), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="p-3 font-medium">{c.lead_name || '—'}</td>
                    <td className="p-3 text-gray-600">{c.lead_company || '—'}</td>
                    <td className="p-3 font-mono text-xs">
                      {c.lead_phone ? (
                        <a href={`tel:${c.lead_phone}`} className="text-[#C84B31] hover:underline">
                          {c.lead_phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{c.status}</td>
                    <td className="p-3">{c.attempt_number || 1}</td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        className="bg-[#C84B31] hover:bg-[#A03A23] text-white"
                        disabled={isRetrying || !c.lead_id}
                        onClick={() => onRetry(c.lead_id)}
                      >
                        {isRetrying ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Retry Call
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
      </CardContent>
    </Card>
  );
}