import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Zap, CalendarClock, ThermometerSun, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getStageMeta, STATUS_COLORS as STAGE_STATUS_COLORS } from '@/components/leads/stageMetadata';
import { Info } from 'lucide-react';
import PlanningDiscussionChecklist from '@/components/leads/PlanningDiscussionChecklist';

const WARMTH_LABELS = ['', 'Cold', 'Cool', 'Warm', 'Hot', 'On Fire'];
const WARMTH_COLORS = ['', 'bg-blue-500', 'bg-sky-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];

const STATE_MACHINE = {
  'New Inquiry': {
    prompt: 'Has the initial call been attempted?',
    actions: [
      { label: 'Yes – Call Attempted', nextStage: 'Outreach Initiated – Call Attempted' }
    ]
  },
  'Outreach Initiated – Call Attempted': {
    prompt: 'Did the client answer the call?',
    actions: [
      { label: 'Yes – They Answered', nextStage: 'Program Planning Discussion' },
      { label: 'No – No Answer', nextStage: 'No Answer – 1st Email Sent' }
    ]
  },
  'No Answer – 1st Email Sent': {
    prompt: 'Did the client respond to the email?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Calendar Invite Sent' },
      { label: 'No – No Response', nextStage: 'Invite Not Accepted' }
    ]
  },
  'Calendar Invite Sent': {
    prompt: 'Has the calendar invite been accepted?',
    actions: [
      { label: 'Yes – Invite Accepted', nextStage: 'Invite Accepted – Survey Sent' },
      { label: 'No – Not Accepted', nextStage: 'Invite Not Accepted' }
    ]
  },
  'Invite Not Accepted': {
    prompt: 'Did they respond to the Reconnect email?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Calendar Invite Sent' },
      { label: 'No – Still No Response', nextStage: '2nd Follow-Up – Off Radar' }
    ]
  },
  '2nd Follow-Up – Off Radar': {
    prompt: 'Any response to Off-Radar email?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Calendar Invite Sent' },
      { label: 'No – No Response', nextStage: 'No Response – Final Email Sent' }
    ]
  },
  'No Response – Final Email Sent': {
    prompt: 'Did they respond to the final outreach?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Calendar Invite Sent' },
      { label: 'No – Marking as Lost', nextStage: 'Lost/Canceled' }
    ]
  },
  'Invite Accepted – Survey Sent': {
    prompt: 'Has the pre-program survey been collected?',
    actions: [
      { label: 'Yes – Survey Collected', nextStage: 'Program Planning Discussion' }
    ]
  },
  'Program Planning Discussion': {
    specialType: 'planning_discussion_checklist'
  },
  'After Meeting Follow-Up': {
    prompt: null,
    specialType: 'post_meeting_form'
  },
  'Client Follow-Up – Review Template': {
    prompt: 'Did the client agree after the review?',
    actions: [
      { label: 'Yes – They Agreed', nextStage: 'Deposit Requested' },
      { label: 'No – Closing as Lost', nextStage: 'Lost/Canceled' }
    ]
  },
  'Deposit Requested': {
    prompt: 'Has the payment been received?',
    actions: [
      { label: 'Yes – Payment Received', nextStage: 'Confirmed Sales' }
    ]
  }
};

