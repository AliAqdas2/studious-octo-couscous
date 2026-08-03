import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function LostReasonField({ lead, onSave, isPending }) {
  const [value, setValue] = useState(lead.lost_reason || '');

  useEffect(() => {
    setValue(lead.lost_reason || '');
  }, [lead.lost_reason]);

  const isDirty = value.trim() !== (lead.lost_reason || '');

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Why was this lead lost?</label>
      <textarea
        className="w-full px-3 py-2 border border-red-200 rounded-md text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
        rows={3}
        placeholder="Why was this lead lost or canceled?"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {isDirty && (
        <Button
          size="sm"
          onClick={() => onSave(value.trim())}
          disabled={isPending}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {isPending ? 'Saving...' : 'Save Reason'}
        </Button>
      )}
    </div>
  );
}