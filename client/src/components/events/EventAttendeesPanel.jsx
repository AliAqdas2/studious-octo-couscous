import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Upload, Users, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';

/**
 * Instructor + guest list for the BEO (manual, Excel/CSV, Google Sheet).
 */
export default function EventAttendeesPanel({
  eventId,
  event,
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [draft, setDraft] = useState({ name: '', allergies: '', phone: '' });
  const [sheetUrl, setSheetUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    allergies: '',
    phone: '',
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors-active'],
    queryFn: async () => {
      const rows = await base44.entities.Instructor.filter(
        { is_active: true },
        'sort_order',
        200
      );
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventAttendees', {
        eventId,
      });
      return res?.data ?? res;
    },
    enabled: Boolean(eventId),
  });

  const attendees = useMemo(
    () => (Array.isArray(data?.attendees) ? data.attendees : []),
    [data]
  );

  const instructorId = event?.instructor_id || '';

  const invalidateGuests = () => {
    queryClient.invalidateQueries(['event-attendees', eventId]);
    queryClient.invalidateQueries(['beo-document', eventId]);
  };

  const instructorMutation = useMutation({
    mutationFn: async (nextId) => {
      await base44.entities.Event.update(eventId, {
        instructor_id: nextId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['beo-document', eventId]);
      toast.success('Instructor updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update instructor'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createEventAttendee', {
        eventId,
        name: draft.name,
        allergies: draft.allergies,
        phone: draft.phone,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      setDraft({ name: '', allergies: '', phone: '' });
      invalidateGuests();
      toast.success('Attendee added');
    },
    onError: (err) => toast.error(err?.message || 'Failed to add attendee'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('updateEventAttendee', {
        eventId,
        attendeeId: editingId,
        name: editDraft.name,
        allergies: editDraft.allergies,
        phone: editDraft.phone,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      setEditingId(null);
      invalidateGuests();
      toast.success('Attendee updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (attendeeId) => {
      const res = await base44.functions.invoke('deleteEventAttendee', {
        eventId,
        attendeeId,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      invalidateGuests();
      toast.success('Attendee removed');
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete'),
  });

  const importFileMutation = useMutation({
    mutationFn: async (file) => {
      const res = await base44.functions.invoke('importEventAttendeesFile', {
        eventId,
        file,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      invalidateGuests();
      toast.success(`Imported ${body?.imported ?? 0} attendees`);
    },
    onError: (err) => toast.error(err?.message || 'Import failed'),
  });

  const importSheetMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('importEventAttendeesSheet', {
        eventId,
        url: sheetUrl,
      });
      return res?.data ?? res;
    },
    onSuccess: (body) => {
      setSheetUrl('');
      invalidateGuests();
      toast.success(`Imported ${body?.imported ?? 0} attendees`);
    },
    onError: (err) => toast.error(err?.message || 'Sheet import failed'),
  });

  const busy =
    instructorMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    importFileMutation.isPending ||
    importSheetMutation.isPending;

  const confirmReplace = () =>
    window.confirm(
      'Import will replace the current attendee list. Continue?'
    );

  return (
    <OpsPanelShell
      title="Instructor & attendees"
      icon={Users}
      complete={Boolean(instructorId) && attendees.length > 0}
      doneBadge={Boolean(instructorId) && attendees.length > 0}
      milestoneLabel={
        attendees.length
          ? `${attendees.length} guest${attendees.length === 1 ? '' : 's'}`
          : instructorId
            ? 'Guests pending'
            : null
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="text-sm font-medium shrink-0 sm:w-28">
            Instructor
          </Label>
          <select
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={instructorId}
            disabled={!canEdit || instructorMutation.isPending}
            onChange={(e) => instructorMutation.mutate(e.target.value || null)}
          >
            <option value="">Select instructor…</option>
            {instructors.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Bio is pulled into the BEO from Settings → Instructors.
        </p>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Guest list</p>
          <p className="text-xs text-gray-500 -mt-2">
            Name, allergies, and phone fill the BEO table. Import replaces the
            current list.
          </p>

          {isLoading ? (
            <div className="h-16 animate-pulse bg-slate-100 rounded" />
          ) : (
            <div className="overflow-x-auto rounded-md border border-orange-100">
              <table className="w-full text-sm">
                <thead className="bg-orange-50/80 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Allergies</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    {canEdit ? (
                      <th className="px-3 py-2 font-medium w-28"> </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {attendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 4 : 3}
                        className="px-3 py-5 text-center text-gray-500"
                      >
                        No attendees yet.
                      </td>
                    </tr>
                  ) : (
                    attendees.map((row) => {
                      const isEditing = editingId === row.id;
                      return (
                        <tr key={row.id} className="border-t">
                          {isEditing ? (
                            <>
                              <td className="px-2 py-1">
                                <Input
                                  value={editDraft.name}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      name: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  value={editDraft.allergies}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      allergies: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  value={editDraft.phone}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      phone: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={busy || !editDraft.name.trim()}
                                    onClick={() => updateMutation.mutate()}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2">{row.name}</td>
                              <td className="px-3 py-2 text-gray-600">
                                {row.allergies || '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {row.phone || '—'}
                              </td>
                              {canEdit ? (
                                <td className="px-2 py-1">
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                      disabled={busy}
                                      onClick={() => {
                                        setEditingId(row.id);
                                        setEditDraft({
                                          name: row.name || '',
                                          allergies: row.allergies || '',
                                          phone: row.phone || '',
                                        });
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-red-600"
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Remove ${row.name} from the list?`
                                          )
                                        ) {
                                          deleteMutation.mutate(row.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {canEdit ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="Allergies"
                  value={draft.allergies}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, allergies: e.target.value }))
                  }
                />
                <Input
                  placeholder="Phone"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, phone: e.target.value }))
                  }
                />
                <Button
                  disabled={busy || !draft.name.trim()}
                  onClick={() => createMutation.mutate()}
                  className="bg-[#C84B31] hover:bg-[#A03A23] shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (!confirmReplace()) return;
                    importFileMutation.mutate(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {importFileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Import Excel / CSV
                </Button>
                <Input
                  placeholder="Google Sheet URL"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !sheetUrl.trim()}
                  onClick={() => {
                    if (!confirmReplace()) return;
                    importSheetMutation.mutate();
                  }}
                >
                  {importSheetMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Import sheet
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Headers: Name, Allergies (or Dietary), Phone. Sheet must be
                shared or published as CSV — not a private Drive Doc.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </OpsPanelShell>
  );
}
