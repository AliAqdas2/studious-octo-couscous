import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Loader2, Search, Sparkles, Mail } from 'lucide-react';
import AILogRow from '@/components/ai-logs/AILogRow';
import AILogDraftModal from '@/components/ai-logs/AILogDraftModal';
import EmailViewModal from '@/components/email/EmailViewModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// AI / system actors whose actions show up in this feed.
const AI_USER_NAMES = new Set([
  'System (Email Intake)',
  'System (Contact Form Watcher)',
  'Lead Auto-Detection',
  'Automated Call Fallback',
  'Staff Assignment System',
  'System',
  'system'
]);

// Actions that indicate the LLM was actually invoked for an email
const LLM_EMAIL_ACTIONS = new Set([
  'Created from Contact Form',
  'Created from Direct Email',
  'Inbound Email Received (Follow-up)',
  'Routed to Spam (Promotion)',
  'Routed to Spam (CC-Only)',
  'Routed to Spam (Other)'
]);

// AI-driven actions in ActivityLog (regardless of user_name, these are always AI).
const AI_ACTIONS = new Set([
  'Auto-Classification',
  'Staff Auto-Assigned',
  'Meeting Proposal Draft Created (No-Answer Fallback)',
  'Created from Direct Email',
  'Created from Contact Form',
  'Inbound Email Received (Follow-up)'
]);

function isAILog(log) {
  if (AI_ACTIONS.has(log.action)) return true;
  if (log.action?.startsWith('Routed to Spam')) return true;
  if (log.user_name && AI_USER_NAMES.has(log.user_name)) return true;
  return false;
}

const CATEGORIES = [
  { value: 'all', label: 'All AI Activity' },
  { value: 'survey-draft', label: 'Survey Drafts' },
  { value: 'classification', label: 'Lead Classification' },
  { value: 'lead-created', label: 'Lead Intake' },
  { value: 'lead-appended', label: 'Email Append' },
  { value: 'call', label: 'Call Analysis' },
  { value: 'staff', label: 'Staff Assignment' },
  { value: 'event', label: 'Auto Event Created' },
  { value: 'spam-routed', label: 'Spam Routed' }
];

function actionToCategory(action) {
  if (action?.includes('Meeting Proposal Draft')) return 'survey-draft';
  if (action === 'Auto-Classification') return 'classification';
  if (action === 'Staff Auto-Assigned') return 'staff';
  if (action === 'Created from Direct Email' || action === 'Created from Contact Form') return 'lead-created';
  if (action === 'Inbound Email Received (Follow-up)') return 'lead-appended';
  if (action === 'Event Created' || action === 'Created from Won Lead') return 'event';
  if (action === 'Call Analyzed') return 'call';
  if (action?.startsWith('Routed to Spam')) return 'spam-routed';
  return 'other';
}

