/** Website contact / opportunities form bot — not treated as internal team mail. */
export const WEBSITE_FORM_SENDERS = new Set(["itsupport@mangiadc.com"]);

export function isWebsiteFormSender(email: string): boolean {
  const normalized = (email || "").trim().toLowerCase();
  return WEBSITE_FORM_SENDERS.has(normalized);
}

export const AUTOMATED_SENDER_LOCALPARTS = [
  "mailer-daemon",
  "postmaster",
  "bounces",
  "bounce",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "notifications",
  "notification",
  "alerts",
  "alert",
  "mailerdaemon",
  "meetings-noreply",
  "calendar-notification",
  "gemini-noreply",
  "workspace-noreply",
  "meet-recordings-noreply",
];

export const AUTOMATED_SENDER_SUBSTRINGS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "-bounce",
  ".bounce",
  "mailer-daemon",
];

export const BOT_NAME_PREFIXES = [
  "1xbet",
  "888starz",
  "888",
  "777-bet",
  "777bet",
];

export const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "zoho.com",
  "fastmail.com",
  "fastmail.fm",
  "mail.com",
  "email.com",
  "inbox.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "tutanota.com",
  "tuta.io",
  "hey.com",
  "duck.com",
]);

export const SPAM_PHRASES = [
  "guest post",
  "guest posting",
  "backlink",
  "backlinks",
  "link building",
  "link exchange",
  "link insertion",
  "seo services",
  "seo proposal",
  "seo audit",
  "rank #1 on google",
  "first page of google",
  "google ranking",
  "web design proposal",
  "website redesign offer",
  "website redesign proposal",
  "mobile app development services",
  "app development proposal",
  "crypto investment",
  "bitcoin opportunity",
  "forex signals",
  "increase your traffic",
  "increase your website traffic",
  "we can provide developers",
  "we offer virtual assistants",
  "outsourcing services",
  "white label seo",
  "white-label seo",
];

export function extractDomain(email: string): string {
  const parts = (email || "").split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : "";
}

