import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Loader2, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { getPanelMilestoneLabel } from '@/lib/eventMilestones';
import { siteVisitComplete } from '@/lib/opsPanelCompletion';

function photosFromEvent(event) {
  const raw = event?.site_visit_photos ?? event?.siteVisitPhotos;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => ({
      url: String(p?.url || '').trim(),
      caption: p?.caption != null ? String(p.caption) : '',
    }))
    .filter((p) => p.url);
}

function dateInputValue(event) {
  const raw = event?.site_visit_date || event?.siteVisitDate;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Client Venue site visit (CRM-18). Not mounted for Our Venue.
 */
export default function EventSiteVisitPanel({ event, canEdit = false }) {
  const eventId = event?.id;
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [visitDate, setVisitDate] = useState(() => dateInputValue(event));
  const [notes, setNotes] = useState(
    () => event?.site_visit_notes || event?.siteVisitNotes || ''
  );
  const [parking, setParking] = useState(
    () => event?.site_visit_parking || event?.siteVisitParking || ''
  );
  const [contacts, setContacts] = useState(
    () => event?.site_visit_contacts || event?.siteVisitContacts || ''
  );
  const [photos, setPhotos] = useState(() => photosFromEvent(event));
  const [linkDraft, setLinkDraft] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');

  useEffect(() => {
    setVisitDate(dateInputValue(event));
    setNotes(event?.site_visit_notes || event?.siteVisitNotes || '');
    setParking(event?.site_visit_parking || event?.siteVisitParking || '');
    setContacts(event?.site_visit_contacts || event?.siteVisitContacts || '');
    setPhotos(photosFromEvent(event));
  }, [event]);

  const complete = siteVisitComplete(event);
  const showSummary = complete && !isEditing;
  const milestoneLabel = getPanelMilestoneLabel('site_visit', event);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('saveEventSiteVisit', {
        eventId,
        siteVisitDate: visitDate
          ? new Date(`${visitDate}T12:00:00`).toISOString()
          : null,
        siteVisitNotes: notes.trim() || null,
        siteVisitParking: parking.trim() || null,
        siteVisitContacts: contacts.trim() || null,
        siteVisitPhotos: photos.map((p) => ({
          url: p.url,
          caption: p.caption?.trim() || null,
        })),
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['beo-document', eventId]);
      setIsEditing(false);
      toast.success('Site visit saved');
    },
    onError: (err) =>
      toast.error(err?.message || 'Failed to save site visit'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const url = uploadResult?.file_url;
      if (!url) throw new Error('Upload failed');
      return url;
    },
    onSuccess: (url) => {
      setPhotos((prev) => [...prev, { url, caption: '' }]);
      toast.success('Photo uploaded');
    },
    onError: (err) =>
      toast.error(err?.message || 'Failed to upload photo'),
  });

  const summaryBits = useMemo(() => {
    const bits = [];
    if (visitDate) bits.push({ label: 'Visit date', value: visitDate });
    if (notes.trim()) bits.push({ label: 'Notes', value: notes.trim() });
    if (parking.trim())
      bits.push({ label: 'Parking / load-in', value: parking.trim() });
    if (contacts.trim())
      bits.push({ label: 'Contacts', value: contacts.trim() });
    if (photos.length)
      bits.push({
        label: 'Photos',
        value: `${photos.length} link${photos.length === 1 ? '' : 's'}`,
        photos,
      });
    return bits;
  }, [visitDate, notes, parking, contacts, photos]);

  const cancelEdit = () => {
    setVisitDate(dateInputValue(event));
    setNotes(event?.site_visit_notes || event?.siteVisitNotes || '');
    setParking(event?.site_visit_parking || event?.siteVisitParking || '');
    setContacts(event?.site_visit_contacts || event?.siteVisitContacts || '');
    setPhotos(photosFromEvent(event));
    setIsEditing(false);
  };

  const addLink = () => {
    const url = linkDraft.trim();
    if (!url) return;
    setPhotos((prev) => [
      ...prev,
      { url, caption: captionDraft.trim() },
    ]);
    setLinkDraft('');
    setCaptionDraft('');
  };

  return (
    <OpsPanelShell
      title="Site Visit"
      icon={MapPin}
      complete={showSummary}
      forceOpen={!showSummary}
      doneBadge={showSummary}
      milestoneLabel={milestoneLabel}
    >
      {showSummary ? (
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium text-green-900">Site visit on file</p>
              <p className="text-sm text-green-700">
                Client Venue visit details for the event record and BEO.
              </p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-300 text-green-800 hover:bg-green-100"
                onClick={() => setIsEditing(true)}
              >
                View / Edit
              </Button>
            ) : null}
          </div>
          {summaryBits.length ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {summaryBits.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-green-700">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-green-950 whitespace-pre-wrap break-words">
                    {row.value}
                    {row.photos?.length ? (
                      <ul className="mt-2 space-y-1">
                        {row.photos.map((p) => (
                          <li key={p.url}>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#C84B31] underline"
                            >
                              {p.caption || p.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Capture the Client Venue site visit. Switching back to Our Venue
            hides this section but keeps saved data.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Visit date</Label>
              <Input
                type="date"
                disabled={!canEdit}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">
              Notes / instructions
            </Label>
            <Textarea
              disabled={!canEdit}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Access, timing, special instructions…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Parking / load-in</Label>
            <Textarea
              disabled={!canEdit}
              value={parking}
              onChange={(e) => setParking(e.target.value)}
              rows={2}
              placeholder="Parking, dock, elevator, load-in window…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Contacts</Label>
            <Textarea
              disabled={!canEdit}
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
              rows={2}
              placeholder="On-site contacts, phones, emails…"
            />
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-sm font-medium">Photos / links</Label>
            {photos.length ? (
              <ul className="space-y-2">
                {photos.map((p, idx) => (
                  <li
                    key={`${p.url}-${idx}`}
                    className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded border border-orange-100 p-2 bg-orange-50/30"
                  >
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#C84B31] underline break-all flex-1"
                    >
                      {p.url}
                    </a>
                    <Input
                      className="sm:w-40 h-8 text-xs"
                      disabled={!canEdit}
                      placeholder="Caption"
                      value={p.caption}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPhotos((list) =>
                          list.map((row, i) =>
                            i === idx ? { ...row, caption: next } : row
                          )
                        );
                      }}
                    />
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-red-600"
                        onClick={() =>
                          setPhotos((list) => list.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No photos yet.</p>
            )}
            {canEdit ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  className="flex-1 text-sm"
                  placeholder="Photo or map URL"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                />
                <Input
                  className="sm:w-36 text-sm"
                  placeholder="Caption"
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!linkDraft.trim()}
                  onClick={addLink}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add link
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) uploadMutation.mutate(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-[#C84B31] hover:bg-[#A03A23]"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Saving…' : 'Save site visit'}
              </Button>
              {complete && isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-gray-500">View only for your role.</p>
          )}
        </div>
      )}
    </OpsPanelShell>
  );
}
