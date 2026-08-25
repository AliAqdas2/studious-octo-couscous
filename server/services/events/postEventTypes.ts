/** Post-event capture payload (plan 06). */

export type ThankYouVariant = "v1" | "v2" | null;

export interface Email2Answers {
  nextEventPlanned?: string | null;
  introThreeIndividuals?: string | null;
  newsletterInterest?: boolean | null;
  buildAnotherLead?: boolean | null;
  newLeadId?: string | null;
}

export interface PostEventPayload {
  staffHoursNotes?: string | null;
  additionalEventDetails?: string | null;
  laborCost?: number | null;
  venueFees?: number | null;
  suppliesCost?: number | null;
  photosUploaded?: boolean | null;
  photoDownloadUrl?: string | null;
  thankYouVariant?: ThankYouVariant;
  thankYouSent?: boolean | null;
  eventTrackerNote?: string | null;
  linkedInRequested?: boolean | null;
  tshirtSize?: string | null;
  tshirtRequested?: boolean | null;
  receiptTiming?: "eom_with_invoice" | "immediate_after_event" | null;
  invoiceTimingNote?: string | null;
  email2?: Email2Answers | null;
  satisfactionRating?: string | null;
}

export interface PostEventState {
  staffHoursNotes: string | null;
  additionalEventDetails: string | null;
  laborCost: number | null;
  venueFees: number | null;
  suppliesCost: number | null;
  photosUploaded: boolean;
  photoDownloadUrl: string | null;
  thankYouVariant: ThankYouVariant;
  thankYouSent: boolean;
  eventTrackerNote: string | null;
  linkedInRequested: boolean;
  tshirtSize: string | null;
  tshirtRequested: boolean;
  receiptTiming: "eom_with_invoice" | "immediate_after_event" | null;
  invoiceTimingNote: string | null;
  email2: Email2Answers;
  satisfactionRating: string | null;
  experienceName: string;
}
