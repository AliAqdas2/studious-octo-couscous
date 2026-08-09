import { getDb } from "../../db/index.js";
import { threadMessages } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const SYSTEM_ACTIONS = [
  "acknowledged",
  "status_changed",
  "completed",
  "override",
  "event_created",
  "tasks_generated",
] as const;

type SystemAction = (typeof SYSTEM_ACTIONS)[number];

export interface PostSystemMessageInput {
  taskId?: string | null;
  eventId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}

export async function postSystemMessage(
  input: PostSystemMessageInput,
  user: AuthUser
) {
  if (!input.taskId && !input.eventId) {
    throw new AppError("taskId or eventId required", 400);
  }
  if (!SYSTEM_ACTIONS.includes(input.action as SystemAction)) {
    throw new AppError(`Invalid system action: ${input.action}`, 400);
  }

  const action = input.action as SystemAction;
  const metadata = input.metadata || {};
  const name = user.full_name || user.email || "User";

  const systemMessages: Record<SystemAction, string> = {
    acknowledged: `Task acknowledged by ${name}`,
    status_changed: `Status changed from ${metadata.old_status ?? "?"} to ${metadata.new_status ?? "?"} by ${name}`,
    completed: `Task marked as done by ${name}`,
    override: `Admin override by ${name}. Previous assignee: ${metadata.previous_assignee ?? "none"}`,
    event_created: `Event created by ${name}`,
    tasks_generated: `${metadata.task_count ?? 0} tasks generated from template`,
  };

  const db = requireDb();
  const [row] = await db
    .insert(threadMessages)
    .values({
      taskId: input.taskId || null,
      eventId: input.eventId || null,
      authorId: user.id,
      authorName: name,
      body: systemMessages[action],
      isSystemMessage: true,
      systemAction: action,
      systemMetadata: metadata,
      createdBy: user.email || user.id,
    })
    .returning();

  return {
    success: true,
    message: "System message posted",
    id: row?.id,
  };
}
