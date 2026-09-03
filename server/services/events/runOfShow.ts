import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, events, tasks } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { toApiRecord } from "../entities/serialize.js";
import { canViewDepositAmount, redactDepositFields } from "./depositAccess.js";
import {
  normalizeRosTransportCompany,
  ROS_ARRIVAL_METHODS,
  ROS_MEDIA_LABELS,
  ROS_MEDIA_PERMISSIONS,
  ROS_MEDIA_TALK_TRACK,
  ROS_SEATING_STYLES,
  ROS_WINE_OR_BEER,
  type EventArtifactsPayload,
  type RunOfShowPayload,
} from "./runOfShowTypes.js";
import { TRANSPORT_COMPANIES } from "./depositIntakeTypes.js";
import { getRosConfirmLabel } from "./experienceMatrix.js";
import { rescheduleWorkflowTasks } from "./rescheduleWorkflowTasks.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const ROS_COMPLETE_TRACE_IDS = [
  "C045",
  "C046",
  "C047",
  "C048",
  "C049",
  "C050",
  "C051",
  "C052",
  "C053",
  "C054",
  "C055",
] as const;

const ROS_SCHEDULE_TRACE_IDS = ["C042", "C043", "C044"] as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeRos(
  existing: unknown,
  payload: RunOfShowPayload
): RunOfShowPayload {
  const prev = asRecord(existing) as RunOfShowPayload;
  return {
    ...prev,
    ...payload,
    menu: { ...(prev.menu || {}), ...(payload.menu || {}) },
    activityConfirm: {
      ...(prev.activityConfirm || {}),
      ...(payload.activityConfirm || {}),
    },
    bar: { ...(prev.bar || {}), ...(payload.bar || {}) },
    dayOfPoc: { ...(prev.dayOfPoc || {}), ...(payload.dayOfPoc || {}) },
    foodAdditions: {
      ...(prev.foodAdditions || {}),
      ...(payload.foodAdditions || {}),
    },
    customAddons: {
      ...(prev.customAddons || {}),
      embroideredAprons: {
        ...(prev.customAddons?.embroideredAprons || {}),
        ...(payload.customAddons?.embroideredAprons || {}),
      },
      engravedGlassware: {
        ...(prev.customAddons?.engravedGlassware || {}),
        ...(payload.customAddons?.engravedGlassware || {}),
      },
      cheeseboard: {
        ...(prev.customAddons?.cheeseboard || {}),
        ...(payload.customAddons?.cheeseboard || {}),
      },
      chocolateMold: {
        ...(prev.customAddons?.chocolateMold || {}),
        ...(payload.customAddons?.chocolateMold || {}),
      },
      chefHats: {
        ...(prev.customAddons?.chefHats || {}),
        ...(payload.customAddons?.chefHats || {}),
      },
      berets: {
        ...(prev.customAddons?.berets || {}),
        ...(payload.customAddons?.berets || {}),
      },
    },
    transport: { ...(prev.transport || {}), ...(payload.transport || {}) },
  };
}

function validateRos(payload: RunOfShowPayload): void {
  if (
    payload.arrivalMethod != null &&
    !(ROS_ARRIVAL_METHODS as readonly string[]).includes(payload.arrivalMethod)
  ) {
    throw new AppError("Invalid arrivalMethod", 400);
  }
  if (
    payload.mediaPermission != null &&
    !(ROS_MEDIA_PERMISSIONS as readonly string[]).includes(
      payload.mediaPermission
    )
  ) {
    throw new AppError("Invalid mediaPermission", 400);
  }
  if (
    payload.seatingStyle != null &&
    !(ROS_SEATING_STYLES as readonly string[]).includes(payload.seatingStyle)
  ) {
    throw new AppError("Invalid seatingStyle", 400);
  }
  if (
    payload.bar?.wineOrBeer != null &&
    !(ROS_WINE_OR_BEER as readonly string[]).includes(payload.bar.wineOrBeer)
  ) {
    throw new AppError("Invalid bar.wineOrBeer", 400);
  }
  if (
    payload.transport?.company != null &&
    payload.transport.company !== "Other" &&
    !normalizeRosTransportCompany(payload.transport.company)
  ) {
    throw new AppError(
      "transport.company must be Sammy Transport, DC Nation Tours, or Other",
      400
    );
  }
}

