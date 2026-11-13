import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  clients,
  events,
  leads,
  tasks,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { toApiRecord } from "../entities/serialize.js";
import { canViewDepositAmount, redactDepositFields } from "./depositAccess.js";
import {
  CHEESEBOARD_MIN_UNITS,
  normalizeTransportCompany,
  type DepositIntakePayload,
} from "./depositIntakeTypes.js";
import { sendDepositNotifyEmail } from "./depositNotifyEmail.js";
import { generateEventWorkflow, reconcileEventWorkflowTasks } from "./generateWorkflow.js";
import { listActiveHouseVenueNames } from "./venuesService.js";
import { syncLeadEventVenue } from "./syncLeadEventVenue.js";
import {
  applyEventDateTimeToLead,
  parseEventDateInput,
} from "./syncLeadEventDateTime.js";
import { etYmd } from "../dates/easternTime.js";
import { rescheduleWorkflowTasks } from "./rescheduleWorkflowTasks.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function clampHeadcount(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0) return null;
  if (v > 999) return 999;
  return v;
}

function resolveVenue(payload: DepositIntakePayload): string | null {
  if (payload.venueMode === "go_to_them") {
    return (payload.venueOther || payload.venue || "Client Venue").trim();
  }
  if (payload.venue === "Other") {
    return (payload.venueOther || "Other").trim();
  }
  return (payload.venue || null)?.trim() || null;
}

function validatePayload(
  payload: DepositIntakePayload,
  eventType: string
): void {
  if (payload.venueMode !== "go_to_them" && payload.venueMode !== "house_venue") {
    throw new AppError("venueMode must be go_to_them or house_venue", 400);
  }
  if (payload.venueMode === "house_venue" && payload.venue) {
    // Active house list is DB-managed; "Other" remains a free-text escape hatch.
    if (payload.venue !== "Other") {
      // Soft allow — admin may have renamed venues; free text still accepted.
    }
  }

  const min = clampHeadcount(payload.headcountMin);
  const max = clampHeadcount(payload.headcountMax);
  if (min != null && max != null && min > max) {
    throw new AppError("headcountMin cannot exceed headcountMax", 400);
  }

  const board = payload.customAddons?.cheeseboard;
  if (board?.enabled) {
    const amt = board.amount != null ? Number(board.amount) : null;
    if (amt == null || Number.isNaN(amt) || amt < CHEESEBOARD_MIN_UNITS) {
      throw new AppError(
        `Cheeseboard requires a minimum of ${CHEESEBOARD_MIN_UNITS} units`,
        400
      );
    }
  }

  const isCooking = eventType === "In-Person Cooking";
  if (!isCooking) {
    // Mystery ingredients / alt sauces are cooking-only — ignore if sent
    if (payload.foodAdditions) {
      payload.foodAdditions.mysteryIngredients = {
        enabled: false,
        amount: null,
      };
      payload.foodAdditions.alternativeSauces = {
        enabled: false,
        amount: null,
      };
    }
  }

  if (typeof payload.alcoholIncluded !== "boolean") {
    throw new AppError("alcoholIncluded is required", 400);
  }
  if (typeof payload.transportationNeeded !== "boolean") {
    throw new AppError("transportationNeeded is required", 400);
  }
}

