# Remaining migration gaps (Base44 → Mangia)

Last updated: 2026-08-10

This lists what is **still missing** after the core Gmail / Twilio / intake / Calendar / event-task work.
Use it as the backlog; items are ordered by suggested priority within each section.

---

## Done (do not re-port)

- Gmail connect / disconnect / watch, message detail, draft detail, thread, sync, send, reply, log activity
- Twilio outbound call + TwiML callbacks + `analyzeCall` + local recording storage
- Contact-form / inbox intake + classify + returning-client check
- Survey draft on call failure with **Google Calendar freeBusy** slot (`<<Sales Manager Availability>>`)
- Meeting confirmation reply handler + ICS invite
- Local file upload / extract
- `getDraftDetail`, `createEventFromWonLead` (basic), scheduled jobs (digest, poll, retries, watch renew)
- `generateEventWorkflow`, `postSystemMessage`, `validateTaskSync`, `autoRepairTaskSync`
- `postEventAutomation` (on Completed transition), `assignEventStaff` (on event create), `cleanupEventTasks` (on event delete)

---

## Won’t do (intentional)

Declined — do not add back to the backlog:

| Feature | Reason |
|---------|--------|
| `validateLeadStageTransition` | No stage-transition matrix enforcement |
| `sendStageEmail` | No auto-send of mapped templates on stage change |
| `handleDepositReceived` | No deposit-chasing / deposit-received automation |
| Auto Won → event conversion beyond basic `createEventFromWonLead` | Manual/API path is enough; no further auto-convert work |

---

## 1. Integrations / lower priority

| Feature | Notes |
|---------|--------|
| FareHarbor webhook | Schema / entity exist; no `/webhook/fareharbor` HMAC handler |
| Twilio business-profile callback | Trust Hub / business profile status logging (voice webhooks already exist) |
| Assets / Google Drive | UI shows “Coming Soon” |
| `appLogs.logUserInApp` | Analytics no-op in apiClient |
| `getInboxEmails` / `getSentEmails` | Base44 had them; no current Mangia UI callers |
| `extractLeadFromEmail` | Manual “extract this message into a lead” tool; intake covers the auto path |

---

## 2. Suggested order

1. **FareHarbor / Twilio Trust Hub / Drive / analytics** as needed

---

## 3. How to spot new 501s

Any `functions.invoke('…')` name that is not explicitly mapped in `apiClient.js` throws:

```text
Function "<name>" is not migrated yet. Use the local API when available.
```

When adding a port: implement the service + route, then map the invoke name in `apiClient.js` (same pattern as `getDraftDetail` / Gmail / calls).
