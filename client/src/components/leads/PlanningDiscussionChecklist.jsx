import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';

/**
 * Two-step checklist gating the transition out of "Program Planning Discussion":
 *   1. Was the planning discussion completed?
 *   2. Was the thank-you email sent?
 * Both must be confirmed before the stage advances.
 */
export default function PlanningDiscussionChecklist({ onConfirm, isLoading }) {
  const [discussionDone, setDiscussionDone] = useState(false);
  const [thankYouSent, setThankYouSent] = useState(false);

  const canAdvance = discussionDone && thankYouSent;

  const Item = ({ checked, onToggle, label }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
        checked
          ? 'bg-green-50 border-green-500 text-green-800'
          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
      }`}
    >
      {checked ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-gray-700 font-medium">
        Confirm both steps before advancing:
      </p>

      <Item
        checked={discussionDone}
        onToggle={() => setDiscussionDone((v) => !v)}
        label="Planning discussion completed"
      />
      <Item
        checked={thankYouSent}
        onToggle={() => setThankYouSent((v) => !v)}
        label="Thank-you email sent to the client"
      />

      <Button
        onClick={onConfirm}
        disabled={!canAdvance || isLoading}
        className="w-full bg-[#C84B31] hover:bg-[#A03A23] text-white mt-2"
      >
        {isLoading ? 'Advancing...' : 'Advance to After Meeting Follow-Up'}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}