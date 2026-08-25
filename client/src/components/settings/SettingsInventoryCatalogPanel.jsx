import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, Plus, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '',
  experience_keys: ['In-Person Cooking'],
  default_vendor_id: '',
  notes: '',
  is_active: true,
  purchase_links: [{ label: '', url: '' }],
};

function normalizeLinks(links) {
  return (links || [])
    .map((l) => ({
      label: (l.label || '').trim() || 'Buy',
      url: (l.url || '').trim(),
    }))
    .filter((l) => l.url);
}

function slugSkuKey(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return base || `item_${Date.now()}`;
}

function itemExperienceKeys(item) {
  if (Array.isArray(item?.experience_keys) && item.experience_keys.length) {
    return item.experience_keys;
  }
  if (item?.experience_key) return [item.experience_key];
  return [];
}

/**
 * Admin CRUD for inventory catalog items + purchase links (plan 08).
 * Experience is a multi-select checklist (experience_keys).
 */
export default function SettingsInventoryCatalogPanel() {
  const queryClient = useQueryClient();
  const [experienceFilter, setExperienceFilter] = useState('In-Person Cooking');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-catalog-all'],
    queryFn: async () => {
      const rows = await base44.entities.InventoryCatalogItem.list(
        'sort_order',
        500
      );
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: async () => {
      const rows = await base44.entities.Vendor.filter(
        { is_active: true },
        'name'
      );
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: matrixExperiences = [] } = useQuery({
    queryKey: ['experience-matrix'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getExperienceMatrix', {});
      const body = res?.data ?? res;
      const list = body?.experiences ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const experienceOptions = useMemo(() => {
    if (matrixExperiences.length > 0) {
      return matrixExperiences.map((r) => ({
        key: r.experienceKey || r.experience_key,
        label: r.displayName || r.display_name || r.experienceKey,
      }));
    }
    return [{ key: 'In-Person Cooking', label: 'In-Person Cooking Class' }];
  }, [matrixExperiences]);

  const filtered = useMemo(() => {
    if (!experienceFilter || experienceFilter === '__all__') return items;
    return items.filter((i) =>
      itemExperienceKeys(i).includes(experienceFilter)
    );
  }, [items, experienceFilter]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-catalog-all'] });
  };

  const toggleExperience = (key, checked) => {
    setForm((f) => {
      const set = new Set(f.experience_keys || []);
      if (checked) set.add(key);
      else set.delete(key);
      return { ...f, experience_keys: [...set] };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      experience_keys:
        experienceFilter && experienceFilter !== '__all__'
          ? [experienceFilter]
          : ['In-Person Cooking'],
    });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    const links =
      Array.isArray(item.purchase_links) && item.purchase_links.length
        ? item.purchase_links.map((l) => ({
            label: l.label || '',
            url: l.url || '',
          }))
        : [{ label: '', url: '' }];
    const keys = itemExperienceKeys(item);
    setForm({
      name: item.name || '',
      experience_keys: keys.length ? keys : ['In-Person Cooking'],
      default_vendor_id: item.default_vendor_id || '',
      notes: item.notes || '',
      is_active: item.is_active !== false,
      purchase_links: links,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) {
        throw new Error('Name is required');
      }
      const experience_keys = (form.experience_keys || []).filter(Boolean);
      if (experience_keys.length === 0) {
        throw new Error('Select at least one experience');
      }
      const nextSort =
        filtered.reduce((m, i) => Math.max(m, Number(i.sort_order) || 0), 0) +
        1;
      const payload = {
        name,
        experience_keys,
        default_vendor_id: form.default_vendor_id || null,
        notes: form.notes.trim() || null,
        is_active: Boolean(form.is_active),
        purchase_links: normalizeLinks(form.purchase_links),
      };
      if (editingId) {
        return base44.entities.InventoryCatalogItem.update(editingId, payload);
      }
      return base44.entities.InventoryCatalogItem.create({
        ...payload,
        sku_key: `${slugSkuKey(name)}_${Date.now().toString(36)}`,
        sort_order: nextSort,
      });
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
      toast.success(editingId ? 'Item updated' : 'Item created');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Save failed'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      base44.entities.InventoryCatalogItem.update(id, { is_active }),
    onSuccess: () => {
      invalidate();
      toast.success('Updated');
    },
    onError: () => toast.error('Failed to update item'),
  });

  const setLink = (idx, patch) => {
    setForm((f) => {
      const next = [...f.purchase_links];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, purchase_links: next };
    });
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <Package className="w-5 h-5 text-[#C84B31]" />
          Inventory catalog
        </CardTitle>
        <CardDescription>
          Add/remove items and edit purchase links. Assign each item to one or
          more experiences. Event checklists load items that include that
          experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end justify-between">
          <div className="space-y-1">
            <Label>Filter by experience</Label>
            <select
              className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
            >
              <option value="__all__">All experiences</option>
              {experienceOptions.map((ex) => (
                <option key={ex.key} value={ex.key}>
                  {ex.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="bg-[#C84B31] hover:bg-[#A03A23]"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add item
          </Button>
        </div>

        {isLoading ? (
          <div className="h-24 animate-pulse bg-slate-100 rounded" />
        ) : (
          <div className="overflow-x-auto border border-orange-100 rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b bg-[#FFF9F0]">
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Experiences</th>
                  <th className="p-2 font-medium">Links</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const keys = itemExperienceKeys(item);
                  return (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="p-2 font-medium text-gray-800">
                        {item.name}
                      </td>
                      <td className="p-2 text-xs text-gray-600 max-w-[220px]">
                        {keys.length ? keys.join(', ') : '—'}
                      </td>
                      <td className="p-2 text-xs">
                        {(item.purchase_links || []).length
                          ? (item.purchase_links || [])
                              .map((l) => l.label || 'Link')
                              .join(', ')
                          : '—'}
                      </td>
                      <td className="p-2">
                        {item.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </td>
                      <td className="p-2 text-right space-x-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={toggleActiveMutation.isPending}
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: item.id,
                              is_active: !item.is_active,
                            })
                          }
                        >
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-gray-500 text-sm">
                      No catalog items for this filter. Seed inventory or add
                      one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit catalog item' : 'New catalog item'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Experiences *</Label>
                <p className="text-xs text-gray-500">
                  Check every experience this item should appear on.
                </p>
                <div className="max-h-48 overflow-y-auto border border-orange-100 rounded-md p-3 space-y-2">
                  {experienceOptions.map((ex) => {
                    const checked = (form.experience_keys || []).includes(
                      ex.key
                    );
                    return (
                      <label
                        key={ex.key}
                        className="flex items-start gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            toggleExperience(ex.key, Boolean(v))
                          }
                          className="mt-0.5"
                        />
                        <span>{ex.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Default vendor</Label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={form.default_vendor_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      default_vendor_id: e.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase links</Label>
                {form.purchase_links.map((link, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      className="w-28"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => setLink(idx, { label: e.target.value })}
                    />
                    <Input
                      className="flex-1"
                      placeholder="https://…"
                      value={link.url}
                      onChange={(e) => setLink(idx, { url: e.target.value })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          purchase_links: f.purchase_links.filter(
                            (_, i) => i !== idx
                          ),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      purchase_links: [
                        ...f.purchase_links,
                        { label: '', url: '' },
                      ],
                    }))
                  }
                >
                  Add link
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#C84B31] hover:bg-[#A03A23]"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
