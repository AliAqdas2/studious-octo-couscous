import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// Stages where sending an email is expected
const EMAIL_REQUIRED_STAGES = new Set([
  'No Answer – 1st Email Sent',
  'Calendar Invite Sent',
  'Invite Not Accepted',
  '2nd Follow-Up – Off Radar',
  'No Response – Final Email Sent',
  'Invite Accepted – Survey Sent',
  'Survey Sent',
  'No Survey Response – Follow-Up 1',
  'Awaiting Response After Follow-Up 1',
  'No Response – Follow-Up 2',
  'Awaiting Response After Follow-Up 2',
  'Survey Completed – Calendar Invite Sent',
  'Awaiting Calendar Acceptance',
  'Calendar Invite Resent',
  'After Meeting Follow-Up',
  'Client Follow-Up – Review Template',
  'Deposit Requested',
]);

export default function StageEmailIndicator({ activities, stageEnteredAt, currentStage }) {
  if (!EMAIL_REQUIRED_STAGES.has(currentStage)) return null;

  // Find emails sent AFTER the lead entered the current stage
  const emailsSinceStage = activities.filter(a =>
    (a.action === 'Automated Email Sent' || a.action === 'Email Activity') &&
    new Date(a.timestamp) >= new Date(stageEnteredAt)
  );

  const sent = emailsSinceStage.length > 0;
  const latestEmail = sent
    ? emailsSinceStage.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
    : null;

  const subject = latestEmail?.details?.subject || latestEmail?.details?.template || null;
  const tooltip = sent
    ? `Email sent${subject ? `: "${subject}"` : ''}`
    : 'No email sent in this stage yet';

  return (
    <div className="relative group flex items-center gap-1.5 cursor-default">
      {sent ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-400" />
      )}
      <span className={`text-xs font-medium ${sent ? 'text-green-600' : 'text-red-400'}`}>
        {sent ? 'Email sent' : 'No email sent'}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50">
        <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap max-w-xs shadow-lg">
          {tooltip}
        </div>
      </div>
    </div>
  );
}