export async function completeDepositIntake(
  eventId: string,
  payload: DepositIntakePayload,
  user?: AuthUser | null
) {
  if (!eventId) throw new AppError("eventId is required", 400);
  if (!payload || typeof payload !== "object") {
    throw new AppError("intake payload is required", 400);
  }

  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const isUpdate = Boolean(event.depositIntakeCompletedAt);

  validatePayload(payload, event.eventType);

  const headcountMin = clampHeadcount(payload.headcountMin);
  const headcountMax = clampHeadcount(payload.headcountMax);
  const headcount =
    headcountMax ?? headcountMin ?? event.headcount ?? null;

  const venue = resolveVenue(payload);
  const dishConfiguration =
    payload.dishConfiguration === "Other"
      ? payload.dishConfigurationOther || "Other"
      : payload.dishConfiguration || null;

  const transportDetails = payload.transportationNeeded
    ? {
        company:
          payload.transportCompany === "Other"
            ? payload.transportCompanyOther || "Other"
            : normalizeTransportCompany(payload.transportCompany) ||
              payload.transportCompany ||
              null,
        pickupDropoff: true,
      }
    : null;

  const allowDeposit = canViewDepositAmount(user);
  const depositAmount =
    allowDeposit && payload.depositAmount != null
      ? Number(payload.depositAmount)
      : undefined;
  const depositNumber =
    allowDeposit && payload.depositNumber !== undefined
      ? String(payload.depositNumber || "").trim() || null
      : undefined;
  const depositPaymentUrl =
    allowDeposit && payload.depositPaymentUrl !== undefined
      ? String(payload.depositPaymentUrl || "").trim() || null
      : undefined;

  const now = new Date();
  const prevYmd = event.eventDate ? etYmd(new Date(event.eventDate)) : null;
  const parsedEventDate = payload.eventDate
    ? parseEventDateInput(payload.eventDate)
    : null;
  const eventDate = parsedEventDate || event.eventDate;
  const nextStartTime =
    payload.startTime?.trim() || event.startTime || null;

  const [updated] = await db
    .update(events)
    .set({
      startTime: nextStartTime,
      eventDate,
      pocName: payload.pocName?.trim() || event.pocName,
      pocEmail: payload.pocEmail?.trim() || event.pocEmail,
      pocPhone: payload.pocPhone?.trim() || event.pocPhone,
      headcountMin,
      headcountMax,
      headcount,
      alcoholIncluded: payload.alcoholIncluded,
      barDetails: payload.alcoholIncluded
        ? (payload.barDetails ?? null)
        : null,
      isCompetition:
        event.eventType === "In-Person Cooking"
          ? Boolean(payload.isCompetition)
          : false,
      dishConfiguration:
        event.eventType === "In-Person Cooking" ? dishConfiguration : null,
      foodAdditions: payload.foodAdditions,
      customAddons: payload.customAddons,
      transportationNeeded: payload.transportationNeeded,
      transportationDetails: transportDetails,
      venueMode: payload.venueMode,
      venue,
      venueAddress: payload.venueAddress?.trim() || null,
      venueRestrictions: payload.venueRestrictions?.trim() || null,
      ...(depositAmount !== undefined && !Number.isNaN(depositAmount)
        ? { depositAmount }
        : {}),
      ...(depositNumber !== undefined ? { depositNumber } : {}),
      ...(depositPaymentUrl !== undefined ? { depositPaymentUrl } : {}),
      ...(isUpdate
        ? {}
        : { depositIntakeCompletedAt: now, stage: "Planning" as const }),
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  if (!updated) throw new AppError("Failed to update event", 500);

  try {
    await syncLeadEventVenue({
      eventId,
      leadId: updated.leadId,
      venue: updated.venue,
      venueMode: updated.venueMode,
      venueAddress: updated.venueAddress,
      skipEvent: true,
    });
  } catch (syncErr) {
    console.warn(
      "[completeDepositIntake] syncLeadEventVenue failed:",
      syncErr instanceof Error ? syncErr.message : syncErr
    );
  }

  const linkedLeadId = updated.leadId || updated.sourceLeadId || null;
  if (linkedLeadId && updated.eventDate) {
    try {
      await applyEventDateTimeToLead(
        linkedLeadId,
        {
          eventDate: updated.eventDate,
          startTime: updated.startTime,
        },
        { user, eventId }
      );
    } catch (dtErr) {
      console.warn(
        "[completeDepositIntake] applyEventDateTimeToLead failed:",
        dtErr instanceof Error ? dtErr.message : dtErr
      );
    }
  }

  const nextYmd = updated.eventDate
    ? etYmd(new Date(updated.eventDate))
    : null;
  if (prevYmd && nextYmd && prevYmd !== nextYmd) {
    try {
      await rescheduleWorkflowTasks(eventId);
    } catch (rsErr) {
      console.warn(
        "[completeDepositIntake] rescheduleWorkflowTasks failed:",
        rsErr instanceof Error ? rsErr.message : rsErr
      );
    }
  }

  // Instantiate workflow if not already generated; otherwise reconcile new conditionals
  let workflowResult:
    | Awaited<ReturnType<typeof generateEventWorkflow>>
    | Awaited<ReturnType<typeof reconcileEventWorkflowTasks>>
    | null = null;
  const existingWorkflow = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), ne(tasks.category, "Checklist")))
    .limit(1);

  if (existingWorkflow.length === 0) {
    try {
      workflowResult = await generateEventWorkflow(eventId, user);
    } catch (err) {
      console.warn(
        "[completeDepositIntake] generateEventWorkflow failed:",
        err instanceof Error ? err.message : err
      );
    }
  } else {
    try {
      workflowResult = await reconcileEventWorkflowTasks(eventId, user);
    } catch (err) {
      console.warn(
        "[completeDepositIntake] reconcileEventWorkflowTasks failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Mark C001 / C030 done on first complete (and if tasks appear later)
  if (!isUpdate || existingWorkflow.length === 0) {
    const openTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.eventId, eventId));
    for (const t of openTasks) {
      const isC001 =
        t.traceId === "C001" || /sales intake meeting/i.test(t.title);
      const isC030 =
        t.traceId === "C030" ||
        /email deposit notify/i.test(t.title) ||
        /dave,\s*zach,\s*monica,\s*eileen/i.test(t.title);
      if (!isC001 && !isC030) continue;
      if (t.status === "Done") continue;
      await db
        .update(tasks)
        .set({
          status: "Done",
          completionTimestamp: now,
          progressNotes: [
            t.progressNotes,
            isC001
              ? "Completed via Deposit Intake form"
              : "Deposit notify email sent (Slack not required)",
          ]
            .filter(Boolean)
            .join("\n"),
          updatedDate: now,
        })
        .where(eq(tasks.id, t.id));
    }
  }

  let notify: Awaited<ReturnType<typeof sendDepositNotifyEmail>> | null = null;
  if (!isUpdate) {
    try {
      notify = await sendDepositNotifyEmail({
        eventId,
        eventName: updated.eventName,
        eventType: updated.eventType,
        eventDate: updated.eventDate,
        venue: updated.venue,
        pocName: updated.pocName,
        pocEmail: updated.pocEmail,
        headcountMin: updated.headcountMin,
        headcountMax: updated.headcountMax,
        user,
      });
    } catch (err) {
      console.warn(
        "[completeDepositIntake] deposit notify failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: isUpdate ? "Deposit Intake Updated" : "Deposit Intake Completed",
    details: {
      workflow_tasks: workflowResult?.tasksCreated ?? 0,
      notify_sent: notify?.sent ?? 0,
      notify_failed: notify?.failed ?? 0,
      is_update: isUpdate,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  return {
    success: true,
    updated: isUpdate,
    event: redactDepositFields(
      toApiRecord(updated as Record<string, unknown>),
      user
    ),
    workflow: workflowResult
      ? {
          tasksCreated: workflowResult.tasksCreated,
          fromDbTemplate: workflowResult.fromDbTemplate,
        }
      : { tasksCreated: 0, alreadyGenerated: true },
    notify,
  };
}

export async function getDepositIntakeState(
  eventId: string,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [row] = await db
    .select({
      event: events,
      leadCompany: leads.company,
      clientCompany: clients.company,
    })
    .from(events)
    .leftJoin(leads, eq(events.leadId, leads.id))
    .leftJoin(clients, eq(events.clientId, clients.id))
    .where(eq(events.id, eventId))
    .limit(1);
  if (!row?.event) throw new AppError("Event not found", 404);

  const event = row.event;
  const companyName = row.clientCompany || row.leadCompany || null;

  const record = redactDepositFields(
    {
      ...toApiRecord(event as Record<string, unknown>),
      company_name: companyName,
    },
    user
  );

  return {
    completed: Boolean(event.depositIntakeCompletedAt),
    completedAt: event.depositIntakeCompletedAt,
    canViewDepositAmount: canViewDepositAmount(user),
    isCooking: event.eventType === "In-Person Cooking",
    houseVenues: await listActiveHouseVenueNames(),
    cheeseboardMinUnits: CHEESEBOARD_MIN_UNITS,
    event: record,
  };
}
