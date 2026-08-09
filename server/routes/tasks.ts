import { Router } from "express";
import { AppError } from "../lib/errors.js";
import {
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { postSystemMessage } from "../services/tasks/postSystemMessage.js";
import {
  autoRepairTaskSync,
  validateTaskSync,
} from "../services/tasks/taskSync.js";

const router = Router();

router.post(
  "/tasks/system-message",
  requireAuth,
  async (req, res, next) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) throw new AppError("Authentication required", 401);

      const taskId = req.body?.taskId || req.body?.task_id;
      const eventId = req.body?.eventId || req.body?.event_id;
      const action = req.body?.action || req.body?.system_action;
      const metadata = req.body?.metadata || req.body?.system_metadata || {};

      if (!action) throw new AppError("action is required", 400);

      const result = await postSystemMessage(
        {
          taskId: taskId || null,
          eventId: eventId || null,
          action: String(action),
          metadata:
            metadata && typeof metadata === "object"
              ? (metadata as Record<string, unknown>)
              : {},
        },
        user
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/tasks/validate-sync",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const result = await validateTaskSync();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/tasks/repair-sync",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) throw new AppError("Authentication required", 401);
      const eventId = req.body?.eventId || req.body?.event_id;
      if (!eventId) throw new AppError("eventId is required", 400);
      const result = await autoRepairTaskSync(String(eventId), user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
