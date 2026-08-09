import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { findNextFreeSlot } from "../services/calendar/findNextFreeSlot.js";

const router = Router();

/**
 * Next free Mon–Fri 9–5 ET slot on the connected Google Calendar.
 * Used by UI draft helpers to replace <<Sales Manager Availability>>.
 */
router.get("/calendar/next-slot", requireAuth, async (_req, res, next) => {
  try {
    const slot = await findNextFreeSlot();
    res.json({
      success: true,
      slotUtc: slot.slotUtc ? slot.slotUtc.toISOString() : null,
      formatted: slot.formatted,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
