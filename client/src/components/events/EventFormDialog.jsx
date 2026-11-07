import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  CUSTOM_VENUE_LABEL,
  CUSTOM_VENUE_OPTION,
  CustomVenueFields,
  PromoteVenueButton,
} from '@/components/venues/CustomVenueFields';
import { canAccessOpsSettings } from '@/lib/operationalAccess';
import SettingsCatalogLink from '@/components/settings/SettingsCatalogLink';
import {
  confirmLeave,
  useUnsavedBeforeUnload,
} from '@/lib/useUnsavedNavigation';

/** CRM event_type enum values (events.event_type). */
export const CRM_EVENT_TYPE_OPTIONS = [
  'In-Person Cooking',
  'In-Person Mixology',
  'In-Person Private Monuments',
  'In-Person Paint & Sip',
  'In-Person Private Food Tour',
  'In-Person Yoga & UnWined',
  'Virtual Mixology',
  'Virtual Paint & Sip',
  'In-Person Pottery',
  'In-Person Terrarium',
  'Flavors of DC',
  'In-Person Chocolate Making',
  'In-Person Chocolate & Wine',
  'In-Person Cheeseboard',
  'In-Person Gingerbread',
  'In-Person Lend a Hand',
  'Group Food Tour',
  'Italian Food Tour',
  'Georgetown Foodie Tour',
  'Private Food Tour',
  'Indoor Food Tour',
];

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 16);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  return {
    event_name: '',
    poc_name: '',
    event_type: '',
    event_format: '',
    venue: '',
    event_date: '',
    headcount: '',
    menu: '',
    notes: '',
    stage: 'Deposit Received',
    template_id: '',
  };
}

function formFromEvent(event) {
  if (!event) return emptyForm();
  return {
    event_name: event.event_name || '',
    poc_name: event.poc_name || '',
    event_type: event.event_type || '',
    event_format: event.event_format || '',
    venue: event.venue || '',
    event_date: toDatetimeLocalValue(event.event_date),
    headcount: event.headcount != null ? String(event.headcount) : '',
    menu: event.menu || '',
    notes: event.notes || '',
    stage: event.stage || 'Deposit Received',
    template_id: event.template_id || '',
  };
}

function applyVenueSelect(
  venue,
  houseVenues,
  setVenueSelect,
  setOtherVenue,
  address,
  setVenueAddress
) {
  const v = (venue || '').trim();
  if (!v) {
    setVenueSelect('');
    setOtherVenue('');
    setVenueAddress(String(address || '').trim());
    return;
  }
  if (
    v === 'Virtual' ||
    houseVenues.some((h) => h.name.toLowerCase() === v.toLowerCase())
  ) {
    setVenueSelect(v);
    setOtherVenue('');
    setVenueAddress('');
  } else {
    setVenueSelect(CUSTOM_VENUE_OPTION);
    setOtherVenue(v);
    setVenueAddress(String(address || '').trim());
  }
}

