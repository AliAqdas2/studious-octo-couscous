# Cooking → Plan Traceability

Every checklist line from [`BEO_System_docs/Copy of _In-Person Cooking.md`](../BEO_System_docs/Copy%20of%20_In-Person%20Cooking.md) maps to a plan field, task, or named resource.  
**Meeting overrides** (Slack retirement, FoDC shared add-on, deposit viewers) are noted where they differ from the cooking doc text.

| ID | Cooking item | Plan home | Implementation type |
|----|--------------|-----------|---------------------|
| C001 | Meeting with sales to determine location, date, timing, preferences | 02, 03 | Task `upon_deposit` — Sales |
| C002 | Start Time | 02 | Event field / prefill |
| C003 | Date | 02 | Event field / prefill |
| C004 | Company Name | 02 | Prefill from lead |
| C005 | Preferred Experience(s) | 02 | Prefill → eventType |
| C006 | Event Planner Name / Phone / Email | 02 | POC fields |
| C007 | Deposit amount (restricted) | 02, README | Field; viewers **Dave, Zach, Monica only** |
| C008 | Estimated Headcount range | 02 | `headcount_min` / `headcount_max` |
| C009 | Alcohol or No Alcohol | 02 | Boolean |
| C010 | Card on file / Ticketed / Fixed Open Bar | 02 | Enum |
| C011 | Wine/Beer/Soft Drinks | 02 | Bar sub-options |
| C012 | Mixed Drinks — Top Shelf / Rail | 02 | Bar sub-options |
| C013 | Competition or Cooking Experience | 02 | `is_competition` |
| C014 | Dish Configuration (entree / app+entree / app+entree+dessert) | 02 | Enum |
| C015 | Menu selected at ROS | 05 | ROS form |
| C016 | Food Additions — Charcuterie Platters (**boards vs platters**) | 02, 05 | Intake + ROS count |
| C017 | Additional Protein on the side | 02, 05 | Optional amount |
| C018 | Mystery ingredients (competition) | 02, 05 | Cooking-only |
| C019 | Alternative sauces (competition) | 02, 05 | Cooking-only |
| C020 | Flavors of DC / Warm Meal | 02, README | **Shared** add-on (meeting) |
| C021 | Embroidered aprons + custom name Y/N | 02, 05 | Add-on + ROS logo progress |
| C022 | Custom Engraved Glassware | 02, 05 | Add-on + optional amount |
| C023 | Custom Cheeseboard (**25 unit minimum**) | 02 | Add-on with min validation |
| C024 | Chocolate Mold | 02, 05 | Add-on |
| C025 | Chef Hats ± embroidered | 02, 05 | Add-on |
| C026 | Berets (Paint & Sip) ± embroidered | 02, 05 | Shared add-on |
| C027 | Transportation Y/N + **Sammy Transport** (Alberto) / **DC Nation Tours** | 02, 05 | + Vendor Directory |
| C028 | Venue: go-to-them vs house list + restrictions | 02 | Dichotomy + list + Other |
| C029 | Venue list (Launch…1015 15th) | 02 | Enum + Other |
| C030 | Sales alert in Slack | README, 03 | **Meeting override:** not required; email blast Dave/Zach/Monica/Eileen; Slack link optional resource |
| C031 | Create FareHarbor item + how-to video | 03, 01 | Task Admin + resource |
| C032 | Participation Link (Sheets **or** Forms) | 02, 05 | URL + type enum |
| C033 | Post Event Survey link | 05, 06 | URL field |
| C034 | Workflow direct CRM event link | 05 | URL field |
| C035 | Admin creates **BEO** | 01, 05 | Task Admin (distinct from shell) |
| C036 | Run of Show Template | 05 | Resource / URL |
| C037 | Ops BEO Shell & link to FareHarbor + video | 01, 05 | Task Ops |
| C038 | Reach out Instructor + Event Team immediately | 03 | Task Ops |
| C039 | 48h staff response policy + escalate | 03 | Sub-status + escalate |
| C040 | Record which member reached out | 03 | Task note field |
| C041 | Contact venue / reserve loading dock | 03 | Task Ops + Vendor Directory |
| C042 | Email client **2.5 weeks** before | 03 | Phase `two_point_five_weeks` |
| C043 | Schedule ROS with client | 03, 05 | Task |
| C044 | Calendar invite client + Sales | 05 | Task / calendar |
| C045 | ROS Confirm menu App/Entree/Dessert | 05 | ROS form |
| C046 | ROS Double-check bar (handling / consumption / wine or beer) | 05 | ROS form |
| C047 | ROS arrival (motorcoach / Uber / own / all) | 05 | ROS form |
| C048 | ROS time changed Y/N + new time | 05 | ROS form |
| C049 | ROS confirm headcount | 05 | ROS form |
| C050 | ROS Day-of POC name/email/phone | 05 | ROS form |
| C051 | ROS Multimedia permission (3-way) | 05 | Enum + talk-track helper |
| C052 | ROS seating curated Y/N → random / client groups | 05 | ROS form |
| C053 | ROS food addition counts (charcuterie, protein, mystery, sauces) | 05 | ROS form |
| C054 | ROS custom add-ons progress (logo→embroiderist, name, glassware, board, mold, hats, berets) | 05 | ROS checklist |
| C055 | ROS transport confirm | 05 | ROS form |
| C056 | Email BEO to all staff + embed FH | 05 | Task Ops after ROS |
| C057 | Marketing: menu/recipe cards printed + video | 03, 04 | Task Marketing |
| C058 | Menu verified by chef for THIS function? | 03 | Sub-check |
| C059 | Appropriate paper in stock | 03 | Sub-check |
| C060 | Printed in office? + FedEx how-to | 03 | Sub-check + resource |
| C061 | QR created Y/N → create if not | 03 | Sub-check |
| C062 | QR on website | 03 | Sub-check |
| C063 | QR printed | 03 | Sub-check |
| C064 | Menu Tents | 03 | Sub-check |
| C065 | Recipe Cards | 03 | Sub-check |
| C066 | Bar Menu | 03 | Sub-check |
| C067 | Inventory ordered (Inventory Links doc) | 03, 04 | Task Ops |
| C068 | Glassware (**Quality Glass Engraving** — Vendor Directory) | 04 | Inventory item |
| C069 | Custom aprons sent to **Basecamp DC** | 03, 04 | Task |
| C070 | Paper Towels (+ Amazon URL) | 04 | Catalog seed |
| C071 | Dish soap | 04 | Catalog seed |
| C072 | Plastic or Ceramic Plates (+ Amazon/Party City/Michaels) | 04 | Catalog seed |
| C073 | Plastic Tablecloth Roll (Party City) | 04 | Catalog seed |
| C074 | Trash Bags (Target) | 04 | Catalog seed |
| C075 | Dinner Napkins (Amazon) | 04 | Catalog seed |
| C076 | Spices | 04 | Catalog seed |
| C077 | Cocktail napkins | 04 | Catalog seed |
| C078 | 3rd party furniture | 04 | Catalog seed |
| C079 | Sterno Fuel (+ Party City alt) | 04 | Catalog seed |
| C080 | Aluminum Tray (+ Target note) | 04 | Catalog seed |
| C081 | Parchment Paper | 04 | Catalog seed |
| C082 | To Go Containers + cost analysis note | 04 | Catalog seed |
| C083 | Plastic Gloves | 04 | Catalog seed |
| C084 | Butane cartridges | 04 | Catalog seed |
| C085 | Olive Oil — **Georgetown Olive Oil** | 04 | Catalog seed |
| C086 | Fig or strawberry Balsamic — **Georgetown Olive Oil** | 04 | Catalog seed |
| C087 | Salt and Pepper | 04 | Catalog seed |
| C088 | Aluminum foil + purchase analysis note | 04 | Catalog seed |
| C089 | BEO staff check-in Host+Instructor 72–48h | 01, 03, 05 | Phase `staff_checkin_72_48h` |
| C090 | Company aprons cleaned and ready | 03 | Task |
| C091 | Logo’d aprons ready for **Basecamp DC** pickup | 03 | Task |
| C092 | Remaining supplies: in-person / curbside / rush | 03 | Task with method enum |
| C093 | 24h inventory triple-check (Ops Manager or Intern) | 03 | Task |
| C094 | Acquire Ice Y/N | 03, 04 | Task / check |
| C095 | Day-of: refer to event-specific BEO | 05, 06 | Host task |
| C096 | Event Host — Company Handbook | 06 | Resource on task |
| C097 | Ops support — Company Handbook | 06 | Resource on task |
| C098 | Event Lead ↔ day-of POC | 06 | Task |
| C099 | Ensure guest speakers speak | 06 | Task |
| C100 | Gather photo assets | 06 | Task |
| C101 | Upload assets to digital database | 06 | Task |
| C102 | Post event survey fill | 06 | Task + Form URL |
| C103 | Track drink consumption | 06 | Task |
| C104 | WhatsApp media (manual) | 06, README | Task; automation deferred |
| C105 | Team debrief → survey | 06 | Task |
| C106 | Admin obtain media for morning email | 06 | Task Admin |
| C107 | Staff Hours of the event | 06 | Capture field |
| C108 | Additional details on the event | 06 | Capture field |
| C109 | Consumption Invoice | 06 | Task |
| C110 | Thank-you email + photo Drive link | 06 | Sales draft V1/V2 (dynamic experience name) |
| C111 | V2 yes → event tracker + LinkedIn | 06 | Follow-up tasks |
| C112 | +3 months T-shirt size → CEO letter + shirt | 06 | Scheduled follow-up |
| C113 | Staff invoice EOM; receipts EOM or immediate | 06 | Policy on invoicing task |
| C114 | Event report: labor, venue fees, supplies | 06 | Fields |
| C115 | EMAIL 2: next event? | 06 | Checklist |
| C116 | EMAIL 2: intro three individuals | 06 | Checklist + copy |
| C117 | EMAIL 2: newsletter interest | 06 | Checklist |
| C118 | Build another lead Yes/No (Sales) | 06 | Action |

