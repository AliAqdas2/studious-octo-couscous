// Common free email domains for B2C detection
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'live.com', 'msn.com', 'me.com', 'mac.com', 'comcast.net',
  'verizon.net', 'att.net', 'cox.net', 'sbcglobal.net', 'charter.net'
];

export function detectChannelFromEmail(email) {
  if (!email) return 'B2C';
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'B2C';
  return FREE_EMAIL_DOMAINS.includes(domain) ? 'B2C' : 'B2B';
}

export const B2C_STAGES = [
  'New Inquiry',
  'Outreach Initiated – Call Attempted',
  'No Answer – 1st Email Sent',
  'Calendar Invite Sent',
  'Invite Not Accepted',
  '2nd Follow-Up – Off Radar',
  'No Response – Final Email Sent',
  'Invite Accepted – Survey Sent',
  'Program Planning Discussion',
  'After Meeting Follow-Up',
  'Deposit Requested',
  'Confirmed Sales',
  'Completed',
  'Lost/Canceled',
];

export const B2B_STAGES = [
  'New Inquiry',
  'Initial Outreach – Call to Schedule',
  'Survey Sent',
  'Awaiting Survey Response (24hr)',
  'No Survey Response – Follow-Up 1',
  'Awaiting Response After Follow-Up 1',
  'No Response – Follow-Up 2',
  'Awaiting Response After Follow-Up 2',
  'No Response – Final Email Sent',
  'Survey Completed – Calendar Invite Sent',
  'Awaiting Calendar Acceptance',
  'Calendar Invite Resent',
  'Calendar Accepted',
  'Program Planning Discussion',
  'After Meeting Follow-Up',
  'Deposit Requested',
  'Confirmed Sales',
  'Completed',
  'Lost/Canceled',
];

export const ALL_STAGES = [...new Set([...B2C_STAGES, ...B2B_STAGES])];

export function getStagesForChannel(channel) {
  return channel === 'B2B' ? B2B_STAGES : B2C_STAGES;
}

export const B2C_TRANSITIONS = {
  'New Inquiry': ['Outreach Initiated – Call Attempted'],
  'Outreach Initiated – Call Attempted': ['No Answer – 1st Email Sent', 'Calendar Invite Sent'],
  'No Answer – 1st Email Sent': ['Calendar Invite Sent', '2nd Follow-Up – Off Radar'],
  'Calendar Invite Sent': ['Invite Not Accepted', 'Invite Accepted – Survey Sent'],
  'Invite Not Accepted': ['2nd Follow-Up – Off Radar'],
  '2nd Follow-Up – Off Radar': ['No Response – Final Email Sent', 'Calendar Invite Sent'],
  'No Response – Final Email Sent': [],
  'Invite Accepted – Survey Sent': ['Program Planning Discussion'],
  'Program Planning Discussion': ['After Meeting Follow-Up', 'Confirmed Sales', 'Lost/Canceled'],
  'After Meeting Follow-Up': ['Deposit Requested', 'Confirmed Sales', 'Lost/Canceled'],
  'Deposit Requested': ['Confirmed Sales', 'Lost/Canceled'],
  'Confirmed Sales': ['Completed', 'Lost/Canceled'],
  'Completed': [],
  'Lost/Canceled': [],
};

export const B2B_TRANSITIONS = {
  'New Inquiry': ['Initial Outreach – Call to Schedule'],
  'Initial Outreach – Call to Schedule': ['Survey Sent'],
  'Survey Sent': ['Awaiting Survey Response (24hr)'],
  'Awaiting Survey Response (24hr)': ['No Survey Response – Follow-Up 1', 'Survey Completed – Calendar Invite Sent'],
  'No Survey Response – Follow-Up 1': ['Awaiting Response After Follow-Up 1'],
  'Awaiting Response After Follow-Up 1': ['No Response – Follow-Up 2', 'Survey Completed – Calendar Invite Sent'],
  'No Response – Follow-Up 2': ['Awaiting Response After Follow-Up 2'],
  'Awaiting Response After Follow-Up 2': ['No Response – Final Email Sent', 'Survey Completed – Calendar Invite Sent'],
  'No Response – Final Email Sent': [],
  'Survey Completed – Calendar Invite Sent': ['Awaiting Calendar Acceptance'],
  'Awaiting Calendar Acceptance': ['Calendar Invite Resent', 'Calendar Accepted'],
  'Calendar Invite Resent': ['Calendar Accepted'],
  'Calendar Accepted': ['Program Planning Discussion'],
  'Program Planning Discussion': ['After Meeting Follow-Up', 'Confirmed Sales', 'Lost/Canceled'],
  'After Meeting Follow-Up': ['Deposit Requested', 'Confirmed Sales', 'Lost/Canceled'],
  'Deposit Requested': ['Confirmed Sales', 'Lost/Canceled'],
  'Confirmed Sales': ['Completed', 'Lost/Canceled'],
  'Completed': [],
  'Lost/Canceled': [],
};

export function getTransitionsForChannel(channel) {
  return channel === 'B2B' ? B2B_TRANSITIONS : B2C_TRANSITIONS;
}

export const STAGE_COLORS = {
  'New Inquiry': 'bg-blue-100 text-blue-800 border-blue-200',
  'Outreach Initiated – Call Attempted': 'bg-purple-100 text-purple-800 border-purple-200',
  'No Answer – 1st Email Sent': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Calendar Invite Sent': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Invite Not Accepted': 'bg-orange-100 text-orange-800 border-orange-200',
  '2nd Follow-Up – Off Radar': 'bg-gray-100 text-gray-800 border-gray-200',
  'No Response – Final Email Sent': 'bg-red-100 text-red-800 border-red-200',
  'Invite Accepted – Survey Sent': 'bg-teal-100 text-teal-800 border-teal-200',
  'Program Planning Discussion': 'bg-green-100 text-green-800 border-green-200',
  'After Meeting Follow-Up': 'bg-lime-100 text-lime-800 border-lime-200',
  'Deposit Requested': 'bg-violet-100 text-violet-800 border-violet-200',
  'Confirmed Sales': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Completed': 'bg-green-200 text-green-900 border-green-300',
  'Lost/Canceled': 'bg-red-100 text-red-800 border-red-200',
  'Initial Outreach – Call to Schedule': 'bg-purple-100 text-purple-800 border-purple-200',
  'Survey Sent': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Awaiting Survey Response (24hr)': 'bg-orange-100 text-orange-800 border-orange-200',
  'No Survey Response – Follow-Up 1': 'bg-amber-100 text-amber-800 border-amber-200',
  'Awaiting Response After Follow-Up 1': 'bg-orange-100 text-orange-800 border-orange-200',
  'No Response – Follow-Up 2': 'bg-red-100 text-red-800 border-red-200',
  'Awaiting Response After Follow-Up 2': 'bg-red-100 text-red-800 border-red-200',
  'Survey Completed – Calendar Invite Sent': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Awaiting Calendar Acceptance': 'bg-sky-100 text-sky-800 border-sky-200',
  'Calendar Invite Resent': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Calendar Accepted': 'bg-teal-100 text-teal-800 border-teal-200',
};

export const CHANNEL_COLORS = {
  'B2B': 'bg-indigo-100 text-indigo-800',
  'B2C': 'bg-pink-100 text-pink-800'
};