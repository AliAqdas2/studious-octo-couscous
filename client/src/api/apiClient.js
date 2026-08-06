/**
 * Local Express API client — drop-in replacement for @base44/sdk surface used by the app.
 */

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token ?? null;
}

export function getAccessToken() {
  return accessToken;
}

function clearAccessToken() {
  accessToken = null;
}

function redirectToLoginPage() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const body = await parseJson(res);
    if (!res.ok) {
      clearAccessToken();
      throw new ApiError(body?.error || "Session expired", res.status, body);
    }
    setAccessToken(body.accessToken);
    return body;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request(path, options = {}, { retry = true, skipAuth = false } = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && retry && !skipAuth) {
    try {
      await refreshAccessToken();
      return request(path, options, { retry: false, skipAuth });
    } catch {
      clearAccessToken();
      redirectToLoginPage();
      throw new ApiError("Authentication required", 401);
    }
  }

  const body = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body);
  }
  return body;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [innerKey, innerVal] of Object.entries(value)) {
        if (innerVal === undefined || innerVal === null) continue;
        if (typeof innerVal === "object") {
          for (const [op, opVal] of Object.entries(innerVal)) {
            if (opVal !== undefined && opVal !== null) {
              search.set(`filter[${innerKey}][${op}]`, String(opVal));
            }
          }
        } else {
          search.set(`filter[${innerKey}]`, String(innerVal));
        }
      }
      continue;
    }
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function unwrapList(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function createEntityClient(path) {
  return {
    list: async (sort, limit) => {
      const result = await request(
        `/api/${path}${toQuery({ sort, limit, format: "array" })}`
      );
      return unwrapList(result);
    },
    filter: async (filters = {}, sort, limit) => {
      const result = await request(
        `/api/${path}${toQuery({ filter: filters, sort, limit, format: "array" })}`
      );
      return unwrapList(result);
    },
    get: (id) => request(`/api/${path}/${id}`),
    create: (data) =>
      request(`/api/${path}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/api/${path}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      request(`/api/${path}/${id}`, {
        method: "DELETE",
      }),
    bulkCreate: (rows) =>
      request(`/api/${path}/bulk`, {
        method: "POST",
        body: JSON.stringify(rows),
      }),
  };
}

const ENTITY_MAP = {
  User: "users",
  Lead: "leads",
  Client: "clients",
  Event: "events",
  Task: "tasks",
  RoleAssignment: "role-assignments",
  ActivityLog: "activity-logs",
  CallLog: "call-logs",
  EmailTemplate: "email-templates",
  EventTemplate: "event-templates",
  ThreadMessage: "thread-messages",
  MentionRead: "mention-reads",
  AutomationConfig: "automation-config",
  GmailPollState: "gmail-poll-state",
  SpamEmail: "spam-emails",
  StageEmailMapping: "stage-email-mappings",
  ProcessedGmailMessage: "processed-gmail-messages",
  FareharborEvent: "fareharbor-events",
  TwilioWebhookLog: "twilio-webhook-logs",
};

const entities = Object.fromEntries(
  Object.entries(ENTITY_MAP).map(([name, path]) => [name, createEntityClient(path)])
);

export const base44 = {
  auth: {
    async login({ email, password }) {
      const body = await request(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        { skipAuth: true, retry: false }
      );
      setAccessToken(body.accessToken);
      return body;
    },
    async refresh() {
      return refreshAccessToken();
    },
    async me() {
      return request("/api/auth/me");
    },
    async logout(_returnUrl) {
      try {
        await request(
          "/api/auth/logout",
          { method: "POST", body: JSON.stringify({}) },
          { retry: false }
        );
      } catch {
        // ignore logout network errors
      } finally {
        clearAccessToken();
      }
    },
    redirectToLogin(_returnUrl) {
      redirectToLoginPage();
    },
    passwordReset: {
      async status() {
        return request(
          "/api/auth/password-reset/status",
          {},
          { skipAuth: true, retry: false }
        );
      },
      async request({ email }) {
        return request(
          "/api/auth/password-reset/request",
          {
            method: "POST",
            body: JSON.stringify({ email }),
          },
          { skipAuth: true, retry: false }
        );
      },
      async verify({ email, code }) {
        return request(
          "/api/auth/password-reset/verify",
          {
            method: "POST",
            body: JSON.stringify({ email, code }),
          },
          { skipAuth: true, retry: false }
        );
      },
      async confirm({ email, code, newPassword }) {
        return request(
          "/api/auth/password-reset/confirm",
          {
            method: "POST",
            body: JSON.stringify({ email, code, newPassword }),
          },
          { skipAuth: true, retry: false }
        );
      },
    },
    async inviteStatus(token) {
      const q = encodeURIComponent(token || "");
      return request(
        `/api/auth/invite/status?token=${q}`,
        {},
        { skipAuth: true, retry: false }
      );
    },
    async acceptInvite({ token, password }) {
      return request(
        "/api/auth/accept-invite",
        {
          method: "POST",
          body: JSON.stringify({ token, password }),
        },
        { skipAuth: true, retry: false }
      );
    },
  },
  entities,
  gmail: {
    async getStatus() {
      return request("/api/gmail/status");
    },
    async getOAuthUrl() {
      return request("/api/gmail/oauth/url");
    },
    async disconnect({ confirmPhrase } = {}) {
      return request("/api/gmail/disconnect", {
        method: "POST",
        body: JSON.stringify({ confirmPhrase }),
      });
    },
  },
  appLogs: {
    async logUserInApp() {
      // Analytics not migrated yet — no-op
    },
  },
  functions: {
    async invoke(name, payload = {}) {
      if (name === "getLeadsPaginated") {
        const body = await request("/api/leads/search", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "getEmailDetail") {
        const messageId = payload.messageId || payload.id;
        if (!messageId) {
          throw new ApiError("messageId is required", 400);
        }
        const body = await request(
          `/api/gmail/messages/${encodeURIComponent(messageId)}`
        );
        return { data: body };
      }

      if (name === "getGmailThread") {
        const threadId = payload.threadId || payload.id;
        if (!threadId) {
          throw new ApiError("threadId is required", 400);
        }
        const body = await request(
          `/api/gmail/threads/${encodeURIComponent(threadId)}`
        );
        return { data: body };
      }

      if (name === "syncGmailEmails") {
        const leadEmail = payload.leadEmail || payload.email;
        if (!leadEmail) {
          throw new ApiError("leadEmail is required", 400);
        }
        const body = await request("/api/gmail/sync", {
          method: "POST",
          body: JSON.stringify({ leadEmail }),
        });
        return { data: body };
      }

      if (name === "createGmailDraft") {
        const body = await request("/api/gmail/drafts", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "sendGmailEmail") {
        const body = await request("/api/gmail/send", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "replyToEmail") {
        const body = await request("/api/gmail/reply", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "logLeadEmailActivity") {
        const body = await request("/api/gmail/log-activity", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "createEventFromWonLead") {
        const leadId =
          payload.leadId ||
          payload.event?.entity_id ||
          payload.data?.id;
        if (!leadId) {
          throw new ApiError("leadId is required", 400);
        }
        const body = await request(`/api/leads/${encodeURIComponent(leadId)}/create-event`, {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "triggerCallTwiML") {
        const body = await request("/api/calls/trigger", {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        });
        return { data: body };
      }

      if (name === "analyzeCall") {
        const callLogId =
          payload?.call_log_id ||
          payload?.callLogId ||
          payload?.id;
        if (!callLogId) {
          throw new ApiError("call_log_id is required", 400);
        }
        const qs =
          payload?.reanalyze === true || payload?.reanalyze === "true"
            ? "?reanalyze=true"
            : "";
        const body = await request(
          `/api/calls/${encodeURIComponent(callLogId)}/analyze${qs}`,
          {
            method: "POST",
            body: JSON.stringify(payload ?? {}),
          }
        );
        return { data: body };
      }

      throw new ApiError(
        `Function "${name}" is not migrated yet. Use the local API when available.`,
        501
      );
    },
  },
  users: {
    async inviteUser({ email, full_name, phone, role, operational_role }) {
      return request("/api/auth/invite", {
        method: "POST",
        body: JSON.stringify({
          email,
          full_name,
          phone,
          role,
          operational_role,
        }),
      });
    },
  },
  integrations: {
    Core: {
      async UploadFile() {
        throw new ApiError("File upload is not migrated yet.", 501);
      },
      async ExtractDataFromUploadedFile() {
        throw new ApiError("File extract is not migrated yet.", 501);
      },
    },
  },
};

export { ApiError };
