import { decodeBase64Url, getGmailApi } from "./gmailClient.js";

interface BodyResult {
  content: string;
  mimeType: string;
}

function getBody(payload: {
  body?: { data?: string | null } | null;
  mimeType?: string | null;
  parts?: Array<{
    body?: { data?: string | null } | null;
    mimeType?: string | null;
    parts?: unknown[];
  }> | null;
}): BodyResult {
  if (payload.body?.data) {
    return {
      content: decodeBase64Url(payload.body.data),
      mimeType: payload.mimeType || "text/plain",
    };
  }
  if (payload.parts) {
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return {
        content: decodeBase64Url(htmlPart.body.data),
        mimeType: "text/html",
      };
    }
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return {
        content: decodeBase64Url(textPart.body.data),
        mimeType: "text/plain",
      };
    }
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = getBody(part as typeof payload);
        if (nested.content) return nested;
      }
    }
  }
  return { content: "", mimeType: "text/plain" };
}

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export async function getEmailDetail(messageId: string) {
  const gmail = await getGmailApi();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msgData = res.data;
  const headers = msgData.payload?.headers || [];
  const bodyResult = getBody(msgData.payload || {});

  return {
    success: true,
    email: {
      id: msgData.id,
      threadId: msgData.threadId,
      subject: headerValue(headers, "Subject"),
      from: headerValue(headers, "From"),
      to: headerValue(headers, "To"),
      cc: headerValue(headers, "Cc"),
      date: headerValue(headers, "Date"),
      body: bodyResult.content,
      bodyMimeType: bodyResult.mimeType,
      snippet: msgData.snippet || "",
      messageIdHeader: headerValue(headers, "Message-ID"),
    },
  };
}
