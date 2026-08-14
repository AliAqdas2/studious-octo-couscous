import type { OnboardingStepResource } from "../../server/db/schema/onboarding-workflow-steps.js";

export const JOB_ROLES = [
  "Event Support Associate",
  "Event Team Lead",
  "Culinary Instructor",
  "Food Tour Guide",
] as const;

export type JobRole = (typeof JOB_ROLES)[number];

export const HIRE_TYPES = [
  "Practicum",
  "Internship",
  "Part-time",
  "Contractor",
] as const;

export type HireType = (typeof HIRE_TYPES)[number];

export const HIRE_SOURCES = [
  "Indeed",
  "Employee referral",
  "University / career fair",
  "University email blast",
  "Company website",
  "Other",
] as const;

export type HireSource = (typeof HIRE_SOURCES)[number];

export const CANDIDATE_STAGES = [
  "Application Received",
  "Under Review",
  "Interview Scheduled",
  "Interview Complete",
  "Pending Dave Approval",
  "Offer Extended",
  "Offer Accepted",
  "Onboarding",
  "Active",
  "Declined",
  "Withdrawn",
] as const;

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const DEFAULT_CANDIDATE_STAGE: CandidateStage = "Application Received";

export interface SeedStepDef {
  phase: string;
  sortOrder: number;
  title: string;
  instructions: string;
  stepType: string;
  ownerRole: string;
  isGate: boolean;
  slaHours?: number | null;
  resources: OnboardingStepResource[];
}

