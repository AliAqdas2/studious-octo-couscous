CREATE TYPE "public"."activity_entity_type" AS ENUM('Lead', 'Event', 'Task', 'Email', 'Drive');--> statement-breakpoint
CREATE TYPE "public"."ai_flag_category" AS ENUM('', 'Possible Spam', 'Job Application', 'Unrelated Inquiry', 'Hiring-Related', 'Other');--> statement-breakpoint
CREATE TYPE "public"."alcohol_preference" AS ENUM('Alcohol', 'Non-Alcohol', 'Mocktails', 'Mixed');--> statement-breakpoint
CREATE TYPE "public"."call_log_status" AS ENUM('Initiated', 'Ringing', 'In Progress', 'Completed', 'No Answer', 'Busy', 'Failed', 'Rep Declined', 'Analyzed');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('B2B', 'B2C');--> statement-breakpoint
CREATE TYPE "public"."client_business_type" AS ENUM('B2B', 'B2C');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('New', 'Previous', 'Referral');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('Doesn''t matter', 'New', 'Old', 'Referred');--> statement-breakpoint
CREATE TYPE "public"."email_category" AS ENUM('Lead Follow-Up', 'Survey', 'Reminder', 'Proposal', 'Event Confirmation', 'Post-Event', 'Re-Engagement');--> statement-breakpoint
CREATE TYPE "public"."email_template_channel" AS ENUM('B2C', 'B2B', 'Both');--> statement-breakpoint
CREATE TYPE "public"."event_delivery_format" AS ENUM('In-Person', 'Virtual');--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('In-Person', 'Virtual', 'Hybrid');--> statement-breakpoint
CREATE TYPE "public"."event_stage" AS ENUM('Deposit Received', 'Pre-Event Planning', 'Inventory Ordering', 'Staff Confirmed', '72hr Final Check', 'Event Day', 'Post-Event Processing', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('In-Person Mixology', 'In-Person Private Monuments', 'In-Person Paint & Sip', 'In-Person Private Food Tour', 'In-Person Yoga & UnWined', 'Virtual Mixology', 'Virtual Paint & Sip');--> statement-breakpoint
CREATE TYPE "public"."gmail_message_source" AS ENUM('webhook', 'poller');--> statement-breakpoint
CREATE TYPE "public"."gmail_message_status" AS ENUM('lead', 'spam', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."inquiry_type" AS ENUM('Estimate', 'General', 'Corporate Program', 'Unknown');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('Not Started', 'Ordered', 'Shipped', 'Confirmed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('Not Sent', 'Sent', 'Paid', 'Overdue');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('Website', 'Email', 'Phone', 'Referral', 'Call', 'Form', 'Other');--> statement-breakpoint
CREATE TYPE "public"."operational_role" AS ENUM('Admin', 'Sales', 'Ops', 'Chef', 'Event Host', 'Finance', 'Instructor');--> statement-breakpoint
CREATE TYPE "public"."priority_tag" AS ENUM('Previous Client Priority', 'First Priority');--> statement-breakpoint
CREATE TYPE "public"."referral_source" AS ENUM('ChatGPT', 'Perplexity', 'Gemini', 'Google', 'Word-of-mouth', 'Washington.org', 'Other');--> statement-breakpoint
CREATE TYPE "public"."responsible_role" AS ENUM('Admin', 'Sales', 'Ops', 'Chef', 'Event Host', 'Finance');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_rating" AS ENUM('Excellent', 'Good', 'Fair', 'Poor');--> statement-breakpoint
CREATE TYPE "public"."send_mode" AS ENUM('send', 'draft');--> statement-breakpoint
CREATE TYPE "public"."shipping_type" AS ENUM('Domestic', 'International', 'Local Pickup');--> statement-breakpoint
CREATE TYPE "public"."spam_category" AS ENUM('Sales Pitch', 'SEO/Marketing', 'Web Design', 'Promotion', 'Gibberish', 'Other');--> statement-breakpoint
CREATE TYPE "public"."stage_email_channel" AS ENUM('B2B', 'B2C', 'Both');--> statement-breakpoint
CREATE TYPE "public"."system_action" AS ENUM('acknowledged', 'status_changed', 'completed', 'override', 'event_created', 'tasks_generated');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('Pre-Event', 'Event-Day', 'Post-Event', 'Checklist');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Not Acknowledged', 'Working On It', 'Done');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "activity_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"details" jsonb,
	"user_id" uuid,
	"user_name" varchar(255),
	"timestamp" timestamp with time zone,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "automation_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) DEFAULT 'default' NOT NULL,
	"enabled" boolean DEFAULT true,
	"business_hours_gate_enabled" boolean DEFAULT true,
	"use_rep_caller_id_enabled" boolean DEFAULT false,
	"rep_phone" varchar(50),
	"rep_email" varchar(255),
	"calendar_link" text,
	"company_trigger_prefix" varchar(50) DEFAULT 'ALITEST',
	"max_attempts" integer DEFAULT 3,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "automation_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"lead_name" varchar(255),
	"lead_company" varchar(255),
	"lead_phone" varchar(50),
	"lead_brief" text,
	"rep_phone" varchar(50),
	"rep_email" varchar(255),
	"attempt_number" integer DEFAULT 1,
	"status" "call_log_status" DEFAULT 'Initiated',
	"twilio_call_sid" varchar(255),
	"twilio_execution_sid" varchar(255),
	"recording_url" text,
	"transcript" text,
	"summary" text,
	"extracted_budget" varchar(255),
	"extracted_headcount" varchar(255),
	"extracted_timing" varchar(255),
	"extracted_next_stage" varchar(255),
	"extracted_notes" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"scheduled_retry_at" timestamp with time zone,
	"retry_processed" boolean DEFAULT false,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"additional_contacts" jsonb,
	"client_type" "client_business_type",
	"total_events" integer DEFAULT 0,
	"lifetime_revenue" real DEFAULT 0,
	"average_event_value" real DEFAULT 0,
	"first_event_date" timestamp with time zone,
	"last_event_date" timestamp with time zone,
	"is_vip" boolean DEFAULT false,
	"is_returning" boolean DEFAULT false,
	"newsletter_subscribed" boolean DEFAULT false,
	"linkedin_connected" boolean DEFAULT false,
	"tshirt_sent" boolean DEFAULT false,
	"lost_intelligence" jsonb,
	"notes" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"pipeline_stage" varchar(255),
	"channel" "email_template_channel" DEFAULT 'Both',
	"customer_type" "customer_type" DEFAULT 'Doesn''t matter',
	"category" "email_category",
	"is_active" boolean DEFAULT true,
	"send_automatically" boolean DEFAULT false,
	"send_mode" "send_mode" DEFAULT 'send',
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"event_type" "event_type" NOT NULL,
	"description" text,
	"pre_event_tasks" jsonb,
	"event_day_tasks" jsonb,
	"post_event_tasks" jsonb,
	"is_active" boolean DEFAULT true,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"event_name" varchar(255) NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_format" "event_delivery_format",
	"template_id" uuid,
	"venue" varchar(255),
	"virtual_platform" varchar(255),
	"venue_restrictions" text,
	"event_date" timestamp with time zone NOT NULL,
	"deposit_received" boolean DEFAULT false,
	"deposit_amount" real,
	"headcount" integer,
	"alcohol_included" boolean DEFAULT false,
	"alcohol_preference" "alcohol_preference",
	"transportation_needed" boolean DEFAULT false,
	"transportation_details" jsonb,
	"custom_addons" jsonb,
	"dietary_restrictions" text,
	"special_requests" text,
	"accessibility_needs" text,
	"shipping_required" boolean DEFAULT false,
	"shipping_type" "shipping_type",
	"shipping_tracking" varchar(255),
	"menu" text,
	"poc_name" varchar(255),
	"poc_title" varchar(255),
	"poc_email" varchar(255),
	"poc_phone" varchar(50),
	"poc_verified" boolean DEFAULT false,
	"instructor_assigned" uuid,
	"ops_support_assigned" uuid,
	"beo_link" text,
	"fareharbor_link" text,
	"inventory_status" "inventory_status" DEFAULT 'Not Started',
	"loading_dock_reserved" boolean DEFAULT false,
	"venue_reservations_confirmed" boolean DEFAULT false,
	"staff_assigned" jsonb,
	"staff_confirmed_date" timestamp with time zone,
	"stage" "event_stage" DEFAULT 'Deposit Received',
	"drive_folder_id" varchar(255),
	"drive_folder_url" text,
	"photos_uploaded" boolean DEFAULT false,
	"followup_email_sent" boolean DEFAULT false,
	"referral_requested" boolean DEFAULT false,
	"linkedin_connection_sent" boolean DEFAULT false,
	"post_event_feedback" text,
	"invoice_status" "invoice_status" DEFAULT 'Not Sent',
	"total_cost" real,
	"labor_cost" real,
	"supplies_cost" real,
	"venue_fees" real,
	"client_id" uuid,
	"cancellation_reason" text,
	"went_to_competitor" varchar(255),
	"budget_issue" boolean DEFAULT false,
	"timing_issue" boolean DEFAULT false,
	"satisfaction_rating" "satisfaction_rating",
	"source_lead_id" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fareharbor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventType" varchar(255) NOT NULL,
	"bookingUuid" varchar(255),
	"bookingStatus" varchar(255),
	"startAt" timestamp with time zone,
	"endAt" timestamp with time zone,
	"itemName" varchar(255),
	"crew" jsonb,
	"contactName" varchar(255),
	"contactEmail" varchar(255),
	"contactPhone" varchar(50),
	"note" text,
	"rawPayload" jsonb,
	"receivedAt" timestamp with time zone NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "gmail_poll_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) DEFAULT 'default' NOT NULL,
	"last_history_id" varchar(255),
	"last_polled_at" timestamp with time zone,
	"last_webhook_received_at" timestamp with time zone,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "gmail_poll_state_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255),
	"company" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"additional_contacts" jsonb,
	"source" "lead_source",
	"referral_source" "referral_source",
	"referral_source_other" varchar(255),
	"inquiry_type" "inquiry_type" DEFAULT 'Unknown',
	"channel" "channel",
	"client_type" "client_type" DEFAULT 'New',
	"is_priority" boolean DEFAULT false,
	"reviewed" boolean,
	"headcount_estimate" real,
	"event_type_interest" varchar(255),
	"event_format" "event_format",
	"preferred_date" timestamp with time zone,
	"meeting_date" timestamp with time zone,
	"proposed_meeting_date" timestamp with time zone,
	"awaiting_meeting_confirmation" boolean DEFAULT false,
	"survey_sent" boolean DEFAULT false,
	"survey_sent_date" timestamp with time zone,
	"survey_responded" boolean DEFAULT false,
	"stage" varchar(255) DEFAULT 'New Inquiry',
	"assigned_sales_rep" uuid,
	"notes" text,
	"gmail_thread_id" varchar(255),
	"last_contact_date" timestamp with time zone,
	"client_id" uuid,
	"converted_to_event_id" uuid,
	"is_returning_client" boolean DEFAULT false,
	"returning_client_summary" jsonb,
	"priority_tag" "priority_tag",
	"estimate_keywords_detected" boolean DEFAULT false,
	"returning_client_checked" boolean DEFAULT false,
	"event_created" boolean DEFAULT false,
	"linked_event_id" uuid,
	"deposit_number" varchar(255),
	"deposit_amount" real,
	"ai_flag_category" "ai_flag_category" DEFAULT '',
	"ai_flag_reason" text,
	"skip_auto_call" boolean DEFAULT false,
	"survey_data" jsonb,
	"followup_sale_confirmed" boolean,
	"followup_client_type" varchar(255),
	"followup_response_eta" timestamp,
	"followup_next_date" timestamp,
	"followup_experience_confirmation" text,
	"followup_warmth_scale" integer,
	"followup_meeting_notes" text,
	"followup_contract_required" boolean,
	"lost_reason" text,
	"lost_ok_to_contact" boolean,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "task_category" NOT NULL,
	"responsible_role" "responsible_role" NOT NULL,
	"assigned_user" uuid,
	"status" "task_status" DEFAULT 'Not Acknowledged',
	"acknowledged_timestamp" timestamp with time zone,
	"completion_timestamp" timestamp with time zone,
	"override_flag" boolean DEFAULT false,
	"override_timestamp" timestamp with time zone,
	"previous_assignee" uuid,
	"overridden_by" uuid,
	"due_date" timestamp with time zone,
	"order" real,
	"progress_notes" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"user_name" varchar(255),
	"role" "operational_role" NOT NULL,
	"is_active" boolean DEFAULT true,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"coverage_rules" jsonb,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "thread_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"event_id" uuid,
	"author_id" uuid NOT NULL,
	"author_name" varchar(255),
	"body" text NOT NULL,
	"mentioned_users" jsonb,
	"attachment_urls" jsonb,
	"is_system_message" boolean DEFAULT false,
	"system_action" "system_action",
	"system_metadata" jsonb,
	"parent_message_id" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "mention_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "spam_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from" varchar(500) NOT NULL,
	"sender_email" varchar(255),
	"subject" varchar(500) NOT NULL,
	"body" text,
	"page_url" text,
	"gmail_message_id" varchar(255),
	"gmail_thread_id" varchar(255),
	"spam_category" "spam_category",
	"spam_reason" text,
	"received_at" timestamp with time zone,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stage_email_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" varchar(255) NOT NULL,
	"channel" "stage_email_channel" DEFAULT 'Both',
	"email_category" "email_category" NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"last_sent_template" varchar(255),
	"last_sent_date" timestamp with time zone,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "processed_gmail_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" varchar(255) NOT NULL,
	"processed_at" timestamp with time zone,
	"source" "gmail_message_source",
	"status" "gmail_message_status",
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "processed_gmail_messages_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "twilio_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"status" varchar(255),
	"error_code" varchar(50),
	"error_message" text,
	"business_profile_sid" varchar(255),
	"raw_payload" jsonb,
	"received_at" timestamp with time zone NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_config" ADD CONSTRAINT "automation_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_template_id_event_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."event_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_instructor_assigned_users_id_fk" FOREIGN KEY ("instructor_assigned") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ops_support_assigned_users_id_fk" FOREIGN KEY ("ops_support_assigned") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_lead_id_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fareharbor_events" ADD CONSTRAINT "fareharbor_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD CONSTRAINT "gmail_poll_state_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_sales_rep_users_id_fk" FOREIGN KEY ("assigned_sales_rep") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_users_id_fk" FOREIGN KEY ("assigned_user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_previous_assignee_users_id_fk" FOREIGN KEY ("previous_assignee") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_reads" ADD CONSTRAINT "mention_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_reads" ADD CONSTRAINT "mention_reads_message_id_thread_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_reads" ADD CONSTRAINT "mention_reads_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_reads" ADD CONSTRAINT "mention_reads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spam_emails" ADD CONSTRAINT "spam_emails_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_email_mappings" ADD CONSTRAINT "stage_email_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_gmail_messages" ADD CONSTRAINT "processed_gmail_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_webhook_logs" ADD CONSTRAINT "twilio_webhook_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;