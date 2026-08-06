import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeCall } from "../services/twilio/analyzeCall.js";
import { triggerCall } from "../services/twilio/triggerCall.js";

const router = Router();

router.post("/calls/trigger", requireAuth, async (req, res, next) => {
  try {
    const leadId =
      req.body?.leadId || req.body?.lead_id || req.body?.event?.entity_id;
    if (!leadId) {
      throw new AppError("leadId is required", 400);
    }
    const result = await triggerCall({
      leadId,
      attemptNumber: req.body?.attempt_number ?? req.body?.attemptNumber,
      skipBusinessHours: Boolean(
        req.body?.skip_business_hours ?? req.body?.skipBusinessHours
      ),
      dryRun: Boolean(req.body?.dry_run ?? req.body?.dryRun),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/calls/:id/analyze", requireAuth, async (req, res, next) => {
  try {
    const callLogId = req.params.id;
    if (!callLogId) {
      throw new AppError("call log id is required", 400);
    }
    const reanalyze = Boolean(
      req.query.reanalyze === "true" ||
        req.body?.reanalyze === true ||
        req.body?.reanalyze === "true"
    );
    const result = await analyzeCall({
      callLogId,
      recordingUrl:
        req.body?.recording_url ||
        req.body?.recordingUrl ||
        req.body?.RecordingUrl,
      reanalyze,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
