import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarClock, ThermometerSun, Sparkles, FileText, Save } from 'lucide-react';

const WARMTH_LABELS = ['', 'Cold', 'Cool', 'Warm', 'Hot', 'On Fire'];
const WARMTH_COLORS = ['', 'bg-blue-500', 'bg-sky-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];

export default function AfterMeetingFollowUp({ lead, onSave, isSaving }) {
  const [form, setForm] = useState({
    followup_response_eta: lead?.followup_response_eta || '',
    followup_next_date: lead?.followup_next_date || '',
    followup_experience_confirmation: lead?.followup_experience_confirmation || '',
    followup_warmth_scale: lead?.followup_warmth_scale || 0,
    followup_meeting_notes: lead?.followup_meeting_notes || '',
    followup_contract_required: lead?.followup_contract_required ?? null,
  });

  useEffect(() => {
    setForm({
      followup_response_eta: lead?.followup_response_eta || '',
      followup_next_date: lead?.followup_next_date || '',
      followup_experience_confirmation: lead?.followup_experience_confirmation || '',
      followup_warmth_scale: lead?.followup_warmth_scale || 0,
      followup_meeting_notes: lead?.followup_meeting_notes || '',
      followup_contract_required: lead?.followup_contract_required ?? null,
    });
  }, [lead?.id]);

  const hasChanges =
    form.followup_response_eta !== (lead?.followup_response_eta || '') ||
    form.followup_next_date !== (lead?.followup_next_date || '') ||
    form.followup_experience_confirmation !== (lead?.followup_experience_confirmation || '') ||
    form.followup_warmth_scale !== (lead?.followup_warmth_scale || 0) ||
    form.followup_meeting_notes !== (lead?.followup_meeting_notes || '') ||
    form.followup_contract_required !== (lead?.followup_contract_required ?? null);

  const handleSave = () => {
    const updates = { ...form };
    if (!updates.followup_warmth_scale) updates.followup_warmth_scale = null;
    onSave(updates);
  };

  return (
    <Card className="bg-gradient-to-r from-lime-50 to-green-50 border-lime-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lime-800">
          <CalendarClock className="w-5 h-5" />
          After Meeting Follow-Up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Response ETA */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-lime-600" />
              When will they get back to us?
            </Label>
            <Input
              type="date"
              value={form.followup_response_eta}
              onChange={(e) => setForm({ ...form, followup_response_eta: e.target.value })}
              className="border-lime-200 focus:ring-lime-400"
            />
          </div>

          {/* Next Follow-up */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-green-600" />
              When should we follow up next?
            </Label>
            <Input
              type="date"
              value={form.followup_next_date}
              onChange={(e) => setForm({ ...form, followup_next_date: e.target.value })}
              className="border-lime-200 focus:ring-lime-400"
            />
          </div>
        </div>

        {/* Experience Confirmation */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            What is their preferred experience?
          </Label>
          <Input
            value={form.followup_experience_confirmation}
            onChange={(e) => setForm({ ...form, followup_experience_confirmation: e.target.value })}
            placeholder="e.g. In-Person Mixology, Virtual Paint & Sip..."
            className="border-lime-200 focus:ring-lime-400"
          />
        </div>

        {/* Warmth Scale */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <ThermometerSun className="w-4 h-4 text-orange-500" />
            How warm is this lead? (1 = Cold, 5 = On Fire)
          </Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, followup_warmth_scale: n })}
                className={`w-10 h-10 rounded-full font-bold text-sm transition-all
                  ${form.followup_warmth_scale >= n
                    ? `${WARMTH_COLORS[n]} text-white shadow-md scale-110`
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
              >
                {n}
              </button>
            ))}
            {form.followup_warmth_scale > 0 && (
              <span className="ml-2 text-sm font-medium text-gray-600">
                {WARMTH_LABELS[form.followup_warmth_scale]}
              </span>
            )}
          </div>
        </div>

        {/* Contract Required */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-500" />
            Does the client require a contract?
          </Label>
          <div className="flex gap-3">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => setForm({ ...form, followup_contract_required: value })}
                className={`px-5 py-2 rounded-lg font-medium text-sm border transition-all ${
                  form.followup_contract_required === value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
            {form.followup_contract_required !== null && (
              <button
                type="button"
                onClick={() => setForm({ ...form, followup_contract_required: null })}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Meeting Notes */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-gray-500" />
            Any additional details worth mentioning?
          </Label>
          <Textarea
            value={form.followup_meeting_notes}
            onChange={(e) => setForm({ ...form, followup_meeting_notes: e.target.value })}
            placeholder="Notes from the meeting, next steps, concerns, etc."
            rows={4}
            className="border-lime-200 focus:ring-lime-400"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-lime-600 hover:bg-lime-700 text-white"
        >
          {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" />Save Follow-Up Details</>}
        </Button>
      </CardContent>
    </Card>
  );
}