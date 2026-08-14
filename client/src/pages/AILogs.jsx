import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Loader2, Search, Sparkles, Mail } from 'lucide-react';
import AILogRow from '@/components/ai-logs/AILogRow';
import AILogDraftModal from '@/components/ai-logs/AILogDraftModal';
import EmailViewModal from '@/components/email/EmailViewModal';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';

const PAGE_SIZE = 50;

const CATEGORIES = [
  { value: 'all', label: 'All AI Activity' },
  { value: 'survey-draft', label: 'Survey Drafts' },
  { value: 'classification', label: 'Lead Classification' },
  { value: 'lead-created', label: 'Lead Intake' },
  { value: 'lead-appended', label: 'Email Append' },
  { value: 'call', label: 'Call Analysis' },
  { value: 'staff', label: 'Staff Assignment' },
  { value: 'event', label: 'Auto Event Created' },
  { value: 'spam-routed', label: 'Spam Routed' },
  { value: 'intake-failure', label: 'Intake Failures' },
];

export default function AILogs() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewing, setViewing] = useState(null);

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data: feedPages,
    isLoading: loadingFeed,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['ai-logs-feed', category, search],
    queryFn: ({ pageParam = 0 }) =>
      base44.aiLogs.list({
        limit: PAGE_SIZE,
        offset: pageParam,
        category,
        q: search,
      }),
    getNextPageParam: (lastPage) => {
      const next = (lastPage.offset || 0) + (lastPage.data?.length || 0);
      if (next >= (lastPage.total || 0)) return undefined;
      if (!(lastPage.data?.length > 0)) return undefined;
      return next;
    },
    initialPageParam: 0,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['ai-logs-stats'],
    queryFn: () => base44.aiLogs.stats(),
    staleTime: 60_000,
  });

  const feedItems = useMemo(
    () => (feedPages?.pages || []).flatMap((p) => p.data || []),
    [feedPages]
  );

  const totalMatching = feedPages?.pages?.[0]?.total ?? feedItems.length;

  const spamById = useMemo(() => {
    const map = {};
    for (const log of feedItems) {
      if (log.spam?.id) map[log.spam.id] = log.spam;
    }
    return map;
  }, [feedItems]);

  const counts = stats?.counts || { total: 0 };
  const dailyEmailData = stats?.daily || [];
  const totalLlmThisMonth = stats?.totals?.emails || 0;
  const totalTokensThisMonth = stats?.totals?.tokens || 0;
  const totalInputTokensThisMonth = stats?.totals?.inputTokens || 0;
  const totalOutputTokensThisMonth = stats?.totals?.outputTokens || 0;

  const isLoading = loadingFeed || loadingStats;

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base flex-wrap">
            <Mail className="w-4 h-4 text-[#C84B31]" />
            Emails Sent to LLM — Last 30 Days
            <span className="ml-auto text-sm font-normal text-gray-500">
              {totalLlmThisMonth} emails · {totalTokensThisMonth.toLocaleString()} tokens
              <span className="text-gray-400">
                {' '}(in {totalInputTokensThisMonth.toLocaleString()} · out {totalOutputTokensThisMonth.toLocaleString()})
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyEmailData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  yAxisId="emails"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="tokens"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => {
                    if (name === 'tokens') return [Number(value).toLocaleString(), 'Tokens (in+out)'];
                    if (name === 'leads') return [value, 'New Leads'];
                    if (name === 'followups') return [value, 'Follow-ups'];
                    if (name === 'spam') return [value, 'Spam/Filtered'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar yAxisId="emails" dataKey="leads" stackId="a" fill="#C84B31" radius={[0,0,0,0]} name="leads" />
                <Bar yAxisId="emails" dataKey="followups" stackId="a" fill="#E8B55F" name="followups" />
                <Bar yAxisId="emails" dataKey="spam" stackId="a" fill="#d1d5db" radius={[3,3,0,0]} name="spam" />
                <Line
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="tokens"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  name="tokens"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#C84B31'}}></span> New Leads</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#E8B55F'}}></span> Follow-ups</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#d1d5db'}}></span> Spam/Filtered by LLM</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{background:'#7c3aed', width: 12}}></span> Tokens (in+out)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-[#C84B31]" />
            Activity ({totalMatching})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && feedItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#C84B31]" />
            </div>
          ) : feedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bot className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No AI activity matches your filters yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feedItems.map(log => {
                const lead = log.lead || null;
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
              {hasNextPage ? (
                <div className="flex justify-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="border-orange-200 hover:bg-orange-50 hover:text-[#C84B31]"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              ) : null}
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
