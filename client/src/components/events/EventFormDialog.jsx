import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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

function applyVenueSelect(venue, houseVenues, setVenueSelect, setOtherVenue) {
  const v = (venue || '').trim();
  if (!v) {
    setVenueSelect('');
    setOtherVenue('');
    return;
  }
  if (v === 'Virtual' || houseVenues.some((h) => h.name === v)) {
    setVenueSelect(v);
    setOtherVenue('');
  } else {
    setVenueSelect('Other');
    setOtherVenue(v);
  }
}

export default function EventFormDialog({ event, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => formFromEvent(event));
  const [venueSelect, setVenueSelect] = useState('');
  const [otherVenue, setOtherVenue] = useState('');

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

  React.useEffect(() => {
    const next = formFromEvent(event);
    setFormData(next);
    applyVenueSelect(next.venue, houseVenues, setVenueSelect, setOtherVenue);
  }, [event, houseVenues]);

  const mutation = useMutation({
    mutationFn: (data) =>
      event
        ? base44.entities.Event.update(event.id, data)
        : base44.entities.Event.create(data),
    onSuccess: () => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const venue =
      venueSelect === 'Other' ? otherVenue.trim() : venueSelect.trim();
    const submitData = {
      event_name: formData.event_name,
      poc_name: formData.poc_name || null,
      event_type: formData.event_type || null,
      event_format: formData.event_format || null,
      venue: venue || null,
      event_date: formData.event_date || null,
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            {event ? 'Edit Event' : 'New Event'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            <div>
              <Label>Venue</Label>
              <select
                value={venueSelect}
                onChange={(e) => {
                  const v = e.target.value;
                  setVenueSelect(v);
                  if (v !== 'Other') setOtherVenue('');
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
                <option value="Other">Other</option>
              </select>
              {venueSelect === 'Other' && (
                <Input
                  className="mt-2"
                  placeholder="Venue name"
                  value={otherVenue}
                  onChange={(e) => setOtherVenue(e.target.value)}
                />
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
