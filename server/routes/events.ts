import { Router } from "express";
import { AppError } from "../lib/errors.js";
import {
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { generateEventWorkflow, regenerateEventWorkflow } from "../services/events/generateWorkflow.js";
import { EXPERIENCE_MATRIX, getExperienceRow } from "../services/events/experienceMatrix.js";
import {
  completeDepositIntake,
  getDepositIntakeState,
} from "../services/events/completeDepositIntake.js";
import type { DepositIntakePayload } from "../services/events/depositIntakeTypes.js";
import {
  addEventInventoryItem,
  deleteEventInventoryItem,
  ensureEventInventoryChecklist,
  getEventInventory,
  patchEventInventoryItems,
  type EventInventoryPatch,
} from "../services/events/eventInventory.js";
import { COOKING_EXPERIENCE_KEY } from "../services/events/cookingWorkflowSeed.js";
import { events } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  getRunOfShowState,
  saveEventArtifacts,
  saveRunOfShow,
} from "../services/events/runOfShow.js";
import {
  getBeoDocumentState,
  saveBeoDocument,
} from "../services/events/beoDocument.js";
import {
  addEateryStop,
  getEventEateryStops,
  removeEateryStop,
  updateEateryStop,
  type AddEateryStopPayload,
  type UpdateEateryStopPayload,
} from "../services/events/eateryStops.js";
import type {
  EventArtifactsPayload,
  RunOfShowPayload,
} from "../services/events/runOfShowTypes.js";
import {
  getPostEventState,
  savePostEvent,
} from "../services/events/postEventCapture.js";
import type { PostEventPayload } from "../services/events/postEventTypes.js";
import {
  getEventOpsFeatures,
  updateEventOpsFeatures,
} from "../services/events/eventOpsSettings.js";
import type { EventOpsFeatures } from "../services/events/eventOpsFeatures.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const router = Router();

router.post(
  "/events/:id/generate-workflow",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id || req.body?.eventId;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const result = await generateEventWorkflow(eventId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/regenerate-workflow",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id || req.body?.eventId;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const confirm = Boolean(req.body?.confirm);
      const result = await regenerateEventWorkflow(eventId, user, { confirm });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/experience-matrix",
  requireAuth,
  async (_req, res, next) => {
    try {
      res.json({ experiences: EXPERIENCE_MATRIX });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/experience",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const db = requireDb();
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!event) throw new AppError("Event not found", 404);
      const row = getExperienceRow(event.eventType);
      res.json({
        eventType: event.eventType,
        experience: row || null,
        needsZachReview:
          row?.docQuality === "incomplete" || row?.docQuality === "stub",
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/deposit-intake",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const result = await getDepositIntakeState(eventId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/deposit-intake",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const payload = (req.body ?? {}) as DepositIntakePayload;
      const result = await completeDepositIntake(eventId, payload, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/inventory",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const result = await getEventInventory(eventId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/events/:id/inventory",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const patches = (req.body?.patches ?? req.body) as EventInventoryPatch[];
      const result = await patchEventInventoryItems(eventId, patches);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/inventory",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const result = await addEventInventoryItem(eventId, {
        catalogItemId: req.body?.catalogItemId ?? req.body?.catalog_item_id,
        name: req.body?.name,
        purchaseUrl: req.body?.purchaseUrl ?? req.body?.purchase_url,
        vendorId: req.body?.vendorId ?? req.body?.vendor_id,
        notes: req.body?.notes,
        needed: req.body?.needed,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/events/:id/inventory/:itemId",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      const itemId = req.params.itemId;
      if (!eventId) throw new AppError("eventId is required", 400);
      if (!itemId) throw new AppError("itemId is required", 400);
      const result = await deleteEventInventoryItem(eventId, itemId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/inventory/ensure",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const db = requireDb();
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!event) throw new AppError("Event not found", 404);
      const experienceKey =
        event.eventType || COOKING_EXPERIENCE_KEY;
      const ensured = await ensureEventInventoryChecklist(
        eventId,
        experienceKey
      );
      const inventory = await getEventInventory(eventId);
      res.json({ ...ensured, ...inventory });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/run-of-show",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const result = await getRunOfShowState(eventId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/run-of-show",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const body = (req.body ?? {}) as RunOfShowPayload & {
        complete?: boolean;
        markScheduled?: boolean;
      };
      const { complete, markScheduled, ...payload } = body;
      const result = await saveRunOfShow(eventId, payload, user, {
        complete: Boolean(complete),
        markScheduled: Boolean(markScheduled),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/events/:id/artifacts",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const payload = (req.body ?? {}) as EventArtifactsPayload;
      const result = await saveEventArtifacts(eventId, payload, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/beo-document",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const result = await getBeoDocumentState(eventId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/events/:id/beo-document",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const html =
        typeof (req.body as { html?: unknown })?.html === "string"
          ? (req.body as { html: string }).html
          : "";
      const result = await saveBeoDocument(eventId, html, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/eatery-stops",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const result = await getEventEateryStops(eventId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/eatery-stops",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const payload = (req.body ?? {}) as AddEateryStopPayload;
      const result = await addEateryStop(eventId, payload);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/events/:id/eatery-stops/:stopId",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      const stopId = req.params.stopId;
      if (!eventId) throw new AppError("eventId is required", 400);
      if (!stopId) throw new AppError("stopId is required", 400);
      const payload = (req.body ?? {}) as UpdateEateryStopPayload;
      const result = await updateEateryStop(eventId, stopId, payload);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/events/:id/eatery-stops/:stopId",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      const stopId = req.params.stopId;
      if (!eventId) throw new AppError("eventId is required", 400);
      if (!stopId) throw new AppError("stopId is required", 400);
      const result = await removeEateryStop(eventId, stopId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/events/:id/post-event",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const result = await getPostEventState(eventId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/events/:id/post-event",
  requireAuth,
  async (req, res, next) => {
    try {
      const eventId = req.params.id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const user = (req as AuthenticatedRequest).user;
      const body = (req.body ?? {}) as PostEventPayload & {
        createLead?: boolean;
      };
      const { createLead, ...payload } = body;
      const result = await savePostEvent(eventId, payload, user, {
        createLead: Boolean(createLead),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/event-ops-features",
  requireAuth,
  async (_req, res, next) => {
    try {
      const result = await getEventOpsFeatures();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/event-ops-features",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const partial = (req.body ?? {}) as Partial<EventOpsFeatures>;
      const result = await updateEventOpsFeatures(partial, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
