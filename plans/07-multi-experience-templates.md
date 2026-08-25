# 07 — Multi-experience templates

**Depends on:** Cooking Family A complete (01–06)  
**Sources:** Each experience file in `BEO_System_docs/` + Aug 19 meeting (`meeting.md`)  
**Rule:** Meeting-first shared skeleton + ROS. Doc deltas for inventory/logistics only. Stubs = **incomplete — flag Zach**. Do not invent inventory.

---

## Goal

After Cooking is production-ready, add one template per experience using a **matrix**: timeline family, real inventory/logistics deltas, doc quality, and **`rosConfirmLabel`** (confirm menu / painting / cocktails / …).

**Policy update:** Family B docs that omit a ROS section are superseded by the meeting — **ROS is shared** for all experiences; inventory remains the primary content delta.

---

## Shared across all templates

- Prefill + deposit intake core (02)
- Deposit notify email → Dave, Zach, Monica, Eileen (Slack not required)
- FareHarbor + Admin BEO + Ops BEO shell
- Instructor / event team outreach + 48h policy
- Venue / loading dock (where applicable)
- Shared custom add-ons (aprons, glassware, boards 25-min, mold, hats, berets) + **FoDC / warm meal**
- Alcohol / bar where applicable
- Transport **Sammy Transport** / **DC Nation Tours** (Alberto = Sammy contact; [Vendor Directory](../BEO_System_docs/Vendor%20Directory.md))
- **Run of Show (~2.5w)** + confirm-X by experience
- Post-event survey, media, thank-you V1/V2 (dynamic experience name), EMAIL 2, optional new lead

---

## Doc-accurate matrix

| Experience | Timeline family | Confirm-X | Real deltas in doc | Doc quality |
|------------|-----------------|-----------|--------------------|-------------|
| **In-Person Cooking** | **A** (deposit → 2.5w ROS → 1w → 72–48h → 24h → day → post) | Confirm menu | Full cooking seed (traceability) | Complete (v1 source of truth) |
| **Paint & Sip** | **B** + shared ROS | Confirm painting | Out-of-town: 8x10 + bubble wrap vs house 11x14; scissors + easels on BEO; canvas / easel / brush inventory | Complete-ish |
| **Pottery** | **B** + shared ROS | Confirm pottery activity | Out-of-town clay + bubble; **rest is Paint clone** | **Incomplete — flag Zach** for clay/kiln SKUs |
| **Lend a Hand** | **B** + shared ROS | Confirm activity | Materials placeholder; ON premise; Paint BEO gear | **Incomplete — flag Zach** |
| **Terrarium** | **B** + shared ROS | Confirm terrarium build | Full plant/soil inventory; remaining balance @2w; kit ship QA | Complete-ish |
| **Flavors of DC** | **B** + shared ROS | Confirm tour itinerary | Early participant list; olive oil gift; multi-stop; wheelchair; BEO mailed; day-of FOH | Complete process; venues omit Foundry/1015 |
| **Monuments** | **B** + shared ROS | Confirm tour itinerary | Tour kit; Dine Around; multi-stop; wheelchair; +45min; 72h reconfirm; BEO mailed to guide | Complete process |
| **Private Food Tour** | **B** + shared ROS | Confirm tour itinerary | Same as Monuments + drinks 0–4 deferred to 2w | Complete process |
| **Mixology** | Collapsed **1w** + shared ROS | Confirm cocktails | Venue “2001 K ST”; inventory still cooking | **Stub — flag Zach** |
| **Chocolate Making** | Collapsed **1w** + shared ROS | Confirm activity | Cooking clone | **Stub — flag Zach** |
| **Chocolate & Wine** | Collapsed **1w** + shared ROS | Confirm activity | Truncated cooking inventory | **Stub — flag Zach** |
| **Cheeseboard** | Collapsed **1w** + shared ROS | Confirm activity | Cooking clone | **Stub — flag Zach** |
| **Gingerbread** | Collapsed **1w** + shared ROS | Confirm activity | Cooking clone | **Stub — flag Zach** |

---

## Implementation approach

1. Shared deposit + **shared ROS cadence** for Family B/C (`includeRos: true`, `sharedRosCadence(rosConfirmLabel)`).  
2. Apply **only** inventory / logistics / intake deltas listed above.  
3. For **Incomplete / Stub** rows: ship shared skeleton + `doc_quality` flag (“Needs Zach inventory review”) — do **not** invent SKUs.  
4. Tours / Flavors: multi-stop / wheelchair / mailed-BEO task defs from their docs.  
5. Paint: out-of-town canvas packaging rules.  
6. Terrarium: remaining balance @2w + kit ship QA.  
7. Inventory order tasks run **after** ROS (~1w), matching the meeting.

---

## Acceptance

- [x] Meeting-first: ROS shared; confirm-X per experience
- [x] Stubs marked flag Zach
- [x] Shared includes FoDC add-on + email blast + FH/BEO/post-event + ROS
- [x] Switching event type regenerates open tasks from new template (with confirm)
- [x] Cooking remains default v1 production path (marketing/QR depth cooking-only)
