import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Package, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { getPanelMilestoneLabel } from '@/lib/eventMilestones';

function cloneItems(items) {
  return (items || []).map((i) => ({ ...i }));
}

function flag(v) {
  return v ? '✓' : '—';
}

function VendorLinks({ item }) {
  return (
    <div className="min-w-[140px]">
      {item.vendor_name && (
        <div className="text-xs text-gray-700">{item.vendor_name}</div>
      )}
      <div className="flex flex-wrap gap-1 mt-0.5">
        {(item.purchase_links || []).map((link, idx) =>
          link?.url ? (
            <a
              key={`${link.label}-${idx}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-[#C84B31] hover:underline"
            >
              {link.label || 'Buy'}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : null
        )}
        {!item.purchase_links?.length && item.purchase_url ? (
          <a
            href={item.purchase_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-xs text-[#C84B31] hover:underline"
          >
            Link
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-event inventory checklist.
 * Read-only table by default; Edit → draft → Save returns to clean table.
 */
export default function EventInventoryChecklist({
  eventId,
  event = null,
  experienceKey = 'In-Person Cooking',
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState('catalog');
  const [catalogPick, setCatalogPick] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event-inventory', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventInventory', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const items = data?.items ?? [];
  const summary = data?.summary;

  useEffect(() => {
    if (!isEditing) {
      setDraft(cloneItems(items));
    }
  }, [items, isEditing]);

  useEffect(() => {
    // Empty checklist: open edit so staff can Load catalog / Add
    if (canEdit && items.length === 0 && !isLoading) {
      setIsEditing(true);
      setDraft([]);
    }
  }, [canEdit, items.length, isLoading]);

  const COOKING_EXPERIENCE_KEY = 'In-Person Cooking';

  const { data: catalog = [] } = useQuery({
    queryKey: ['inventory-catalog-for-experience', experienceKey],
    queryFn: async () => {
      const rows = await base44.entities.InventoryCatalogItem.filter(
        { is_active: true },
        'sort_order'
      );
      const list = Array.isArray(rows) ? rows : [];
      const keysOf = (c) =>
        Array.isArray(c.experience_keys)
          ? c.experience_keys
          : c.experience_key
            ? [c.experience_key]
            : [];
      const forExperience = list.filter((c) =>
        keysOf(c).includes(experienceKey)
      );
      if (forExperience.length > 0) return forExperience;
      if (experienceKey === COOKING_EXPERIENCE_KEY) return [];
      return list.filter((c) => keysOf(c).includes(COOKING_EXPERIENCE_KEY));
    },
    enabled: canEdit && addOpen && !!experienceKey,
  });

  const patchMutation = useMutation({
    mutationFn: async (patches) => {
      const res = await base44.functions.invoke('patchEventInventory', {
        eventId,
        patches,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      queryClient.setQueryData(['event-inventory', eventId], body);
      setIsEditing(false);
      toast.success('Inventory saved');
    },
    onError: () => toast.error('Failed to save inventory'),
  });

  const ensureMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('ensureEventInventory', {
        eventId,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      queryClient.setQueryData(['event-inventory', eventId], body);
      setDraft(cloneItems(body?.items ?? []));
      toast.success('Inventory checklist loaded from catalog');
    },
    onError: () => toast.error('Could not load inventory catalog'),
  });

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('addEventInventory', {
        eventId,
        ...payload,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      queryClient.setQueryData(['event-inventory', eventId], body);
      setDraft(cloneItems(body?.items ?? []));
      setAddOpen(false);
      setCatalogPick('');
      setCustomName('');
      setCustomUrl('');
      toast.success('Item added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add item'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId) => {
      const res = await base44.functions.invoke('deleteEventInventory', {
        eventId,
        itemId,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      queryClient.setQueryData(['event-inventory', eventId], body);
      setDraft(cloneItems(body?.items ?? []));
      toast.success('Item removed');
    },
    onError: () => toast.error('Failed to remove item'),
  });

  const onEventCatalogIds = useMemo(
    () => new Set(items.map((i) => i.catalog_item_id).filter(Boolean)),
    [items]
  );

  const availableCatalog = useMemo(
    () => catalog.filter((c) => !onEventCatalogIds.has(c.id)),
    [catalog, onEventCatalogIds]
  );

  const startEdit = () => {
    setDraft(cloneItems(items));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(cloneItems(items));
    setIsEditing(false);
  };

  const updateDraft = (id, patch) => {
    setDraft((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const saveDraft = () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const patches = [];
    for (const row of draft) {
      const orig = byId.get(row.id);
      if (!orig) continue;
      const patch = { id: row.id };
      let dirty = false;
      for (const field of ['needed', 'ordered', 'received', 'in_office', 'notes']) {
        const a = row[field] ?? (field === 'notes' ? '' : false);
        const b = orig[field] ?? (field === 'notes' ? '' : false);
        if (a !== b) {
          dirty = true;
          if (field === 'in_office') patch.inOffice = Boolean(row.in_office);
          else if (field === 'notes') patch.notes = row.notes || null;
          else patch[field] = Boolean(row[field]);
        }
      }
      const urlA = (row.purchase_url || '').trim() || null;
      const urlB = (orig.purchase_url || '').trim() || null;
      if (urlA !== urlB) {
        dirty = true;
        patch.purchaseUrl = urlA;
      }
      if (dirty) patches.push(patch);
    }
    if (patches.length === 0) {
      setIsEditing(false);
      toast.message('No changes to save');
      return;
    }
    patchMutation.mutate(patches);
  };

  const displayRows = isEditing ? draft : items;
  const hasInventory = (summary?.total ?? items.length) > 0;
  const inventoryComplete = hasInventory && !isEditing;
  const inventoryMilestone = getPanelMilestoneLabel('inventory', event || {}, {
    hasInventory,
  });

  if (isLoading) {
    return (
      <OpsPanelShell title="Inventory checklist" icon={Package} forceOpen>
        <div className="h-24 animate-pulse bg-slate-100 rounded" />
      </OpsPanelShell>
    );
  }

  if (isError) {
    return null;
  }

  return (
    <OpsPanelShell
      title="Inventory checklist"
      icon={Package}
      complete={inventoryComplete}
      forceOpen={isEditing || !hasInventory}
      doneBadge={inventoryComplete}
      milestoneLabel={inventoryMilestone}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {summary ? (
            <p className="text-xs text-gray-500">
              {summary.in_office}/{summary.needed} needed items in office
              {summary.triple_check_ready ? (
                <Badge className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-200">
                  24h triple-check ready
                </Badge>
              ) : null}
            </p>
          ) : (
            <span />
          )}
          {canEdit && (
            <div className="flex gap-2 flex-wrap justify-end">
              {!isEditing ? (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  {hasInventory ? 'View / Edit' : 'Edit'}
                </Button>
              ) : (
                <>
                  {displayRows.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ensureMutation.mutate()}
                      disabled={ensureMutation.isPending}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Load catalog
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add item
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {displayRows.length === 0 ? (
          <p className="text-sm text-gray-500">
            No checklist yet. Generate the event workflow or load the catalog for
            this experience.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-1 pr-2 font-medium">Item</th>
                  <th className="py-1 px-1 font-medium">Needed</th>
                  <th className="py-1 px-1 font-medium">Ordered</th>
                  <th className="py-1 px-1 font-medium">Received</th>
                  <th className="py-1 px-1 font-medium">In office</th>
                  <th className="py-1 pl-2 font-medium">Vendor / link</th>
                  <th className="py-1 pl-2 font-medium">Notes</th>
                  {isEditing && canEdit && (
                    <th className="py-1 pl-2 font-medium" />
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 align-top"
                  >
                    <td className="py-2 pr-2">
                      <div className="font-medium text-gray-800">
                        {item.name}
                      </div>
                    </td>
                    {['needed', 'ordered', 'received', 'in_office'].map(
                      (field) => {
                        const checked = Boolean(item[field]);
                        return (
                          <td key={field} className="py-2 px-1 text-center">
                            {isEditing && canEdit ? (
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  updateDraft(item.id, {
                                    [field]: Boolean(v),
                                  })
                                }
                              />
                            ) : (
                              <span className="text-xs">{flag(checked)}</span>
                            )}
                          </td>
                        );
                      }
                    )}
                    <td className="py-2 pl-2">
                      <VendorLinks item={item} />
                      {isEditing && canEdit && (
                        <Input
                          className="h-7 text-xs mt-1"
                          placeholder="Override purchase URL"
                          value={item.purchase_url || ''}
                          onChange={(e) =>
                            updateDraft(item.id, {
                              purchase_url: e.target.value,
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="py-2 pl-2 max-w-[180px]">
                      {isEditing && canEdit ? (
                        <Input
                          className="h-7 text-xs"
                          placeholder="Notes"
                          value={item.notes || ''}
                          onChange={(e) =>
                            updateDraft(item.id, { notes: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-xs text-gray-600">
                          {item.notes || '—'}
                        </p>
                      )}
                    </td>
                    {isEditing && canEdit && (
                      <td className="py-2 pl-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove “${item.name}” from this event checklist?`
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isEditing && canEdit && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              className="bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={patchMutation.isPending}
              onClick={saveDraft}
            >
              {patchMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-500 pt-1">
          24h before: confirm every needed row is in office, then set Acquire Ice
          Y/N on the ice task.
        </p>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add inventory item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={addMode === 'catalog' ? 'default' : 'outline'}
                onClick={() => setAddMode('catalog')}
              >
                From catalog
              </Button>
              <Button
                size="sm"
                variant={addMode === 'custom' ? 'default' : 'outline'}
                onClick={() => setAddMode('custom')}
              >
                Custom
              </Button>
            </div>
            {addMode === 'catalog' ? (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={catalogPick}
                onChange={(e) => setCatalogPick(e.target.value)}
              >
                <option value="">Select catalog item…</option>
                {availableCatalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <Input
                  placeholder="Item name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <Input
                  placeholder="Purchase URL (optional)"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#C84B31] hover:bg-[#A03A23]"
              disabled={addMutation.isPending}
              onClick={() => {
                if (addMode === 'catalog') {
                  if (!catalogPick) {
                    toast.error('Pick a catalog item');
                    return;
                  }
                  addMutation.mutate({ catalogItemId: catalogPick });
                } else {
                  if (!customName.trim()) {
                    toast.error('Name is required');
                    return;
                  }
                  addMutation.mutate({
                    name: customName.trim(),
                    purchaseUrl: customUrl.trim() || null,
                  });
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OpsPanelShell>
  );
}
