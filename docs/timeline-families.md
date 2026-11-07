# Timeline families (CRM-05)

Internal workflow codes **A / B / C** stay in the database and seeds. The UI shows descriptive labels only.

| Code | UI label | Meaning |
|------|----------|---------|
| A | Cooking timeline | Full Cooking cadence (deposit → 2.5w ROS → week-of → during → post) |
| B | Standard timeline (3–2–1 weeks) | Multi-week ops with shared ROS; inventory often ~3w or ~2w |
| C | Condensed timeline (1 week) | Shared ROS + ~1 week inventory / prep |

Helper: `client/src/lib/timelineFamilyLabels.js` (`timelineFamilyLabel`).
