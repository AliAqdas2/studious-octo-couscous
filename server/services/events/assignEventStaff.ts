import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  events,
  roleAssignments,
  users,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { sendGmailEmail } from "../gmail/send.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function getInstructorRole(eventType: string | null | undefined): string {
  if (eventType?.includes("Food Tour")) return "Event Host";
  if (eventType?.includes("Yoga")) return "Event Host";
  return "Chef";
}

function findStaffByRole(
  assignments: (typeof roleAssignments.$inferSelect)[],
  targetRole: string
): string | null {
  const match = assignments.find((ra) => ra.role === targetRole && ra.userId);
  return match?.userId || null;
}

/**
 * Auto-assign instructor / ops / host from active RoleAssignment rows.
 */
export async function assignEventStaff(eventId: string): Promise<{
  success: boolean;
  assignments: {
    instructor_assigned: string | null;
    ops_support_assigned: string | null;
    staff_assigned: string[];
  };
}> {
  if (!eventId) throw new AppError("eventId is required", 400);

  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const active = await db
    .select()
    .from(roleAssignments)
    .where(eq(roleAssignments.isActive, true));

  const instructorAssigned = findStaffByRole(
    active,
    getInstructorRole(event.eventType)
  );
  const opsSupportAssigned = findStaffByRole(active, "Ops");
  const host = findStaffByRole(active, "Event Host");
  const staffAssigned: string[] = [];
  if (host) staffAssigned.push(host);

  const assignments = {
    instructor_assigned: instructorAssigned,
    ops_support_assigned: opsSupportAssigned,
    staff_assigned: staffAssigned,
  };

  await db
    .update(events)
    .set({
      instructorAssigned: instructorAssigned,
      opsSupportAssigned: opsSupportAssigned,
      staffAssigned: staffAssigned,
      updatedDate: new Date(),
    })
    .where(eq(events.id, eventId));

  const staffIds = [
    instructorAssigned,
    opsSupportAssigned,
    ...staffAssigned,
  ].filter((id): id is string => Boolean(id));

  if (staffIds.length > 0) {
    const uniqueIds = [...new Set(staffIds)];
    const staffUsers = await db
      .select()
      .from(users)
      .where(and(inArray(users.id, uniqueIds), eq(users.isActive, true)));

    for (const u of staffUsers) {
      if (!u.email) continue;
      try {
        await sendGmailEmail({
          to: u.email,
          subject: `New Event Assignment: ${event.eventName}`,
          body: [
            `You've been assigned to: ${event.eventName}`,
            `Date: ${event.eventDate ? new Date(event.eventDate).toLocaleString() : "(TBD)"}`,
            `Type: ${event.eventType}`,
            "",
            "Please review event details in the system.",
          ].join("\n"),
          userName: "System (Staff Assignment)",
          systemAlert: true,
        });
      } catch (err) {
        console.warn(
          "[assignEventStaff] notify failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Staff Auto-Assigned",
    details: assignments,
    userName: "Staff Assignment System",
    timestamp: new Date(),
  });

  return { success: true, assignments };
}
