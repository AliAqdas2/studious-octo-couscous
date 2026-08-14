import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getAiLogsFeed,
  getAiLogsStats,
} from "../services/ai/aiLogsFeed.js";

const router = Router();

router.get("/ai-logs/stats", requireAuth, async (_req, res, next) => {
  try {
    const result = await getAiLogsStats();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/ai-logs", requireAuth, async (req, res, next) => {
  try {
    const result = await getAiLogsFeed({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
