import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { searchLeads } from "../services/leads/searchLeads.js";

const router = Router();

router.post("/leads/search", requireAuth, async (req, res, next) => {
  try {
    const result = await searchLeads(req.body ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
