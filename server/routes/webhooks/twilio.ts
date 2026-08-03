import { Router, type Request, type Response, type NextFunction } from "express";
import twilio from "twilio";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { handleTwimlCallback } from "../../services/twilio/twimlCallbacks.js";

const router = Router();

function validateTwilioSignature(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authToken = env.twilioAuthToken();
  if (!authToken) {
    next();
    return;
  }

  const signature = req.header("X-Twilio-Signature");
  if (!signature) {
    next(new AppError("Missing Twilio signature", 403));
    return;
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const url = `${protocol}://${host}${req.originalUrl}`;
  const params = (req.body || {}) as Record<string, string>;

  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    next(new AppError("Invalid Twilio signature", 403));
    return;
  }
  next();
}

async function handleVoiceOrStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const stage =
      (typeof req.query.stage === "string" && req.query.stage) ||
      req.body?.stage ||
      "";
    const callLogId =
      (typeof req.query.call_log_id === "string" && req.query.call_log_id) ||
      req.body?.call_log_id ||
      "";
    const attempt = parseInt(
      (typeof req.query.attempt === "string" && req.query.attempt) || "1",
      10
    );
    const timeout = req.query.timeout === "true";

    if (!stage || !callLogId) {
      res
        .type("text/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Missing parameters. Goodbye.</Say><Hangup/></Response>`
        );
      return;
    }

    const result = await handleTwimlCallback({
      stage,
      callLogId,
      attempt,
      timeout,
      body: (req.body || {}) as Record<string, string>,
    });

    res
      .status(result.status || 200)
      .type(result.contentType)
      .send(result.body);
  } catch (err) {
    next(err);
  }
}

router.post("/voice", validateTwilioSignature, handleVoiceOrStatus);
router.post("/status", validateTwilioSignature, handleVoiceOrStatus);

export default router;
