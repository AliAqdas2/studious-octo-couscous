import { Router } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { entityRegistry } from "../../services/entities/registry.js";
import {
  bulkCreateEntities,
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "../../services/entities/entityService.js";

const router = Router();

router.use(requireAuth);

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  return req.user;
}

for (const entityName of Object.keys(entityRegistry)) {
  router.get(`/${entityName}`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await listEntities(
        entityName,
        req.query as Record<string, unknown>,
        requireUser(req)
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post(`/${entityName}/bulk`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const rows = Array.isArray(req.body) ? req.body : req.body?.data;
      const result = await bulkCreateEntities(
        entityName,
        rows as Record<string, unknown>[],
        requireUser(req)
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get(`/${entityName}/:id`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await getEntity(entityName, req.params.id, requireUser(req));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post(`/${entityName}`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await createEntity(
        entityName,
        req.body as Record<string, unknown>,
        requireUser(req)
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.patch(`/${entityName}/:id`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await updateEntity(
        entityName,
        req.params.id,
        req.body as Record<string, unknown>,
        requireUser(req)
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete(`/${entityName}/:id`, async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await deleteEntity(entityName, req.params.id, requireUser(req));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

export default router;
