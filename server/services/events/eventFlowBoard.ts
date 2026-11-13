import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  clients,
  eventClientCommunicationStages,
  events,
  leads,
  tasks,
  users,
} from "../../db/schema/index.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const LEGACY_STAGE_MAP: Record<string, string> = {
  "Pre-Event Planning": "Planning",
  "Inventory Ordering": "Planning",
  "Staff Confirmed": "Run Of Show Scheduled",
  "72hr Final Check": "Pre-Event Ready",
  "Event Day": "In Progress",
  "Post-Event Processing": "Post-Event",
  Cancelled: "Canceled",
};

function normalizeEventStage(stage: string | null | undefined): string {
  if (!stage) return "Deposit Received";
  return LEGACY_STAGE_MAP[stage] || stage;
}

const PHASES_BY_STAGE: Record<string, string[]> = {
  "Deposit Received": ["upon_deposit"],
  Planning: ["two_point_five_weeks", "three_weeks", "two_weeks", "ros"],
  "Run Of Show Scheduled": [
    "one_week_before",
    "staff_checkin_72_48h",
    "twenty_four_h",
  ],
  "Pre-Event Ready": [
    "upon_deposit",
    "two_point_five_weeks",
    "three_weeks",
    "two_weeks",
    "ros",
    "one_week_before",
    "staff_checkin_72_48h",
    "twenty_four_h",
  ],
  "In Progress": ["during"],
  "Post-Event": ["post"],
  Completed: [],
  Lost: [],
  Canceled: [],
};

const PRE_EVENT_PHASES = new Set([
  "upon_deposit",
  "two_point_five_weeks",
  "three_weeks",
  "two_weeks",
  "ros",
  "one_week_before",
  "staff_checkin_72_48h",
  "twenty_four_h",
]);

type TaskRow = {
  id: string;
  eventId: string;
  title: string;
  category: string | null;
  status: string | null;
  workflowPhase: string | null;
  assignedUser: string | null;
  assignedUserName: string | null;
  dueDate: Date | null;
  order: number | null;
};

function filterTasksForStage(list: TaskRow[], stage: string | null | undefined): TaskRow[] {
  const canonical = normalizeEventStage(stage);
  if (
    canonical === "Completed" ||
    canonical === "Lost" ||
    canonical === "Canceled"
  ) {
    return [];
  }

  if (canonical === "Pre-Event Ready") {
    return list.filter((t) => {
      if (t.category === "Checklist") return false;
      const phase = t.workflowPhase;
      if (!phase || !PRE_EVENT_PHASES.has(phase)) return false;
      return t.status !== "Done" && t.status !== "Completed";
    });
  }

  const phases = new Set(PHASES_BY_STAGE[canonical] || []);
  return list.filter((t) => {
    if (t.category === "Checklist") return false;
    const phase = t.workflowPhase;
    return Boolean(phase && phases.has(phase));
  });
}

function pickNextOpsTask(list: TaskRow[]): TaskRow | null {
  const open = list.filter(
    (t) => t.status !== "Done" && t.status !== "Completed"
  );
  const pool = open.length ? open : list;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return String(a.title).localeCompare(String(b.title));
  })[0];
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type FlowBoardRow = {
  id: string;
  event_name: string;
  event_type: string | null;
  event_format: string | null;
  company_name: string | null;
  client_name: string | null;
  phone_number: string | null;
  event_date: string | null;
  event_time: string | null;
  stage: string;
  venue: string | null;
  headcount: number | null;
  deposit_received: boolean;
  client_interaction_stage: string | null;
  client_assigned_task: string | null;
  client_assigned_to: string | null;
  client_assigned_user_id: string | null;
  client_due_date: string | null;
  client_status: string | null;
  client_done_count: number;
  client_total_count: number;
  operation_stage: string;
  ops_assigned_task: string | null;
  ops_assigned_to: string | null;
  ops_assigned_user_id: string | null;
  ops_due_date: string | null;
  ops_status: string | null;
  post_event: boolean;
  completed_date: string | null;
};

/**
 * Confirmed Event Flow board — identity + current client-comm + next ops task.
 */
