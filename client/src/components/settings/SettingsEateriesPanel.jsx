import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import {
  ORDER_MODES,
  TIME_LABELS,
  normalizeOrderLines,
  perGuestsLabel,
} from '@/lib/eateryOrders';

const EMPTY_LINE = { label: '', perGuests: 1, note: '' };

function emptyForm() {
  return {
    name: '',
    address: '',
    time_label: 'Reservation Time',
    order_mode: 'PRE-ORDERED',
    drink_option: '',
    order_key_dishes: '',
    notes: '',
    order_lines: [{ ...EMPTY_LINE }],
  };
}

function formFromEatery(row) {
  const lines = Array.isArray(row.order_lines) ? row.order_lines : [];
  return {
    name: row.name || '',
    address: row.address || '',
    time_label: row.time_label || 'Reservation Time',
    order_mode: row.order_mode || 'PRE-ORDERED',
    drink_option: row.drink_option || '',
    order_key_dishes: row.order_key_dishes || '',
    notes: row.notes || '',
    order_lines: lines.length
      ? lines.map((l) => ({
          label: l.label || '',
          perGuests: l.perGuests == null ? '' : l.perGuests,
          note: l.note || '',
        }))
      : [{ ...EMPTY_LINE }],
  };
}

/**
 * Admin/Ops CRUD for the food-tour restaurant catalog and their order schemes.
 */
