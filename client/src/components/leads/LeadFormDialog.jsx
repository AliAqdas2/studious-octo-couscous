import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone } from 'lucide-react';
import { detectChannelFromEmail } from './pipelineConfig';
import AdditionalContactsEditor from './AdditionalContactsEditor';

export default function LeadFormDialog({ lead, onClose, prefillData }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  React.useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: automationConfigs = [] } = useQuery({
    queryKey: ['automation-config'],
    queryFn: () => base44.entities.AutomationConfig.filter({ key: 'default' }),
    enabled: !lead // only needed when creating
  });
  const autoCallEnabled = !lead && (automationConfigs[0]?.enabled === true);

  const [formData, setFormData] = useState(lead || {
    name: prefillData?.name || '',
    title: prefillData?.title || '',
    company: prefillData?.company || '',
    email: prefillData?.email || '',
    phone: prefillData?.phone || '',
    source: prefillData?.source || 'Email',
    client_type: prefillData?.client_type || 'New',
    headcount_estimate: '',
    event_type_interest: '',
    preferred_date: '',
    notes: '',
    stage: 'New Inquiry',
    channel: prefillData?.channel || '',
    referral_source: prefillData?.referral_source || '',
    referral_source_other: prefillData?.referral_source_other || ''
  });
  const [additionalContacts, setAdditionalContacts] = useState(
    Array.isArray(lead?.additional_contacts) ? lead.additional_contacts : []
  );
  const EVENT_TYPES = [
    'Cooking Class', 'Paint & Sip', 'Mixology Class', 'Chocolate Making',
    'Chocolate and Wine Tasting', 'Terrarium Building', 'Cheese Board Making',
    'Lend a Hand for Good', 'Yoga and unWINEd', 'Alcohol Tasting', 'Flavors of DC',
    'Baking Class', 'Dine Around', 'Georgetown Food Tour', 'DuPont Food Tour',
    'Premium Food Tour', 'Scavenger', 'Monuments Tour', 'Wine/Whiskey Tasting',
    'Bike Tour', 'Hand-Crafted Pottery Class', 'DC at your Door', 'The Guac Gourmet Showdown',
    'Other'
  ];

  // Parse existing interest string into array
  const parseInterests = (val) => val ? val.split(', ').filter(Boolean) : [];
  const [selectedInterests, setSelectedInterests] = useState(parseInterests(lead?.event_type_interest || ''));
  const [otherEventType, setOtherEventType] = useState('');

  const toggleInterest = (type) => {
    setSelectedInterests(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  const [showOtherReferral, setShowOtherReferral] = useState(lead?.referral_source === 'Other');

  // Auto-detect channel from email when not editing
  const handleEmailChange = (email) => {
    const updates = { email };
    if (!lead) {
      updates.channel = detectChannelFromEmail(email);
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (lead) {
        await base44.entities.Lead.update(lead.id, data);
        // Sync preferred_date to linked event when lead has been converted
        if (data.preferred_date && lead.converted_to_event_id) {
          await base44.entities.Event.update(lead.converted_to_event_id, {
            event_date: data.preferred_date
          });
        }
        return;
      }
      return base44.entities.Lead.create(data);
    },
    onSuccess: async (result) => {
      if (!lead && result?.id) {
        await base44.entities.ActivityLog.create({
          entity_type: 'Lead',
          entity_id: result.id,
          action: 'Lead Added',
          details: { method: 'Single Form', added_by: currentUser?.full_name || 'Unknown' },
          user_id: currentUser?.id || '',
          user_name: currentUser?.full_name || 'Unknown',
          timestamp: new Date().toISOString()
        });
      }
      queryClient.invalidateQueries(['leads']);
      onClose();
    }
  });

  const buildSubmitData = (skipCall) => {
    const channel = formData.channel || detectChannelFromEmail(formData.email);
    const cleanedAdditionalContacts = additionalContacts.filter(
      (c) => (c.name && c.name.trim()) || (c.email && c.email.trim()) || (c.phone && c.phone.trim()) || (c.role && c.role.trim())
    );
    return {
      ...formData,
      channel,
      headcount_estimate: formData.headcount_estimate ? Number(formData.headcount_estimate) : null,
      is_priority: formData.client_type === 'Previous',
      event_type_interest: selectedInterests.includes('Other')
        ? [...selectedInterests.filter(t => t !== 'Other'), otherEventType].filter(Boolean).join(', ')
        : selectedInterests.join(', '),
      additional_contacts: cleanedAdditionalContacts,
      ...(skipCall ? { skip_auto_call: true } : {})
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(buildSubmitData(false));
  };

  const handleJustSave = (e) => {
    e.preventDefault();
    mutation.mutate(buildSubmitData(true));
  };

  const handleSaveAndCall = (e) => {
    e.preventDefault();
    mutation.mutate(buildSubmitData(false));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C84B31]">
            {lead ? 'Edit Lead' : 'New Lead'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#C84B31] uppercase tracking-wider mb-3">Primary Contact</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Director of Events"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
              {formData.email && !lead && (
                <p className="text-xs mt-1 text-gray-500">
                  Detected: <span className={`font-semibold ${(formData.channel || detectChannelFromEmail(formData.email)) === 'B2B' ? 'text-indigo-600' : 'text-pink-600'}`}>
                    {formData.channel || detectChannelFromEmail(formData.email)}
                  </span>
                </p>
              )}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <div className="border-t border-orange-100 pt-5">
            <AdditionalContactsEditor
              contacts={additionalContacts}
              onChange={setAdditionalContacts}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {lead && (
              <div>
                <Label>Channel</Label>
                <select
                  value={formData.channel || ''}
                  onChange={(e) => setFormData({...formData, channel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Auto-detect from email</option>
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                </select>
              </div>
            )}
            <div>
              <Label>Source</Label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Website">Website</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Referral">Referral</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {!lead && (
              <div>
                <Label>Occasion</Label>
                <Input
                  value={formData.survey_data?.occasion || ''}
                  onChange={(e) => setFormData({...formData, survey_data: { ...formData.survey_data, occasion: e.target.value }})}
                  placeholder="e.g. Birthday, Team Event..."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client Type</Label>
              <select
                value={formData.client_type}
                onChange={(e) => setFormData({...formData, client_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="New">New</option>
                <option value="Previous">Previous</option>
                <option value="Referral">Referral</option>
              </select>
            </div>
            <div>
              <Label>Headcount Estimate</Label>
              <Input
                type="number"
                value={formData.headcount_estimate}
                onChange={(e) => setFormData({...formData, headcount_estimate: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Preferred Date & Time</Label>
              <Input
                type="datetime-local"
                value={formData.preferred_date ? new Date(formData.preferred_date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({...formData, preferred_date: e.target.value ? new Date(e.target.value).toISOString() : ''})}
              />
            </div>
            <div>
              <Label>In-Person, Virtual, or Hybrid?</Label>
              <select
                value={formData.event_format || ''}
                onChange={(e) => setFormData({...formData, event_format: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select...</option>
                <option value="In-Person">In-Person</option>
                <option value="Virtual">Virtual</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Event Type Interest</Label>
            <div className="mt-2 border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
              {EVENT_TYPES.map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedInterests.includes(type)}
                    onChange={() => toggleInterest(type)}
                    className="w-3.5 h-3.5 accent-[#C84B31]"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              ))}
            </div>
            {selectedInterests.includes('Other') && (
              <div className="mt-2">
                <Input
                  value={otherEventType}
                  onChange={(e) => setOtherEventType(e.target.value)}
                  placeholder="Please specify the event type"
                />
              </div>
            )}
          </div>

          <div>
            <Label>How did you hear about us?</Label>
            <select
              value={formData.referral_source}
              onChange={(e) => {
                setFormData({...formData, referral_source: e.target.value});
                setShowOtherReferral(e.target.value === 'Other');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select...</option>
              <option value="ChatGPT">ChatGPT</option>
              <option value="Perplexity">Perplexity</option>
              <option value="Gemini">Gemini</option>
              <option value="Google">Google</option>
              <option value="Word-of-mouth">Word-of-mouth</option>
              <option value="Washington.org">Washington.org</option>
              <option value="Other">Other</option>
            </select>
            {showOtherReferral && (
              <div className="mt-3">
                <Input
                  value={formData.referral_source_other}
                  onChange={(e) => setFormData({...formData, referral_source_other: e.target.value})}
                  placeholder="Please specify"
                />
              </div>
            )}
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!lead && autoCallEnabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={handleJustSave}
                >
                  {mutation.isPending ? 'Saving...' : 'Just Save'}
                </Button>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={handleSaveAndCall}
                        className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
                      >
                        <Phone className="w-4 h-4 mr-1.5" />
                        {mutation.isPending ? 'Saving...' : 'Save & Call'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-center bg-gray-900 text-white border-0">
                      Saves the lead and immediately triggers an automated call to the sales rep, who will then be connected to the lead.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                {mutation.isPending ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}