export async function getEventsFlowBoard(): Promise<{ events: FlowBoardRow[] }> {
  const db = requireDb();
  const assigneeUsers = alias(users, "flow_assignee_users");
  const taskAssigneeUsers = alias(users, "flow_task_assignee_users");

  const eventRows = await db
    .select({
      id: events.id,
      eventName: events.eventName,
      eventType: events.eventType,
      eventFormat: events.eventFormat,
      pocName: events.pocName,
      pocPhone: events.pocPhone,
      eventDate: events.eventDate,
      startTime: events.startTime,
      stage: events.stage,
      venue: events.venue,
      headcount: events.headcount,
      depositReceived: events.depositReceived,
      updatedDate: events.updatedDate,
      leadCompany: leads.company,
      clientCompany: clients.company,
      clientName: clients.name,
    })
    .from(events)
    .leftJoin(leads, eq(events.leadId, leads.id))
    .leftJoin(clients, eq(events.clientId, clients.id))
    .orderBy(asc(events.eventDate));

  if (!eventRows.length) {
    return { events: [] };
  }

  const eventIds = eventRows.map((e) => e.id);

  const [commRows, taskRows] = await Promise.all([
    db
      .select({
        id: eventClientCommunicationStages.id,
        eventId: eventClientCommunicationStages.eventId,
        title: eventClientCommunicationStages.title,
        sortOrder: eventClientCommunicationStages.sortOrder,
        status: eventClientCommunicationStages.status,
        dueDate: eventClientCommunicationStages.dueDate,
        assignedUser: eventClientCommunicationStages.assignedUser,
        assignedUserName: assigneeUsers.fullName,
      })
      .from(eventClientCommunicationStages)
      .leftJoin(
        assigneeUsers,
        eq(eventClientCommunicationStages.assignedUser, assigneeUsers.id)
      )
      .where(inArray(eventClientCommunicationStages.eventId, eventIds))
      .orderBy(
        asc(eventClientCommunicationStages.eventId),
        asc(eventClientCommunicationStages.sortOrder)
      ),
    db
      .select({
        id: tasks.id,
        eventId: tasks.eventId,
        title: tasks.title,
        category: tasks.category,
        status: tasks.status,
        workflowPhase: tasks.workflowPhase,
        assignedUser: tasks.assignedUser,
        assignedUserName: taskAssigneeUsers.fullName,
        dueDate: tasks.dueDate,
        order: tasks.order,
      })
      .from(tasks)
      .leftJoin(taskAssigneeUsers, eq(tasks.assignedUser, taskAssigneeUsers.id))
      .where(
        and(inArray(tasks.eventId, eventIds), ne(tasks.category, "Checklist"))
      )
      .orderBy(asc(tasks.eventId), asc(tasks.order)),
  ]);

  const commByEvent = new Map<
    string,
    Array<(typeof commRows)[number]>
  >();
  for (const row of commRows) {
    const key = String(row.eventId);
    const list = commByEvent.get(key) || [];
    list.push(row);
    commByEvent.set(key, list);
  }

  const tasksByEvent = new Map<string, TaskRow[]>();
  for (const row of taskRows) {
    const key = String(row.eventId);
    const list = tasksByEvent.get(key) || [];
    list.push({
      id: row.id,
      eventId: row.eventId,
      title: row.title,
      category: row.category,
      status: row.status,
      workflowPhase: row.workflowPhase,
      assignedUser: row.assignedUser,
      assignedUserName: row.assignedUserName,
      dueDate: row.dueDate,
      order: row.order,
    });
    tasksByEvent.set(key, list);
  }

  const board: FlowBoardRow[] = eventRows.map((ev) => {
    const stage = normalizeEventStage(ev.stage);
    const company =
      ev.clientCompany || ev.leadCompany || null;
    const clientName = ev.pocName || ev.clientName || null;

    const stages = commByEvent.get(String(ev.id)) || [];
    const pending = stages.find((s) => s.status !== "done");
    const doneCount = stages.filter((s) => s.status === "done").length;

    const eventTasks = tasksByEvent.get(String(ev.id)) || [];
    const stageTasks = filterTasksForStage(eventTasks, stage);
    const nextOps = pickNextOpsTask(stageTasks);

    const isCompleted = stage === "Completed";
    const isPostEvent = stage === "Post-Event";

    return {
      id: ev.id,
      event_name: ev.eventName,
      event_type: ev.eventType ?? null,
      event_format: ev.eventFormat ?? null,
      company_name: company,
      client_name: clientName,
      phone_number: ev.pocPhone ?? null,
      event_date: isoDate(ev.eventDate),
      event_time: ev.startTime ?? null,
      stage,
      venue: ev.venue ?? null,
      headcount: ev.headcount ?? null,
      deposit_received: Boolean(ev.depositReceived),
      client_interaction_stage: pending?.title ?? (stages.length ? "Complete" : null),
      client_assigned_task: pending?.title ?? null,
      client_assigned_to: pending?.assignedUserName ?? null,
      client_assigned_user_id: pending?.assignedUser ?? null,
      client_due_date: isoDate(pending?.dueDate ?? null),
      client_status: pending
        ? pending.status
        : stages.length
          ? "done"
          : null,
      client_done_count: doneCount,
      client_total_count: stages.length,
      operation_stage: stage,
      ops_assigned_task: nextOps?.title ?? null,
      ops_assigned_to: nextOps?.assignedUserName ?? null,
      ops_assigned_user_id: nextOps?.assignedUser ?? null,
      ops_due_date: isoDate(nextOps?.dueDate ?? null),
      ops_status: nextOps?.status ?? null,
      post_event: isPostEvent,
      completed_date: isCompleted ? isoDate(ev.updatedDate) : null,
    };
  });

  return { events: board };
}