async function markTasksDone(
  eventId: string,
  traceIds: readonly string[],
  note: string
) {
  const db = requireDb();
  if (traceIds.length === 0) return;
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.eventId, eventId),
        inArray(tasks.traceId, [...traceIds]),
        ne(tasks.status, "Done")
      )
    );
  const now = new Date();
  for (const t of rows) {
    if (t.traceId === "C055") {
      const [event] = await db
        .select({ transportationNeeded: events.transportationNeeded })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!event?.transportationNeeded) continue;
    }
    await db
      .update(tasks)
      .set({
        status: "Done",
        completionTimestamp: now,
        progressNotes: [t.progressNotes, note].filter(Boolean).join("\n"),
        updatedDate: now,
      })
      .where(eq(tasks.id, t.id));
  }
}

export async function getRunOfShowState(eventId: string, user?: AuthUser | null) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const ros = asRecord(event.runOfShow) as RunOfShowPayload;
  const record = redactDepositFields(
    toApiRecord(event as Record<string, unknown>),
    user
  );

  return {
    completed: Boolean(ros.completedAt),
    completedAt: ros.completedAt ?? null,
    scheduledAt: ros.scheduledAt ?? null,
    isCooking: event.eventType === "In-Person Cooking",
    rosConfirmLabel: getRosConfirmLabel(event.eventType),
    mediaTalkTrack: ROS_MEDIA_TALK_TRACK,
    mediaLabels: ROS_MEDIA_LABELS,
    arrivalMethods: [...ROS_ARRIVAL_METHODS],
    seatingStyles: [...ROS_SEATING_STYLES],
    wineOrBeerOptions: [...ROS_WINE_OR_BEER],
    transportCompanies: [...TRANSPORT_COMPANIES],
    runOfShow: ros,
    prefill: {
      startTime: event.startTime,
      eventDate: event.eventDate,
      headcount: event.headcount,
      headcountMin: event.headcountMin,
      headcountMax: event.headcountMax,
      alcoholIncluded: event.alcoholIncluded,
      isCompetition: event.isCompetition,
      dishConfiguration: event.dishConfiguration,
      foodAdditions: event.foodAdditions,
      customAddons: event.customAddons,
      barDetails: event.barDetails,
      transportationNeeded: event.transportationNeeded,
      transportationDetails: event.transportationDetails,
      dayOfPocName: event.dayOfPocName,
      dayOfPocEmail: event.dayOfPocEmail,
      dayOfPocPhone: event.dayOfPocPhone,
      instructorId: event.instructorId,
      mediaPermission: event.mediaPermission,
      seatingCurated: event.seatingCurated,
      seatingStyle: event.seatingStyle,
    },
    artifacts: {
      participationListUrl: event.participationListUrl,
      participationListType: event.participationListType,
      postEventSurveyUrl: event.postEventSurveyUrl,
      workflowCrmUrl: event.workflowCrmUrl,
      beoUrl: event.beoUrl,
      beoShellUrl: event.beoShellUrl,
      fareharborLink: event.fareharborLink,
      beoLink: event.beoLink,
      rosTemplateUrl: ros.rosTemplateUrl ?? null,
    },
    canViewDepositAmount: canViewDepositAmount(user),
    event: record,
  };
}

