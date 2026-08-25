import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { refreshTokens } from "./refresh-tokens.js";
import { clients } from "./clients.js";
import { leads } from "./leads.js";
import { eventTemplates } from "./event-templates.js";
import { eventWorkflowTemplates } from "./event-workflow-templates.js";
import { eventWorkflowTaskDefs } from "./event-workflow-task-defs.js";
import { events } from "./events.js";
import { tasks } from "./tasks.js";
import { roleAssignments } from "./role-assignments.js";
import { activityLogs } from "./activity-logs.js";
import { callLogs } from "./call-logs.js";
import { threadMessages } from "./thread-messages.js";
import { mentionReads } from "./mention-reads.js";

export const usersRelations = relations(users, ({ many }) => ({
  roleAssignments: many(roleAssignments),
  assignedLeads: many(leads),
  assignedTasks: many(tasks),
  activityLogs: many(activityLogs),
  threadMessages: many(threadMessages),
  mentionReads: many(mentionReads),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  leads: many(leads),
  events: many(events),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, {
    fields: [leads.clientId],
    references: [clients.id],
  }),
  assignedSalesRep: one(users, {
    fields: [leads.assignedSalesRep],
    references: [users.id],
  }),
  events: many(events),
  callLogs: many(callLogs),
}));

export const eventTemplatesRelations = relations(eventTemplates, ({ many }) => ({
  events: many(events),
}));

export const eventWorkflowTemplatesRelations = relations(
  eventWorkflowTemplates,
  ({ many }) => ({
    taskDefs: many(eventWorkflowTaskDefs),
    events: many(events),
  })
);

export const eventWorkflowTaskDefsRelations = relations(
  eventWorkflowTaskDefs,
  ({ one }) => ({
    template: one(eventWorkflowTemplates, {
      fields: [eventWorkflowTaskDefs.templateId],
      references: [eventWorkflowTemplates.id],
    }),
  })
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  lead: one(leads, {
    fields: [events.leadId],
    references: [leads.id],
  }),
  sourceLead: one(leads, {
    fields: [events.sourceLeadId],
    references: [leads.id],
    relationName: "sourceLead",
  }),
  client: one(clients, {
    fields: [events.clientId],
    references: [clients.id],
  }),
  template: one(eventTemplates, {
    fields: [events.templateId],
    references: [eventTemplates.id],
  }),
  workflowTemplate: one(eventWorkflowTemplates, {
    fields: [events.workflowTemplateId],
    references: [eventWorkflowTemplates.id],
  }),
  instructor: one(users, {
    fields: [events.instructorAssigned],
    references: [users.id],
    relationName: "instructor",
  }),
  opsSupport: one(users, {
    fields: [events.opsSupportAssigned],
    references: [users.id],
    relationName: "opsSupport",
  }),
  tasks: many(tasks),
  threadMessages: many(threadMessages),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  event: one(events, {
    fields: [tasks.eventId],
    references: [events.id],
  }),
  assignedUser: one(users, {
    fields: [tasks.assignedUser],
    references: [users.id],
    relationName: "assignedUser",
  }),
  previousAssignee: one(users, {
    fields: [tasks.previousAssignee],
    references: [users.id],
    relationName: "previousAssignee",
  }),
  overriddenBy: one(users, {
    fields: [tasks.overriddenBy],
    references: [users.id],
    relationName: "overriddenBy",
  }),
  threadMessages: many(threadMessages),
  mentionReads: many(mentionReads),
}));

export const roleAssignmentsRelations = relations(roleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [roleAssignments.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  lead: one(leads, {
    fields: [callLogs.leadId],
    references: [leads.id],
  }),
}));

export const threadMessagesRelations = relations(threadMessages, ({ one, many }) => ({
  task: one(tasks, {
    fields: [threadMessages.taskId],
    references: [tasks.id],
  }),
  event: one(events, {
    fields: [threadMessages.eventId],
    references: [events.id],
  }),
  author: one(users, {
    fields: [threadMessages.authorId],
    references: [users.id],
  }),
  parentMessage: one(threadMessages, {
    fields: [threadMessages.parentMessageId],
    references: [threadMessages.id],
    relationName: "parentMessage",
  }),
  replies: many(threadMessages, { relationName: "parentMessage" }),
  mentionReads: many(mentionReads),
}));

export const mentionReadsRelations = relations(mentionReads, ({ one }) => ({
  user: one(users, {
    fields: [mentionReads.userId],
    references: [users.id],
  }),
  message: one(threadMessages, {
    fields: [mentionReads.messageId],
    references: [threadMessages.id],
  }),
  task: one(tasks, {
    fields: [mentionReads.taskId],
    references: [tasks.id],
  }),
}));