const B2B_STATE_MACHINE = {
  'New Inquiry': {
    prompt: 'Has the lead been contacted yet?',
    actions: [
      { label: 'No – Begin Outreach', nextStage: 'Initial Outreach – Call to Schedule' }
    ]
  },
  'Initial Outreach – Call to Schedule': {
    prompt: 'Did the client answer the call?',
    actions: [
      { label: 'Yes – They Answered', nextStage: 'Program Planning Discussion' },
      { label: 'No – No Answer', nextStage: 'Survey Sent' }
    ]
  },
  'Survey Sent': {
    prompt: 'Has the client completed the survey within 24 hours?',
    actions: [
      { label: 'Yes – Survey Completed', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – No Response', nextStage: 'No Survey Response – Follow-Up 1' }
    ]
  },
  'Awaiting Survey Response (24hr)': {
    prompt: 'Did the client complete the survey within the 24-hour window?',
    actions: [
      { label: 'Yes – Survey Completed', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – No Response', nextStage: 'No Survey Response – Follow-Up 1' }
    ]
  },
  'No Survey Response – Follow-Up 1': {
    prompt: 'Did the client respond after the Overwhelm Nudge email?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – Still No Response', nextStage: 'Awaiting Response After Follow-Up 1' }
    ]
  },
  'Awaiting Response After Follow-Up 1': {
    prompt: 'Did the client respond within 48 hours of Follow-Up 1?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – Still No Response', nextStage: 'No Response – Follow-Up 2' }
    ]
  },
  'No Response – Follow-Up 2': {
    prompt: 'Did the client respond after the Fall Off Radar email?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – Still No Response', nextStage: 'Awaiting Response After Follow-Up 2' }
    ]
  },
  'Awaiting Response After Follow-Up 2': {
    prompt: 'Did the client respond within 48 hours of Follow-Up 2?',
    actions: [
      { label: 'Yes – They Responded', nextStage: 'Survey Completed – Calendar Invite Sent' },
      { label: 'No – Still No Response', nextStage: 'No Response – Final Email Sent' }
    ]
  },
  'Survey Completed – Calendar Invite Sent': {
    prompt: 'Has the calendar invite been sent to the client?',
    actions: [
      { label: 'Sent – Awaiting Response', nextStage: 'Awaiting Calendar Acceptance' }
    ]
  },
  'Awaiting Calendar Acceptance': {
    prompt: 'Did the client accept the calendar invite?',
    actions: [
      { label: 'Yes – Accepted', nextStage: 'Calendar Accepted' },
      { label: 'No / No Response – Resend', nextStage: 'Calendar Invite Resent' }
    ]
  },
  'Calendar Invite Resent': {
    prompt: 'Did the client accept the resent calendar invite?',
    actions: [
      { label: 'Yes – Accepted', nextStage: 'Calendar Accepted' },
      { label: 'No – Closing as Lost', nextStage: 'Lost/Canceled' }
    ]
  },
  'Calendar Accepted': {
    prompt: 'Is the meeting confirmed and scheduled?',
    actions: [
      { label: 'Yes – Proceed to Planning', nextStage: 'Program Planning Discussion' }
    ]
  },
  'Program Planning Discussion': {
    specialType: 'planning_discussion_checklist'
  }
};