export async function saveRunOfShow(
  eventId: string,
  payload: RunOfShowPayload,
  user?: AuthUser | null,
  options?: { complete?: boolean; markScheduled?: boolean }
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  validateRos(payload);

  const now = new Date();
  const complete = Boolean(options?.complete);
  const markScheduled = Boolean(options?.markScheduled);

  let merged = mergeRos(event.runOfShow, payload);
  if (complete && !merged.completedAt) {
    merged = { ...merged, completedAt: now.toISOString() };
  }
  if (markScheduled && !merged.scheduledAt) {
    merged = { ...merged, scheduledAt: now.toISOString() };
  }

  if (merged.transport?.company) {
    const normalized = normalizeRosTransportCompany(merged.transport.company);
    if (normalized) {
      merged = {
        ...merged,
        transport: { ...merged.transport, company: normalized },
      };
    }
  }

  const foodAdditions = {
    ...asRecord(event.foodAdditions),
    ...(merged.foodAdditions
      ? {
          rosCharcuterieCount: merged.foodAdditions.charcuterieCount ?? null,
          rosAdditionalProtein: merged.foodAdditions.additionalProtein ?? null,
          rosMysteryIngredients: merged.foodAdditions.mysteryIngredients ?? null,
          rosAlternativeSauces: merged.foodAdditions.alternativeSauces ?? null,
        }
      : {}),
  };

  const priorAddons = asRecord(event.customAddons);
  const customAddons = {
    ...priorAddons,
    ...(merged.customAddons
      ? {
          embroideredAprons: {
            ...asRecord(priorAddons.embroideredAprons),
            ...(merged.customAddons.embroideredAprons || {}),
          },
          engravedGlassware: {
            ...asRecord(priorAddons.engravedGlassware),
            ...(merged.customAddons.engravedGlassware || {}),
          },
          cheeseboard: {
            ...asRecord(priorAddons.cheeseboard),
            ...(merged.customAddons.cheeseboard || {}),
          },
          chocolateMold: {
            ...asRecord(priorAddons.chocolateMold),
            ...(merged.customAddons.chocolateMold || {}),
          },
          chefHats: {
            ...asRecord(priorAddons.chefHats),
            ...(merged.customAddons.chefHats || {}),
          },
          berets: {
            ...asRecord(priorAddons.berets),
            ...(merged.customAddons.berets || {}),
          },
        }
      : {}),
  };

  const transportNeeded =
    merged.transport?.needed != null
      ? Boolean(merged.transport.needed)
      : event.transportationNeeded;

  const transportCompany =
    merged.transport?.company === "Other"
      ? merged.transport.companyOther || "Other"
      : merged.transport?.company ||
        (asRecord(event.transportationDetails).company as string | undefined) ||
        null;

  const startTime =
    merged.timeChanged && merged.newStartTime?.trim()
      ? merged.newStartTime.trim()
      : event.startTime;

  let nextEventDate = event.eventDate;
  let eventDateChanged = false;
  if (merged.timeChanged && merged.newEventDate?.trim()) {
    const raw = merged.newEventDate.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const prev = event.eventDate ? new Date(event.eventDate) : null;
      const sameDay =
        prev &&
        prev.getFullYear() === parsed.getFullYear() &&
        prev.getMonth() === parsed.getMonth() &&
        prev.getDate() === parsed.getDate();
      if (!sameDay) {
        nextEventDate = parsed;
        eventDateChanged = true;
      }
    }
  }

  const headcount =
    merged.headcountConfirmed != null &&
    Number.isFinite(Number(merged.headcountConfirmed))
      ? Math.round(Number(merged.headcountConfirmed))
      : event.headcount;

  const earlyStages = new Set([
    "Deposit Received",
    "Planning",
    null,
    undefined,
    "",
  ]);
  let nextStage = event.stage;
  if (markScheduled && earlyStages.has(event.stage ?? "")) {
    nextStage = "Run Of Show Scheduled";
  }

  const [updated] = await db
    .update(events)
    .set({
      runOfShow: merged,
      startTime,
      eventDate: nextEventDate,
      headcount,
      mediaPermission: merged.mediaPermission ?? event.mediaPermission,
      seatingCurated:
        merged.seatingCurated != null
          ? merged.seatingCurated
          : event.seatingCurated,
      seatingStyle: merged.seatingStyle ?? event.seatingStyle,
      dayOfPocName: merged.dayOfPoc?.name?.trim() || event.dayOfPocName,
      dayOfPocEmail: merged.dayOfPoc?.email?.trim() || event.dayOfPocEmail,
      dayOfPocPhone: merged.dayOfPoc?.phone?.trim() || event.dayOfPocPhone,
      instructorId:
        merged.instructorId != null && String(merged.instructorId).trim()
          ? String(merged.instructorId).trim()
          : payload.instructorId !== undefined
            ? null
            : event.instructorId,
      foodAdditions,
      customAddons,
      transportationNeeded: transportNeeded,
      transportationDetails: transportNeeded
        ? {
            ...asRecord(event.transportationDetails),
            company: transportCompany,
            pickupDropoff: true,
            confirmedAtRos: true,
          }
        : event.transportationDetails,
      stage: nextStage,
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  if (markScheduled) {
    await markTasksDone(
      eventId,
      ROS_SCHEDULE_TRACE_IDS,
      "Marked done via ROS schedule (plan 05)"
    );
  }
  if (complete) {
    await markTasksDone(
      eventId,
      ROS_COMPLETE_TRACE_IDS,
      "Marked done via Run of Show form (plan 05)"
    );
  }

  if (eventDateChanged) {
    try {
      await rescheduleWorkflowTasks(eventId);
    } catch (err) {
      console.error(
        "[saveRunOfShow] rescheduleWorkflowTasks failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: complete
      ? "Run Of Show Completed"
      : markScheduled
        ? "Run Of Show Scheduled"
        : "Run Of Show Saved",
    details: {
      complete,
      mark_scheduled: markScheduled,
      media_permission: merged.mediaPermission ?? null,
      event_date_changed: eventDateChanged,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  return {
    success: true,
    completed: Boolean(merged.completedAt),
    scheduledAt: merged.scheduledAt ?? null,
    event: redactDepositFields(
      toApiRecord((updated || event) as Record<string, unknown>),
      user
    ),
    runOfShow: merged,
  };
}

export async function saveEventArtifacts(
  eventId: string,
  payload: EventArtifactsPayload,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  if (
    payload.participationListType != null &&
    payload.participationListType !== "sheets" &&
    payload.participationListType !== "forms"
  ) {
    throw new AppError("participationListType must be sheets or forms", 400);
  }

  const now = new Date();
  const ros = asRecord(event.runOfShow) as RunOfShowPayload;
  const nextRos: RunOfShowPayload =
    payload.rosTemplateUrl !== undefined
      ? { ...ros, rosTemplateUrl: payload.rosTemplateUrl }
      : ros;

  const [updated] = await db
    .update(events)
    .set({
      participationListUrl:
        payload.participationListUrl !== undefined
          ? payload.participationListUrl
          : event.participationListUrl,
      participationListType:
        payload.participationListType !== undefined
          ? payload.participationListType
          : event.participationListType,
      postEventSurveyUrl:
        payload.postEventSurveyUrl !== undefined
          ? payload.postEventSurveyUrl
          : event.postEventSurveyUrl,
      workflowCrmUrl:
        payload.workflowCrmUrl !== undefined
          ? payload.workflowCrmUrl
          : event.workflowCrmUrl,
      beoUrl:
        payload.beoUrl !== undefined ? payload.beoUrl : event.beoUrl,
      beoShellUrl:
        payload.beoShellUrl !== undefined
          ? payload.beoShellUrl
          : event.beoShellUrl,
      fareharborLink:
        payload.fareharborLink !== undefined
          ? payload.fareharborLink
          : event.fareharborLink,
      // Keep legacy beoLink in sync with Admin BEO when provided
      beoLink:
        payload.beoUrl !== undefined
          ? payload.beoUrl
          : event.beoLink,
      runOfShow: nextRos,
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  const artifactTaskMarks: string[] = [];
  if (payload.beoUrl) artifactTaskMarks.push("C035");
  if (payload.rosTemplateUrl) artifactTaskMarks.push("C036");
  if (payload.beoShellUrl || payload.fareharborLink) {
    artifactTaskMarks.push("C037");
  }
  if (payload.participationListUrl) artifactTaskMarks.push("C032");
  if (payload.postEventSurveyUrl) artifactTaskMarks.push("C033");
  if (payload.workflowCrmUrl) artifactTaskMarks.push("C034");

  if (artifactTaskMarks.length) {
    await markTasksDone(
      eventId,
      artifactTaskMarks,
      "Marked done via event artifacts (plan 05)"
    );
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Event Artifacts Updated",
    details: {
      beo: Boolean(payload.beoUrl),
      beo_shell: Boolean(payload.beoShellUrl),
      fareharbor: Boolean(payload.fareharborLink),
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  return {
    success: true,
    event: redactDepositFields(
      toApiRecord((updated || event) as Record<string, unknown>),
      user
    ),
    artifacts: {
      participationListUrl: updated?.participationListUrl,
      participationListType: updated?.participationListType,
      postEventSurveyUrl: updated?.postEventSurveyUrl,
      workflowCrmUrl: updated?.workflowCrmUrl,
      beoUrl: updated?.beoUrl,
      beoShellUrl: updated?.beoShellUrl,
      fareharborLink: updated?.fareharborLink,
      rosTemplateUrl: nextRos.rosTemplateUrl ?? null,
    },
  };
}
