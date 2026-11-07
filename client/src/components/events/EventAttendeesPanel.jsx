import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Upload, Users, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import SettingsCatalogLink from '@/components/settings/SettingsCatalogLink';
import { attendeesComplete } from '@/lib/opsPanelCompletion';
import { useUnsavedBeforeUnload } from '@/lib/useUnsavedNavigation';

/**
 * Group leaders + Attendee List for the BEO (CRM-13).
 */
export default function EventAttendeesPanel({
  eventId,
  event,
  canEdit = false,
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [draft, setDraft] = useState({
    name: '',
    allergies: '',
    phone: '',
    email: '',
  });
  const [sheetUrl, setSheetUrl] = useState('');
  const [supportStaffDraft, setSupportStaffDraft] = useState(
    () => event?.support_staff || event?.supportStaff || ''
  );
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    allergies: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    setSupportStaffDraft(event?.support_staff || event?.supportStaff || '');
  }, [event?.id, event?.support_staff, event?.supportStaff]);

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

  const panelComplete = attendeesComplete(event, {
    attendeeCount: attendees.length,
  });

  const leader1Id = event?.instructor_id || event?.instructorId || '';
  const leader2Id = event?.instructor_id_2 || event?.instructorId2 || '';

  const supportStaffSaved = (
    event?.support_staff ||
    event?.supportStaff ||
    ''
  ).trim();
  const supportStaffDirty =
    supportStaffDraft.trim() !== supportStaffSaved;
  const leadershipDirty = supportStaffDirty || Boolean(editingId);
  useUnsavedBeforeUnload(leadershipDirty);

  const invalidateGuests = () => {
    queryClient.invalidateQueries(['event-attendees', eventId]);
    queryClient.invalidateQueries(['event', eventId]);
    queryClient.invalidateQueries(['event-tasks', eventId]);
    queryClient.invalidateQueries(['beo-document', eventId]);
    queryClient.invalidateQueries(['deposit-intake', eventId]);
    queryClient.invalidateQueries(['run-of-show', eventId]);
  };

  const leadershipMutation = useMutation({
    mutationFn: async (patch) => {
      await base44.entities.Event.update(eventId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['beo-document', eventId]);
      toast.success('Group leadership updated');
    },
    onError: (err) =>
      toast.error(err?.message || 'Failed to update group leadership'),
  });

  const flushSupportStaffIfNeeded = () => {
    if (!supportStaffDirty || !canEdit) return;
    const next = supportStaffDraft.trim() || null;
    leadershipMutation.mutate({ support_staff: next });
  };

  const setLeader1 = (nextId) => {
    const id = nextId || null;
    const patch = { instructor_id: id };
    if (id && leader2Id && id === leader2Id) {
      patch.instructor_id_2 = null;
    }
    leadershipMutation.mutate(patch);
  };

  const setLeader2 = (nextId) => {
    const id = nextId || null;
    if (id && leader1Id && id === leader1Id) {
      toast.error('Group Leader 2 cannot be the same as Group Leader 1');
      return;
    }
    leadershipMutation.mutate({ instructor_id_2: id });
  };

  const saveSupportStaff = () => {
    const next = supportStaffDraft.trim() || null;
    const current = (event?.support_staff || event?.supportStaff || '').trim() || null;
    if (next === current) return;
    leadershipMutation.mutate({ support_staff: next });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createEventAttendee', {
        eventId,
        name: draft.name,
        allergies: draft.allergies,
        phone: draft.phone,
        email: draft.email,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      setDraft({ name: '', allergies: '', phone: '', email: '' });
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
        email: editDraft.email,
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
    leadershipMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    importFileMutation.isPending ||
    importSheetMutation.isPending;

  const confirmReplace = () =>
    window.confirm(
      'Upload / Replace will replace the current Attendee List. Continue?'
    );

  return (
    <OpsPanelShell
      title="Group Leader"
      icon={Users}
      complete={panelComplete}
      doneBadge={panelComplete}
      milestoneLabel={
        attendees.length
          ? `${attendees.length} guest${attendees.length === 1 ? '' : 's'}`
          : leader1Id
            ? 'Guests pending'
            : null
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Group Leader 1</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={leader1Id}
              disabled={!canEdit || leadershipMutation.isPending}
              onChange={(e) => setLeader1(e.target.value || null)}
            >
              <option value="">Select group leader…</option>
              {instructors.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Group Leader 2 (Optional)
            </Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={leader2Id}
              disabled={!canEdit || leadershipMutation.isPending}
              onChange={(e) => setLeader2(e.target.value || null)}
            >
              <option value="">N/A</option>
              {instructors
                .filter((row) => row.id !== leader1Id)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Support Staff</Label>
            <Textarea
              rows={2}
              value={supportStaffDraft}
              disabled={!canEdit || leadershipMutation.isPending}
              onChange={(e) => setSupportStaffDraft(e.target.value)}
              onBlur={saveSupportStaff}
              placeholder="Names only — no bio in the BEO"
              className="resize-y min-h-[60px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-gray-500">
              Bios come from Settings → Group Leaders. Support Staff is text
              only.
            </p>
            <SettingsCatalogLink
              hash="settings-group-leaders"
              label="Add more in Settings"
              dirty={Boolean(editingId)}
              onBeforeNavigate={flushSupportStaffIfNeeded}
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Attendee List</p>
          <p className="text-xs text-gray-500 -mt-2">
            Name, allergies, phone number, and email fill the BEO table. Upload /
            Replace or Import updates every event surface that uses this list.
          </p>
          {(data?.attendee_list_updated_at ||
            event?.attendee_list_updated_at ||
            event?.attendeeListUpdatedAt) && (
            <p className="text-xs text-gray-600">
              Last updated{' '}
              {new Date(
                data?.attendee_list_updated_at ||
                  event?.attendee_list_updated_at ||
                  event?.attendeeListUpdatedAt
              ).toLocaleString()}
              {(data?.attendee_list_updated_by_name ||
                event?.attendee_list_updated_by_name ||
                event?.attendeeListUpdatedByName) &&
                ` by ${
                  data?.attendee_list_updated_by_name ||
                  event?.attendee_list_updated_by_name ||
                  event?.attendeeListUpdatedByName
                }`}
            </p>
          )}

          {isLoading ? (
            <div className="h-16 animate-pulse bg-slate-100 rounded" />
          ) : (
            <div className="overflow-x-auto rounded-md border border-orange-100">
              <table className="w-full text-sm">
                <thead className="bg-orange-50/80 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Allergies</th>
                    <th className="px-3 py-2 font-medium">Phone Number</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    {canEdit ? (
                      <th className="px-3 py-2 font-medium w-28"> </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {attendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 5 : 4}
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
                                  placeholder="Phone Number"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  value={editDraft.email}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      email: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                  placeholder="Email"
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
                              <td className="px-3 py-2 text-gray-600">
                                {row.email || '—'}
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
                                          email: row.email || '',
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
                  placeholder="Phone Number"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, phone: e.target.value }))
                  }
                />
                <Input
                  placeholder="Email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, email: e.target.value }))
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
                  Upload / Replace
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
                  Import
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Headers: Name, Allergies (or Dietary), Phone Number (or Phone),
                Email. Sheet must be shared or published as CSV — not a private
                Drive Doc. Import replaces the current Attendee List.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </OpsPanelShell>
  );
}
