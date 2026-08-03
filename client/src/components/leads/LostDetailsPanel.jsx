import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function LostDetailsPanel({ lead, onSave, isPending }) {
  const [reason, setReason] = useState(lead.lost_reason || '');
  const [okToContact, setOkToContact] = useState(lead.lost_ok_to_contact ?? null);

  useEffect(() => {
    setReason(lead.lost_reason || '');
    setOkToContact(lead.lost_ok_to_contact ?? null);
  }, [lead.lost_reason, lead.lost_ok_to_contact]);

  const isDirty =
    reason.trim() !== (lead.lost_reason || '') ||
    okToContact !== (lead.lost_ok_to_contact ?? null);

  const handleSave = () => {
    onSave({ lost_reason: reason.trim(), lost_ok_to_contact: okToContact });
  };

  return (
    <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="w-5 h-5 text-red-600" />
          Lost / Canceled Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Reason for cancellation</label>
          <textarea
            className="w-full px-3 py-2 border border-red-200 rounded-md text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            rows={3}
            placeholder="Why was this lead lost or canceled?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Can we follow up with this client later?</label>
          <div className="flex gap-3">
            <button
              onClick={() => setOkToContact(true)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${okToContact === true ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50 hover:border-green-400'}`}
            >
              Yes
            </button>
            <button
              onClick={() => setOkToContact(false)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${okToContact === false ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-red-50 hover:border-red-400'}`}
            >
              No
            </button>
            {okToContact === null && (
              <span className="text-sm text-gray-400 self-center italic">Not answered yet</span>
            )}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}