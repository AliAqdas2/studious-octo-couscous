import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const leadSourceEnum = pgEnum("lead_source", [
  "Website",
  "Email",
  "Phone",
  "Referral",
  "Call",
  "Form",
  "Other",
]);

export const referralSourceEnum = pgEnum("referral_source", [
  "ChatGPT",
  "Perplexity",
  "Gemini",
  "Google",
  "Word-of-mouth",
  "Washington.org",
  "Other",
]);

export const inquiryTypeEnum = pgEnum("inquiry_type", [
  "Estimate",
  "General",
  "Corporate Program",
  "Unknown",
]);

export const channelEnum = pgEnum("channel", ["B2B", "B2C"]);

export const clientTypeEnum = pgEnum("client_type", ["New", "Previous", "Referral"]);

export const eventFormatEnum = pgEnum("event_format", ["In-Person", "Virtual", "Hybrid"]);

export const priorityTagEnum = pgEnum("priority_tag", [
  "Previous Client Priority",
  "First Priority",
]);

export const aiFlagCategoryEnum = pgEnum("ai_flag_category", [
  "",
  "Possible Spam",
  "Job Application",
  "Unrelated Inquiry",
  "Hiring-Related",
  "Other",
]);

export const clientBusinessTypeEnum = pgEnum("client_business_type", ["B2B", "B2C"]);

export const eventTypeEnum = pgEnum("event_type", [
  "In-Person Cooking",
  "In-Person Mixology",
  "In-Person Private Monuments",
  "In-Person Paint & Sip",
  "In-Person Private Food Tour",
  "In-Person Yoga & UnWined",
  "Virtual Mixology",
  "Virtual Paint & Sip",
  "In-Person Pottery",
  "In-Person Terrarium",
  "Flavors of DC",
  "In-Person Chocolate Making",
  "In-Person Chocolate & Wine",
  "In-Person Cheeseboard",
  "In-Person Gingerbread",
  "In-Person Lend a Hand",
  "Group Food Tour",
  "Italian Food Tour",
  "Georgetown Foodie Tour",
  "Private Food Tour",
  "Indoor Food Tour",
]);

/** Timeline family: A = Cooking ROS, B = 3/2/1w, C = collapsed 1w stubs. */
export const workflowTimelineFamilyEnum = pgEnum("workflow_timeline_family", [
  "A",
  "B",
  "C",
]);

/** Family A/B/C phases (plan 01 + 07). */
export const workflowPhaseEnum = pgEnum("workflow_phase", [
  "upon_deposit",
  "two_point_five_weeks",
  "ros",
  "three_weeks",
  "two_weeks",
  "one_week_before",
  "staff_checkin_72_48h",
  "twenty_four_h",
  "during",
  "post",
]);

export const workflowDueAnchorEnum = pgEnum("workflow_due_anchor", [
  "event_date",
  "deposit_date",
  "immediate",
]);

export const workflowRoleEnum = pgEnum("workflow_role", [
  "Sales",
  "Admin",
  "Ops",
  "Marketing",
  "Event Host",
]);

export const venueModeEnum = pgEnum("venue_mode", ["go_to_them", "house_venue"]);

export const participationListTypeEnum = pgEnum("participation_list_type", [
  "sheets",
  "forms",
]);

export const eventDeliveryFormatEnum = pgEnum("event_delivery_format", ["In-Person", "Virtual"]);

export const alcoholPreferenceEnum = pgEnum("alcohol_preference", [
  "Alcohol",
  "Non-Alcohol",
  "Mocktails",
  "Mixed",
]);

export const shippingTypeEnum = pgEnum("shipping_type", [
  "Domestic",
  "International",
  "Local Pickup",
]);

export const inventoryStatusEnum = pgEnum("inventory_status", [
  "Not Started",
  "Ordered",
  "Shipped",
  "Confirmed",
]);

