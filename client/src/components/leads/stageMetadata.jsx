// Stage metadata: description (what it means) + status label
// Used across the platform (LeadDetail, state machine, emails) to keep language consistent.

export const STAGE_META = {
  // Shared / Universal
  'New Inquiry': {
    description: 'Brand new lead has just come in — no contact made yet, sitting in queue for first outreach.',
    status: 'New'
  },
  'Program Planning Discussion': {
    description: 'Active planning meeting underway — discussing event needs, budget, and program details with the client.',
    status: 'In Meeting'
  },
  'After Meeting Follow-Up': {
    description: 'Meeting done — sending deposit request, TripAdvisor or recognition template based on client type; awaiting their decision.',
    status: 'Proposal'
  },
  'Deposit Requested': {
    description: 'Client agreed to move forward — deposit invoice sent, waiting on payment to officially confirm the booking.',
    status: 'Pending Payment'
  },
  'Confirmed Sales': {
    description: 'Deposit received and sale is confirmed — event is on the books, internal workflows and sales alerts triggered.',
    status: 'Won'
  },
  'Lost/Canceled': {
    description: 'Lead did not convert or event was canceled — reason logged, newsletter opt-in noted for future nurturing.',
    status: 'Closed Lost'
  },

  // B2B-only
  'Initial Outreach – Call to Schedule': {
    description: 'First call placed to the B2B client to schedule a planning discussion; outcome drives whether survey or calendar invite goes next.',
    status: 'Active'
  },
  'Survey Sent': {
    description: 'Call went unanswered — pre-program survey emailed to collect event details and availability before scheduling.',
    status: 'Active'
  },
  'Awaiting Survey Response (24hr)': {
    description: 'Holding 24 hours for the client to fill in the survey before deciding whether to nudge or proceed.',
    status: 'Waiting'
  },
  'No Survey Response – Follow-Up 1': {
    description: 'No survey reply received — "overwhelm nudge" email sent to re-engage and make it easy for the client to respond.',
    status: 'Following Up'
  },
  'Awaiting Response After Follow-Up 1': {
    description: 'Waiting 48 hours after the first nudge — if no reply, escalate to second follow-up.',
    status: 'Waiting'
  },
  'No Response – Follow-Up 2': {
    description: 'Still silent after nudge — "fall off radar" email sent as a second attempt to reconnect before final outreach.',
    status: 'At Risk'
  },
  'Awaiting Response After Follow-Up 2': {
    description: '48-hour hold after second follow-up — lead is at serious risk of closing if no engagement here.',
    status: 'At Risk'
  },
  'No Response – Final Email Sent': {
    description: 'Last-chance email sent — no reply within 48 hours means this lead will be closed out.',
    status: 'Closing Soon'
  },
  'Survey Completed – Calendar Invite Sent': {
    description: 'Survey returned and calendar invite sent — client is engaged and a planning meeting is being scheduled.',
    status: 'Progressing'
  },
  'Awaiting Calendar Acceptance': {
    description: 'Invite is out — waiting on client to accept and lock in the meeting slot before proceeding.',
    status: 'Waiting'
  },
  'Calendar Invite Resent': {
    description: 'Original invite was ignored or declined — resent after 24 hours to keep the meeting from falling through.',
    status: 'Following Up'
  },
  'Calendar Accepted': {
    description: 'Client confirmed the meeting — discussion is locked in and the team is ready to conduct the planning call.',
    status: 'Confirmed'
  },

  // B2C-only
  'Outreach Initiated – Call Attempted': {
    description: 'First call made to the B2C client — if answered, move to planning; if not, begin email follow-up sequence.',
    status: 'Active'
  },
  'No Answer – 1st Email Sent': {
    description: 'Call unanswered — first email sent requesting availability; response triggers a calendar invite, silence triggers overwhelm email.',
    status: 'Following Up'
  },
  'Calendar Invite Sent': {
    description: 'Client responded to outreach — calendar invite sent to schedule the program planning discussion.',
    status: 'Progressing'
  },
  'Invite Not Accepted': {
    description: 'Invite sent but not yet accepted — follow-up email dispatched after 48 hours to nudge the client to confirm.',
    status: 'Waiting'
  },
  '2nd Follow-Up – Off Radar': {
    description: 'No invite acceptance after first nudge — second follow-up sent to a client who has gone quiet; lead is at risk.',
    status: 'At Risk'
  },
  'Invite Accepted – Survey Sent': {
    description: 'Meeting confirmed and pre-program survey sent — collecting event details before the planning discussion takes place.',
    status: 'Confirmed'
  }
};

export const STATUS_COLORS = {
  'New': 'bg-blue-100 text-blue-800 border-blue-300',
  'Active': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'In Meeting': 'bg-green-100 text-green-800 border-green-300',
  'Proposal': 'bg-purple-100 text-purple-800 border-purple-300',
  'Pending Payment': 'bg-amber-100 text-amber-800 border-amber-300',
  'Won': 'bg-emerald-600 text-white border-emerald-700',
  'Closed Lost': 'bg-gray-700 text-white border-gray-800',
  'Waiting': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Following Up': 'bg-orange-100 text-orange-800 border-orange-300',
  'At Risk': 'bg-red-100 text-red-800 border-red-300',
  'Closing Soon': 'bg-red-200 text-red-900 border-red-400',
  'Progressing': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Confirmed': 'bg-teal-100 text-teal-800 border-teal-300'
};

export function getStageMeta(stage) {
  return STAGE_META[stage] || { description: '', status: '' };
}