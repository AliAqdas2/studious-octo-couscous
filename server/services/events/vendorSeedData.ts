/** Cooking-relevant vendors from BEO_System_docs/Vendor Directory.md (plan 04). */

export interface VendorSeedRow {
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  usedFor: string;
}

export const VENDOR_SEED: VendorSeedRow[] = [
  {
    name: "Sammy Transport",
    category: "transport",
    phone: "(703) 401-2861",
    email: "ACARHUAS@sammytrans.com",
    address: null,
    website: null,
    notes:
      "Owner Alberto; assigns drivers; hourly rates + 4h min in Vendor Directory",
    usedFor: "cooking_transport",
  },
  {
    name: "DC Nation Tours",
    category: "transport",
    phone: "571-969-9558",
    email: "smile@dcnationtours.com",
    address: null,
    website: null,
    notes: "Contact Mike or Mistral; coach rates in Vendor Directory",
    usedFor: "cooking_transport",
  },
  {
    name: "Georgetown Olive Oil",
    category: "food_supplier",
    phone: "(202) 333-7330",
    email: "emil@georgetownoliveoil.com",
    address: "2910 M St NW, Washington, DC 20007",
    website: "https://georgetownoliveoil.com",
    notes: "Owner Emil; 20% when purchasing in-store on Mangia account",
    usedFor: "oil_balsamic",
  },
  {
    name: "Basecamp DC",
    category: "merchandise",
    phone: "202-387-8831",
    email: "info@basecampdc.com / Sales@basecampdc.com",
    address: "1929 18th St NW, Washington, DC 20009",
    website: "https://basecampdc.com",
    notes: "Raj (owner), Evan (manager); custom logo'd aprons / printed merchandise",
    usedFor: "logo_aprons",
  },
  {
    name: "United Tees",
    category: "merchandise",
    phone: "DJ 202-701-7182 / AJ 202-330-7729",
    email: null,
    address: null,
    website: null,
    notes: "Alt custom printed aprons; screen/pricing in Vendor Directory",
    usedFor: "logo_aprons_alt",
  },
  {
    name: "Zecron Textiles",
    category: "merchandise",
    phone: "(718) 522-9292",
    email: "zeki@zecron.com",
    address: "150-50 14th Road, Whitestone, NY 11357",
    website: null,
    notes: "White and black blank aprons (Zeki Dusi)",
    usedFor: "blank_aprons",
  },
  {
    name: "Quality Glass Engraving",
    category: "merchandise",
    phone: "336-585-7986",
    email: "sales@qualityglassengraving.com",
    address: "206 W 4th St, Winston-Salem, NC 27101",
    website: "https://qualityglassengraving.com",
    notes: "Custom engraved glassware",
    usedFor: "engraved_glassware",
  },
  {
    name: "Wattz Web Design & Marketing",
    category: "embroidery",
    phone: "(443) 646-3527",
    email: null,
    address: "7620B Investment Ct, Owings, MD 20736",
    website: "https://wattzwebdesign.com",
    notes: "Meeting + Directory embroidery partner",
    usedFor: "embroidery",
  },
  {
    name: "Minuteman Press",
    category: "embroidery",
    phone: "(240) 762-0609",
    email: null,
    address: "2940 Morning Glory Lane, Dunkirk, MD 20754",
    website: "https://minutemanapparel.com",
    notes: "Meeting + Directory embroidery/apparel",
    usedFor: "embroidery",
  },
];