/** Full ESA checklist from Raisa handbook / Chart 2. */
export const ESA_WORKFLOW_STEPS: SeedStepDef[] = [
  {
    phase: "Recruitment",
    sortOrder: 10,
    title: "Confirm hiring need + hire type",
    instructions:
      "Manager confirms headcount need and whether this is practicum, internship, part-time, or contractor. Management approval required before posting.",
    stepType: "decision",
    ownerRole: "Manager",
    isGate: true,
    resources: [],
  },
  {
    phase: "Recruitment",
    sortOrder: 20,
    title: "Source candidates",
    instructions:
      "Part-time: Indeed, company website, employee referrals, career fairs, university email blast. Internship/practicum: contact HTEM faculty, attend GMU fairs, request internship emails. LinkedIn is not used for Event Support Associate.",
    stepType: "action",
    ownerRole: "Manager",
    isGate: false,
    resources: [
      {
        type: "link",
        label: "GMU Career Fairs",
        url: "https://careers.gmu.edu/fairs-and-recruiting",
      },
      {
        type: "link",
        label: "GMU Tourism & Events Management",
        url: "https://cehd.gmu.edu/tourism-and-events-management/",
      },
      {
        type: "contact",
        label: "Dr. Min Park",
        detail: "mparka@gmu.edu",
        url: "mailto:mparka@gmu.edu",
      },
      {
        type: "contact",
        label: "Dr. Abena Aidoo Hewton",
        detail: "aaidoo@gmu.edu",
        url: "mailto:aaidoo@gmu.edu",
      },
      {
        type: "contact",
        label: "Tina Jones (Career Services)",
        detail: "tjonesq@gmu.edu",
        url: "mailto:tjonesq@gmu.edu",
      },
      {
        type: "note",
        label: "University email blast process",
        detail:
          "Missing detail — ask Dave: who to email, cadence, and template.",
      },
    ],
  },
  {
    phase: "Recruitment",
    sortOrder: 30,
    title: "Review application",
    instructions:
      "Review with the hiring team. Outcomes: Qualified (Belle contacts within 48 hours), More information needed, or Not qualified (decline email + retain resume with reason).",
    stepType: "decision",
    ownerRole: "Manager",
    isGate: true,
    slaHours: 48,
    resources: [],
  },
  {
    phase: "Hiring",
    sortOrder: 40,
    title: "Belle contacts + schedule interview",
    instructions:
      "Belle contacts qualified candidates within 48 hours and schedules the interview with Zach Finch.",
    stepType: "action",
    ownerRole: "Recruiter",
    isGate: false,
    slaHours: 48,
    resources: [],
  },
  {
    phase: "Hiring",
    sortOrder: 50,
    title: "Conduct interview (Zach)",
    instructions:
      "Zach conducts the interview and records feedback. Interview question bank: pending from management.",
    stepType: "action",
    ownerRole: "Manager",
    isGate: true,
    resources: [
      {
        type: "note",
        label: "Interview questions",
        detail: "Not in handbook — ask Dave / Zach for the official list.",
      },
    ],
  },
  {
    phase: "Hiring",
    sortOrder: 60,
    title: "Dave secondary approval",
    instructions:
      "Zach passes fit candidates (with availability) to Dave for secondary approval before an offer is extended.",
    stepType: "decision",
    ownerRole: "Manager",
    isGate: true,
    resources: [],
  },
  {
    phase: "Hiring",
    sortOrder: 70,
    title: "Extend offer + acceptance",
    instructions:
      "Extend offer. If accepted, proceed to onboarding. If declined, close or reopen the position.",
    stepType: "decision",
    ownerRole: "Manager",
    isGate: true,
    resources: [],
  },
  {
    phase: "Paperwork",
    sortOrder: 80,
    title: "9A — New hire paperwork",
    instructions:
      "Complete I-9, W-4, direct deposit, handbook acknowledgment, confidentiality agreement, emergency contact. Contractors also need W-9 / contractor agreement. Track status outside the CRM (links only). Management must approve before virtual training.",
    stepType: "checklist",
    ownerRole: "Manager",
    isGate: true,
    resources: [
      {
        type: "document",
        slug: "i9",
        label: "I-9 (work eligibility)",
        detail:
          "Verify your identity and work authorization. HR will walk you through this form — bring acceptable ID documents as listed on the form.",
        action: "email",
      },
      {
        type: "document",
        slug: "w4",
        label: "W-4 (tax withholding)",
        detail:
          "Complete your federal tax withholding form so payroll can process your pay correctly.",
        action: "email",
      },
      {
        type: "document",
        slug: "direct-deposit",
        label: "Direct deposit",
        detail:
          "Provide your bank routing and account numbers so we can pay you electronically.",
        action: "email",
      },
      {
        type: "document",
        slug: "handbook-ack",
        label: "Handbook acknowledgment",
        detail:
          "Read the Mangia DC employee handbook and sign the acknowledgment confirming you understand company policies.",
        action: "email",
      },
      {
        type: "document",
        slug: "confidentiality",
        label: "Confidentiality agreement",
        detail:
          "Sign the confidentiality agreement protecting client and company information.",
        action: "email",
      },
      {
        type: "document",
        slug: "emergency-contact",
        label: "Emergency contact",
        detail:
          "Provide an emergency contact name, relationship, and phone number.",
        action: "email",
      },
      {
        type: "document",
        slug: "w9",
        label: "W-9 (contractor)",
        detail:
          "Required for 1099 contractors — tax identification for independent contractor pay.",
        action: "email",
        contractorOnly: true,
      },
      {
        type: "document",
        slug: "contractor-agreement",
        label: "Contractor agreement",
        detail:
          "Sign the contractor agreement outlining terms for 1099 work.",
        action: "email",
        contractorOnly: true,
      },
    ],
  },
  {
    phase: "Virtual Training",
    sortOrder: 90,
    title: "9B — Virtual training (Shift 1)",
    instructions:
      "New hire watches training modules. Zach confirms completion via post-video questionnaire (add when Raisa/Dave provide it).",
    stepType: "video",
    ownerRole: "Manager",
    isGate: true,
    resources: [
      {
        type: "video",
        label: "FareHarbor & BEO",
        slug: "fareharbor-beo",
        url: "/videos/Fareharbor%26BEO.mp4",
      },
      {
        type: "video",
        label: "Invoice template",
        slug: "invoice-template",
        url: "/videos/InvoiceTemplate.mp4",
      },
      {
        type: "video",
        label: "Mangia Structure",
        slug: "mangia-structure",
        url: "/videos/Mangia%20Structure.mp4",
      },
      {
        type: "video",
        label: "FareHarbor login (Vimeo)",
        url: "https://player.vimeo.com/video/182472620",
      },
      {
        type: "link",
        label: "FareHarbor dashboard basics",
        url: "https://help.fareharbor.com/getting-started/dashboard-basics/navigating-the-dashboard/",
      },
      {
        type: "note",
        label: "Video 3 — safety / basic event workflow",
        detail: "Listed in handbook but no link yet — ask Dave who records it.",
      },
      {
        type: "note",
        label: "Post-video questionnaire",
        detail: "Mandatory verification quiz — content still pending.",
      },
    ],
  },
  {
    phase: "Shadow Training",
    sortOrder: 100,
    title: "9C — Shadow shift (Shift 2)",
    instructions:
      "Shadow an experienced team member for a full event (setup through breakdown) at training pay. Trainer evaluates. Not ready → additional coaching and repeat Shift 2.",
    stepType: "action",
    ownerRole: "Trainer",
    isGate: true,
    resources: [],
  },
  {
    phase: "Shadow Training",
    sortOrder: 110,
    title: "9C — Independent observed shift (Shift 3)",
    instructions:
      "Perform the role independently at standard pay while the trainer observes the entire shift. Trainer submits evaluation to management.",
    stepType: "action",
    ownerRole: "Trainer",
    isGate: true,
    resources: [],
  },
  {
    phase: "Evaluation",
    sortOrder: 120,
    title: "9D — Evaluation & management review",
    instructions:
      "Management reviews trainer evaluation (professionalism, guest service, teamwork, communication, initiative, knowledge, readiness). New-hire feedback meeting. Approve for independent scheduling or assign more training.",
    stepType: "form",
    ownerRole: "Manager",
    isGate: true,
    resources: [
      {
        type: "note",
        label: "Passing threshold",
        detail: "Raisa: up to management — confirm score with Dave.",
      },
    ],
  },
  {
    phase: "Active",
    sortOrder: 130,
    title: "9E — Active employee",
    instructions:
      "Add to schedule and event assignments. Plan 30/60/90-day and ongoing reviews. Growth path: Trainer → Event Lead → Senior Event Support Associate. Issue CRM credentials after hire (not before).",
    stepType: "action",
    ownerRole: "Manager",
    isGate: false,
    resources: [],
  },
];
