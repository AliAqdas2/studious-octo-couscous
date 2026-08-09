import { Router } from "express";
import { AppError } from "../lib/errors.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { generateEventWorkflow } from "../services/events/generateWorkflow.js";

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

export default router;