## Named resources (must seed)

| Resource | URL / note |
|----------|------------|
| Vendor Directory (local source of truth) | [`BEO_System_docs/Vendor Directory.md`](../BEO_System_docs/Vendor%20Directory.md) |
| Vendor Directory (Drive convenience) | `https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit` |
| How to Add Events to FareHarbor | Drive video `1b7r8q-jcbn4uZ09IftUSHdaLUuZ7FMnl` |
| How to make a BEO Shell | Same Drive folder / video ref in cooking |
| How to Create Recipe Cards | Drive `1nTWDc2MRYW0tseNMDLnAtnqGUr1zyMNU` |
| QR Codes folder | Drive `1qDXF2mUG_lSHrHyrGOviqHTwbov3sOmo` |
| Inventory Links | `https://docs.google.com/document/d/1WSsg6tgUGXv3bYspElOWjQvYFJnnVLXXLQI2gd0oh8U/edit` |
| Post Event Survey Form | `https://docs.google.com/forms/d/17shTljWmlrpEvZBhljLFsu3oUQCeR_rQEGFjRr6LUJw/edit` |
| Event Photos Drive | `https://drive.google.com/drive/folders/1un3gg73vMrmkbLR_8BaHqw1XLTtHrC1I` |
| Company Handbook | `https://docs.google.com/document/d/19OsGb5N7y_GIgUsYuSsfjTxVBx65Mn_zPH5_mH3grO0/edit` |
| Slack Salesalert (optional resource only) | `https://mangia-dc.slack.com/archives/C03UU3WPUR1` |
| Embroidery: Wattz Web Design & Marketing, Owings MD | Vendor Directory + meeting |
| Embroidery: Minuteman Press, Dunkirk MD | Vendor Directory + meeting |
| Transport: Sammy Transport (Alberto) | Vendor Directory |
| Transport: DC Nation Tours | Vendor Directory |
| Merchandise: Basecamp DC / Quality Glass Engraving | Vendor Directory |
| Oil: Georgetown Olive Oil | Vendor Directory |

## Sync status

When every row above is reflected in plans 01–06 and seeded at build time, Cooking is **100% traced**.
