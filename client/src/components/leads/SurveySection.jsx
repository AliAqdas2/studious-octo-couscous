import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ClipboardList, CheckCircle, Save } from 'lucide-react';

const SURVEY_FIELDS = [
  { key: 'occasion', label: 'What is the occasion?', type: 'text' },
  { key: 'available_dates', label: 'What date(s) did you have in mind?', type: 'textarea' },
  { key: 'preferred_time', label: 'What time of day is preferred?', type: 'text' },
  { key: 'event_format', label: 'In-person, virtual, or hybrid?', type: 'select', options: ['In-Person', 'Virtual', 'Hybrid'] },
  { key: 'daytime_phone', label: 'What is your daytime phone number?', type: 'text' },
  { key: 'guest_count', label: 'Around how many people?', type: 'text' },
  { key: 'transportation_needed', label: 'Do you need transportation?', type: 'text' },
  { key: 'drinking_level', label: 'Drinking level of the group?', type: 'select', options: ['None', 'Light', 'Moderate'] },
  { key: 'competitive_group', label: 'Competitive or not so much?', type: 'text' },
  { key: 'budget', label: 'What is your budget for this event?', type: 'text' },
  { key: 'decision_maker', label: 'Who would process this / be involved?', type: 'text' },
];

export default function SurveySection({ lead, onSave, isSaving }) {
  const [open, setOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [form, setForm] = useState({
    occasion: '',
    available_dates: '',
    preferred_time: '',
    event_format: '',
    daytime_phone: '',
    guest_count: '',
    transportation_needed: '',
    drinking_level: '',
    competitive_group: '',
    budget: '',
    decision_maker: '',
  });

  useEffect(() => {
    if (lead?.survey_data) {
      setForm(prev => ({ ...prev, ...lead.survey_data }));
    }
    // Prefill from lead data
    setForm(prev => ({
      ...prev,
      daytime_phone: prev.daytime_phone || lead?.phone || '',
      guest_count: prev.guest_count || (lead?.headcount_estimate ? String(lead.headcount_estimate) : ''),
    }));
  }, [lead?.survey_data, lead?.phone, lead?.headcount_estimate]);

  const handleSave = () => {
    onSave({ survey_data: form });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const filledCount = SURVEY_FIELDS.filter(f => form[f.key]?.trim()).length;

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-orange-50/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#C84B31]" />
                Survey Information
                <span className="text-sm font-normal text-gray-500">({filledCount}/{SURVEY_FIELDS.length} fields)</span>
              </div>
              {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Name & Company are read-only from lead */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500">Name</Label>
                <p className="font-medium text-gray-900 mt-1">{lead?.name || '—'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Company</Label>
                <p className="font-medium text-gray-900 mt-1">{lead?.company || '—'}</p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              {SURVEY_FIELDS.map(field => (
                <div key={field.key}>
                  <Label>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={form[field.key] || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      rows={2}
                      className="mt-1"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={form[field.key] || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Survey'}
              </Button>
              {justSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}