export default function AILogs() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewing, setViewing] = useState(null); // { type: 'draft', log }

  // Fetch recent ActivityLog (descending by timestamp)
  const { data: activityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['ai-logs-activity'],
    queryFn: () => base44.entities.ActivityLog.list('-timestamp', 500)
  });

  // Fetch analyzed CallLogs to surface as synthetic "Call Analyzed" entries.
  const { data: callLogs = [], isLoading: loadingCalls } = useQuery({
    queryKey: ['ai-logs-calls'],
    queryFn: async () => {
      const all = await base44.entities.CallLog.filter({ status: 'Analyzed' }, '-ended_at', 200);
      return all;
    }
  });

  // Fetch leads so we can show "<Lead Name> — Action" on each row.
  const { data: leads = [] } = useQuery({
    queryKey: ['ai-logs-leads'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 1000)
  });
  const leadById = useMemo(() => {
    const map = {};
    for (const l of leads) map[l.id] = l;
    return map;
  }, [leads]);

  // Spam rows for resolving gmail_message_id from spam_email_id on routed logs.
  const { data: spamEmails = [] } = useQuery({
    queryKey: ['ai-logs-spam'],
    queryFn: () => base44.entities.SpamEmail.list('-received_at', 500)
  });
  const spamById = useMemo(() => {
    const map = {};
    for (const s of spamEmails) map[s.id] = s;
    return map;
  }, [spamEmails]);

  // Normalize ActivityLog + CallLog into a single unified list.
  const merged = useMemo(() => {
    const aiActivity = activityLogs
      .filter(isAILog)
      .map(l => ({ ...l, _source: 'activity' }));

    const callsAsLogs = callLogs.map(c => ({
      id: `call-${c.id}`,
      _source: 'call',
      entity_type: 'Lead',
      entity_id: c.lead_id,
      action: 'Call Analyzed',
      user_name: 'AI Call Analyzer',
      timestamp: c.ended_at || c.started_at,
      details: {
        call_log_id: c.id,
        summary: c.summary,
        extracted_next_stage: c.extracted_next_stage,
        extracted_budget: c.extracted_budget,
        extracted_headcount: c.extracted_headcount,
        extracted_timing: c.extracted_timing,
        recording_url: c.recording_url,
        lead_name: c.lead_name
      }
    }));

    return [...aiActivity, ...callsAsLogs].sort(
      (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [activityLogs, callLogs]);

  const filtered = useMemo(() => {
    return merged.filter(log => {
      if (category !== 'all' && actionToCategory(log.action) !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const lead = leadById[log.entity_id];
        const haystack = [
          log.action,
          log.user_name,
          lead?.name,
          lead?.email,
          lead?.company,
          log.details?.summary,
          log.details?.subject,
          log.details?.recipient,
          log.details?.ai_reason,
          log.details?.from
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [merged, category, search, leadById]);

  const isLoading = loadingLogs || loadingCalls;

  // Daily LLM email processing chart — last 30 days
  // Only count emails that actually went through the LLM:
  //   - New leads (always LLM)
  //   - Follow-ups appended to existing leads (always LLM)
  //   - Spam routed by the LLM itself (NOT by cheap header/keyword filters)
  const BULK_HEADER_PATTERNS = ['List-Unsubscribe', 'List-Id', 'Feedback-ID', 'List-Unsubscribe-Post'];
  const PRE_LLM_PATTERNS = ['Bot name prefix', 'url= injection', 'Spam phrase:'];
  const isLlmClassifiedSpam = (log) => {
    if (log.action === 'Routed to Spam (CC-Only)') return false;
    const reason = log.details?.ai_reason || '';
    if (BULK_HEADER_PATTERNS.some(p => reason.includes(p))) return false;
    if (PRE_LLM_PATTERNS.some(p => reason.includes(p))) return false;
    return true;
  };

  const dailyEmailData = useMemo(() => {
    const llmLogs = activityLogs.filter(l => {
      if (!LLM_EMAIL_ACTIONS.has(l.action)) return false;
      // For spam actions, only include those that actually went through the LLM
      const isSpamAction = l.action.startsWith('Routed to Spam');
      if (isSpamAction) return isLlmClassifiedSpam(l);
      return true;
    });
    const byDay = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { date: key, total: 0, leads: 0, spam: 0, followups: 0 };
    }
    for (const log of llmLogs) {
      const key = (log.timestamp || '').slice(0, 10);
      if (!byDay[key]) continue;
      byDay[key].total++;
      if (log.action === 'Created from Contact Form' || log.action === 'Created from Direct Email') byDay[key].leads++;
      else if (log.action === 'Inbound Email Received (Follow-up)') byDay[key].followups++;
      else byDay[key].spam++;
    }
    return Object.values(byDay).map(d => ({
      ...d,
      label: new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));
  }, [activityLogs]);

  const totalLlmThisMonth = useMemo(() => dailyEmailData.reduce((s, d) => s + d.total, 0), [dailyEmailData]);

  // Counts per category, for the summary chips
  const counts = useMemo(() => {
    const c = { total: merged.length };
    for (const log of merged) {
      const k = actionToCategory(log.action);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [merged]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-[#C84B31] flex items-center justify-center shadow-md">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">AI Activity Log</h1>
          <p className="text-sm text-gray-500">Everything the system did automatically — call analyses, drafts, lead intake, classifications, and more.</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { key: 'total', label: 'Total', cls: 'bg-gradient-to-br from-[#C84B31] to-[#E8B55F] text-white' },
          { key: 'survey-draft', label: 'Drafts', cls: 'bg-purple-50 text-purple-700' },
          { key: 'call', label: 'Calls', cls: 'bg-rose-50 text-rose-700' },
          { key: 'classification', label: 'Classified', cls: 'bg-amber-50 text-amber-700' },
          { key: 'lead-created', label: 'Leads', cls: 'bg-emerald-50 text-emerald-700' },
          { key: 'staff', label: 'Staff Assigns', cls: 'bg-blue-50 text-blue-700' },
          { key: 'event', label: 'Events', cls: 'bg-indigo-50 text-indigo-700' }
        ].map(item => (
          <div key={item.key} className={`rounded-xl px-3 py-2 ${item.cls}`}>
            <p className="text-xs opacity-80">{item.label}</p>
            <p className="text-xl font-bold">{counts[item.key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Daily LLM Email Volume Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-[#C84B31]" />
            Emails Sent to LLM for Processing — Last 30 Days
            <span className="ml-auto text-sm font-normal text-gray-500">{totalLlmThisMonth} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyEmailData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [value, name === 'leads' ? 'New Leads' : name === 'followups' ? 'Follow-ups' : 'Spam/Filtered']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="leads" stackId="a" fill="#C84B31" radius={[0,0,0,0]} name="leads" />
                <Bar dataKey="followups" stackId="a" fill="#E8B55F" name="followups" />
                <Bar dataKey="spam" stackId="a" fill="#d1d5db" radius={[3,3,0,0]} name="spam" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#C84B31'}}></span> New Leads</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#E8B55F'}}></span> Follow-ups</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#d1d5db'}}></span> Spam/Filtered by LLM</span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by lead, subject, summary, action..."
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-[#C84B31]" />
            Activity ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#C84B31]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bot className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No AI activity matches your filters yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(log => {
                const lead = leadById[log.entity_id];
                const leadName = lead?.name || log.details?.lead_name || null;
                return (
                  <AILogRow
                    key={log.id}
                    log={log}
                    leadName={leadName}
                    lead={lead}
                    spamById={spamById}
                    onView={setViewing}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {viewing?.type === 'draft' && (
        <AILogDraftModal
          draftId={viewing.log.details?.draft_id}
          log={viewing.log}
          onClose={() => setViewing(null)}
        />
      )}

      {viewing?.type === 'email' && (
        <EmailViewModal
          email={viewing.email}
          lead={viewing.lead}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}