export default function EventFormDialog({ event, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => formFromEvent(event));
  const [venueSelect, setVenueSelect] = useState('');
  const [otherVenue, setOtherVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [user, setUser] = useState(null);
  const [formTouched, setFormTouched] = useState(false);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: templates = [] } = useQuery({
    queryKey: ['event-templates'],
    queryFn: () => base44.entities.EventTemplate.list(),
  });

  const { data: houseVenues = [] } = useQuery({
    queryKey: ['venues-active'],
    queryFn: async () => {
      const rows = await base44.entities.Venue.filter({ is_active: true }, 'sort_order');
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: assignment } = useQuery({
    queryKey: ['user-assignment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (user.role === 'admin') return { is_active: true, role: 'Admin' };
      const rows = await base44.entities.RoleAssignment.filter({
        user_id: user.id,
      });
      return rows[0] || null;
    },
    enabled: !!user,
  });

  const canPromote = canAccessOpsSettings(user, assignment);
  const houseVenueNames = useMemo(
    () => houseVenues.map((v) => v.name),
    [houseVenues]
  );

  React.useEffect(() => {
    const next = formFromEvent(event);
    setFormData(next);
    applyVenueSelect(
      next.venue,
      houseVenues,
      setVenueSelect,
      setOtherVenue,
      event?.venue_address || event?.venueAddress || '',
      setVenueAddress
    );
  }, [event, houseVenues]);

  const mutation = useMutation({
    mutationFn: (data) =>
      event
        ? base44.entities.Event.update(event.id, data)
        : base44.entities.Event.create(data),
    onSuccess: () => {
      setFormTouched(false);
      queryClient.invalidateQueries(['events']);
      if (event?.id) {
        queryClient.invalidateQueries(['event', event.id]);
      }
      toast.success(event ? 'Event updated' : 'Event created');
      onClose();
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save event');
    },
  });

  useUnsavedBeforeUnload(formTouched && !mutation.isPending);

  const touch = () => setFormTouched(true);

  const requestClose = () => {
    if (!confirmLeave(formTouched)) return;
    onClose();
  };

  const promoteMutation = useMutation({
    mutationFn: async (name) => {
      const trimmed = String(name || '').trim();
      if (!trimmed) throw new Error('Venue name is required');
      const existing = await base44.entities.Venue.filter({});
      const dup = (Array.isArray(existing) ? existing : []).find(
        (v) => String(v.name || '').toLowerCase() === trimmed.toLowerCase()
      );
      if (dup) {
        if (dup.is_active === false) {
          return base44.entities.Venue.update(dup.id, { is_active: true });
        }
        throw new Error('That venue is already on the standard list');
      }
      const maxSort = (Array.isArray(existing) ? existing : []).reduce(
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
      queryClient.invalidateQueries({ queryKey: ['venues-active'] });
      queryClient.invalidateQueries({ queryKey: ['venues-all'] });
      toast.success('Added to standard venues');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add venue'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const venue =
      venueSelect === CUSTOM_VENUE_OPTION
        ? otherVenue.trim()
        : venueSelect.trim();
    if (venueSelect === CUSTOM_VENUE_OPTION && !venue) {
      toast.error('Enter a custom location name');
      return;
    }
    const isHouse =
      venue &&
      houseVenueNames.some((n) => n.toLowerCase() === venue.toLowerCase());
    const venue_mode = !venue
      ? null
      : isHouse
        ? 'house_venue'
        : 'go_to_them';
    const venue_address =
      venue_mode === 'go_to_them' ? venueAddress.trim() || null : null;
    let startTime = null;
    if (formData.event_date) {
      const d = new Date(formData.event_date);
      if (!Number.isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (hh !== '00' || mm !== '00') startTime = `${hh}:${mm}`;
      }
    }
    const submitData = {
      event_name: formData.event_name,
      poc_name: formData.poc_name || null,
      event_type: formData.event_type || null,
      event_format: formData.event_format || null,
      venue: venue || null,
      venue_mode,
      venue_address,
      event_date: formData.event_date || null,
      start_time: startTime,
      headcount: formData.headcount ? Number(formData.headcount) : null,
      menu: formData.menu || null,
      notes: formData.notes || null,
      template_id: formData.template_id || null,
    };
    if (!event) {
      submitData.stage = formData.stage || 'Deposit Received';
    }
    mutation.mutate(submitData);
  };

  const saving = mutation.isPending || mutation.isLoading;
  const eventTypeOptions = formData.event_type &&
    !CRM_EVENT_TYPE_OPTIONS.includes(formData.event_type)
    ? [formData.event_type, ...CRM_EVENT_TYPE_OPTIONS]
    : CRM_EVENT_TYPE_OPTIONS;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            {event ? 'Edit Event' : 'New Event'}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          onChange={touch}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company/Group Name *</Label>
              <Input
                required
                value={formData.event_name}
                onChange={(e) =>
                  setFormData({ ...formData, event_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Primary contact name</Label>
              <Input
                value={formData.poc_name}
                onChange={(e) =>
                  setFormData({ ...formData, poc_name: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Event *</Label>
              <select
                required
                value={formData.event_type || ''}
                onChange={(e) =>
                  setFormData({ ...formData, event_type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select event type...</option>
                {eventTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>In-Person or Remote</Label>
              <select
                value={formData.event_format || ''}
                onChange={(e) =>
                  setFormData({ ...formData, event_format: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select format...</option>
                <option value="In-Person">In-Person</option>
                <option value="Virtual">Remote</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Event Date *</Label>
              <Input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) =>
                  setFormData({ ...formData, event_date: e.target.value })
                }
              />
              {event?.lead_id || event?.source_lead_id ? (
                <p className="text-xs text-gray-500 mt-1">
                  Synced with linked Lead — changes update both.
                </p>
              ) : null}
            </div>
            <div>
              <Label>Event Template</Label>
              <select
                value={formData.template_id || ''}
                onChange={(e) =>
                  setFormData({ ...formData, template_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Venue</Label>
              <select
                value={venueSelect}
                onChange={(e) => {
                  touch();
                  const v = e.target.value;
                  setVenueSelect(v);
                  if (v !== CUSTOM_VENUE_OPTION) {
                    setOtherVenue('');
                    setVenueAddress('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select a venue...</option>
                {houseVenues.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
                <option value="Virtual">Virtual</option>
                <option value={CUSTOM_VENUE_OPTION}>{CUSTOM_VENUE_LABEL}</option>
              </select>
              <SettingsCatalogLink
                hash="settings-venues"
                label="Manage venues & floor maps in Settings"
                dirty={formTouched}
              />
              {venueSelect === CUSTOM_VENUE_OPTION && (
                <>
                  <CustomVenueFields
                    idPrefix="event-form-venue"
                    customName={otherVenue}
                    onCustomNameChange={(v) => {
                      touch();
                      setOtherVenue(v);
                    }}
                    address={venueAddress}
                    onAddressChange={(v) => {
                      touch();
                      setVenueAddress(v);
                    }}
                  />
                  <PromoteVenueButton
                    venueName={otherVenue}
                    houseVenueNames={houseVenueNames}
                    canPromote={canPromote}
                    pending={promoteMutation.isPending}
                    onPromote={(name) => promoteMutation.mutate(name)}
                  />
                </>
              )}
            </div>
            <div>
              <Label>Headcount</Label>
              <Input
                type="number"
                value={formData.headcount}
                onChange={(e) =>
                  setFormData({ ...formData, headcount: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label>Menu</Label>
            <Textarea
              value={formData.menu}
              onChange={(e) =>
                setFormData({ ...formData, menu: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
