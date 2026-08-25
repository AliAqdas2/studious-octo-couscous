import type { InventoryPurchaseLink } from "../../db/schema/vendors.js";
import { COOKING_EXPERIENCE_KEY } from "./cookingWorkflowSeed.js";

/** Exact Cooking inventory catalog from Copy of _In-Person Cooking.md (plan 04). */

export interface CatalogSeedRow {
  skuKey: string;
  name: string;
  experienceKey: string;
  /** Match vendors.name when linking default_vendor_id */
  defaultVendorName: string | null;
  purchaseLinks: InventoryPurchaseLink[];
  notes: string | null;
  sortOrder: number;
}

export const COOKING_INVENTORY_CATALOG: CatalogSeedRow[] = [
  {
    skuKey: "paper_towels",
    name: "Paper towels",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon Flex-Size",
        url: "https://www.amazon.com/Amazon-Brand-Flex-Size-Regular/dp/B07QY8P3B1",
      },
    ],
    notes: null,
    sortOrder: 10,
  },
  {
    skuKey: "dish_soap",
    name: "Dish soap",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: null,
    sortOrder: 20,
  },
  {
    skuKey: "plastic_or_ceramic_plates",
    name: "Plastic or ceramic plates",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon plastic plates",
        url: "https://www.amazon.com/Plastic-Premium-Disposable-Dessert-Appetizer/dp/B09X67QRMN",
      },
      {
        label: "Party City",
        url: "https://www.partycity.com/white-with-gold-rim-premium-plastic-dinner-plates-10.25in-20ct-937777.html",
      },
      {
        label: "Michaels",
        url: "https://www.michaels.com/product/round-banquet-plates-with-silver-trim-by-celebrate-it-10512609",
      },
    ],
    notes: "Amazon / Party City / Michaels alts",
    sortOrder: 30,
  },
  {
    skuKey: "plastic_tablecloth_roll",
    name: "Plastic tablecloth roll",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Party City (white preferred)",
        url: "https://www.partycity.com/white-plastic-table-cover-roll-with-slide-cutter-54in-x-126ft-924460.html",
      },
    ],
    notes: "White color preferred",
    sortOrder: 40,
  },
  {
    skuKey: "trash_bags",
    name: "Trash bags",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Target Flexguard 13gal",
        url: "https://www.target.com/p/flexguard-tall-kitchen-drawstring-trash-bags-unscented-13-gallon-25ct-up-38-up-8482/-/A-13967214",
      },
    ],
    notes: null,
    sortOrder: 50,
  },
  {
    skuKey: "dinner_napkins",
    name: "Dinner napkins",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon Vanity Fair",
        url: "https://www.amazon.com/Vanity-Fair-Everyday-Napkins-Packaging/dp/B00MW3HBA0",
      },
    ],
    notes: null,
    sortOrder: 60,
  },
  {
    skuKey: "spices",
    name: "Spices",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: null,
    sortOrder: 70,
  },
  {
    skuKey: "cocktail_napkins",
    name: "Cocktail napkins",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: "Separate from dinner napkins",
    sortOrder: 80,
  },
  {
    skuKey: "third_party_furniture",
    name: "3rd party furniture",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: null,
    sortOrder: 90,
  },
  {
    skuKey: "sterno_fuel",
    name: "Sterno fuel",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon",
        url: "https://www.amazon.com/Gas-pack-Hour-Chafing-Fuel/dp/B084TC8D4L",
      },
      {
        label: "Party City",
        url: "https://www.partycity.com/2-hour-gel-chafing-fuel-cans-6.43oz-12ct-271556.html",
      },
    ],
    notes: null,
    sortOrder: 100,
  },
  {
    skuKey: "aluminum_tray",
    name: "Aluminum tray",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Party City",
        url: "https://www.partycity.com/aluminum-full-chafing-dish-steam-pan-39659.html",
      },
      {
        label: "Target",
        url: "https://www.target.com/p/reynolds-disposable-bakeware-heavy-duty-giant-size-1-pan/-/A-14731997",
      },
    ],
    notes: "Note: two per tray",
    sortOrder: 110,
  },
  {
    skuKey: "parchment_paper",
    name: "Parchment paper",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon Basics",
        url: "https://www.amazon.com/Amazon-Basics-Parchment-Paper-90/dp/B09NQGXJ5C",
      },
    ],
    notes: null,
    sortOrder: 120,
  },
  {
    skuKey: "to_go_containers",
    name: "To-go containers",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: "Inventory cost analysis",
    sortOrder: 130,
  },
  {
    skuKey: "plastic_gloves",
    name: "Plastic gloves",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: null,
    sortOrder: 140,
  },
  {
    skuKey: "butane_cartridges",
    name: "Butane cartridges",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [
      {
        label: "Amazon GasOne",
        url: "https://www.amazon.com/GasOne-Butane-Fuel-Canister-Pack/dp/B0022BUT2O",
      },
    ],
    notes: null,
    sortOrder: 150,
  },
  {
    skuKey: "olive_oil",
    name: "Olive oil",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: "Georgetown Olive Oil",
    purchaseLinks: [],
    notes: "20% in-store on Mangia account (Georgetown Olive Oil)",
    sortOrder: 160,
  },
  {
    skuKey: "fig_or_strawberry_balsamic",
    name: "Fig or strawberry balsamic",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: "Georgetown Olive Oil",
    purchaseLinks: [],
    notes: "Georgetown Olive Oil",
    sortOrder: 170,
  },
  {
    skuKey: "salt_and_pepper",
    name: "Salt and pepper",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: null,
    sortOrder: 180,
  },
  {
    skuKey: "aluminum_foil",
    name: "Aluminum foil",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: null,
    purchaseLinks: [],
    notes: "Purchase analysis on where to buy",
    sortOrder: 190,
  },
  {
    skuKey: "glassware_engraved",
    name: "Glassware / engraved glassware",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: "Quality Glass Engraving",
    purchaseLinks: [],
    notes: "Quality Glass Engraving — see Vendor Directory",
    sortOrder: 200,
  },
  {
    skuKey: "logo_aprons",
    name: "Custom / logo aprons",
    experienceKey: COOKING_EXPERIENCE_KEY,
    defaultVendorName: "Basecamp DC",
    purchaseLinks: [],
    notes:
      "Basecamp DC primary; United Tees alt; Zecron Textiles for blanks — see Vendor Directory",
    sortOrder: 210,
  },
];
