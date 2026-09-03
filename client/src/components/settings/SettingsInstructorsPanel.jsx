import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

function sortInstructors(rows) {
  return [...rows].sort(
    (a, b) =>
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
      String(a.name || '').localeCompare(String(b.name || ''))
  );
}

/**
 * Admin/Ops CRUD for standalone instructor bios.
 */
export default function SettingsInstructorsPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructors-all'],
    queryFn: async () => {
      const rows = await base44.entities.Instructor.list('sort_order', 200);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const sorted = useMemo(() => sortInstructors(instructors), [instructors]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['instructors-all'] });
    queryClient.invalidateQueries({ queryKey: ['instructors-active'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Name is required');
      const maxSort = instructors.reduce(
        (m, row) => Math.max(m, Number(row.sort_order) || 0),
        0
      );
      return base44.entities.Instructor.create({
        name: trimmedName,
        bio: bio.trim(),
        sort_order: maxSort + 1,
        is_active: true,
      });
    },
    onSuccess: () => {
      setName('');
      setBio('');
      invalidate();
      toast.success('Instructor added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add instructor'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }) =>
      base44.entities.Instructor.update(id, patch),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success('Instructor updated');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to update instructor'),
  });

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditName(row.name || '');
    setEditBio(row.bio || '');
    setExpandedId(row.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditBio('');
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <GraduationCap className="w-5 h-5 text-[#C84B31]" />
          Instructors
        </CardTitle>
        <CardDescription>
          Instructor names and bios for ops and event materials. Run{' '}
          <code>npm run db:seed-instructors</code> to load the bundled list, or
          add profiles below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border border-orange-100 rounded-md p-3">
          <Label htmlFor="new-instructor-name">Add instructor</Label>
          <Input
            id="new-instructor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Bio"
            rows={4}
            className="resize-y"
          />
          <Button
            className="bg-[#C84B31] hover:bg-[#A03A23]"
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
            {sorted.map((row) => {
              const expanded = expandedId === row.id;
              const isEditing = editingId === row.id;

              return (
                <li key={row.id} className="p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Name"
                          />
                          <Textarea
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            rows={6}
                            className="resize-y"
                          />
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 truncate">
                            {row.name}
                          </span>
                          {!row.is_active && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {!isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedId(expanded ? null : row.id)
                          }
                        >
                          Bio
                          {expanded ? (
                            <ChevronUp className="w-3.5 h-3.5 ml-1" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 ml-1" />
                          )}
                        </Button>
                      )}
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            disabled={
                              updateMutation.isPending || !editName.trim()
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: row.id,
                                patch: {
                                  name: editName.trim(),
                                  bio: editBio.trim(),
                                },
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
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
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && expanded && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap border-t border-orange-50 pt-2">
                      {row.bio?.trim() ? row.bio : 'No bio yet.'}
                    </p>
                  )}
                </li>
              );
            })}
            {sorted.length === 0 && (
              <li className="p-4 text-sm text-gray-500">
                No instructors yet. Run{' '}
                <code>npm run db:seed-instructors</code> or add one above.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
