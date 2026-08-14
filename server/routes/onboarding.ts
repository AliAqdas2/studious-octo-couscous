import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { beginCandidateOnboarding } from "../services/onboarding/beginCandidateOnboarding.js";
import {
  createCandidateWithWorkflow,
  getCandidateDetail,
} from "../services/onboarding/createCandidate.js";
import { getMyOnboarding } from "../services/onboarding/getMyOnboarding.js";
import { updateVideoProgress } from "../services/onboarding/updateVideoProgress.js";

const router = Router();

router.post(
  "/onboarding/candidates",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body ?? {};
      const result = await createCandidateWithWorkflow({
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        phone: body.phone != null ? String(body.phone) : null,
        jobRole: String(body.job_role ?? body.jobRole ?? ""),
        hireType: String(body.hire_type ?? body.hireType ?? ""),
        source: String(body.source ?? ""),
        sourceDetail:
          body.source_detail != null
            ? String(body.source_detail)
            : body.sourceDetail != null
              ? String(body.sourceDetail)
              : null,
        resumeUrl:
          body.resume_url != null
            ? String(body.resume_url)
            : body.resumeUrl != null
              ? String(body.resumeUrl)
              : null,
        notes: body.notes != null ? String(body.notes) : null,
        assignedTo:
          body.assigned_to != null
            ? String(body.assigned_to)
            : body.assignedTo != null
              ? String(body.assignedTo)
              : null,
        createdBy: req.user?.id ?? null,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/onboarding/candidates/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await getCandidateDetail(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/onboarding/candidates/:id/begin-onboarding",
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await beginCandidateOnboarding(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/onboarding/me",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user?.id) {
        throw new AppError("Authentication required", 401);
      }
      const result = await getMyOnboarding(req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/onboarding/me/steps/:stepId/video-progress",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user?.id) {
        throw new AppError("Authentication required", 401);
      }
      const body = req.body ?? {};
      const result = await updateVideoProgress(req.user.id, req.params.stepId, {
        slug: String(body.slug ?? ""),
        watched: Boolean(body.watched),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
