import type { Table } from "drizzle-orm";
import {
  activityLogs,
  automationConfig,
  callLogs,
  candidates,
  candidateSteps,
  clients,
  emailTemplates,
  eventTemplates,
  events,
  fareharborEvents,
  gmailPollState,
  inventoryCatalogItems,
  leads,
  mentionReads,
  onboardingWorkflowSteps,
  onboardingWorkflowTemplates,
  processedGmailMessages,
  roleAssignments,
  spamEmails,
  stageEmailMappings,
  tasks,
  threadMessages,
  twilioWebhookLogs,
  users,
  vendors,
  venues,
} from "../../db/schema/index.js";

export interface EntityDefinition {
  table: Table;
  searchable: string[];
  defaultSort: string;
  omitFromResponse?: string[];
  adminOnlyList?: boolean;
  adminOnlyDelete?: boolean;
  requiredOnCreate?: string[];
  /** Column used for singleton upsert (e.g. automation-config key). */
  singletonKey?: string;
  /** Unique field for idempotent create (e.g. gmail_message_id). */
  idempotentUniqueField?: string;
}

export const entityRegistry: Record<string, EntityDefinition> = {
  users: {
    table: users,
    searchable: ["email", "full_name"],
    defaultSort: "-created_date",
    omitFromResponse: ["password_hash", "invite_token"],
    adminOnlyList: true,
    adminOnlyDelete: true,
  },
  leads: {
    table: leads,
    searchable: ["name", "email", "company"],
    defaultSort: "-created_date",
    requiredOnCreate: ["name", "email"],
  },
  clients: {
    table: clients,
    searchable: ["name", "email", "company"],
    defaultSort: "-created_date",
    requiredOnCreate: ["name", "email"],
  },
  events: {
    table: events,
    searchable: ["event_name", "venue", "poc_name"],
    defaultSort: "-created_date",
    requiredOnCreate: ["event_name", "event_type", "event_date"],
  },
  tasks: {
    table: tasks,
    searchable: ["title"],
    defaultSort: "-created_date",
    requiredOnCreate: ["event_id", "title", "category", "responsible_role"],
  },
  "role-assignments": {
    table: roleAssignments,
    searchable: ["user_email", "user_name", "contact_name", "contact_email"],
    defaultSort: "-created_date",
    requiredOnCreate: ["role"],
  },
  "activity-logs": {
    table: activityLogs,
    searchable: ["action", "user_name"],
    defaultSort: "-created_date",
    requiredOnCreate: ["entity_type", "entity_id", "action"],
  },
  "call-logs": {
    table: callLogs,
    searchable: ["lead_name", "lead_phone", "twilio_call_sid"],
    defaultSort: "-created_date",
    requiredOnCreate: ["lead_id"],
  },
  "email-templates": {
    table: emailTemplates,
    searchable: ["template_name", "subject", "pipeline_stage"],
    defaultSort: "-created_date",
    requiredOnCreate: ["template_name", "subject", "body"],
  },
  "event-templates": {
    table: eventTemplates,
    searchable: ["template_name"],
    defaultSort: "-created_date",
    requiredOnCreate: ["template_name", "event_type"],
  },
  "thread-messages": {
    table: threadMessages,
    searchable: ["author_name", "body"],
    defaultSort: "-created_date",
    requiredOnCreate: ["author_id", "body"],
  },
  "mention-reads": {
    table: mentionReads,
    searchable: [],
    defaultSort: "-created_date",
    requiredOnCreate: ["user_id", "message_id", "task_id"],
  },
  "automation-config": {
    table: automationConfig,
    searchable: ["key"],
    defaultSort: "-created_date",
    singletonKey: "key",
  },
  "gmail-poll-state": {
    table: gmailPollState,
    searchable: ["key"],
    defaultSort: "-created_date",
    singletonKey: "key",
  },
  "spam-emails": {
    table: spamEmails,
    searchable: ["from", "sender_email", "subject"],
    defaultSort: "-created_date",
    requiredOnCreate: ["from", "subject"],
  },
  "stage-email-mappings": {
    table: stageEmailMappings,
    searchable: ["stage"],
    defaultSort: "-created_date",
    requiredOnCreate: ["stage", "email_category"],
  },
  "processed-gmail-messages": {
    table: processedGmailMessages,
    searchable: ["gmail_message_id"],
    defaultSort: "-created_date",
    requiredOnCreate: ["gmail_message_id"],
    idempotentUniqueField: "gmail_message_id",
  },
  "fareharbor-events": {
    table: fareharborEvents,
    searchable: ["contact_name", "contact_email", "item_name"],
    defaultSort: "-created_date",
    requiredOnCreate: ["event_type", "received_at"],
  },
  "twilio-webhook-logs": {
    table: twilioWebhookLogs,
    searchable: ["event_type", "status"],
    defaultSort: "-created_date",
    requiredOnCreate: ["event_type", "received_at"],
  },
  candidates: {
    table: candidates,
    searchable: ["name", "email", "phone"],
    defaultSort: "-created_date",
    requiredOnCreate: ["name", "email", "job_role", "hire_type", "source"],
  },
  "onboarding-workflow-templates": {
    table: onboardingWorkflowTemplates,
    searchable: ["name", "job_role"],
    defaultSort: "-created_date",
    requiredOnCreate: ["name", "job_role", "status"],
  },
  "onboarding-workflow-steps": {
    table: onboardingWorkflowSteps,
    searchable: ["title", "phase"],
    defaultSort: "-created_date",
    requiredOnCreate: ["template_id", "phase", "title"],
  },
  "candidate-steps": {
    table: candidateSteps,
    searchable: ["title", "phase"],
    defaultSort: "-created_date",
    requiredOnCreate: ["candidate_id", "phase", "title"],
  },
  vendors: {
    table: vendors,
    searchable: ["name", "category", "email", "phone", "used_for"],
    defaultSort: "name",
    requiredOnCreate: ["name", "category"],
  },
  venues: {
    table: venues,
    searchable: ["name"],
    defaultSort: "sort_order",
    requiredOnCreate: ["name"],
    adminOnlyDelete: true,
  },
  "inventory-catalog-items": {
    table: inventoryCatalogItems,
    searchable: ["name", "sku_key", "experience_keys"],
    defaultSort: "sort_order",
    requiredOnCreate: ["sku_key", "name"],
  },
};

export function getEntityDefinition(entityName: string): EntityDefinition | null {
  return entityRegistry[entityName] ?? null;
}