function PostMeetingForm({ onSubmit, isLoading, lead }) {
  const [saleConfirmed, setSaleConfirmed] = useState(lead?.followup_sale_confirmed ?? null);
  const [clientType, setClientType] = useState(lead?.followup_client_type || 'New');
  const [decisionDate, setDecisionDate] = useState(lead?.followup_response_eta || '');
  const [nextDate, setNextDate] = useState(lead?.followup_next_date || '');

  const getNextWorkingDay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    let daysToAdd = 1;
    if (day === 5) daysToAdd = 3; // Friday → Monday
    if (day === 6) daysToAdd = 2; // Saturday → Monday
    if (day === 0) daysToAdd = 1; // Sunday → Monday (already 1, but explicit)
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  const handleDecisionDateChange = (value) => {
    setDecisionDate(value);
    if (value) setNextDate(getNextWorkingDay(value));
  };
  const [experience, setExperience] = useState(lead?.followup_experience_confirmation || lead?.event_type_interest || '');
  const [warmth, setWarmth] = useState(lead?.followup_warmth_scale || 0);
  const [meetingNotes, setMeetingNotes] = useState(lead?.followup_meeting_notes || '');
  const [contractRequired, setContractRequired] = useState(lead?.followup_contract_required ?? null);

  const canSubmit = saleConfirmed !== null;

  return (
    <div className="space-y-5 mt-3">

      {/* Sale Confirmed — always visible, top, large */}
      <div className="space-y-2">
        <Label className="text-base font-semibold text-gray-800">Sale Confirmed?</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSaleConfirmed(true)}
            className={`py-4 rounded-xl border-2 text-base font-bold transition-all ${saleConfirmed === true ? 'bg-green-600 border-green-600 text-white shadow-md' : 'border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50'}`}
          >
            ✅ Yes
          </button>
          <button
            onClick={() => setSaleConfirmed(false)}
            className={`py-4 rounded-xl border-2 text-base font-bold transition-all ${saleConfirmed === false ? 'bg-red-500 border-red-500 text-white shadow-md' : 'border-gray-300 text-gray-600 hover:border-red-400 hover:bg-red-50'}`}
          >
            ❌ No
          </button>
        </div>
      </div>

      {/* Always-visible fields */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />What is their preferred experience?
        </Label>
        <Select value={experience} onValueChange={setExperience}>
          <SelectTrigger>
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>🏠 In-Person Events</SelectLabel>
              <SelectItem value="Cooking Class">Cooking Class</SelectItem>
              <SelectItem value="Paint & Sip">Paint & Sip</SelectItem>
              <SelectItem value="Mixology Class">Mixology Class</SelectItem>
              <SelectItem value="Chocolate Making">Chocolate Making</SelectItem>
              <SelectItem value="Chocolate and Wine Tasting">Chocolate and Wine Tasting</SelectItem>
              <SelectItem value="Terrarium Building">Terrarium Building</SelectItem>
              <SelectItem value="Cheese Board Making">Cheese Board Making</SelectItem>
              <SelectItem value="Lend a Hand for Good">Lend a Hand for Good</SelectItem>
              <SelectItem value="Yoga and unWINEd">Yoga and unWINEd</SelectItem>
              <SelectItem value="Alcohol Tasting">Alcohol Tasting</SelectItem>
              <SelectItem value="Flavors of DC">Flavors of DC</SelectItem>
              <SelectItem value="Baking Class">Baking Class</SelectItem>
              <SelectItem value="Dine Around">Dine Around</SelectItem>
              <SelectItem value="Georgetown Food Tour">Georgetown Food Tour</SelectItem>
              <SelectItem value="DuPont Food Tour">DuPont Food Tour</SelectItem>
              <SelectItem value="Premium Food Tour">Premium Food Tour</SelectItem>
              <SelectItem value="Scavenger">Scavenger</SelectItem>
              <SelectItem value="Monuments Tour">Monuments Tour</SelectItem>
              <SelectItem value="Wine/Whiskey Tasting">Wine/Whiskey Tasting</SelectItem>
              <SelectItem value="Bike Tour">Bike Tour</SelectItem>
              <SelectItem value="Hand-Crafted Pottery Class">Hand-Crafted Pottery Class</SelectItem>
              <SelectItem value="DC at your Door">DC at your Door</SelectItem>
              <SelectItem value="The Guac Gourmet Showdown">The Guac Gourmet Showdown</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectItem value="Other">Other</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <ThermometerSun className="w-4 h-4 text-orange-500" />How warm is this lead? (1 = Cold, 5 = On Fire)
        </Label>
        <div className="flex items-center gap-2">
          {[1,2,3,4,5].map((n) => (
            <button key={n} type="button" onClick={() => setWarmth(n)}
              className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${warmth >= n ? `${WARMTH_COLORS[n]} text-white shadow-md scale-110` : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
            >{n}</button>
          ))}
          {warmth > 0 && <span className="ml-2 text-sm font-medium text-gray-600">{WARMTH_LABELS[warmth]}</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-500" />Does the client require a contract?
        </Label>
        <div className="flex gap-3">
          {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => setContractRequired(value)}
              className={`px-5 py-2 rounded-lg font-medium text-sm border transition-all ${
                contractRequired === value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          {contractRequired !== null && (
            <button type="button" onClick={() => setContractRequired(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-gray-500" />Any additional details worth mentioning?
        </Label>
        <Textarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} placeholder="Notes from the meeting, next steps, concerns, etc." rows={3} />
      </div>

      {/* "No" path — conditionally revealed */}
      {saleConfirmed === false && (
        <div className="border-t border-amber-200 pt-4 space-y-4">
          <p className="text-sm font-semibold text-amber-700">📋 Still Deciding — Follow-Up Planning</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-lime-600" />When will they get back to us?
              </Label>
              <Input type="date" value={decisionDate} onChange={(e) => handleDecisionDateChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-green-600" />When should we follow up next?
              </Label>
              <p className="text-xs text-gray-400">This will appear as a to-do on the calendar</p>
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Client Type</Label>
            <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm w-40">
              <option value="New">New</option>
              <option value="Previous">Previous</option>
              <option value="Referral">Referral</option>
            </select>
          </div>
        </div>
      )}

      <Button
        onClick={() => onSubmit({ decisionDate, saleConfirmed, clientType, nextDate, experience, warmth, meetingNotes, contractRequired })}
        disabled={!canSubmit || isLoading}
        className="bg-[#C84B31] hover:bg-[#A03A23] text-white w-full"
      >
        {isLoading ? 'Saving...' : 'Submit & Advance Stage'}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

// Shared stages between B2B and B2C
const SHARED_STAGES = ['Program Planning Discussion', 'After Meeting Follow-Up', 'Client Follow-Up – Review Template', 'Deposit Requested', 'No Response – Final Email Sent', 'Lost/Canceled', 'Confirmed Sales'];

function getConfig(lead) {
  const isB2B = lead.channel === 'B2B';
  if (isB2B) {
    return B2B_STATE_MACHINE[lead.stage] || STATE_MACHINE[lead.stage] || null;
  }
  return STATE_MACHINE[lead.stage] || null;
}

export default function LeadStateMachine({ lead, user }) {
  const queryClient = useQueryClient();
  const config = getConfig(lead);

  const transitionMutation = useMutation({
    mutationFn: async ({ nextStage, logDetails, followupUpdates }) => {
      const oldStage = lead.stage;
      const leadUpdate = { stage: nextStage };
      if (followupUpdates) Object.assign(leadUpdate, followupUpdates);
      await base44.entities.Lead.update(lead.id, leadUpdate);
      await base44.entities.ActivityLog.create({
        entity_type: 'Lead',
        entity_id: lead.id,
        action: 'Stage Changed',
        details: {
          old_stage: oldStage,
          new_stage: nextStage,
          action_taken: logDetails?.actionTaken || 'State machine transition',
          changed_by: user?.full_name || 'Unknown',
          ...logDetails
        },
        user_id: user?.id || '',
        user_name: user?.full_name || 'Unknown',
        timestamp: new Date().toISOString()
      });
      return { newStage: nextStage, followupUpdates: followupUpdates || {} };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['lead', lead.id], (old) => old ? { ...old, stage: result.newStage, ...result.followupUpdates } : old);
      queryClient.invalidateQueries({ queryKey: ['activities', 'Lead', lead.id], exact: true });
      toast.success('Stage advanced');
    },
    onError: () => toast.error('Failed to advance stage')
  });

  const handleAction = (action) => {
    transitionMutation.mutate({
      nextStage: action.nextStage,
      logDetails: { actionTaken: action.label },
      followupUpdates: null
    });
  };

  const handlePostMeetingSubmit = ({ decisionDate, saleConfirmed, clientType, nextDate, experience, warmth, meetingNotes, contractRequired }) => {
    const isB2B = lead.channel === 'B2B';
    const nextStage = saleConfirmed ? (isB2B ? 'Deposit Requested' : 'Confirmed Sales') : 'After Meeting Follow-Up';
    const followupUpdates = {
      followup_sale_confirmed: saleConfirmed,
      followup_client_type: clientType || null,
      followup_response_eta: decisionDate || null,
      followup_next_date: nextDate || null,
      followup_experience_confirmation: experience || null,
      followup_warmth_scale: warmth || null,
      followup_meeting_notes: meetingNotes || null,
      followup_contract_required: contractRequired ?? null,
    };
    transitionMutation.mutate({
      nextStage,
      logDetails: {
        actionTaken: `Post-meeting form submitted. Sale ${saleConfirmed ? 'confirmed' : 'not confirmed'}. Client type: ${clientType}.`,
        sale_confirmed: saleConfirmed,
        client_type: clientType,
        ...followupUpdates,
      },
      followupUpdates,
    });
  };

  if (!config) return null;

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-[#C84B31]/30 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[#C84B31] text-base">
          <Zap className="w-4 h-4" />
          Next Action
        </CardTitle>
      </CardHeader>
      <CardContent>
        {config.specialType === 'post_meeting_form' ? (
          <>
            <p className="text-gray-700 font-medium mb-1">Complete the post-meeting assessment:</p>
            <PostMeetingForm onSubmit={handlePostMeetingSubmit} isLoading={transitionMutation.isPending} lead={lead} />
          </>
        ) : config.specialType === 'planning_discussion_checklist' ? (
          <PlanningDiscussionChecklist
            isLoading={transitionMutation.isPending}
            onConfirm={() =>
              transitionMutation.mutate({
                nextStage: 'After Meeting Follow-Up',
                logDetails: { actionTaken: 'Planning discussion completed and thank-you email sent' },
                followupUpdates: null,
              })
            }
          />
        ) : (
          <>
            <p className="text-gray-700 font-medium mb-3">{config.prompt}</p>
            <div className="flex flex-wrap gap-2">
              {config.actions.map((action) => (
                <Button
                  key={action.label}
                  onClick={() => handleAction(action)}
                  disabled={transitionMutation.isPending}
                  className={
                    action.label.toLowerCase().includes('no') || action.label.toLowerCase().includes('lost')
                      ? 'bg-gray-600 hover:bg-gray-700 text-white'
                      : 'bg-[#C84B31] hover:bg-[#A03A23] text-white'
                  }
                >
                  {action.label}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ))}
            </div>
            {transitionMutation.isPending && <p className="text-xs text-gray-500 mt-2">Updating stage...</p>}

            {/* Preview of the next stage(s) the action would move this lead to */}
            <div className="mt-4 space-y-2">
              {config.actions.map((action) => {
                const meta = getStageMeta(action.nextStage);
                if (!meta.description && !meta.status) return null;
                const statusCls = STAGE_STATUS_COLORS[meta.status] || 'bg-gray-100 text-gray-800 border-gray-300';
                return (
                  <div key={action.nextStage} className="flex items-start gap-2 bg-white/70 border border-orange-200 rounded-md p-2.5">
                    <Info className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500">If </span>
                        <span className="font-semibold text-gray-800">"{action.label}"</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-gray-800">{action.nextStage}</span>
                        {meta.status && (
                          <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${statusCls}`}>
                            {meta.status}
                          </span>
                        )}
                      </div>
                      {meta.description && <p className="text-gray-600 mt-0.5 leading-snug">{meta.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}