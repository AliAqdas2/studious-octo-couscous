import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin CRUD for house venues (plan 08). "Other" is not stored — UI escape hatch only.
 */
export default function SettingsVenuesPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-all'],
    queryFn: async () => {
      const rows = await base44.entities.Venue.list('sort_order', 200);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['venues-all'] });
    queryClient.invalidateQueries({ queryKey: ['venues-active'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name is required');
      const maxSort = venues.reduce(
        (m, v) => Math.max(m, Number(v.sort_order) || 0),
        0
      );
      return base44.entities.Venue.create({
        name: trimmed,
        sort_order: maxSort + 1,
        is_active: true,
      });
    },
    onSuccess: () => {
      setName('');
      invalidate();
      toast.success('Venue added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add venue'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }) =>
      base44.entities.Venue.update(id, patch),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success('Venue updated');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to update venue'),
  });

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <MapPin className="w-5 h-5 text-[#C84B31]" />
          House venues
        </CardTitle>
        <CardDescription>
          Shared list for Lead Detail, Deposit Intake, and event forms. Deactivate
          instead of deleting so past events keep their free-text name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-venue">Add venue</Label>
            <Input
              id="new-venue"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
            />
          </div>
          <Button
            className="sm:self-end bg-[#C84B31] hover:bg-[#A03A23]"
            disabled={createMutation.isPending || !name.trim()}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="h-16 animate-pulse bg-slate-100 rounded" />
        ) : (
          <ul className="divide-y divide-orange-50 border border-orange-100 rounded-md">
            {venues.map((v) => (
              <li
                key={v.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3"
              >
                <div className="flex-1 min-w-0">
                  {editingId === v.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="max-w-md"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">
                        {v.name}
                      </span>
                      {!v.is_active && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingId === v.id ? (
                    <>
                      <Button
                        size="sm"
                        disabled={updateMutation.isPending || !editName.trim()}
                        onClick={() =>
                          updateMutation.mutate({
                            id: v.id,
                            patch: { name: editName.trim() },
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(v.id);
                          setEditName(v.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: v.id,
                            patch: { is_active: !v.is_active },
                          })
                        }
                      >
                        {v.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {venues.length === 0 && (
              <li className="p-4 text-sm text-gray-500">
                No venues yet. Run <code>npm run db:seed-venues</code> or add one
                above.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