export const eventStageEnum = pgEnum("event_stage", [
  "Deposit Received",
  "Planning",
  "Run Of Show Scheduled",
  "Pre-Event Ready",
  "In Progress",
  "Post-Event",
  "Completed",
  "Lost",
  "Canceled",
  // Legacy values kept for existing rows
  "Pre-Event Planning",
  "Inventory Ordering",
  "Staff Confirmed",
  "72hr Final Check",
  "Event Day",
  "Post-Event Processing",
  "Cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "Not Sent",
  "Sent",
  "Paid",
  "Overdue",
]);

export const satisfactionRatingEnum = pgEnum("satisfaction_rating", [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
]);

export const taskCategoryEnum = pgEnum("task_category", [
  "Pre-Event",
  "Event-Day",
  "Post-Event",
  "Checklist",
]);

export const responsibleRoleEnum = pgEnum("responsible_role", [
  "Admin",
  "Sales",
  "Ops",
  "Chef",
  "Event Host",
  "Finance",
  "Marketing",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "Not Acknowledged",
  "Working On It",
  "Done",
]);

export const operationalRoleEnum = pgEnum("operational_role", [
  "Admin",
  "Sales",
  "Ops",
  "Chef",
  "Event Host",
  "Finance",
  "Instructor",
  "Onboarding",
  "Marketing",
]);

export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "Lead",
  "Event",
  "Task",
  "Email",
  "Drive",
  "Candidate",
]);

export const candidateJobRoleEnum = pgEnum("candidate_job_role", [
  "Event Support Associate",
  "Event Team Lead",
  "Culinary Instructor",
  "Food Tour Guide",
]);

export const candidateHireTypeEnum = pgEnum("candidate_hire_type", [
  "Practicum",
  "Internship",
  "Part-time",
  "Contractor",
]);

export const candidateHireSourceEnum = pgEnum("candidate_hire_source", [
  "Indeed",
  "Employee referral",
  "University / career fair",
  "University email blast",
  "Company website",
  "Other",
]);

export const onboardingTemplateStatusEnum = pgEnum("onboarding_template_status", [
  "ready",
  "coming_soon",
]);

export const candidateStepStatusEnum = pgEnum("candidate_step_status", [
  "pending",
  "in_progress",
  "done",
  "blocked",
  "skipped",
]);

export const callLogStatusEnum = pgEnum("call_log_status", [
  "Initiated",
  "Ringing",
  "In Progress",
  "Completed",
  "No Answer",
  "Busy",
  "Failed",
  "Rep Declined",
  "Analyzed",
]);

export const emailTemplateChannelEnum = pgEnum("email_template_channel", ["B2C", "B2B", "Both"]);

export const customerTypeEnum = pgEnum("customer_type", [
  "Doesn't matter",
  "New",
  "Old",
  "Referred",
]);

export const emailCategoryEnum = pgEnum("email_category", [
  "Lead Follow-Up",
  "Survey",
  "Reminder",
  "Proposal",
  "Event Confirmation",
  "Post-Event",
  "Re-Engagement",
]);

export const sendModeEnum = pgEnum("send_mode", ["send", "draft"]);

export const systemActionEnum = pgEnum("system_action", [
  "acknowledged",
  "status_changed",
  "completed",
  "override",
  "event_created",
  "tasks_generated",
]);

export const spamCategoryEnum = pgEnum("spam_category", [
  "Sales Pitch",
  "SEO/Marketing",
  "Web Design",
  "Promotion",
  "Gibberish",
  "Other",
]);

export const gmailMessageSourceEnum = pgEnum("gmail_message_source", ["webhook", "poller"]);

export const gmailMessageStatusEnum = pgEnum("gmail_message_status", [
  "lead",
  "spam",
  "ignored",
  "failed",
  "processing",
]);

export const stageEmailChannelEnum = pgEnum("stage_email_channel", ["B2B", "B2C", "Both"]);
