# 04 — Inventory and vendors

**Depends on:** [01](./01-event-workflow-foundation.md), [03](./03-task-timeline-and-roles.md)  
**Traceability:** C067–C088, C094  
**Sources:**
1. Cooking inventory SKUs + purchase URLs → [Copy of _In-Person Cooking.md](../BEO_System_docs/Copy%20of%20_In-Person%20Cooking.md) + [Inventory Links](https://docs.google.com/document/d/1WSsg6tgUGXv3bYspElOWjQvYFJnnVLXXLQI2gd0oh8U/edit)
2. Vendor contacts / addresses / phones / use-notes → **[Vendor Directory.md](../BEO_System_docs/Vendor%20Directory.md)** (wins over Drive-only placeholders)
3. Meeting confirms embroidery vendors (Wattz + Minuteman)

Do not invent SKUs for stub experiences (plan 07). Experience-specific vendor sections in the Directory (Paint, Terrarium, Chocolate, tour restaurants) stay out of the cooking catalog.

---

## Goal

Seed **exact** cooking inventory catalog with default purchase URLs and attach per-event checklists to the one-week Ops order task. Seed a **vendors** table from Vendor Directory cooking-relevant rows and link SKUs / tasks to those vendors.

---

## Catalog seed (Cooking — required items)

| Item | Default links / notes | Default vendor |
|------|------------------------|----------------|
| Paper towels | Amazon Flex-Size (cooking URL) | Amazon |
| Dish soap | (no URL in cooking — seed name only) | — |
| Plastic **or** ceramic plates | Amazon plastic + Party City + Michaels alts | Amazon / Party City / Michaels |
| Plastic tablecloth roll | Party City white preferred | Party City |
| Trash bags | Target Flexguard 13gal | Target |
| Dinner napkins | Amazon Vanity Fair | Amazon |
| Spices | name only | — |
| **Cocktail napkins** | name only (separate from dinner) | — |
| **3rd party furniture** | name only | — |
| Sterno fuel | Amazon + Party City alt | Amazon / Party City |
| Aluminum tray | Party City + Target (two per tray note) | Party City / Target |
| Parchment paper | Amazon Basics | Amazon |
| To-go containers | + inventory cost analysis note | — |
| Plastic gloves | name only | — |
| Butane cartridges | Amazon GasOne | Amazon |
| Olive oil | Georgetown Olive Oil (20% in-store account) | **Georgetown Olive Oil** |
| Fig or strawberry balsamic | Georgetown Olive Oil | **Georgetown Olive Oil** |
| Salt and pepper | name only | — |
| Aluminum foil | + purchase analysis note | — |
| Glassware / engraved glassware | Quality Glass Engraving | **Quality Glass Engraving** |
| Custom/logo aprons | Basecamp DC primary; United Tees alt; Zecron blanks | **Basecamp DC** (+ related) |

Master purchase doc: [Inventory Links](https://docs.google.com/document/d/1WSsg6tgUGXv3bYspElOWjQvYFJnnVLXXLQI2gd0oh8U/edit)

---

## Per-event checklist

On cooking events, one-week Ops task expands rows: needed | ordered | received | in_office | notes | link | vendor_id.  
24h: triple-check all needed → in_office; **Acquire Ice Y/N**.

---

## Vendors seed (from Vendor Directory.md)

Seed fields: `name`, `category`, `phone`, `email`, `address`, `website`, `notes`, `used_for`.

| name | category | phone | email | address | website | notes | used_for |
|------|----------|-------|-------|---------|---------|-------|----------|
| Sammy Transport | transport | (703) 401-2861 | ACARHUAS@sammytrans.com | — | — | Owner **Alberto**; assigns drivers; hourly rates + 4h min in Directory | cooking_transport |
| DC Nation Tours | transport | 571-969-9558 | smile@dcnationtours.com | — | — | Contact Mike or Mistral; coach rates in Directory | cooking_transport |
| Georgetown Olive Oil | food_supplier | (202) 333-7330 | emil@georgetownoliveoil.com | 2910 M St NW, Washington, DC 20007 | georgetownoliveoil.com | Owner Emil; 20% when purchasing in-store on Mangia account | oil_balsamic |
| Basecamp DC | merchandise | 202-387-8831 | info@basecampdc.com / Sales@basecampdc.com | 1929 18th St NW, Washington, DC 20009 | basecampdc.com | Raj (owner), Evan (manager); custom logo’d aprons / printed merchandise | logo_aprons |
| United Tees | merchandise | DJ 202-701-7182 / AJ 202-330-7729 | — | — | — | Alt custom printed aprons; screen/pricing in Directory | logo_aprons_alt |
| Zecron Textiles | merchandise | (718) 522-9292 | zeki@zecron.com | 150-50 14th Road, Whitestone, NY 11357 | — | White and black blank aprons (Zeki Dusi) | blank_aprons |
| Quality Glass Engraving | merchandise | 336-585-7986 | sales@qualityglassengraving.com | 206 W 4th St, Winston-Salem, NC 27101 | qualityglassengraving.com | Custom engraved glassware | engraved_glassware |
| Wattz Web Design & Marketing | embroidery | (443) 646-3527 | — | 7620B Investment Ct, Owings, MD 20736 | wattzwebdesign.com | Meeting + Directory embroidery partner | embroidery |
| Minuteman Press | embroidery | (240) 762-0609 | — | 2940 Morning Glory Lane, Dunkirk, MD 20754 | minutemanapparel.com | Meeting + Directory embroidery/apparel | embroidery |

**Also cite (not cooking SKU vendors):** Metro Wine & Spirits / Passion Vines / Dallas Fine Wine under alcohol partnerships for later bar procurement UI — do not invent Mixology inventory from them in v1 cooking catalog.

**Master index resources (keep both):**
- Local: [`BEO_System_docs/Vendor Directory.md`](../BEO_System_docs/Vendor%20Directory.md)
- Drive (convenience): `https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit`

Editable admin list; default URLs on SKUs; vendor_id FKs on catalog rows and relevant task resource links.

---

## Transport CRM enum (intake + ROS)

`Sammy Transport` | `DC Nation Tours` | `Other`

Display **Alberto** as the Sammy contact name — not as the company value.

---

## Acceptance (plan sync)

- [x] Vendor Directory.md cited as contact source of truth (Drive link retained)
- [x] Vendors table lists Sammy Transport, DC Nation Tours, Georgetown Olive Oil, Basecamp DC, United Tees, Zecron, Quality Glass Engraving, Wattz, Minuteman with directory fields
- [x] SKU → vendor mappings (oil, glassware, logo aprons) documented
- [x] Transport CRM enum = Sammy Transport | DC Nation Tours | Other
- [x] No invented Mixology/Chocolate/tour-restaurant SKUs in cooking catalog

## Acceptance (when executing plan 04 code)

- [x] Cocktail napkins and 3rd party furniture seeded
- [x] Plastic or ceramic plates with multi-retailer links
- [x] Georgetown Olive Oil + balsamic linked to vendor seed
- [x] Cooking Amazon/Party City/Target/Michaels defaults from cooking doc
- [x] All directory vendors above seeded in DB
- [x] `TRANSPORT_COMPANIES` / intake UI updated to Sammy Transport | DC Nation Tours | Other

**Next:** execute [`05-run-of-show-and-beo.md`](./05-run-of-show-and-beo.md).
