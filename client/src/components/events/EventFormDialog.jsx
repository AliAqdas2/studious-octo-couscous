import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function EventFormDialog({ event, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(event || {
    event_name: '',
    event_type: '',
    event_format: '',
    venue: '',
    event_date: '',
    headcount: '',
    menu: '',
    notes: '',
    stage: 'Deposit Received'
  });
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
    const v = (formData.venue || '').trim();
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
  }, [houseVenues]); // eslint-disable-line react-hooks/exhaustive-deps -- prefill once venues load

  const mutation = useMutation({
    mutationFn: (data) => event
      ? base44.entities.Event.update(event.id, data)
      : base44.entities.Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const venue =
      venueSelect === 'Other'
        ? otherVenue.trim()
        : venueSelect.trim();
    const submitData = {
      ...formData,
      venue: venue || null,
      headcount: formData.headcount ? Number(formData.headcount) : null
    };
    mutation.mutate(submitData);
  };

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
              <Label>Event Name *</Label>
              <Input
                required
                value={formData.event_name}
                onChange={(e) => setFormData({...formData, event_name: e.target.value})}
              />
            </div>
            <div>
              <Label>Event Date *</Label>
              <Input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) => setFormData({...formData, event_date: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Event Type</Label>
              <Input
                value={formData.event_type}
                onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                placeholder="e.g., Corporate Team Building"
              />
            </div>
            <div>
              <Label>Event Template</Label>
              <select
                value={formData.template_id || ''}
                onChange={(e) => setFormData({...formData, template_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a template...</option>
                {templates.map(template => (
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
                onChange={(e) => setFormData({...formData, headcount: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>Menu</Label>
            <Textarea
              value={formData.menu}
              onChange={(e) => setFormData({...formData, menu: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isLoading}
              className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
            >
              {mutation.isLoading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}