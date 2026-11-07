import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 *
 * @param {{
 *   eventId?: string | null,
 *   onOpenPanel?: () => void,
 * }} props
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

/**
 * Full Client Communication stage list + templates.
 *
 * @param {{
 *   eventId?: string | null,
 *   canEdit?: boolean,
 * }} props
 */
export default function ClientCommunicationPanel({
  eventId,
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

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
  const currentId = data?.current?.id || data?.current?.Id || null;

  const patchMutation = useMutation({
    mutationFn: (payload) =>
      base44.functions.invoke('patchEventClientCommStage', {
        eventId,
        ...payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['event-client-comm-stages', eventId]);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update communication stage');
    },
  });

  const draftMutation = useMutation({
    mutationFn: (stageId) =>
      base44.functions.invoke('createEventClientCommDraft', {
        eventId,
        stageId,
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

  return (
    <OpsPanelShell
      title="Client Communication"
      icon={Mail}
      forceOpen
      milestoneLabel="Outreach track"
    >
      <p className="mb-3 text-sm text-gray-600">
        Client outreach stages — separate from execution tasks. Expand a stage
        for the email template; assign owner and due date; mark complete when
        sent.
      </p>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading stages…</p>
      ) : stages.length === 0 ? (
        <p className="text-sm text-gray-500">
          No communication stages yet. Generate the event workflow to seed them,
          or reopen this panel after deposit confirm.
        </p>
      ) : (
        <ul className="space-y-3">
          {stages.map((stage) => {
            const id = stage.id || stage.Id;
            const status = stage.status || 'pending';
            const done = status === 'done';
            const isCurrent = id === currentId;
            const expanded = expandedId === id;
            const assignedId = String(
              stage.assigned_user || stage.assignedUser || ''
            );
            const dueRaw = stage.due_date || stage.dueDate || '';
            const dueValue = dueRaw ? String(dueRaw).slice(0, 10) : '';
            const subject =
              stage.template_subject || stage.templateSubject || '';
            const body = stage.template_body || stage.templateBody || '';
            const selected = teamMembers.find((m) => m.userId === assignedId);

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
                        onClick={() =>
                          setExpandedId(expanded ? null : id)
                        }
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span>{stage.title}</span>
                      </button>
                      {isCurrent ? (
                        <Badge className="bg-sky-100 text-sky-900 border-sky-200">
                          Current
                        </Badge>
                      ) : null}
                      {done ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          Done
                        </Badge>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Owner</Label>
                        <Select
                          value={assignedId || UNASSIGNED}
                          disabled={!canEdit || patchMutation.isPending}
                          onValueChange={(value) =>
                            patchMutation.mutate({
                              stageId: id,
                              assigned_user:
                                value === UNASSIGNED ? null : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 bg-white">
                            <SelectValue placeholder="Assign…">
                              {selected
                                ? selected.name || selected.label
                                : 'Unassigned'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>
                              Unassigned
                            </SelectItem>
                            {[...teamMembers]
                              .sort((a, b) =>
                                String(a.name || a.label).localeCompare(
                                  String(b.name || b.label)
                                )
                              )
                              .map((m) => (
                                <SelectItem key={m.userId} value={m.userId}>
                                  {m.name || m.label}
                                  {m.role ? ` · ${m.role}` : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Due date</Label>
                        <Input
                          type="date"
                          className="h-9 bg-white"
                          value={dueValue}
                          disabled={!canEdit || patchMutation.isPending}
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

                    {expanded ? (
                      <div className="mt-2 space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Template
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {subject ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => copyText('Subject', subject)}
                              >
                                <Copy className="mr-1 h-3 w-3" />
                                Subject
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                copyText(
                                  'Email',
                                  subject
                                    ? `Subject: ${subject}\n\n${body}`
                                    : body
                                )
                              }
                            >
                              <Copy className="mr-1 h-3 w-3" />
                              Copy all
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs bg-[#C84B31] hover:bg-[#A03A23]"
                              disabled={draftMutation.isPending}
                              onClick={() => draftMutation.mutate(id)}
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
                          Draft fills placeholders from event POC, dates, deposit
                          link, company, and venue — then saves to Gmail Drafts.
                        </p>
                        {subject ? (
                          <p className="text-sm font-medium text-gray-800">
                            {subject}
                          </p>
                        ) : null}
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
                          {body || '(No body template)'}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </OpsPanelShell>
  );
}
