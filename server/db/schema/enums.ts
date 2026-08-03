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
  "In-Person Mixology",
  "In-Person Private Monuments",
  "In-Person Paint & Sip",
  "In-Person Private Food Tour",
  "In-Person Yoga & UnWined",
  "Virtual Mixology",
  "Virtual Paint & Sip",
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
  "Pre-Event Planning",
  "Inventory Ordering",
  "Staff Confirmed",
  "72hr Final Check",
  "Event Day",
  "Post-Event Processing",
  "Completed",
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
]);

export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "Lead",
  "Event",
  "Task",
  "Email",
  "Drive",
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
]);

export const stageEmailChannelEnum = pgEnum("stage_email_channel", ["B2B", "B2C", "Both"]);
