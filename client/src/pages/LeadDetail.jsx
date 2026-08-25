import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, Building, Calendar, Users, Star, Trash2, DollarSign, Pencil, Activity, Clock, MapPin, Reply, MoreVertical, Copy, PhoneCall } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import LeadFormDialog from '@/components/leads/LeadFormDialog';
import InlineEditField from '@/components/leads/InlineEditField';
import LeadEmailDraft from '@/components/leads/LeadEmailDraft';
import AddNoteDialog from '@/components/leads/AddNoteDialog';
import SurveySection from '@/components/leads/SurveySection';
import LeadStateMachine from '@/components/leads/LeadStateMachine';
import EmailViewModal from '@/components/email/EmailViewModal';
import { toast } from 'sonner';
import { getStagesForChannel, STAGE_COLORS, CHANNEL_COLORS } from '@/components/leads/pipelineConfig';
import StageEmailIndicator from '@/components/leads/StageEmailIndicator';
import LostDetailsPanel from '@/components/leads/LostDetailsPanel';
import StageInfoBanner from '@/components/leads/StageInfoBanner';
import { getStageMeta, STATUS_COLORS as STAGE_STATUS_COLORS } from '@/components/leads/stageMetadata';
import StageTooltip from '@/components/leads/StageTooltip';
import AdditionalContactsCard from '@/components/leads/AdditionalContactsCard';

