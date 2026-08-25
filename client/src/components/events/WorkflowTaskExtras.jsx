import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const PHASE_LABELS = {
  upon_deposit: 'Upon deposit',
  two_point_five_weeks: '~2.5 weeks before',
  ros: 'Run of Show',
  three_weeks: 'Three weeks before',
  two_weeks: 'Two weeks before',
  one_week_before: 'One week before',
  staff_checkin_72_48h: 'Staff check-in (72–48h)',
  twenty_four_h: '24 hours before',
  during: 'During event',
  post: 'Post-event',
};

const STAFF_STATUSES = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'awaiting', label: 'Awaiting (48h)' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'escalated', label: 'Escalated' },
];

const SUPPLY_METHODS = [
  { value: 'in_person', label: 'In-person shopping' },
  { value: 'curbside', label: 'Curbside delivery' },
  { value: 'rush_shipping', label: 'Rush shipping' },
];

function parseMeta(task) {
  const raw = task?.workflow_meta;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

/**
 * Phase badge, resource links, and plan-03 controls
 * (staff status / supply pickup / ice / assignee hint).
 */
export default function WorkflowTaskExtras({
  task,
  canEdit = false,
  onMetaChange,
}) {
  const meta = parseMeta(task);
  const links = Array.isArray(task?.resource_links) ? task.resource_links : [];
  const phase = task?.workflow_phase;
  const traceId = task?.trace_id;
  const isStaff =
    traceId === 'C038' ||
    traceId === 'C039' ||
    traceId === 'C040' ||
    /staff availability|reach out to instructor|48h staff/i.test(
      task?.title || ''
    );
  const isSupply =
    traceId === 'C092' || /remaining supplies/i.test(task?.title || '');
  const isIce = traceId === 'C094' || /acquire ice/i.test(task?.title || '');
  const assigneeOptions = meta.assigneeOptions || meta.assignee_options;

  const patch = (partial) => {
    if (!onMetaChange) return;
    onMetaChange({ ...meta, ...partial });
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex flex-wrap gap-1.5">
        {phase && (
          <Badge variant="outline" className="text-xs bg-slate-50">
            {PHASE_LABELS[phase] || phase}
          </Badge>
        )}
        {traceId && (
          <Badge variant="outline" className="text-xs text-gray-500">
            {traceId}
          </Badge>
        )}
        {Array.isArray(assigneeOptions) && assigneeOptions.length > 0 && (
          <Badge className="text-xs bg-blue-50 text-blue-800 border-blue-200">
            Assignee: {assigneeOptions.join(' or ')}
          </Badge>
        )}
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link, idx) =>
            link?.url ? (
              <a
                key={`${link.label}-${idx}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#C84B31] hover:underline"
              >
                {link.label || 'Resource'}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null
          )}
        </div>
      )}

      {canEdit && isStaff && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t">
          <div>
            <Label className="text-xs text-gray-500">Staff response status</Label>
            <Select
              value={meta.staffStatus || 'awaiting'}
              onValueChange={(v) => patch({ staffStatus: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Reached out by</Label>
            <Input
              className="h-8 text-sm"
              placeholder="Name"
              value={meta.reachedOutBy || ''}
              onChange={(e) => patch({ reachedOutBy: e.target.value })}
              onBlur={(e) => patch({ reachedOutBy: e.target.value })}
            />
          </div>
          {meta.staffStatus === 'escalated' && (
            <p className="text-xs text-amber-700 sm:col-span-2">
              Escalated to Ops Manager / Zach — no response within 48h policy.
            </p>
          )}
        </div>
      )}

      {!canEdit && isStaff && meta.staffStatus && (
        <p className="text-xs text-gray-600">
          Staff: {meta.staffStatus}
          {meta.reachedOutBy ? ` · ${meta.reachedOutBy}` : ''}
        </p>
      )}

      {canEdit && isSupply && (
        <div className="pt-1 border-t">
          <Label className="text-xs text-gray-500">Pickup method</Label>
          <Select
            value={meta.supplyPickupMethod || ''}
            onValueChange={(v) => patch({ supplyPickupMethod: v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="In-person / curbside / rush…" />
            </SelectTrigger>
            <SelectContent>
              {SUPPLY_METHODS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {canEdit && isIce && (
        <label className="flex items-center gap-2 text-sm pt-1 border-t">
          <Checkbox
            checked={Boolean(meta.iceAcquired)}
            onCheckedChange={(v) => patch({ iceAcquired: Boolean(v) })}
          />
          Ice acquired
        </label>
      )}
    </div>
  );
}

export { PHASE_LABELS };
