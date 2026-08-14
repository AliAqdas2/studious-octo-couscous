/** Fallback when API still returns the old single checklist blob. */
export const FALLBACK_PAPERWORK_DOCUMENTS = [
  {
    type: 'document',
    slug: 'i9',
    label: 'I-9 (work eligibility)',
    detail:
      'Verify your identity and work authorization. HR will walk you through this form — bring acceptable ID documents as listed on the form.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'w4',
    label: 'W-4 (tax withholding)',
    detail:
      'Complete your federal tax withholding form so payroll can process your pay correctly.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'direct-deposit',
    label: 'Direct deposit',
    detail:
      'Provide your bank routing and account numbers so we can pay you electronically.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'handbook-ack',
    label: 'Handbook acknowledgment',
    detail:
      'Read the Mangia DC employee handbook and sign the acknowledgment confirming you understand company policies.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'confidentiality',
    label: 'Confidentiality agreement',
    detail:
      'Sign the confidentiality agreement protecting client and company information.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'emergency-contact',
    label: 'Emergency contact',
    detail:
      'Provide an emergency contact name, relationship, and phone number.',
    action: 'email',
  },
  {
    type: 'document',
    slug: 'w9',
    label: 'W-9 (contractor)',
    detail:
      'Required for 1099 contractors — tax identification for independent contractor pay.',
    action: 'email',
    contractorOnly: true,
  },
  {
    type: 'document',
    slug: 'contractor-agreement',
    label: 'Contractor agreement',
    detail:
      'Sign the contractor agreement outlining terms for 1099 work.',
    action: 'email',
    contractorOnly: true,
  },
];

export function getPaperworkDocuments(step, hireType) {
  const fromStep = (step?.resources ?? []).filter(
    (r) => r.type === 'document' && r.slug
  );
  const base =
    fromStep.length > 0 ? fromStep : FALLBACK_PAPERWORK_DOCUMENTS;
  const isContractor = hireType === 'Contractor';
  return base.filter((r) => !r.contractorOnly || isContractor);
}