export default function LeadDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [depositNumber, setDepositNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [otherVenue, setOtherVenue] = useState('');
  const [venuePrefillDone, setVenuePrefillDone] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [emailPage, setEmailPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [selectedEmailForView, setSelectedEmailForView] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSpamConfirm, setShowSpamConfirm] = useState(false);
  const EVENT_TYPES = [
    'Cooking Class', 'Paint & Sip', 'Mixology Class', 'Chocolate Making',
    'Chocolate and Wine Tasting', 'Terrarium Building', 'Cheese Board Making',
    'Lend a Hand for Good', 'Yoga and unWINEd', 'Alcohol Tasting', 'Flavors of DC',
    'Baking Class', 'Dine Around', 'Georgetown Food Tour', 'DuPont Food Tour',
    'Premium Food Tour', 'Scavenger', 'Monuments Tour', 'Wine/Whiskey Tasting',
    'Bike Tour', 'Hand-Crafted Pottery Class', 'DC at your Door', 'The Guac Gourmet Showdown',
    'Other'
  ];
  const parseInterests = (val) => val ? val.split(', ').filter(Boolean) : [];
  const [selectedEventTypes, setSelectedEventTypes] = useState([]);
  const [editingEventTypes, setEditingEventTypes] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const ITEMS_PER_PAGE = 5;

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const leads = await base44.entities.Lead.filter({ id: leadId });
      const leadData = leads[0];
      if (leadData?.data) {
        return { ...leadData.data, id: leadData.id, created_date: leadData.created_date, updated_date: leadData.updated_date, created_by: leadData.created_by };
      }
      return leadData;
    },
    enabled: !!leadId
  });

  const { data: houseVenues = [] } = useQuery({
    queryKey: ['venues-active'],
    queryFn: async () => {
      const rows = await base44.entities.Venue.filter({ is_active: true }, 'sort_order');
      return Array.isArray(rows) ? rows : [];
    },
  });

  const houseVenueNames = useMemo(
    () => houseVenues.map((v) => v.name),
    [houseVenues]
  );

  useEffect(() => {
    if (!lead || venuePrefillDone) return;
    const saved = (lead.venue || '').trim();
    if (saved) {
      if (houseVenueNames.includes(saved)) {
        setSelectedVenue(saved);
        setOtherVenue('');
      } else {
        setSelectedVenue('Other');
        setOtherVenue(saved);
      }
    }
    if (lead.deposit_number) setDepositNumber(String(lead.deposit_number));
    if (lead.deposit_amount != null) setDepositAmount(String(lead.deposit_amount));
    setVenuePrefillDone(true);
  }, [lead, houseVenueNames, venuePrefillDone]);

  const resolvedVenueName = () => {
    if (selectedVenue === 'Other') return otherVenue.trim();
    return selectedVenue.trim();
  };

  const [user, setUser] = useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // Auto-flip the "Needs Review" flag the first time someone opens an
  // auto-imported lead. Runs once per lead load when reviewed === false.
  React.useEffect(() => {
    if (lead?.id && lead.reviewed === false) {
      base44.entities.Lead.update(lead.id, { reviewed: true })
        .then(() => {
          queryClient.setQueryData(['lead', lead.id], (old) => old ? { ...old, reviewed: true } : old);
          queryClient.invalidateQueries({ queryKey: ['leads-paginated'] });
        })
        .catch(() => {});
    }
  }, [lead?.id, lead?.reviewed, queryClient]);

  React.useEffect(() => {
    if (lead?.event_type_interest !== undefined) setSelectedEventTypes(parseInterests(lead.event_type_interest));
    if (lead?.deposit_number) setDepositNumber(lead.deposit_number);
    if (lead?.deposit_amount) setDepositAmount(String(lead.deposit_amount));
  }, [lead?.deposit_number, lead?.deposit_amount]);

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', 'Lead', leadId],
    queryFn: () => base44.entities.ActivityLog.filter({ entity_type: 'Lead', entity_id: leadId }),
    enabled: !!leadId
  });

  const emailActivities = activities
    .filter(a => a.action === 'Automated Email Sent' || a.action === 'Email Activity')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const noteActivities = activities.filter(a => a.action === 'Manual Note').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const allLogActivities = activities.filter(a =>
    a.action === 'Lead Added' || a.action === 'Stage Changed' || a.action === 'Field Updated'
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const syncEmailActivitiesMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('logLeadEmailActivity', { leadId: lead.id });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['activities', 'Lead', leadId]);
      toast.success(`Synced ${data.newActivities} new email activities`);
    },
    onError: () => toast.error('Failed to sync email activities')
  });

  const { data: templates = [] } = useQuery({ queryKey: ['email-templates'], queryFn: () => base44.entities.EmailTemplate.list() });

  // Helper: update lead cache directly without triggering a refetch
  const updateLeadCache = (updates) => {
    queryClient.setQueryData(['lead', leadId], (old) => old ? { ...old, ...updates } : old);
  };

  const updateFieldMutation = useMutation({
    mutationFn: async ({ updates, fieldLabel }) => {
      await base44.entities.Lead.update(leadId, updates);
      // Sync preferred_date to linked event when lead has been converted
      if (updates.preferred_date && lead.converted_to_event_id) {
        await base44.entities.Event.update(lead.converted_to_event_id, {
          event_date: updates.preferred_date
        });
      }
      await base44.entities.ActivityLog.create({
        entity_type: 'Lead', entity_id: leadId,
        action: 'Field Updated',
        details: { field: fieldLabel, ...updates, changed_by: user?.full_name || 'Unknown' },
        user_id: user?.id || '', user_name: user?.full_name || 'Unknown',
        timestamp: new Date().toISOString()
      });
      return updates;
    },
    onSuccess: (updates) => {
      updateLeadCache(updates);
      queryClient.invalidateQueries({ queryKey: ['activities', 'Lead', leadId], exact: true });
    },
    onError: () => toast.error('Failed to update')
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ stage }) => {
      const oldStage = lead.stage;
      await base44.entities.Lead.update(leadId, { stage });
      await base44.entities.ActivityLog.create({
        entity_type: 'Lead', entity_id: leadId, action: 'Stage Changed',
        details: { old_stage: oldStage, new_stage: stage, changed_by: user?.full_name || 'Unknown' },
        user_id: user?.id || '', user_name: user?.full_name || 'Unknown', timestamp: new Date().toISOString()
      });
      return { stage };
    },
    onSuccess: ({ stage }) => {
      updateLeadCache({ stage });
      queryClient.invalidateQueries({ queryKey: ['activities', 'Lead', leadId], exact: true });
      toast.success('Stage updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (lead.converted_to_event_id || lead.linked_event_id) throw new Error('Cannot delete a lead converted to an event.');
      // Delete all associated activity logs
      const logs = await base44.entities.ActivityLog.filter({ entity_type: 'Lead', entity_id: leadId });
      await Promise.all(logs.map(log => base44.entities.ActivityLog.delete(log.id)));
      return base44.entities.Lead.delete(leadId);
    },
    onSuccess: () => { toast.success('Lead deleted'); navigate(createPageUrl('Leads'), { replace: true }); },
    onError: (error) => { setDeleteError(error.message); setConfirmDelete(false); }
  });

  const markAsSpamMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.SpamEmail.create({
        from: lead.name || '',
        sender_email: lead.email || '',
        subject: `Lead: ${lead.name || lead.company || 'Unknown'} (${lead.channel || 'Unknown'})`,
        body: lead.notes || '',
        spam_category: 'Other',
        spam_reason: 'Manually marked as spam from Lead Detail',
        received_at: new Date().toISOString()
      });
      const logs = await base44.entities.ActivityLog.filter({ entity_type: 'Lead', entity_id: leadId });
      await Promise.all(logs.map(log => base44.entities.ActivityLog.delete(log.id)));
      return base44.entities.Lead.delete(leadId);
    },
    onSuccess: () => { toast.success('Lead marked as spam'); navigate(createPageUrl('Leads'), { replace: true }); },
    onError: (error) => toast.error('Failed: ' + error.message)
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteText) => {
      return base44.entities.ActivityLog.create({
        entity_type: 'Lead', entity_id: leadId, action: 'Manual Note',
        details: { note: noteText }, user_id: user?.id || '', user_name: user?.full_name || 'Unknown', timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['activities', 'Lead', leadId]);
      setShowAddNote(false);
      toast.success('Note added');
    },
    onError: () => toast.error('Failed to add note')
  });

  const saveDepositMutation = useMutation({
    mutationFn: async ({ number, amount, venue }) => {
      const venueName = (venue || '').trim();
      const venueMode = houseVenueNames.includes(venueName)
        ? 'house_venue'
        : venueName
          ? 'go_to_them'
          : null;
      return base44.entities.Lead.update(leadId, {
        deposit_number: number,
        deposit_amount: amount ? Number(amount) : null,
        ...(venueName
          ? { venue: venueName, venue_mode: venueMode }
          : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['lead', leadId]);
      toast.success('Deposit info saved');
    },
    onError: () => toast.error('Failed to save deposit info')
  });

  const handleTriggerCall = async () => {
    setIsCalling(true);
    try {
      const res = await base44.functions.invoke('triggerCallTwiML', { leadId: lead.id });
      if (res.data?.success) {
        toast.success('Call initiated — rep will be connected shortly');
      } else {
        toast.error(res.data?.message || 'Failed to initiate call');
      }
    } catch (e) {
      toast.error('Failed to initiate call');
    }
    setIsCalling(false);
    setShowCallConfirm(false);
  };

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const venue = resolvedVenueName();
      const number = depositNumber.trim();
      const amount = depositAmount.trim();
      if (!number || !amount || !venue) {
        throw new Error('Enter invoice number, deposit amount, and venue before creating the event.');
      }
      const response = await base44.functions.invoke('createEventFromWonLead', {
        event: { entity_id: leadId },
        data: lead,
        venue,
        deposit_number: number,
        deposit_amount: Number(amount),
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['lead', leadId]);
      if (data?.emailWarning) {
        toast.message(data.emailWarning);
      }
      if (data?.eventId) {
        if (data.skipped) {
          toast.success('Event already exists — opening it');
        } else {
          toast.success('Event created!');
        }
        navigate(createPageUrl('EventDetail') + '?id=' + data.eventId);
        return;
      }
      if (data?.skipped) {
        toast.error(data.reason || 'Event creation was skipped');
        return;
      }
      toast.error('Event was not created — no event id returned');
    },
    onError: (error) => toast.error('Failed: ' + (error?.message || 'Unknown error'))
  });

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!lead && !deleteMutation.isPending) return <div className="text-center py-12">Lead not found</div>;
  if (!lead) return <div className="text-center py-12">Deleting...</div>;

  const stages = getStagesForChannel(lead.channel);
  const isAdmin = user?.role === 'admin';

  // Find when the current stage was entered
  const stageChangeLogs = activities
    .filter(a => a.action === 'Stage Changed' && a.details?.new_stage === lead.stage)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const stageEnteredAt = stageChangeLogs.length > 0
    ? new Date(stageChangeLogs[0].timestamp)
    : new Date(lead.created_date);

  const formatElapsed = (from) => {
    const diffMs = Date.now() - new Date(from).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Leads')}>
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-[#C84B31]">
              {lead.channel === 'B2B' && lead.company ? lead.company : lead.name}
            </h1>
            {lead.is_priority && <Star className="w-6 h-6 text-[#E8B55F] fill-[#E8B55F]" />}
            {lead.stage === 'New Inquiry' ? (
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                <button
                  onClick={() => { if (lead.channel !== 'B2C') updateFieldMutation.mutate({ updates: { channel: 'B2C' }, fieldLabel: 'Channel' }); }}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${lead.channel === 'B2C' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >B2C</button>
                <button
                  onClick={() => { if (lead.channel !== 'B2B') updateFieldMutation.mutate({ updates: { channel: 'B2B' }, fieldLabel: 'Channel' }); }}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${lead.channel === 'B2B' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >B2B</button>
              </div>
            ) : (
              <Badge className={`${CHANNEL_COLORS[lead.channel] || ''} text-sm`}>{lead.channel}</Badge>
            )}
          </div>
          {lead.channel === 'B2B' && lead.name && <p className="text-gray-600 mt-1">Contact: {lead.name}</p>}
          {lead.channel === 'B2C' && lead.company && <p className="text-gray-600 mt-1">{lead.company}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowCallConfirm(true)}>
              <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
              Call to Connect Rep
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDuplicateForm(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Lead
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSpamConfirm(true)} className="text-red-600 focus:text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Mark as Spam
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
        </div>
      </div>

      {/* Pipeline Stage - Dropdown */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardHeader><CardTitle>Pipeline Stage</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={lead.stage}
              onChange={(e) => updateStageMutation.mutate({ stage: e.target.value })}
              className={`px-4 py-2 rounded-lg border-2 font-medium text-sm ${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
            >
              {stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
            {(() => {
              const s = getStageMeta(lead.stage).status;
              if (!s) return null;
              const cls = STAGE_STATUS_COLORS[s] || 'bg-gray-100 text-gray-800 border-gray-300';
              return (
                <StageTooltip stage={lead.stage}>
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border cursor-help ${cls}`}
                  >
                    {s}
                  </span>
                </StageTooltip>
              );
            })()}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>In this stage for <span className="font-semibold text-orange-600">{formatElapsed(stageEnteredAt)}</span></span>
              <span className="text-xs text-gray-400">· since {stageEnteredAt.toLocaleDateString()} {stageEnteredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <StageEmailIndicator activities={activities} stageEnteredAt={stageEnteredAt} currentStage={lead.stage} />
          </div>
          <StageInfoBanner stage={lead.stage} />
        </CardContent>
      </Card>

      {/* State Machine Prompt */}
      <LeadStateMachine lead={lead} user={user} />

      {/* Confirmed Sales - Convert to Event */}
      {lead.stage === 'Confirmed Sales' && !lead.converted_to_event_id && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />Convert to Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">This lead is Confirmed Sales. Enter deposit details and venue, then create the event (details are saved automatically).</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600" />Invoice Number (QuickBooks) *</label>
                <Input placeholder="Invoice number..." value={depositNumber} onChange={(e) => setDepositNumber(e.target.value)} />
                {lead.deposit_number && <p className="text-xs text-green-600">Saved: {lead.deposit_number}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600" />Deposit Amount *</label>
                <Input type="number" placeholder="Amount in $..." value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                {lead.deposit_amount && <p className="text-xs text-green-600">Saved: ${lead.deposit_amount}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" />Location & Venue *</label>
              <select
                value={selectedVenue}
                onChange={(e) => { setSelectedVenue(e.target.value); if (e.target.value !== 'Other') setOtherVenue(''); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select venue...</option>
                {houseVenues.map((v) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              {selectedVenue === 'Other' && (
                <Input
                  placeholder="Enter venue name..."
                  value={otherVenue}
                  onChange={(e) => setOtherVenue(e.target.value)}
                />
              )}
              {lead.venue && (
                <p className="text-xs text-green-600">Saved: {lead.venue}</p>
              )}
            </div>
            <Button
              onClick={() =>
                saveDepositMutation.mutate({
                  number: depositNumber,
                  amount: depositAmount,
                  venue: resolvedVenueName(),
                })
              }
              disabled={saveDepositMutation.isPending || !depositNumber.trim() || !depositAmount.trim()}
              variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {saveDepositMutation.isPending ? 'Saving...' : 'Save Deposit Info'}
            </Button>
            <Button
              onClick={() => createEventMutation.mutate()}
              disabled={createEventMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {createEventMutation.isPending ? 'Creating Event...' : 'Create Event'}
            </Button>
            <p className="text-xs text-gray-500">Create Event saves invoice/amount if needed, then creates the event.</p>
          </CardContent>
        </Card>
      )}

      {lead.converted_to_event_id && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-green-600" />Converted to Event</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">This lead was successfully converted to a confirmed event.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />Venue (synced with event)
              </label>
              <select
                value={selectedVenue}
                onChange={(e) => {
                  setSelectedVenue(e.target.value);
                  if (e.target.value !== 'Other') setOtherVenue('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select venue...</option>
                {houseVenues.map((v) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              {selectedVenue === 'Other' && (
                <Input
                  placeholder="Enter venue name..."
                  value={otherVenue}
                  onChange={(e) => setOtherVenue(e.target.value)}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={saveDepositMutation.isPending || !resolvedVenueName()}
                onClick={() =>
                  saveDepositMutation.mutate({
                    number: depositNumber || lead.deposit_number || '',
                    amount: depositAmount || (lead.deposit_amount != null ? String(lead.deposit_amount) : ''),
                    venue: resolvedVenueName(),
                  })
                }
              >
                {saveDepositMutation.isPending ? 'Saving…' : 'Update venue'}
              </Button>
            </div>
            <Link to={createPageUrl('EventDetail') + '?id=' + lead.converted_to_event_id}>
              <Button className="bg-green-600 hover:bg-green-700 text-white">View Event Details</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Lost / Canceled Info */}
      {lead.stage === 'Lost/Canceled' && (
        <LostDetailsPanel
          lead={lead}
          onSave={(updates) => updateFieldMutation.mutate({ updates, fieldLabel: 'Lost Details' })}
          isPending={updateFieldMutation.isPending}
        />
      )}

      {/* Meeting Date & Time */}
      <Card className={`backdrop-blur-sm border-2 ${lead.meeting_date ? 'bg-amber-50 border-amber-300' : 'bg-white/80 border-orange-100'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <Clock className="w-5 h-5 text-amber-600" />
            Meeting Date & Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <InlineEditField
              label="Meeting Date & Time"
              value={lead.meeting_date ? new Date(lead.meeting_date).toLocaleString() : ''}
              icon={Clock}
              type="datetime-local"
              onSave={(v) => updateFieldMutation.mutate({ updates: { meeting_date: v ? new Date(v).toISOString() : '' }, fieldLabel: 'Meeting Date' })}
            />
          ) : lead.meeting_date ? (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm text-gray-500">Scheduled</p>
                <p className="text-lg font-semibold text-amber-800">{new Date(lead.meeting_date).toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">No meeting scheduled yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Contact Information & Event Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contact Information</span>
              <span className="text-xs font-medium text-[#C84B31] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">Primary Contact</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <>
                <InlineEditField label="Name" value={lead.name} icon={Users} onSave={(v) => updateFieldMutation.mutate({ updates: { name: v }, fieldLabel: 'Name' })} />
                <InlineEditField label="Email" value={lead.email} icon={Mail} type="email" onSave={(v) => updateFieldMutation.mutate({ updates: { email: v }, fieldLabel: 'Email' })} />
                <InlineEditField label="Phone" value={lead.phone} icon={Phone} onSave={(v) => updateFieldMutation.mutate({ updates: { phone: v }, fieldLabel: 'Phone' })} />
                <InlineEditField label="Company" value={lead.company} icon={Building} onSave={(v) => updateFieldMutation.mutate({ updates: { company: v }, fieldLabel: 'Company' })} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-500" /><div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{lead.email}</p></div></div>
                {lead.phone && <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-gray-500" /><div><p className="text-sm text-gray-500">Phone</p><p className="font-medium">{lead.phone}</p></div></div>}
                {lead.company && <div className="flex items-center gap-3"><Building className="w-5 h-5 text-gray-500" /><div><p className="text-sm text-gray-500">Company</p><p className="font-medium">{lead.company}</p></div></div>}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
          <CardHeader><CardTitle>Event Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <>
                <InlineEditField label="Headcount Estimate" value={lead.headcount_estimate ? String(lead.headcount_estimate) : ''} icon={Users} type="number" onSave={(v) => updateFieldMutation.mutate({ updates: { headcount_estimate: v ? Number(v) : null }, fieldLabel: 'Headcount Estimate' })} />
                <InlineEditField label="Preferred Date & Time" value={lead.preferred_date ? new Date(lead.preferred_date).toLocaleString() : ''} icon={Calendar} type="datetime-local" onSave={(v) => updateFieldMutation.mutate({ updates: { preferred_date: v ? new Date(v).toISOString() : '' }, fieldLabel: 'Preferred Date' })} />
                <div>
                  <p className="text-sm text-gray-500 mb-1">Event Type Interest</p>
                  {!editingEventTypes ? (
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm flex-1">{selectedEventTypes.length > 0 ? selectedEventTypes.join(', ') : <span className="text-gray-400 italic">Not set</span>}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingEventTypes(true)}>Edit</Button>
                    </div>
                  ) : (
                    <>
                      <div className="border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
                        {EVENT_TYPES.map(type => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                            <input type="checkbox" checked={selectedEventTypes.includes(type)} onChange={() => setSelectedEventTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])} className="w-3.5 h-3.5 accent-[#C84B31]" />
                            <span className="text-sm text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => { updateFieldMutation.mutate({ updates: { event_type_interest: selectedEventTypes.join(', ') }, fieldLabel: 'Event Type Interest' }); setEditingEventTypes(false); }} disabled={updateFieldMutation.isPending} className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white h-7 text-xs">Save</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedEventTypes(parseInterests(lead.event_type_interest)); setEditingEventTypes(false); }}>Cancel</Button>
                      </div>
                    </>
                  )}
                </div>
                <InlineEditField label="Event Format" value={lead.event_format || ''} options={['In-Person','Virtual','Hybrid']} onSave={(v) => updateFieldMutation.mutate({ updates: { event_format: v }, fieldLabel: 'Event Format' })} />
              </>
            ) : (
              <>
                {lead.headcount_estimate && <div className="flex items-center gap-3"><Users className="w-5 h-5 text-gray-500" /><div><p className="text-sm text-gray-500">Headcount</p><p className="font-medium">{lead.headcount_estimate} people</p></div></div>}
                {lead.preferred_date && <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-gray-500" /><div><p className="text-sm text-gray-500">Preferred Date</p><p className="font-medium">{new Date(lead.preferred_date).toLocaleString()}</p></div></div>}
                {lead.event_type_interest && (
                  <div>
                    <p className="text-sm text-gray-500">Event Type Interest</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {parseInterests(lead.event_type_interest).map(t => (
                        <span key={t} className="inline-block bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {lead.event_format && <div><p className="text-sm text-gray-500">Event Format</p><p className="font-medium">{lead.event_format}</p></div>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Contacts */}
      <AdditionalContactsCard
        lead={lead}
        canEdit={isAdmin}
        onSave={(contacts) =>
          updateFieldMutation.mutate({ updates: { additional_contacts: contacts }, fieldLabel: 'Additional Contacts' })
        }
        isSaving={updateFieldMutation.isPending}
      />


      {/* Additional Information + Meeting Date */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          {isAdmin ? (
            <>
              <div>
                <InlineEditField label="Source" value={lead.source} options={['Website','Email','Phone','Referral','Call','Form','Other']} onSave={(v) => updateFieldMutation.mutate({ updates: { source: v }, fieldLabel: 'Source' })} />
                {lead.referral_source === 'Other' && lead.referral_source_other && (
                  <p className="text-xs text-gray-500 mt-1 ml-1">Other: {lead.referral_source_other}</p>
                )}
              </div>
              <InlineEditField label="Channel" value={lead.channel} options={['B2B','B2C']} onSave={(v) => updateFieldMutation.mutate({ updates: { channel: v }, fieldLabel: 'Channel' })} />
              <InlineEditField label="Client Type" value={lead.client_type} options={['New','Previous','Referral']} onSave={(v) => updateFieldMutation.mutate({ updates: { client_type: v }, fieldLabel: 'Client Type' })} />
              <InlineEditField label="Referral Source" value={lead.referral_source === 'Other' && lead.referral_source_other ? lead.referral_source_other : (lead.referral_source || '')} options={['ChatGPT','Perplexity','Gemini','Google','Word-of-mouth','Washington.org','Other']} onSave={(v) => updateFieldMutation.mutate({ updates: { referral_source: v }, fieldLabel: 'Referral Source' })} />
              <div>
                <p className="text-sm text-gray-500">Created Date</p>
                <p className="font-medium text-gray-900 mt-1">{new Date(lead.created_date).toLocaleDateString()}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-medium mt-1">{lead.source || 'Not set'}</p>
                {lead.referral_source === 'Other' && lead.referral_source_other && (
                  <p className="text-xs text-gray-500 mt-0.5">Other: {lead.referral_source_other}</p>
                )}
              </div>
              <div><p className="text-sm text-gray-500">Channel</p><p className="font-medium mt-1">{lead.channel || 'Not set'}</p></div>
              <div><p className="text-sm text-gray-500">Client Type</p><p className="font-medium mt-1">{lead.client_type || 'Not set'}</p></div>
              <div><p className="text-sm text-gray-500">Created Date</p><p className="font-medium mt-1">{new Date(lead.created_date).toLocaleDateString()}</p></div>
            </>
          )}
        </CardContent>
      </Card>



      {/* Survey Information */}
      <SurveySection
        lead={lead}
        onSave={(updates) => updateFieldMutation.mutate({ updates, fieldLabel: 'Survey Data' })}
        isSaving={updateFieldMutation.isPending}
      />

      {/* Email Draft */}
      <LeadEmailDraft lead={lead} templates={templates} emailActivities={emailActivities} />

      {/* Notes & Activity */}
      <Card className="bg-white/80 backdrop-blur-sm border-orange-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notes & Activity</CardTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddNote(true)} className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white">
                  <Pencil className="w-4 h-4 mr-2" />Add Note
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => syncEmailActivitiesMutation.mutate()} disabled={syncEmailActivitiesMutation.isPending}>
                <Mail className="w-4 h-4 mr-2" />Sync Emails
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lead.notes && (
            <div><p className="text-sm font-semibold text-gray-600 mb-2">Lead Notes:</p><p className="text-gray-700 whitespace-pre-wrap">{lead.notes}</p></div>
          )}

          {noteActivities.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Manual Notes:</p>
              <div className="space-y-2">
                {noteActivities.slice((notesPage - 1) * ITEMS_PER_PAGE, notesPage * ITEMS_PER_PAGE).map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Pencil className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-800 whitespace-pre-wrap">{a.details?.note}</p>
                      <p className="text-xs text-gray-500 mt-1">By {a.user_name} — {new Date(a.timestamp).toLocaleDateString()} at {new Date(a.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {noteActivities.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">Page {notesPage} of {Math.ceil(noteActivities.length / ITEMS_PER_PAGE)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={notesPage === 1} onClick={() => setNotesPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={notesPage >= Math.ceil(noteActivities.length / ITEMS_PER_PAGE)} onClick={() => setNotesPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {emailActivities.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Email History:</p>
              <div className="space-y-2">
                {emailActivities.slice((emailPage - 1) * ITEMS_PER_PAGE, emailPage * ITEMS_PER_PAGE).map(a => {
                  const canReply = !!a.details?.gmail_message_id;
                  const emailForModal = canReply ? {
                    id: a.details.gmail_message_id,
                    subject: a.details?.subject || a.details?.template || '(No Subject)',
                    from: a.details?.from || '',
                    to: a.details?.to || '',
                    date: a.details?.date || a.timestamp
                  } : null;
                  return (
                    <div
                      key={a.id}
                      role={canReply ? 'button' : undefined}
                      onClick={canReply ? () => setSelectedEmailForView(emailForModal) : undefined}
                      className={`flex items-start gap-2 text-sm bg-green-50 border border-green-200 rounded-lg p-3 ${canReply ? 'cursor-pointer hover:bg-green-100/80 transition-colors' : ''}`}
                    >
                      <Mail className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-green-700">{a.details?.subject || a.details?.template}</p>
                        {a.details?.direction && <p className="text-xs text-gray-600 mt-1">{a.details.direction}: {a.details.from} → {a.details.to}</p>}
                        <p className="text-xs text-gray-500">{new Date(a.timestamp).toLocaleDateString()} at {new Date(a.timestamp).toLocaleTimeString()}</p>
                      </div>
                      {canReply && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-green-300 text-green-700 hover:bg-green-100 h-8"
                          onClick={(e) => { e.stopPropagation(); setSelectedEmailForView(emailForModal); }}
                        >
                          <Reply className="w-3.5 h-3.5 mr-1.5" />
                          Reply
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              {emailActivities.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">Page {emailPage} of {Math.ceil(emailActivities.length / ITEMS_PER_PAGE)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={emailPage === 1} onClick={() => setEmailPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={emailPage >= Math.ceil(emailActivities.length / ITEMS_PER_PAGE)} onClick={() => setEmailPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {allLogActivities.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Activity Log:</p>
              <div className="space-y-2">
                {allLogActivities.slice((logPage - 1) * ITEMS_PER_PAGE, logPage * ITEMS_PER_PAGE).map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <Activity className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      {a.action === 'Lead Added' && (
                        <p className="font-medium text-gray-700">Lead added via {a.details?.method || 'Unknown'} by {a.details?.added_by || a.user_name}</p>
                      )}
                      {a.action === 'Stage Changed' && (
                        <p className="font-medium text-gray-700">
                          Stage:{' '}
                          <StageTooltip stage={a.details?.old_stage}>
                            <span className="text-orange-600 cursor-help underline decoration-dotted decoration-orange-300 underline-offset-2">{a.details?.old_stage}</span>
                          </StageTooltip>
                          {' '}→{' '}
                          <StageTooltip stage={a.details?.new_stage}>
                            <span className="text-green-600 cursor-help underline decoration-dotted decoration-green-300 underline-offset-2">{a.details?.new_stage}</span>
                          </StageTooltip>
                          {' '}by {a.details?.changed_by || a.user_name}
                        </p>
                      )}
                      {a.action === 'Field Updated' && (
                        <p className="font-medium text-gray-700">{a.details?.field} updated by {a.details?.changed_by || a.user_name}</p>
                      )}
                      <p className="text-xs text-gray-500">{new Date(a.timestamp).toLocaleDateString()} at {new Date(a.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {allLogActivities.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">Page {logPage} of {Math.ceil(allLogActivities.length / ITEMS_PER_PAGE)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={logPage === 1} onClick={() => setLogPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={logPage >= Math.ceil(allLogActivities.length / ITEMS_PER_PAGE)} onClick={() => setLogPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!lead.notes && noteActivities.length === 0 && emailActivities.length === 0 && allLogActivities.length === 0 && (
            <p className="text-gray-500 text-sm italic">No notes or activity yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Delete at bottom */}
      {isAdmin && (
        <div className="flex flex-col items-end gap-2 pt-4 border-t border-orange-100">
          {deleteError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full">
              <span className="font-semibold">Cannot delete:</span> {deleteError}
            </div>
          )}
          {!confirmDelete ? (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="text-red-600 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />Delete Lead
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Are you sure you want to delete this lead?</span>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          )}
        </div>
      )}

      {showDuplicateForm && (
        <LeadFormDialog
          onClose={() => setShowDuplicateForm(false)}
          prefillData={{ name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, source: lead.source, client_type: 'Previous', channel: lead.channel, referral_source: lead.referral_source, referral_source_other: lead.referral_source_other }}
        />
      )}
      {showEditForm && <LeadFormDialog lead={lead} onClose={() => setShowEditForm(false)} />}
      {showAddNote && <AddNoteDialog onClose={() => setShowAddNote(false)} onSave={(note) => addNoteMutation.mutate(note)} isPending={addNoteMutation.isPending} />}
      {selectedEmailForView && lead && (
        <EmailViewModal
          email={selectedEmailForView}
          lead={lead}
          onClose={() => setSelectedEmailForView(null)}
        />
      )}

      <AlertDialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <PhoneCall className="w-5 h-5" />
              Call to Connect Rep
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This will place an automated call to the rep and brief them on{' '}
              <strong>{lead.name}{lead.company ? ` (${lead.company})` : ''}</strong>.
              The rep will hear a summary of this lead before being connected to the client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCalling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTriggerCall}
              disabled={isCalling}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCalling ? 'Initiating...' : 'Yes, Call Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSpamConfirm} onOpenChange={setShowSpamConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Mark Lead as Spam
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This will permanently <strong>delete</strong> this lead from the CRM and move it to the <strong>Spam Leads</strong> section.
              The lead&apos;s contact info and notes will be saved as a spam record for future reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markAsSpamMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => markAsSpamMutation.mutate()}
              disabled={markAsSpamMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {markAsSpamMutation.isPending ? 'Moving to Spam...' : 'Mark as Spam'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}