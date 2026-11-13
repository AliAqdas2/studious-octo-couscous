import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Mail,
  RotateCcw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import {
  buildTeamMemberOptions,
  enrichTeamMemberOptions,
} from '@/lib/taskTeamMembers';

const UNASSIGNED = '__unassigned__';

/**
 * Compact current-stage strip shown next to Operations stage.
 */
export function ClientCommStageOverview({ eventId, onOpenPanel }) {
  const { data, isLoading } = useQuery({
    queryKey: ['event-client-comm-stages', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventClientCommStages', {
        eventId,
      });
      return res?.data ?? res;
    },
    enabled: Boolean(eventId),
  });

  const currentTitle = data?.current_title || '—';
  const done = data?.done_count ?? 0;
  const total = data?.total_count ?? 0;
  const allDone = total > 0 && done === total;

  return (
    <button
      type="button"
      onClick={onOpenPanel}
      className="w-full text-left space-y-3 rounded-xl border border-sky-100 bg-white/90 p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Client Communication Stage
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              className={`border font-semibold ${
                allDone
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-sky-50 text-sky-900 border-sky-200'
              }`}
            >
              {isLoading ? 'Loading…' : currentTitle}
            </Badge>
            {total > 0 ? (
              <span className="text-sm text-gray-600">
                {done} of {total} complete
              </span>
            ) : (
              <span className="text-sm text-gray-500">
                Stages seed when workflow is generated
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-sky-700">View stages →</span>
      </div>
      <p className="text-xs text-gray-500">
        Client outreach — separate from execution tasks.
      </p>
    </button>
  );
}

function stageDisplayTitle(stage) {
  return stage?.title || 'Untitled stage';
}

function isDoneStatus(status) {
  return status === 'done' || status === 'skipped';
}

/**
 * Full Client Communication stage list + editable compose (Leads-style).
 */
export default function ClientCommunicationPanel({
  eventId,
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [thankYouVariantId, setThankYouVariantId] = useState(null);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [composeSeededFor, setComposeSeededFor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event-client-comm-stages', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventClientCommStages', {
        eventId,
      });
      return res?.data ?? res;
    },
    enabled: Boolean(eventId),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allRoleAssignments = [] } = useQuery({
    queryKey: ['role-assignments-active'],
    queryFn: async () => {
      const rows = await base44.entities.RoleAssignment.filter({
        is_active: true,
      });
      return Array.isArray(rows) ? rows : [];
    },
  });

  const teamMembers = useMemo(
    () =>
      enrichTeamMemberOptions(
        buildTeamMemberOptions(allRoleAssignments),
        users
      ),
    [allRoleAssignments, users]
  );

  const stages = Array.isArray(data?.stages) ? data.stages : [];
  const thankYouGroup = data?.thank_you_group || null;
  const thankYouVariants = Array.isArray(thankYouGroup?.variants)
    ? thankYouGroup.variants
    : [];

  useEffect(() => {
    if (!thankYouGroup) {
      setThankYouVariantId(null);
      return;
    }
    const selected = thankYouGroup.selected_id;
    const pending = thankYouVariants.find((v) => v.status === 'pending');
    const done = thankYouVariants.find((v) => v.status === 'done');
    setThankYouVariantId(
      selected || done?.id || pending?.id || thankYouVariants[0]?.id || null
    );
  }, [thankYouGroup?.selected_id, thankYouVariants.length]);

  const activeComposeStageId =
    expandedId === '__thank_you__' ? thankYouVariantId : expandedId;

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } =
    useQuery({
      queryKey: [
        'event-client-comm-preview',
        eventId,
        activeComposeStageId,
      ],
      queryFn: async () => {
        const res = await base44.functions.invoke('getEventClientCommPreview', {
          eventId,
          stageId: activeComposeStageId,
        });
        return res?.data ?? res;
      },
      enabled: Boolean(eventId && activeComposeStageId),
    });

  // Seed compose when preview loads for the active stage
  useEffect(() => {
    if (!preview || !activeComposeStageId) return;
    if (composeSeededFor === activeComposeStageId) return;
    setCompose({
      to: preview.to || '',
      subject: preview.subject || '',
      body: preview.body || '',
    });
    setComposeSeededFor(activeComposeStageId);
  }, [preview, activeComposeStageId, composeSeededFor]);

  const patchMutation = useMutation({
    mutationFn: (payload) =>
      base44.functions.invoke('patchEventClientCommStage', {
        eventId,
        ...payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-client-comm-stages', eventId]);
      queryClient.invalidateQueries(['events-flow-board']);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update communication stage');
    },
  });

  const draftMutation = useMutation({
    mutationFn: ({ stageId, to, subject, body }) =>
      base44.functions.invoke('createEventClientCommDraft', {
        eventId,
        stageId,
        to,
        subject,
        body,
      }),
    onSuccess: (res) => {
      const body = res?.data ?? res;
      toast.success(
        body?.to
          ? `Gmail draft created for ${body.to}`
          : 'Gmail draft created'
      );
    },
    onError: (err) => {
      toast.error(
        err?.message ||
          'Failed to create draft. Connect Gmail and set the event POC email.'
      );
    },
  });

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const resetComposeFromTemplate = async () => {
    setComposeSeededFor(null);
    const res = await refetchPreview();
    const p = res?.data ?? preview;
    if (p) {
      setCompose({
        to: p.to || '',
        subject: p.subject || '',
        body: p.body || '',
      });
      setComposeSeededFor(activeComposeStageId);
      toast.success('Reset to template');
    }
  };

  const currentId = data?.current?.id || data?.current?.Id || null;

  const renderAssigneeDue = (stage) => {
    if (!canEdit || !stage) return null;
    const id = stage.id || stage.Id;
    const assignedId = String(stage.assigned_user || stage.assignedUser || '');
    const dueRaw = stage.due_date || stage.dueDate || '';
    const dueValue = dueRaw ? String(dueRaw).slice(0, 10) : '';

    return (
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px]">
          <Label className="text-xs text-gray-500">Owner</Label>
          <Select
            value={assignedId || UNASSIGNED}
            onValueChange={(v) => {
              patchMutation.mutate({
                stageId: id,
                assigned_user: v === UNASSIGNED ? null : v,
              });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name || m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Due</Label>
          <Input
            type="date"
            className="h-8 text-xs w-[140px]"
            value={dueValue}
            onChange={(e) => {
              const v = e.target.value;
              patchMutation.mutate({
                stageId: id,
                due_date: v ? v : null,
              });
            }}
          />
        </div>
      </div>
    );
  };

  const renderCompose = () => {
    if (!activeComposeStageId) return null;
    return (
      <div className="mt-2 space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Email compose
          </p>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={previewLoading}
              onClick={() => copyText('Subject', compose.subject)}
            >
              <Copy className="mr-1 h-3 w-3" />
              Subject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={previewLoading}
              onClick={() =>
                copyText(
                  'Email',
                  compose.subject
                    ? `Subject: ${compose.subject}\n\n${compose.body}`
                    : compose.body
                )
              }
            >
              <Copy className="mr-1 h-3 w-3" />
              Copy all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={previewLoading}
              onClick={resetComposeFromTemplate}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset template
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={
                draftMutation.isPending ||
                !compose.to ||
                !compose.subject
              }
              onClick={() =>
                draftMutation.mutate({
                  stageId: activeComposeStageId,
                  to: compose.to,
                  subject: compose.subject,
                  body: compose.body,
                })
              }
            >
              {draftMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              Create Gmail draft
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Template auto-fills from this stage. Edit freely before creating a
          Gmail draft — same flow as Lead email.
        </p>
        {preview?.has_unfilled_placeholders ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Some &lt;&lt;placeholders&gt;&gt; remain — set missing POC / deposit
            link / company on the event, or edit the text below.
          </p>
        ) : null}
        {previewLoading && composeSeededFor !== activeComposeStageId ? (
          <p className="text-sm text-gray-500">Loading template…</p>
        ) : (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-gray-500">To</Label>
              <Input
                type="email"
                className="h-8 text-sm bg-white"
                value={compose.to}
                onChange={(e) =>
                  setCompose((c) => ({ ...c, to: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Subject</Label>
              <Input
                className="h-8 text-sm bg-white"
                value={compose.subject}
                onChange={(e) =>
                  setCompose((c) => ({ ...c, subject: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Body</Label>
              <Textarea
                className="text-sm bg-white min-h-[160px]"
                rows={8}
                value={compose.body}
                onChange={(e) =>
                  setCompose((c) => ({ ...c, body: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStageRow = (stage) => {
    const id = stage.id || stage.Id;
    const status = stage.status || 'pending';
    const done = status === 'done';
    const isCurrent = id === currentId;
    const expanded = expandedId === id;

    return (
      <li
        key={id}
        className={`rounded-lg border p-3 ${
          isCurrent
            ? 'border-sky-300 bg-sky-50/50'
            : done
              ? 'border-emerald-100 bg-emerald-50/30'
              : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-2 pt-0.5">
            <Checkbox
              checked={done}
              disabled={!canEdit || patchMutation.isPending}
              onCheckedChange={(checked) => {
                patchMutation.mutate({
                  stageId: id,
                  complete: Boolean(checked),
                });
              }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-left font-medium text-gray-900 hover:text-[#C84B31]"
                onClick={() => {
                  setComposeSeededFor(null);
                  setExpandedId(expanded ? null : id);
                }}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                {stageDisplayTitle(stage)}
              </button>
              {isCurrent ? (
                <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px]">
                  Current
                </Badge>
              ) : null}
              {done ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                  Done
                </Badge>
              ) : null}
            </div>
            {renderAssigneeDue(stage)}
            {expanded ? renderCompose() : null}
          </div>
        </div>
      </li>
    );
  };

  const renderThankYouRow = () => {
    if (!thankYouGroup || thankYouVariants.length === 0) return null;

    const active =
      thankYouVariants.find((v) => v.id === thankYouVariantId) ||
      thankYouVariants[0];
    const status = active?.status || 'pending';
    const done = status === 'done';
    const anyClosed = thankYouVariants.some((v) => isDoneStatus(v.status));
    const expanded = expandedId === '__thank_you__';
    const isCurrent =
      data?.current_title === 'Send Thank You Email' ||
      thankYouVariants.some((v) => v.id === currentId);

    return (
      <li
        key="thank-you-group"
        className={`rounded-lg border p-3 ${
          isCurrent
            ? 'border-sky-300 bg-sky-50/50'
            : done || anyClosed
              ? 'border-emerald-100 bg-emerald-50/30'
              : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-2 pt-0.5">
            <Checkbox
              checked={done}
              disabled={!canEdit || patchMutation.isPending || !active}
              onCheckedChange={(checked) => {
                if (!active?.id) return;
                patchMutation.mutate({
                  stageId: active.id,
                  complete: Boolean(checked),
                });
              }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-left font-medium text-gray-900 hover:text-[#C84B31]"
                onClick={() => {
                  setComposeSeededFor(null);
                  setExpandedId(expanded ? null : '__thank_you__');
                }}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                {thankYouGroup.title || 'Send Thank You Email'}
              </button>
              {isCurrent ? (
                <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px]">
                  Current
                </Badge>
              ) : null}
              {done ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                  Done
                </Badge>
              ) : null}
              <Badge className="bg-amber-50 text-amber-900 border-amber-200 text-[10px]">
                Pick one
              </Badge>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">
                Which thank-you applies?
              </Label>
              <Select
                value={thankYouVariantId || ''}
                onValueChange={(v) => {
                  setThankYouVariantId(v);
                  setComposeSeededFor(null);
                  if (expandedId !== '__thank_you__') {
                    setExpandedId('__thank_you__');
                  }
                }}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-8 text-xs max-w-md">
                  <SelectValue placeholder="Select variant…" />
                </SelectTrigger>
                <SelectContent>
                  {thankYouVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.def_slug === 'thank_you_with_invoice' ||
                      String(v.title || '').toLowerCase().includes('invoice')
                        ? 'With consumption invoice'
                        : 'Without invoice'}
                      {v.status === 'done' ? ' (done)' : ''}
                      {v.status === 'skipped' ? ' (skipped)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Only one thank-you is sent. Completing this marks the other
                variant skipped.
              </p>
            </div>

            {renderAssigneeDue(active)}
            {expanded ? renderCompose() : null}
          </div>
        </div>
      </li>
    );
  };

  // Insert thank-you group after remaining-balance style stages (before referral
  // if present). Sort by placing group after stages with sort_order < 9.
  const stagesBeforeThankYou = [];
  const stagesAfterThankYou = [];
  for (const s of stages) {
    const order = Number(s.sort_order ?? s.sortOrder ?? 0);
    if (order >= 9) stagesAfterThankYou.push(s);
    else stagesBeforeThankYou.push(s);
  }

  const hasRows =
    stages.length > 0 || (thankYouVariants && thankYouVariants.length > 0);

  return (
    <OpsPanelShell
      title="Client Communication"
      icon={Mail}
      forceOpen
      milestoneLabel="Outreach track"
    >
      <p className="mb-3 text-sm text-gray-600">
        {data?.simple_track
          ? 'Cooking Class outreach — expand a stage to edit the email (like Lead drafts), then Create Gmail draft. Thank-you is pick-one (with or without consumption invoice). Not every stage is required in order.'
          : 'Client outreach — expand a stage to edit To / Subject / Body, then Create Gmail draft. Mark complete when sent. Thank-you variants are pick-one.'}
      </p>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading stages…</p>
      ) : !hasRows ? (
        <p className="text-sm text-gray-500">
          No communication stages yet. Generate the event workflow to seed them,
          or reopen this panel after deposit confirm.
        </p>
      ) : (
        <ul className="space-y-3">
          {stagesBeforeThankYou.map(renderStageRow)}
          {renderThankYouRow()}
          {stagesAfterThankYou.map(renderStageRow)}
        </ul>
      )}
    </OpsPanelShell>
  );
}
