import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { createLeadFromWebhook } from "../../services/leads/createLeadFromWebhook.js";

const router = Router();
const LOG = "[lead-webhook]";

function checkLeadWebhookSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const secret = env.leadWebhookSecret();
  if (!secret) {
    next(
      new AppError(
        "LEAD_WEBHOOK_SECRET is not configured — inbound lead webhook disabled",
        503
      )
    );
    return;
  }

  const headerSecret =
    req.header("X-Lead-Webhook-Secret") ||
    req.header("x-lead-webhook-secret") ||
    "";
  const auth = req.header("Authorization") || "";
  const bearer =
    auth.startsWith("Bearer ") || auth.startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
  const provided = headerSecret || bearer;

  if (!provided || provided !== secret) {
    next(new AppError("Invalid lead webhook secret", 403));
    return;
  }
  next();
}

router.post("/", checkLeadWebhookSecret, async (req, res, next) => {
  try {
    const result = await createLeadFromWebhook(req.body);
    console.log(`${LOG} created lead id=${result.id}`);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
