import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/** Select option value for the custom-location path (internal). */
export const CUSTOM_VENUE_OPTION = 'Other';

/** User-facing label for CUSTOM_VENUE_OPTION. */
export const CUSTOM_VENUE_LABEL = 'Add custom location';

/**
 * @param {string[]} houseVenueNames
 * @param {string | null | undefined} venueName
 */
export function isCustomVenueSelection(houseVenueNames, venueName) {
  const name = String(venueName || '').trim();
  if (!name) return false;
  const list = Array.isArray(houseVenueNames) ? houseVenueNames : [];
  if (name === CUSTOM_VENUE_OPTION) return true;
  return !list.some((v) => v.toLowerCase() === name.toLowerCase());
}

/**
 * Fields shown when the user picks Add custom location.
 */
export function CustomVenueFields({
  customName,
  onCustomNameChange,
  address,
  onAddressChange,
  required = true,
  idPrefix = 'custom-venue',
}) {
  return (
    <div className="space-y-3 rounded-lg border border-orange-100 bg-orange-50/40 p-3">
      <p className="text-xs text-gray-600">
        Use this for client sites or one-off spots (e.g. Georgetown Food Tour).
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          Custom location name{required ? ' *' : ''}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={customName}
          onChange={(e) => onCustomNameChange(e.target.value)}
          placeholder="e.g. Georgetown Food Tour"
          required={required}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Full address (optional)</Label>
        <Textarea
          id={`${idPrefix}-address`}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Street, city, state…"
          rows={2}
          className="resize-y min-h-[60px]"
        />
      </div>
    </div>
  );
}

/**
 * Promote a custom venue name into the permanent house-venues catalog.
 */
export function PromoteVenueButton({
  venueName,
  houseVenueNames = [],
  canPromote,
  onPromote,
  pending = false,
}) {
  const name = String(venueName || '').trim();
  if (!canPromote || !name || name === CUSTOM_VENUE_OPTION) return null;
  const exists = houseVenueNames.some(
    (v) => v.toLowerCase() === name.toLowerCase()
  );
  if (exists) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => onPromote?.(name)}
      className="border-orange-200 text-[#C84B31] hover:bg-orange-50"
    >
      {pending ? 'Adding…' : 'Add to standard venues'}
    </Button>
  );
}
