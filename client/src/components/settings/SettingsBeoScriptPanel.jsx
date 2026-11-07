import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const HOST_SLUG = 'host_mc_script';

const TOKEN_HELP = [
  '{{client_name}}',
  '{{host_name}}',
  '{{event_name}}',
  '{{experience_activity}}',
  '{{instructor_name}}',
  '{{dish_or_drink}}',
];

/**
 * Edit the shared BEO Standard Script template (CRM-17).
 * Group Leader biographies are a separate BEO section — prefer omitting {{instructor_bio}}.
 */
export default function SettingsBeoScriptPanel() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Host MC Script');
  const [body, setBody] = useState('');
  const [rowId, setRowId] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['beo-script-templates'],
    queryFn: async () => {
      const list = await base44.entities.BeoScriptTemplate.list('slug', 20);
      return Array.isArray(list) ? list : [];
    },
  });

  useEffect(() => {
    const row =
      rows.find((r) => r.slug === HOST_SLUG) ||
      rows[0] ||
      null;
    if (!row) return;
    setRowId(row.id);
    setTitle(row.title || 'Host MC Script');
    setBody(row.body || '');
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        slug: HOST_SLUG,
        title: title.trim() || 'Host MC Script',
        body,
      };
      if (rowId) {
        return base44.entities.BeoScriptTemplate.update(rowId, payload);
      }
      return base44.entities.BeoScriptTemplate.create(payload);
    },
    onSuccess: (saved) => {
      if (saved?.id) setRowId(saved.id);
      queryClient.invalidateQueries({ queryKey: ['beo-script-templates'] });
      toast.success('BEO standard script saved');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to save script'),
  });

  return (
    <Card
      id="settings-beo-script"
      className="bg-white/80 backdrop-blur-sm border-orange-100 scroll-mt-24"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <FileText className="w-5 h-5 text-[#C84B31]" />
          BEO Standard Script
        </CardTitle>
        <CardDescription>
          Approved Mangia DC host script for the BEO &quot;Standard Script&quot;
          section. Leader names fill via placeholders; biographies are a separate
          BEO section (Settings → Group Leaders). Prefer omitting{' '}
          <code>{'{{instructor_bio}}'}</code> from this body. Seed default with{' '}
          <code>npm run db:seed-beo-scripts</code>. Regenerate the BEO on an event
          to pick up edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="beo-script-title">Title</Label>
              <Input
                id="beo-script-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="beo-script-body">Script body</Label>
              <Textarea
                id="beo-script-body"
                className="min-h-[280px] font-mono text-xs"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Standard script with {{placeholders}}…"
              />
            </div>
            <p className="text-xs text-gray-500">
              Supported tokens:{' '}
              {TOKEN_HELP.map((t) => (
                <code key={t} className="mr-1">
                  {t}
                </code>
              ))}
              (optional legacy <code>{'{{instructor_bio}}'}</code> is left empty
              on regenerate — use Group Leader Biography instead)
            </p>
            <Button
              className="bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save standard script'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
