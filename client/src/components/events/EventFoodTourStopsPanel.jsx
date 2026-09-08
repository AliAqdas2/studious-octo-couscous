import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPinned,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import {
  formatOrderLine,
  normalizeOrderLines,
  ORDER_MODES,
  TIME_LABELS,
} from '@/lib/eateryOrders';

function defaultGuestCount(event) {
  return (
    event?.headcount ||
    event?.headcount_max ||
    event?.headcount_min ||
    ''
  );
}

/**
 * Per-event food-tour restaurant stops. Shown only for food-tour experiences.
 */
export default function EventFoodTourStopsPanel({
  eventId,
  event,
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const [addEateryId, setAddEateryId] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: eateries = [] } = useQuery({
    queryKey: ['eateries-active'],
    queryFn: async () => {
      const rows = await base44.entities.Eatery.filter(
        { is_active: true },
        'sort_order',
        200
      );
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['event-eatery-stops', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventEateryStops', {
        eventId,
      });
      return res?.data ?? res;
    },
    enabled: Boolean(eventId),
  });

  const stops = useMemo(
    () => (Array.isArray(data?.stops) ? data.stops : []),
    [data]
  );

  const usedIds = useMemo(
    () => new Set(stops.map((s) => s.eatery_id).filter(Boolean)),
    [stops]
  );

  const available = eateries.filter((e) => !usedIds.has(e.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-eatery-stops', eventId] });
    queryClient.invalidateQueries({ queryKey: ['beo-document', eventId] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addEateryId) throw new Error('Pick a restaurant');
      const res = await base44.functions.invoke('addEventEateryStop', {
        eventId,
        eatery_id: addEateryId,
        guest_count: defaultGuestCount(event) || null,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      setAddEateryId('');
      invalidate();
      toast.success('Stop added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add stop'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ stopId, patch }) => {
      const res = await base44.functions.invoke('updateEventEateryStop', {
        eventId,
        stopId,
        ...patch,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Stop updated');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to update stop'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (stopId) => {
      const res = await base44.functions.invoke('deleteEventEateryStop', {
        eventId,
        stopId,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Stop removed');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to remove stop'),
  });

  const moveStop = (stop, direction) => {
    const idx = stops.findIndex((s) => s.id === stop.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= stops.length) return;
    const other = stops[swapIdx];
    updateMutation.mutate({
      stopId: stop.id,
      patch: { sort_order: Number(other.sort_order) || 0 },
    });
    updateMutation.mutate({
      stopId: other.id,
      patch: { sort_order: Number(stop.sort_order) || 0 },
    });
  };

  const patchLine = (stop, lineIdx, field, value) => {
    const lines = normalizeOrderLines(stop.order_lines);
    const next = lines.map((l, i) =>
      i === lineIdx
        ? {
            ...l,
            [field]:
              field === 'perGuests'
                ? value === '' || value == null
                  ? null
                  : Number(value)
                : value,
          }
        : l
    );
    updateMutation.mutate({
      stopId: stop.id,
      patch: { order_lines: next },
    });
  };

  const addLine = (stop) => {
    const lines = normalizeOrderLines(stop.order_lines);
    updateMutation.mutate({
      stopId: stop.id,
      patch: {
        order_lines: [...lines, { label: 'New item', perGuests: 1, note: null }],
      },
    });
  };

  const removeLine = (stop, lineIdx) => {
    const lines = normalizeOrderLines(stop.order_lines).filter(
      (_, i) => i !== lineIdx
    );
    updateMutation.mutate({
      stopId: stop.id,
      patch: { order_lines: lines },
    });
  };

  return (
    <OpsPanelShell
      title="Food tour stops"
      icon={MapPinned}
      complete={stops.length > 0}
      milestoneLabel={
        stops.length
          ? `${stops.length} stop${stops.length === 1 ? '' : 's'}`
          : 'Select restaurants for this tour'
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Pick the restaurants for this tour. Guest count drives order
          quantities on the BEO (ceil of guests ÷ serves-per-order).
        </p>

        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={addEateryId}
              onChange={(e) => setAddEateryId(e.target.value)}
            >
              <option value="">Add a restaurant…</option>
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Button
              className="bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={addMutation.isPending || !addEateryId}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add stop
                </>
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="h-16 animate-pulse bg-slate-100 rounded" />
        ) : stops.length === 0 ? (
          <p className="text-sm text-gray-500">
            No stops yet. Add restaurants from the catalog.
          </p>
        ) : (
          <ul className="divide-y divide-orange-50 border border-orange-100 rounded-md">
            {stops.map((stop, idx) => {
              const expanded = expandedId === stop.id;
              const guests = stop.guest_count;
              return (
                <li key={stop.id} className="p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">
                          {idx + 1}. {stop.name}
                        </span>
                        {stop.stop_time && (
                          <Badge variant="outline" className="text-xs">
                            {stop.stop_time}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {stop.order_mode}
                        </Badge>
                      </div>
                      {!expanded && (
                        <p className="text-xs text-gray-500 mt-1">
                          {normalizeOrderLines(stop.order_lines)
                            .map((l) => formatOrderLine(l, guests))
                            .join(' · ') || 'No order lines'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedId(expanded ? null : stop.id)
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === 0}
                            onClick={() => moveStop(stop, 'up')}
                          >
                            Up
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === stops.length - 1}
                            onClick={() => moveStop(stop, 'down')}
                          >
                            Down
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(stop.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="space-y-3 border-t border-orange-50 pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Stop time</Label>
                          <Input
                            disabled={!canEdit}
                            placeholder="5:45 PM"
                            defaultValue={stop.stop_time || ''}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (stop.stop_time || '')) {
                                updateMutation.mutate({
                                  stopId: stop.id,
                                  patch: { stop_time: v || null },
                                });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Guest count</Label>
                          <Input
                            type="number"
                            min={1}
                            disabled={!canEdit}
                            defaultValue={stop.guest_count ?? ''}
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              const next = Number.isFinite(n) && n > 0 ? n : null;
                              if (next !== stop.guest_count) {
                                updateMutation.mutate({
                                  stopId: stop.id,
                                  patch: { guest_count: next },
                                });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Order mode</Label>
                          <select
                            disabled={!canEdit}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={stop.order_mode || 'PRE-ORDERED'}
                            onChange={(e) =>
                              updateMutation.mutate({
                                stopId: stop.id,
                                patch: { order_mode: e.target.value },
                              })
                            }
                          >
                            {ORDER_MODES.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Time label</Label>
                          <select
                            disabled={!canEdit}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={stop.time_label || 'Reservation Time'}
                            onChange={(e) =>
                              updateMutation.mutate({
                                stopId: stop.id,
                                patch: { time_label: e.target.value },
                              })
                            }
                          >
                            {TIME_LABELS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Alcohol / drink option</Label>
                          <Input
                            disabled={!canEdit}
                            defaultValue={stop.drink_option || ''}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (stop.drink_option || '')) {
                                updateMutation.mutate({
                                  stopId: stop.id,
                                  patch: { drink_option: v || null },
                                });
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Order lines</Label>
                        {normalizeOrderLines(stop.order_lines).map((line, i) => (
                          <div
                            key={`${stop.id}-line-${i}`}
                            className="grid grid-cols-12 gap-1 items-center"
                          >
                            <Input
                              className="col-span-5 text-sm"
                              disabled={!canEdit}
                              defaultValue={line.label}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== line.label) {
                                  patchLine(stop, i, 'label', v);
                                }
                              }}
                            />
                            <Input
                              className="col-span-2 text-sm"
                              type="number"
                              min={0}
                              disabled={!canEdit}
                              title="Serves this many guests per order"
                              placeholder="Per"
                              defaultValue={line.perGuests ?? ''}
                              onBlur={(e) => {
                                const raw = e.target.value;
                                const next =
                                  raw === '' ? null : Number(raw) || null;
                                if (next !== line.perGuests) {
                                  patchLine(stop, i, 'perGuests', next);
                                }
                              }}
                            />
                            <Input
                              className="col-span-4 text-sm"
                              disabled={!canEdit}
                              placeholder="Note"
                              defaultValue={line.note || ''}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (line.note || '')) {
                                  patchLine(stop, i, 'note', v || null);
                                }
                              }}
                            />
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="col-span-1 px-1"
                                onClick={() => removeLine(stop, i)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <p className="col-span-12 text-[11px] text-gray-500 -mt-0.5">
                              BEO: {formatOrderLine(line, guests)}
                            </p>
                          </div>
                        ))}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addLine(stop)}
                          >
                            Add line
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </OpsPanelShell>
  );
}
