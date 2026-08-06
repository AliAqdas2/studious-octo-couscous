import { Router } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import {
  optionalAuth,
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { createGmailDraft } from "../services/gmail/drafts.js";
import {
  assertGmailAdmin,
  GMAIL_DISCONNECT_PHRASE,
} from "../services/gmail/gmailAdminEmails.js";
import {
  disconnectGmail,
  getGmailStatus,
  getOAuthConsentUrl,
  isGoogleOAuthConfigured,
  saveOAuthTokens,
} from "../services/gmail/gmailClient.js";
import { logLeadEmailActivity } from "../services/gmail/logActivity.js";
import { getEmailDetail, getGmailThread } from "../services/gmail/messages.js";
import { syncGmailEmails } from "../services/gmail/syncEmails.js";
import { replyToEmail } from "../services/gmail/reply.js";
import { sendGmailEmail } from "../services/gmail/send.js";
import { renewGmailWatch } from "../services/gmail/watch.js";
import { pollGmailInbox } from "../jobs/pollGmailInbox.js";

const router = Router();

router.get("/gmail/oauth/start", requireAuth, (req, res, next) => {
  try {
    assertGmailAdmin((req as AuthenticatedRequest).user?.email);
    if (!isGoogleOAuthConfigured()) {
      throw new AppError(
        "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        503
      );
    }
    const state = (req as AuthenticatedRequest).user?.id || "";
    const url = getOAuthConsentUrl(state);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

/** JSON consent URL for SPA Connect button (JWT cannot be sent via plain navigation). */
router.get("/gmail/oauth/url", requireAuth, (req, res, next) => {
  try {
    assertGmailAdmin((req as AuthenticatedRequest).user?.email);
    if (!isGoogleOAuthConfigured()) {
      throw new AppError(
        "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        503
      );
    }
    const state = (req as AuthenticatedRequest).user?.id || "";
    const url = getOAuthConsentUrl(state);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.get("/gmail/oauth/callback", optionalAuth, async (req, res, next) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      throw new AppError("Missing OAuth code", 400);
    }
    const userId =
      (typeof req.query.state === "string" && req.query.state) ||
      (req as AuthenticatedRequest).user?.id ||
      null;
    const { email } = await saveOAuthTokens({ code, userId });

    try {
      await renewGmailWatch();
      console.log("[gmail] Watch registered after OAuth connect");
    } catch (watchErr) {
      console.warn(
        "[gmail] Auto watch after OAuth failed (tokens still saved):",
        watchErr instanceof Error ? watchErr.message : watchErr
      );
    }

    const appUrl = env.appUrl().replace(/\/$/, "");
    res.redirect(
      `${appUrl}/Settings?gmail=connected&email=${encodeURIComponent(email)}`
    );
  } catch (err) {
    next(err);
  }
});

router.get("/gmail/status", requireAuth, async (_req, res, next) => {
  try {
    const status = await getGmailStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/disconnect", requireAuth, async (req, res, next) => {
  try {
    assertGmailAdmin((req as AuthenticatedRequest).user?.email);
    const phrase = String(
      req.body?.confirmPhrase ?? req.body?.confirm_phrase ?? ""
    ).trim();
    if (phrase !== GMAIL_DISCONNECT_PHRASE) {
      throw new AppError(
        `Type "${GMAIL_DISCONNECT_PHRASE}" exactly to disconnect`,
        400
      );
    }
    const result = await disconnectGmail();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/gmail/messages/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await getEmailDetail(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/gmail/threads/:threadId", requireAuth, async (req, res, next) => {
  try {
    const result = await getGmailThread(req.params.threadId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/sync", requireAuth, async (req, res, next) => {
  try {
    const leadEmail =
      req.body?.leadEmail || req.body?.email || req.body?.lead_email;
    const result = await syncGmailEmails(String(leadEmail || ""));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/drafts", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { to, subject, body, leadId } = req.body ?? {};
    if (!to || !subject) {
      throw new AppError("to and subject are required", 400);
    }
    const result = await createGmailDraft({
      to,
      subject,
      body: body ?? "",
      leadId,
      userId: user?.id,
      userName: user?.full_name,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/send", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { to, subject, body, leadId } = req.body ?? {};
    if (!to || !subject) {
      throw new AppError("to and subject are required", 400);
    }
    const result = await sendGmailEmail({
      to,
      subject,
      body: body ?? "",
      leadId,
      userId: user?.id,
      userName: user?.full_name,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/reply", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { to, subject, body, threadId, messageId, leadId, action } =
      req.body ?? {};
    if (!to || !subject) {
      throw new AppError("to and subject are required", 400);
    }
    const result = await replyToEmail({
      to,
      subject,
      body: body ?? "",
      threadId,
      messageId,
      leadId,
      action,
      userId: user?.id,
      userName: user?.full_name,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/gmail/log-activity", requireAuth, async (req, res, next) => {
  try {
    const leadId = req.body?.leadId || req.body?.event?.entity_id;
    const result = await logLeadEmailActivity(leadId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Register Gmail users.watch for Pub/Sub push to /webhook/gmail */
router.post("/gmail/watch", requireAuth, async (req, res, next) => {
  try {
    assertGmailAdmin((req as AuthenticatedRequest).user?.email);
    const result = await renewGmailWatch();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Manual safety-net poll (same logic as cron job) */
router.post("/gmail/poll", requireAuth, async (_req, res, next) => {
  try {
    const result = await pollGmailInbox();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