export default function SettingsEateriesPanel() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { data: eateries = [], isLoading } = useQuery({
    queryKey: ['eateries-all'],
    queryFn: async () => {
      const rows = await base44.entities.Eatery.list('sort_order', 200);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const sorted = useMemo(
    () =>
      [...eateries].sort(
        (a, b) =>
          (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
          String(a.name || '').localeCompare(String(b.name || ''))
      ),
    [eateries]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['eateries-all'] });
    queryClient.invalidateQueries({ queryKey: ['eateries-active'] });
  };

  const payloadFromForm = () => {
    const name = form.name.trim();
    if (!name) throw new Error('Name is required');
    return {
      name,
      address: form.address.trim() || null,
      time_label: form.time_label,
      order_mode: form.order_mode,
      drink_option: form.drink_option.trim() || null,
      order_key_dishes: form.order_key_dishes.trim() || null,
      notes: form.notes.trim() || null,
      order_lines: normalizeOrderLines(form.order_lines),
    };
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const maxSort = eateries.reduce(
        (m, r) => Math.max(m, Number(r.sort_order) || 0),
        0
      );
      return base44.entities.Eatery.create({
        ...payloadFromForm(),
        sort_order: maxSort + 10,
        is_active: true,
      });
    },
    onSuccess: () => {
      setCreating(false);
      setForm(emptyForm());
      invalidate();
      toast.success('Eatery added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add eatery'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }) => base44.entities.Eatery.update(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success('Eatery updated');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to update eatery'),
  });

  const startEdit = (row) => {
    setCreating(false);
    setExpandedId(row.id);
    setForm(formFromEatery(row));
  };

  const startCreate = () => {
    setExpandedId(null);
    setCreating(true);
    setForm(emptyForm());
  };

  const setLine = (idx, patch) => {
    setForm((f) => {
      const next = [...f.order_lines];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, order_lines: next };
    });
  };

  const addLine = () =>
    setForm((f) => ({ ...f, order_lines: [...f.order_lines, { ...EMPTY_LINE }] }));

  const removeLine = (idx) =>
    setForm((f) => ({
      ...f,
      order_lines: f.order_lines.filter((_, i) => i !== idx),
    }));

  const orderLinesEditor = (
    <div className="space-y-2">
      <Label className="text-xs">Order lines</Label>
      {form.order_lines.map((line, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row gap-2 items-start bg-white border border-orange-100 rounded-md p-2"
        >
          <Input
            className="flex-1 text-sm"
            placeholder="Dish (e.g. Fire Cracker Shrimp)"
            value={line.label}
            onChange={(e) => setLine(idx, { label: e.target.value })}
          />
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="0"
              className="w-20 text-sm"
              placeholder="per"
              value={line.perGuests ?? ''}
              onChange={(e) => setLine(idx, { perGuests: e.target.value })}
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {perGuestsLabel(line.perGuests)}
            </span>
          </div>
          <Input
            className="sm:w-56 text-sm"
            placeholder="Note (dietary, etc.)"
            value={line.note}
            onChange={(e) => setLine(idx, { note: e.target.value })}
          />
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => removeLine(idx)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addLine}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add line
      </Button>
      <p className="text-xs text-gray-500">
        Leave the number blank for an instruction with no quantity. Otherwise it
        is how many guests one order serves.
      </p>
    </div>
  );

  const formFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="The Tombs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Address</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="1226 36th St NW"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time label</Label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={form.time_label}
            onChange={(e) =>
              setForm((f) => ({ ...f, time_label: e.target.value }))
            }
          >
            {TIME_LABELS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Order mode</Label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={form.order_mode}
            onChange={(e) =>
              setForm((f) => ({ ...f, order_mode: e.target.value }))
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

      {orderLinesEditor}

      <div className="space-y-1">
        <Label className="text-xs">Drink option</Label>
        <Input
          value={form.drink_option}
          onChange={(e) =>
            setForm((f) => ({ ...f, drink_option: e.target.value }))
          }
          placeholder="Prosecco / QR code menu"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Order key dishes (BEO summary table)</Label>
        <Textarea
          rows={2}
          className="resize-y"
          value={form.order_key_dishes}
          onChange={(e) =>
            setForm((f) => ({ ...f, order_key_dishes: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          rows={2}
          className="resize-y"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <Utensils className="w-5 h-5 text-[#C84B31]" />
          Food tour eateries
        </CardTitle>
        <CardDescription>
          Restaurants and their standing order schemes. Selected stops on a food
          tour event pull these lines and scale quantities to the guest count.
          Run <code>npm run db:seed-eateries</code> to load the standard list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <div className="border border-orange-100 rounded-md p-3 bg-[#FFF9F0]/50 space-y-3">
            {formFields}
            <div className="flex gap-2">
              <Button
                className="bg-[#C84B31] hover:bg-[#A03A23]"
                disabled={createMutation.isPending || !form.name.trim()}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Create eatery'
                )}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={startCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Add eatery
          </Button>
        )}

        {isLoading ? (
          <div className="h-16 animate-pulse bg-slate-100 rounded" />
        ) : (
          <ul className="divide-y divide-orange-50 border border-orange-100 rounded-md">
            {sorted.map((row) => {
              const expanded = expandedId === row.id;
              const lineCount = Array.isArray(row.order_lines)
                ? row.order_lines.length
                : 0;

              return (
                <li key={row.id} className="p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">
                        {row.name}
                      </span>
                      {row.is_active === false && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {row.order_mode}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {lineCount} line{lineCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (expanded) {
                            setExpandedId(null);
                          } else {
                            startEdit(row);
                          }
                        }}
                      >
                        Edit
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-1" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-1" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: row.id,
                            patch: { is_active: row.is_active === false },
                          })
                        }
                      >
                        {row.is_active === false ? 'Activate' : 'Deactivate'}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border border-orange-100 rounded-lg p-3 bg-[#FFF9F0]/50 space-y-3">
                      {formFields}
                      <Button
                        size="sm"
                        className="bg-[#C84B31] hover:bg-[#A03A23]"
                        disabled={updateMutation.isPending || !form.name.trim()}
                        onClick={() => {
                          try {
                            updateMutation.mutate({
                              id: row.id,
                              patch: payloadFromForm(),
                            });
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        Save changes
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
            {sorted.length === 0 && (
              <li className="p-4 text-sm text-gray-500">
                No eateries yet. Run <code>npm run db:seed-eateries</code> or add
                one above.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
