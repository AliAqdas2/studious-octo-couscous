import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { createEventFromWonLead } from "../services/leads/createEventFromWonLead.js";

const router = Router();

router.post("/leads/:id/create-event", requireAuth, async (req, res, next) => {
  try {
    const leadId =
      req.params.id ||
      req.body?.leadId ||
      req.body?.event?.entity_id ||
      req.body?.data?.id;
    if (!leadId) {
      throw new AppError("No leadId found", 400);
    }
    const venue = typeof req.body?.venue === "string" ? req.body.venue : "";
    const depositNumberRaw =
      req.body?.depositNumber ?? req.body?.deposit_number;
    const depositAmountRaw =
      req.body?.depositAmount ?? req.body?.deposit_amount;

    let depositAmount: number | null | undefined;
    if (depositAmountRaw !== undefined && depositAmountRaw !== null && depositAmountRaw !== "") {
      const n = Number(depositAmountRaw);
      depositAmount = Number.isNaN(n) ? null : n;
    }

    const result = await createEventFromWonLead({
      leadId,
      venue,
      depositNumber:
        depositNumberRaw != null ? String(depositNumberRaw) : undefined,
      depositAmount,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
