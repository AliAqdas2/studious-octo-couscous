import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getAccessToken } from '@/api/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

function authVenueImageUrl(url) {
  const token = getAccessToken();
  if (!token || !url) return url;
  if (!url.startsWith('/venueimages/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

function groupImagesByVenue(images) {
  const map = new Map();
  for (const img of images) {
    const key = img.venue_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(img);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
        String(a.caption || '').localeCompare(String(b.caption || ''))
    );
  }
  return map;
}

/**
 * Admin CRUD for house venues (plan 08). "Other" is not stored — UI escape hatch only.
 */
export default function SettingsVenuesPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [expandedVenueId, setExpandedVenueId] = useState(null);
  const [addUrl, setAddUrl] = useState('');
  const [addCaption, setAddCaption] = useState('');
  const [uploadVenueId, setUploadVenueId] = useState(null);
  const [guidelinesDraft, setGuidelinesDraft] = useState({});

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-all'],
    queryFn: async () => {
      const rows = await base44.entities.Venue.list('sort_order', 200);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: allImages = [] } = useQuery({
    queryKey: ['venue-images-all'],
    queryFn: async () => {
      const rows = await base44.entities.VenueImage.list('sort_order', 500);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const imagesByVenue = useMemo(
    () => groupImagesByVenue(allImages),
    [allImages]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['venues-all'] });
    queryClient.invalidateQueries({ queryKey: ['venues-active'] });
    queryClient.invalidateQueries({ queryKey: ['venue-images-all'] });
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

  const addImageMutation = useMutation({
    mutationFn: async ({ venueId, imageUrl, caption }) => {
      const trimmed = (imageUrl || '').trim();
      if (!trimmed) throw new Error('Image URL is required');
      const venueImages = imagesByVenue.get(venueId) || [];
      const maxSort = venueImages.reduce(
        (m, i) => Math.max(m, Number(i.sort_order) || 0),
        0
      );
      return base44.entities.VenueImage.create({
        venue_id: venueId,
        image_url: trimmed,
        caption: caption?.trim() || null,
        sort_order: maxSort + 1,
        is_active: true,
      });
    },
    onSuccess: () => {
      setAddUrl('');
      setAddCaption('');
      invalidate();
      toast.success('Image added');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to add image'),
  });

  const updateImageMutation = useMutation({
    mutationFn: async ({ id, patch }) =>
      base44.entities.VenueImage.update(id, patch),
    onSuccess: () => {
      invalidate();
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to update image'),
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ venueId, file }) => {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const imageUrl = uploadResult?.file_url;
      if (!imageUrl) throw new Error('Upload failed');
      const venueImages = imagesByVenue.get(venueId) || [];
      const maxSort = venueImages.reduce(
        (m, i) => Math.max(m, Number(i.sort_order) || 0),
        0
      );
      return base44.entities.VenueImage.create({
        venue_id: venueId,
        image_url: imageUrl,
        caption: null,
        sort_order: maxSort + 1,
        is_active: true,
      });
    },
    onSuccess: () => {
      setUploadVenueId(null);
      invalidate();
      toast.success('Image uploaded');
    },
    onError: (err) =>
      toast.error(err?.body?.error || err?.message || 'Failed to upload image'),
  });

  const handleFilePick = (venueId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImageMutation.mutate({ venueId, file });
    e.target.value = '';
  };

  const moveImage = (venueId, image, direction) => {
    const list = [...(imagesByVenue.get(venueId) || [])].filter(
      (i) => i.is_active !== false
    );
    const idx = list.findIndex((i) => i.id === image.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    const myOrder = Number(image.sort_order) || 0;
    const otherOrder = Number(other.sort_order) || 0;
    updateImageMutation.mutate({ id: image.id, patch: { sort_order: otherOrder } });
    updateImageMutation.mutate({ id: other.id, patch: { sort_order: myOrder } });
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D3436]">
          <MapPin className="w-5 h-5 text-[#C84B31]" />
          House venues
        </CardTitle>
        <CardDescription>
          Shared list for Lead Detail, Deposit Intake, and event forms. Deactivate
          instead of deleting so past events keep their free-text name. Add venue
          photos below each location.
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (uploadVenueId) handleFilePick(uploadVenueId, e);
          }}
        />

        {isLoading ? (
          <div className="h-16 animate-pulse bg-slate-100 rounded" />
        ) : (
          <ul className="divide-y divide-orange-50 border border-orange-100 rounded-md">
            {venues.map((v) => {
              const venueImages = imagesByVenue.get(v.id) || [];
              const activeCount = venueImages.filter((i) => i.is_active !== false).length;
              const expanded = expandedVenueId === v.id;

              return (
                <li key={v.id} className="p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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
                          {activeCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {activeCount} photo{activeCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedVenueId(expanded ? null : v.id)
                        }
                      >
                        <ImagePlus className="w-3.5 h-3.5 mr-1" />
                        Images
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-1" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-1" />
                        )}
                      </Button>
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
                  </div>

                  {expanded && (
                    <div className="border border-orange-100 rounded-lg p-3 bg-[#FFF9F0]/50 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Venue guidelines (one bullet per line)
                        </Label>
                        <Textarea
                          rows={4}
                          className="resize-y text-sm bg-white"
                          placeholder="Be sure to park in the building garage…"
                          value={
                            guidelinesDraft[v.id] ?? (v.guidelines || '')
                          }
                          onChange={(e) =>
                            setGuidelinesDraft((d) => ({
                              ...d,
                              [v.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            updateMutation.isPending ||
                            guidelinesDraft[v.id] === undefined ||
                            guidelinesDraft[v.id] === (v.guidelines || '')
                          }
                          onClick={() =>
                            updateMutation.mutate({
                              id: v.id,
                              patch: {
                                guidelines: guidelinesDraft[v.id] ?? '',
                              },
                            })
                          }
                        >
                          Save guidelines
                        </Button>
                      </div>

                      {venueImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {venueImages.map((img) => (
                            <div
                              key={img.id}
                              className={`rounded-lg border overflow-hidden bg-white ${
                                img.is_active === false
                                  ? 'opacity-50 border-gray-200'
                                  : 'border-orange-100'
                              }`}
                            >
                              <div className="aspect-[4/3] bg-gray-100">
                                <img
                                  src={authVenueImageUrl(img.image_url)}
                                  alt={img.caption || v.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="p-2 space-y-2">
                                <Input
                                  className="h-7 text-xs"
                                  placeholder="Caption"
                                  defaultValue={img.caption || ''}
                                  onBlur={(e) => {
                                    const next = e.target.value.trim() || null;
                                    if (next !== (img.caption || null)) {
                                      updateImageMutation.mutate({
                                        id: img.id,
                                        patch: { caption: next },
                                      });
                                    }
                                  }}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => moveImage(v.id, img, 'up')}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => moveImage(v.id, img, 'down')}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs ml-auto"
                                    disabled={updateImageMutation.isPending}
                                    onClick={() =>
                                      updateImageMutation.mutate({
                                        id: img.id,
                                        patch: {
                                          is_active: img.is_active === false,
                                        },
                                      })
                                    }
                                  >
                                    {img.is_active === false ? 'Activate' : 'Deactivate'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No images yet.</p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-orange-100">
                        <Input
                          className="flex-1 text-sm"
                          placeholder="Image URL (e.g. /venueimages/…)"
                          value={expandedVenueId === v.id ? addUrl : ''}
                          onChange={(e) => setAddUrl(e.target.value)}
                        />
                        <Input
                          className="sm:w-40 text-sm"
                          placeholder="Caption"
                          value={expandedVenueId === v.id ? addCaption : ''}
                          onChange={(e) => setAddCaption(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={addImageMutation.isPending || !addUrl.trim()}
                          onClick={() =>
                            addImageMutation.mutate({
                              venueId: v.id,
                              imageUrl: addUrl,
                              caption: addCaption,
                            })
                          }
                        >
                          Add URL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={uploadImageMutation.isPending}
                          onClick={() => {
                            setUploadVenueId(v.id);
                            fileInputRef.current?.click();
                          }}
                        >
                          {uploadImageMutation.isPending &&
                          uploadVenueId === v.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Upload'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
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
