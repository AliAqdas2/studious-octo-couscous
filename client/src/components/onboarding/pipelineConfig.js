export const CANDIDATE_STATE_MACHINE = {
  "Application Received": {
    prompt: "Ready to review this application?",
    actions: [
      { label: "Start review", nextStage: "Under Review" },
      { label: "Decline", nextStage: "Declined", needsDeclineReason: true },
      { label: "Withdrawn", nextStage: "Withdrawn" },
    ],
  },
  "Under Review": {
    prompt: "Application outcome?",
    actions: [
      {
        label: "Qualified — schedule interview",
        nextStage: "Interview Scheduled",
        opensScheduleInterview: true,
      },
      {
        label: "Need more info (stay in review)",
        nextStage: "Under Review",
        opensNeedMoreInfo: true,
      },
      { label: "Decline", nextStage: "Declined", needsDeclineReason: true },
    ],
  },
  "Interview Scheduled": {
    prompt: "Was the interview completed?",
    actions: [
      { label: "Interview complete", nextStage: "Interview Complete" },
      { label: "Decline", nextStage: "Declined", needsDeclineReason: true },
      { label: "Withdrawn", nextStage: "Withdrawn" },
    ],
  },
  "Interview Complete": {
    prompt: "Good fit for Dave’s secondary approval?",
    actions: [
      {
        label: "Send to Dave",
        nextStage: "Pending Dave Approval",
        opensSendToDave: true,
      },
      { label: "Decline", nextStage: "Declined", needsDeclineReason: true },
    ],
  },
  "Pending Dave Approval": {
    prompt: "Dave’s decision?",
    actions: [
      {
        label: "Approved — extend offer",
        nextStage: "Offer Extended",
        opensExtendOffer: true,
      },
      { label: "Decline", nextStage: "Declined", needsDeclineReason: true },
    ],
  },
  "Offer Extended": {
    prompt: "Did they accept the offer?",
    actions: [
      {
        label: "Offer accepted",
        nextStage: "Offer Accepted",
        opensOfferAccepted: true,
      },
      {
        label: "Declined offer",
        nextStage: "Withdrawn",
        opensOfferDeclined: true,
      },
    ],
  },
  "Offer Accepted": {
    prompt: "Start onboarding paperwork / training?",
    actions: [
      {
        label: "Begin onboarding",
        nextStage: "Onboarding",
        opensBeginOnboarding: true,
      },
    ],
  },
  Onboarding: {
    prompt: "Ready for independent scheduling?",
    actions: [
      {
        label: "Mark active employee",
        nextStage: "Active",
        opensMarkActive: true,
      },
      { label: "Withdrawn", nextStage: "Withdrawn" },
    ],
  },
  Active: {
    prompt: null,
    actions: [],
  },
  Declined: {
    prompt: null,
    actions: [
      { label: "Reopen application", nextStage: "Application Received" },
    ],
  },
  Withdrawn: {
    prompt: null,
    actions: [
      { label: "Reopen application", nextStage: "Application Received" },
    ],
  },
};
