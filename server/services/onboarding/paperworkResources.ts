import type { OnboardingStepResource } from "../../db/schema/onboarding-workflow-steps.js";

/** Canonical 9A paperwork document list for new-hire portal. */
export const PAPERWORK_DOCUMENT_RESOURCES: OnboardingStepResource[] = [
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
];

function hasExpandedPaperworkResources(
  resources: OnboardingStepResource[] | null | undefined
): boolean {
  if (!Array.isArray(resources)) return false;
  return resources.some((r) => r.type === "document" && Boolean(r.slug));
}

export function resolvePaperworkResources(
  resources: OnboardingStepResource[] | null | undefined,
  hireType?: string | null
): OnboardingStepResource[] {
  const base = hasExpandedPaperworkResources(resources)
    ? (resources ?? [])
    : PAPERWORK_DOCUMENT_RESOURCES;

  const isContractor = hireType === "Contractor";

  return base.filter((r) => {
    if (r.contractorOnly && !isContractor) return false;
    return r.type === "document";
  });
}

export function mergeStepResources(
  step: Record<string, unknown>,
  hireType?: string | null
): Record<string, unknown> {
  const phase = String(step.phase ?? "");
  const title = String(step.title ?? "");
  const resources = step.resources as OnboardingStepResource[] | undefined;

  const isPaperwork =
    phase === "Paperwork" ||
    /paperwork/i.test(title) ||
    /^9A\b/i.test(title);

  if (isPaperwork) {
    return {
      ...step,
      resources: resolvePaperworkResources(resources, hireType),
    };
  }

  return step;
}