export function getRootDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  const lastTwo = parts.slice(-2).join(".");
  const multiLevelTlds = [
    "co.uk",
    "com.au",
    "co.nz",
    "co.jp",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "net.au",
  ];
  if (multiLevelTlds.includes(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string
): string {
  const h = headers.find(
    (hdr) => hdr.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value || "";
}

export function parseSenderEmail(fromHeader: string): string {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

export function parseSenderEmailRaw(fromHeader: string): string {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim();
}

interface GmailMimePart {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailMimePart[] | null;
}

export function decodeGmailBody(payload: GmailMimePart | null): string {
  let body = "";
  const walk = (p: GmailMimePart) => {
    if (p.body?.data) {
      try {
        body += Buffer.from(
          p.body.data.replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString("utf8");
      } catch {
        /* ignore */
      }
    }
    if (Array.isArray(p.parts)) {
      for (const part of p.parts) {
        walk(part);
      }
    }
  };
  if (payload) walk(payload);
  return body;
}

/**
 * Detect calendar / meeting invites from MIME, Content-Class, or subject.
 * Catches invites forwarded by real people that sender-only filters miss.
 */
export function detectCalendarInvite(
  headers: Array<{ name?: string | null; value?: string | null }>,
  payload: GmailMimePart | null,
  subject: string
): { isCalendar: boolean; reason?: string } {
  const contentClass = getHeader(headers, "Content-Class").toLowerCase();
  if (contentClass.includes("calendarmessage")) {
    return {
      isCalendar: true,
      reason: `Content-Class calendar message: ${contentClass.substring(0, 80)}`,
    };
  }

  let foundCalendarPart = false;
  let foundIcs = false;
  const walk = (p: GmailMimePart) => {
    const mime = (p.mimeType || "").toLowerCase();
    const filename = (p.filename || "").toLowerCase();
    if (mime === "text/calendar" || mime.includes("text/calendar")) {
      foundCalendarPart = true;
    }
    if (filename.endsWith(".ics")) {
      foundIcs = true;
    }
    if (Array.isArray(p.parts)) {
      for (const part of p.parts) walk(part);
    }
  };
  if (payload) walk(payload);

  if (foundCalendarPart) {
    return { isCalendar: true, reason: "MIME part text/calendar" };
  }
  if (foundIcs) {
    return { isCalendar: true, reason: "Attachment .ics" };
  }

  if (
    /^\s*(Re:\s*)?(Invitation|Updated invitation|Accepted|Declined|Tentative|Canceled|Cancelled):/i.test(
      subject || ""
    )
  ) {
    return {
      isCalendar: true,
      reason: `Calendar subject: ${(subject || "").substring(0, 120)}`,
    };
  }

  return { isCalendar: false };
}

/**
 * Strip quoted reply history and signature blocks to cut LLM input tokens.
 * Falls back to the original body if stripping leaves under 40 characters.
 */
export function stripQuotedReply(body: string): string {
  if (!body || body.trim().length < 40) return body;

  let text = body;

  // Cut at common reply separators
  const separators = [
    /\nOn .{10,120} wrote:\s*\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}\s*\n/i,
    /\nFrom:\s+.+\nSent:\s+/i,
    /\nFrom:\s+.+\nDate:\s+/i,
    /\n_{5,}\s*\n/,
  ];
  for (const sep of separators) {
    const m = text.match(sep);
    if (m && typeof m.index === "number" && m.index > 40) {
      text = text.slice(0, m.index);
      break;
    }
  }

  // Drop lines that are pure quoted reply ("> ...")
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^>/.test(line.trimStart())) continue;
    kept.push(line);
  }
  text = kept.join("\n");

  // Drop signature after "-- " (RFC 3676)
  const sigIdx = text.search(/\n-- \n/);
  if (sigIdx > 40) {
    text = text.slice(0, sigIdx);
  }

  text = text.trim();
  if (text.length < 40) return body;
  return text;
}

export function shouldSilentlySkip(
  headers: Array<{ name?: string | null; value?: string | null }>,
  senderEmail: string
): { skip: boolean; reason?: string } {
  const autoSubmitted = getHeader(headers, "Auto-Submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return { skip: true, reason: `Auto-Submitted: ${autoSubmitted}` };
  }
  if (getHeader(headers, "X-Autoreply").toLowerCase() === "yes") {
    return { skip: true, reason: "X-Autoreply: yes" };
  }
  const precedence = getHeader(headers, "Precedence").toLowerCase();
  if (["bulk", "auto_reply", "list", "junk"].includes(precedence)) {
    return { skip: true, reason: `Precedence: ${precedence}` };
  }
  if (getHeader(headers, "X-Failed-Recipients")) {
    return { skip: true, reason: "Bounce (X-Failed-Recipients header)" };
  }

  const subject = getHeader(headers, "Subject");
  if (
    subject.startsWith("Mangia CRM: Gmail intake") ||
    subject.startsWith("Mangia CRM: Gmail disconnected")
  ) {
    return {
      skip: true,
      reason: `CRM system alert subject: ${subject.substring(0, 120)}`,
    };
  }

  const localPart = (senderEmail.split("@")[0] || "").toLowerCase();
  if (
    AUTOMATED_SENDER_LOCALPARTS.some(
      (p) => localPart === p || localPart.startsWith(`${p}+`)
    )
  ) {
    return { skip: true, reason: `Automated sender local-part: ${localPart}` };
  }

  const matchedSubstring = AUTOMATED_SENDER_SUBSTRINGS.find((s) =>
    localPart.includes(s)
  );
  if (matchedSubstring) {
    return {
      skip: true,
      reason: `Automated sender pattern "${matchedSubstring}" in local-part: ${localPart}`,
    };
  }

  const domain = (senderEmail.split("@")[1] || "").toLowerCase();
  if (
    domain === "google.com" &&
    (localPart.includes("meet") ||
      localPart.includes("calendar") ||
      localPart.includes("gemini") ||
      localPart.includes("workspace"))
  ) {
    return { skip: true, reason: `Google automated sender: ${senderEmail}` };
  }

  if (
    senderEmail.endsWith("@mangiadc.com") &&
    !isWebsiteFormSender(senderEmail)
  ) {
    return { skip: true, reason: `Internal team email: ${senderEmail}` };
  }

  return { skip: false };
}

export function detectBulkMailHeaders(
  headers: Array<{ name?: string | null; value?: string | null }>
): { isBulk: boolean; matched?: string } {
  if (getHeader(headers, "List-Unsubscribe")) {
    return {
      isBulk: true,
      matched: "List-Unsubscribe header present (bulk mail)",
    };
  }
  const listId = getHeader(headers, "List-Id");
  if (listId) {
    return {
      isBulk: true,
      matched: `List-Id header present: ${listId.substring(0, 120)}`,
    };
  }
  if (getHeader(headers, "List-Unsubscribe-Post")) {
    return {
      isBulk: true,
      matched: "List-Unsubscribe-Post header present (bulk mail)",
    };
  }
  if (getHeader(headers, "Feedback-ID")) {
    return {
      isBulk: true,
      matched: "Feedback-ID header present (ESP campaign)",
    };
  }
  return { isBulk: false };
}

export function detectSpamKeywords(
  subject: string,
  body: string,
  namePart: string
): { isSpam: boolean; matched?: string } {
  const matchedBotPrefix = BOT_NAME_PREFIXES.find((p) =>
    namePart.startsWith(p)
  );
  if (matchedBotPrefix) {
    return { isSpam: true, matched: `Bot name prefix: ${matchedBotPrefix}` };
  }
  if (/\burl\s*=/i.test(`${subject}\n${body}`)) {
    return { isSpam: true, matched: "url= injection" };
  }
  const haystack = `${subject}\n${body.substring(0, 1000)}`.toLowerCase();
  const matchedPhrase = SPAM_PHRASES.find((p) => haystack.includes(p));
  if (matchedPhrase) {
    return { isSpam: true, matched: `Spam phrase: "${matchedPhrase}"` };
  }
  return { isSpam: false };
}
