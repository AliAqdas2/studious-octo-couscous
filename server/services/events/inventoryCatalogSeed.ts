import type { InventoryPurchaseLink } from "../../db/schema/vendors.js";
import {
  ALL_EXPERIENCE_KEYS,
  COOKING_EVENT_EXPERIENCE_KEYS,
} from "./experienceMatrix.js";

/** Inventory Per Event.md — catalog seed (replaces cooking-only list). */

export const SECTION_COOKING = "Cooking Supplies";
export const SECTION_DRINKS = "Drinks";
export const SECTION_MISC = "Miscellaneous";
export const SECTION_MIXOLOGY = "Mixology Kits";
export const SECTION_FLAVORS = "Flavors of DC";
export const SECTION_PAINT = "Painting and Sip";
export const SECTION_TERRARIUM = "Terrarium Kits";

const COOKING_KEYS = [...COOKING_EVENT_EXPERIENCE_KEYS];
const DRINKS_KEYS = [...ALL_EXPERIENCE_KEYS];
const MIXOLOGY_KEY = "In-Person Mixology";
const FLAVORS_KEY = "Flavors of DC";
const PAINT_KEY = "In-Person Paint & Sip";
const TERRARIUM_KEY = "In-Person Terrarium";

export interface CatalogSeedRow {
  skuKey: string;
  name: string;
  experienceKeys: string[];
  section: string;
  parentSkuKey?: string | null;
  quantityHint?: string | null;
  defaultVendorName: string | null;
  purchaseLinks: InventoryPurchaseLink[];
  notes: string | null;
  sortOrder: number;
}

type RowInput = {
  skuKey: string;
  name: string;
  sortOrder: number;
  parentSkuKey?: string | null;
  quantityHint?: string | null;
  defaultVendorName?: string | null;
  purchaseLinks?: InventoryPurchaseLink[];
  notes?: string | null;
  experienceKeys?: string[];
  section?: string;
};

const LEGACY_PURCHASE_LINKS: Record<string, InventoryPurchaseLink[]> = {
  paper_towel_rolls: [
    {
      label: "Amazon Flex-Size",
      url: "https://www.amazon.com/Amazon-Brand-Flex-Size-Regular/dp/B07QY8P3B1",
    },
  ],
  plastic_plates: [
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
  ceramic_plates: [
    {
      label: "Amazon plastic plates",
      url: "https://www.amazon.com/Plastic-Premium-Disposable-Dessert-Appetizer/dp/B09X67QRMN",
    },
    {
      label: "Party City",
      url: "https://www.partycity.com/white-with-gold-rim-premium-plastic-dinner-plates-10.25in-20ct-937777.html",
    },
  ],
  table_cloths: [
    {
      label: "Party City (white preferred)",
      url: "https://www.partycity.com/white-plastic-table-cover-roll-with-slide-cutter-54in-x-126ft-924460.html",
    },
  ],
  trash_bags: [
    {
      label: "Target Flexguard 13gal",
      url: "https://www.target.com/p/flexguard-tall-kitchen-drawstring-trash-bags-unscented-13-gallon-25ct-up-38-up-8482/-/A-13967214",
    },
  ],
  dinner_napkins: [
    {
      label: "Amazon Vanity Fair",
      url: "https://www.amazon.com/Vanity-Fair-Everyday-Napkins-Packaging/dp/B00MW3HBA0",
    },
  ],
  sterno: [
    {
      label: "Amazon",
      url: "https://www.amazon.com/Gas-pack-Hour-Chafing-Fuel/dp/B084TC8D4L",
    },
    {
      label: "Party City",
      url: "https://www.partycity.com/2-hour-gel-chafing-fuel-cans-6.43oz-12ct-271556.html",
    },
  ],
  aluminum_trays: [
    {
      label: "Party City",
      url: "https://www.partycity.com/aluminum-full-chafing-dish-steam-pan-39659.html",
    },
    {
      label: "Target",
      url: "https://www.target.com/p/reynolds-disposable-bakeware-heavy-duty-giant-size-1-pan/-/A-14731997",
    },
  ],
  parchment_paper: [
    {
      label: "Amazon Basics",
      url: "https://www.amazon.com/Amazon-Basics-Parchment-Paper-90/dp/B09NQGXJ5C",
    },
  ],
  box_of_butane: [
    {
      label: "Amazon GasOne",
      url: "https://www.amazon.com/GasOne-Butane-Fuel-Canister-Pack/dp/B0022BUT2O",
    },
  ],
};

function cooking(
  input: RowInput,
  overrides?: Partial<RowInput>
): CatalogSeedRow {
  const merged = { ...input, ...overrides };
  return {
    experienceKeys: COOKING_KEYS,
    section: SECTION_COOKING,
    parentSkuKey: merged.parentSkuKey ?? null,
    quantityHint: merged.quantityHint ?? null,
    defaultVendorName: merged.defaultVendorName ?? null,
    purchaseLinks:
      merged.purchaseLinks ??
      LEGACY_PURCHASE_LINKS[merged.skuKey] ??
      [],
    notes: merged.notes ?? null,
    skuKey: merged.skuKey,
    name: merged.name,
    sortOrder: merged.sortOrder,
  };
}

function drinks(input: RowInput): CatalogSeedRow {
  return {
    experienceKeys: DRINKS_KEYS,
    section: SECTION_DRINKS,
    parentSkuKey: input.parentSkuKey ?? null,
    quantityHint: input.quantityHint ?? null,
    defaultVendorName: input.defaultVendorName ?? null,
    purchaseLinks: input.purchaseLinks ?? [],
    notes: input.notes ?? null,
    skuKey: input.skuKey,
    name: input.name,
    sortOrder: input.sortOrder,
  };
}

function misc(input: RowInput, overrides?: Partial<RowInput>): CatalogSeedRow {
  const merged = { ...input, ...overrides };
  return {
    experienceKeys: COOKING_KEYS,
    section: SECTION_MISC,
    parentSkuKey: merged.parentSkuKey ?? null,
    quantityHint: merged.quantityHint ?? null,
    defaultVendorName: merged.defaultVendorName ?? null,
    purchaseLinks:
      merged.purchaseLinks ??
      LEGACY_PURCHASE_LINKS[merged.skuKey] ??
      [],
    notes: merged.notes ?? null,
    skuKey: merged.skuKey,
    name: merged.name,
    sortOrder: merged.sortOrder,
  };
}

function forExperience(
  experienceKeys: string[],
  section: string,
  input: RowInput
): CatalogSeedRow {
  return {
    experienceKeys,
    section,
    parentSkuKey: input.parentSkuKey ?? null,
    quantityHint: input.quantityHint ?? null,
    defaultVendorName: input.defaultVendorName ?? null,
    purchaseLinks:
      input.purchaseLinks ?? LEGACY_PURCHASE_LINKS[input.skuKey] ?? [],
    notes: input.notes ?? null,
    skuKey: input.skuKey,
    name: input.name,
    sortOrder: input.sortOrder,
  };
}

const mixology = (input: RowInput) =>
  forExperience([MIXOLOGY_KEY], SECTION_MIXOLOGY, input);
const flavors = (input: RowInput) =>
  forExperience([FLAVORS_KEY], SECTION_FLAVORS, input);
const paint = (input: RowInput) =>
  forExperience([PAINT_KEY], SECTION_PAINT, input);
const terrarium = (input: RowInput) =>
  forExperience([TERRARIUM_KEY], SECTION_TERRARIUM, input);

const RAW_CATALOG: CatalogSeedRow[] = [
  cooking({ skuKey: "appetizer_main_ingredients", name: "Appetizer/Main Dish ingredients", sortOrder: 1010 }),
  cooking({ skuKey: "dessert", name: "Dessert", sortOrder: 1020 }),
  cooking({ skuKey: "dessert_cups_spoons", name: "Cups/Spoons", parentSkuKey: "dessert", sortOrder: 1021 }),
  cooking({ skuKey: "dessert_ice_cream_scoop", name: "Ice Cream Scoop", parentSkuKey: "dessert", sortOrder: 1022 }),
  cooking({ skuKey: "burners_total", name: "Burners total", quantityHint: "X burners total", sortOrder: 1030 }),
  cooking({ skuKey: "burner_per_guest_table", name: "Burner per guest table", parentSkuKey: "burners_total", quantityHint: "x burner per guest table", sortOrder: 1031 }),
  cooking({ skuKey: "burners_boiling_station", name: "Burners for boiling station", parentSkuKey: "burners_total", quantityHint: "x burners for boiling station", sortOrder: 1032 }),
  cooking({ skuKey: "burner_for_chef", name: "Burner for chef", parentSkuKey: "burners_total", quantityHint: "x burner for chef", sortOrder: 1033 }),
  cooking({ skuKey: "box_of_butane", name: "Box of Butane", parentSkuKey: "burners_total", sortOrder: 1034 }),
  cooking({ skuKey: "cooking_utensils", name: "Cooking utensils", sortOrder: 1040 }),
  cooking({ skuKey: "knife", name: "Knife", parentSkuKey: "cooking_utensils", sortOrder: 1041 }),
  cooking({ skuKey: "cutting_board", name: "Cutting Board", parentSkuKey: "cooking_utensils", sortOrder: 1042 }),
  cooking({ skuKey: "large_spoons", name: "Large Spoons", parentSkuKey: "cooking_utensils", sortOrder: 1043 }),
  cooking({ skuKey: "cheese_graters_zesters", name: "Cheese Graters/Zesters", parentSkuKey: "cooking_utensils", sortOrder: 1044 }),
  cooking({ skuKey: "bench_scrappers", name: "Bench Scrappers", parentSkuKey: "cooking_utensils", sortOrder: 1045 }),
  cooking({ skuKey: "measuring_cup_sets", name: "Measuring Cup Sets", parentSkuKey: "cooking_utensils", sortOrder: 1046 }),
  cooking({ skuKey: "forks", name: "Forks", parentSkuKey: "cooking_utensils", sortOrder: 1047 }),
  cooking({ skuKey: "tongs", name: "Tongs", parentSkuKey: "cooking_utensils", sortOrder: 1048 }),
  cooking({ skuKey: "ladles", name: "Ladles", parentSkuKey: "cooking_utensils", sortOrder: 1049 }),
  cooking({ skuKey: "strainers", name: "Strainers", parentSkuKey: "cooking_utensils", sortOrder: 1050 }),
  cooking({ skuKey: "silverware", name: "Silverware", sortOrder: 1060 }),
  cooking({ skuKey: "plasticware", name: "Plasticware", sortOrder: 1070 }),
  cooking({ skuKey: "can_opener", name: "Can Opener", sortOrder: 1080 }),
  cooking({ skuKey: "mixing_bowls_total", name: "Mixing bowls", quantityHint: "X mixing bowls", sortOrder: 1090 }),
  cooking({ skuKey: "bowls_for_chef", name: "Bowls for chef", parentSkuKey: "mixing_bowls_total", quantityHint: "X bowls for chef", sortOrder: 1091 }),
  cooking({ skuKey: "bowls_per_table", name: "Bowls for each table", parentSkuKey: "mixing_bowls_total", quantityHint: "X bowls for each table", sortOrder: 1092 }),
  cooking({ skuKey: "pots", name: "Pots", quantityHint: "X pots", sortOrder: 1100 }),
  cooking({ skuKey: "lids", name: "Lids", quantityHint: "X lids", sortOrder: 1110 }),
  cooking({ skuKey: "metal_trays", name: "Metal Trays", quantityHint: "X metal trays", sortOrder: 1120 }),
  cooking({ skuKey: "plastic_plates", name: "Plastic Plates", quantityHint: "X plastic plates", sortOrder: 1130 }),
  cooking({ skuKey: "ceramic_plates", name: "Ceramic Plates", quantityHint: "X ceramic plates", sortOrder: 1140 }),
  cooking({ skuKey: "ceramic_bowls", name: "Ceramic Bowls", quantityHint: "X ceramic bowls", sortOrder: 1150 }),
  cooking({ skuKey: "white_mangia_aprons", name: "White Mangia aprons", quantityHint: "X white mangia aprons", defaultVendorName: "Basecamp DC", notes: "Basecamp DC primary; United Tees alt; Zecron blanks", sortOrder: 1160 }),
  cooking({ skuKey: "black_mangia_aprons", name: "Black Mangia Aprons", parentSkuKey: "white_mangia_aprons", quantityHint: "X black mangia aprons", sortOrder: 1161 }),
  cooking({ skuKey: "plastic_bin_seasonings", name: "Plastic Bin of seasonings", sortOrder: 1170 }),
  cooking({ skuKey: "olive_oil_salt_pepper_nutmeg", name: "Olive oil, salt & pepper, nutmeg", parentSkuKey: "plastic_bin_seasonings", defaultVendorName: "Georgetown Olive Oil", notes: "20% in-store on Mangia account", sortOrder: 1171 }),
  cooking({ skuKey: "balsamic_vinaigrette", name: "Balsamic Vinaigrette", parentSkuKey: "plastic_bin_seasonings", defaultVendorName: "Georgetown Olive Oil", sortOrder: 1172 }),
  cooking({ skuKey: "business_cards", name: "Business Cards", sortOrder: 1180 }),

  drinks({ skuKey: "wine_glasses", name: "Wine Glasses", sortOrder: 2010 }),
  drinks({ skuKey: "plastic_cups", name: "Plastic Cups", sortOrder: 2020 }),
  drinks({ skuKey: "bottle_opener", name: "Bottle Opener", sortOrder: 2030 }),
  drinks({ skuKey: "ice_bucket_and_scoop", name: "Ice Bucket and Scoop", sortOrder: 2040 }),
  drinks({ skuKey: "cooler", name: "Cooler", sortOrder: 2050 }),
  drinks({ skuKey: "soda_per_guests", name: "Soda", parentSkuKey: "cooler", quantityHint: "1 soda for every 2 people", sortOrder: 2051 }),
  drinks({ skuKey: "red_wine", name: "Red Wine", parentSkuKey: "cooler", sortOrder: 2052 }),
  drinks({ skuKey: "white_wine", name: "White Wine", parentSkuKey: "cooler", sortOrder: 2053 }),
  drinks({ skuKey: "beer", name: "Beer", parentSkuKey: "cooler", sortOrder: 2054 }),

  misc({ skuKey: "disposable_gloves", name: "Disposable Gloves", sortOrder: 3010 }),
  misc({ skuKey: "safety_emergency_kit", name: "Safety Emergency Kit", parentSkuKey: "disposable_gloves", sortOrder: 3011 }),
  misc({ skuKey: "dinner_napkins", name: "Dinner napkins", parentSkuKey: "disposable_gloves", sortOrder: 3012 }),
  misc({ skuKey: "trash_bags", name: "Trash bags", parentSkuKey: "disposable_gloves", sortOrder: 3013 }),
  misc({ skuKey: "table_cloths", name: "Table cloths", sortOrder: 3020 }),
  misc({ skuKey: "paper_towel_rolls", name: "Paper towel rolls", quantityHint: "X paper towel rolls", sortOrder: 3030 }),
  misc({ skuKey: "polishing_rags_dish_towels", name: "Polishing rags and extra dish towels", sortOrder: 3040 }),
  misc({ skuKey: "to_go_containers", name: "To-Go Containers", notes: "Inventory cost analysis", sortOrder: 3050 }),
  misc({ skuKey: "bluetooth_speaker", name: "Bluetooth Speaker", sortOrder: 3060 }),
  misc({ skuKey: "recipe_cards", name: "Recipe Cards", sortOrder: 3070 }),
  misc({ skuKey: "qr_codes", name: "QR Codes", sortOrder: 3080 }),
  misc({ skuKey: "table_numbers", name: "Table numbers", sortOrder: 3090 }),
  misc({ skuKey: "scissors", name: "Scissors", sortOrder: 3100 }),
  misc({ skuKey: "screw_driver", name: "Screw Driver", sortOrder: 3110 }),
  misc({ skuKey: "parchment_paper", name: "Parchment Paper", sortOrder: 3120 }),
  misc({ skuKey: "aluminum_foil", name: "Aluminum Foil", notes: "Purchase analysis on where to buy", sortOrder: 3130 }),
  misc({ skuKey: "zip_lock_bags", name: "Zip Lock bags", sortOrder: 3140 }),
  misc({ skuKey: "flour", name: "Flour", sortOrder: 3150 }),
  misc({ skuKey: "gluten_free_flour", name: "Gluten Free Flour", sortOrder: 3160 }),
  misc({ skuKey: "plastic_ramakins", name: "Plastic Ramakins", sortOrder: 3170 }),
  misc({ skuKey: "food_processor", name: "Food Processor", sortOrder: 3180 }),
  misc({ skuKey: "aluminum_trays", name: "Aluminum Trays", quantityHint: "X aluminum trays", notes: "Note: two per tray", sortOrder: 3190 }),
  misc({ skuKey: "sterno", name: "Sterno", sortOrder: 3200 }),
  misc({ skuKey: "wire_frames", name: "Wire Frames", sortOrder: 3210 }),
  misc({ skuKey: "lighter", name: "Lighter", sortOrder: 3220 }),

  mixology({ skuKey: "shaker_sets", name: "Shaker Sets", quantityHint: "x shaker sets", sortOrder: 4010 }),
  mixology({ skuKey: "mixology_strainers", name: "Strainers", quantityHint: "x strainers", sortOrder: 4020 }),
  mixology({ skuKey: "mixology_ice_buckets", name: "Ice Buckets", quantityHint: "x ice buckets", sortOrder: 4030 }),
  mixology({ skuKey: "mixology_white_aprons", name: "White aprons", quantityHint: "x white aprons", sortOrder: 4040 }),
  mixology({ skuKey: "mixology_black_aprons", name: "Black aprons for staff", parentSkuKey: "mixology_white_aprons", quantityHint: "x black aprons for staff", sortOrder: 4041 }),
  mixology({ skuKey: "mixology_ice_scoops", name: "Ice Scoops", quantityHint: "x ice scoops", sortOrder: 4050 }),
  mixology({ skuKey: "swizzle_sticks", name: "Swizzle sticks", quantityHint: "x swizzle sticks", sortOrder: 4060 }),
  mixology({ skuKey: "jiggers", name: "Jiggers", quantityHint: "x jiggers", sortOrder: 4070 }),
  mixology({ skuKey: "mixology_paper_towel_rolls", name: "Paper Towel Rolls", quantityHint: "x paper towel rolls", sortOrder: 4080 }),
  mixology({ skuKey: "mixology_tablecloths_white", name: "Tablecloths — white", quantityHint: "x tablecloths", sortOrder: 4090 }),
  mixology({ skuKey: "squeeze_bottles", name: "Squeeze Bottles", quantityHint: "X squeeze bottles", sortOrder: 4100 }),
  mixology({ skuKey: "cocktail_1", name: "Cocktail 1", sortOrder: 4110 }),
  mixology({ skuKey: "cocktail_1_ingredients", name: "Ingredients", parentSkuKey: "cocktail_1", sortOrder: 4111 }),
  mixology({ skuKey: "cocktail_2", name: "Cocktail 2", sortOrder: 4120 }),
  mixology({ skuKey: "cocktail_2_ingredients", name: "Ingredients", parentSkuKey: "cocktail_2", sortOrder: 4121 }),
  mixology({ skuKey: "cocktail_3", name: "Cocktail 3", sortOrder: 4130 }),
  mixology({ skuKey: "cocktail_3_ingredients", name: "Ingredients", parentSkuKey: "cocktail_3", sortOrder: 4131 }),
  mixology({ skuKey: "tape", name: "Tape", sortOrder: 4140 }),
  mixology({ skuKey: "cocktail_napkins", name: "Cocktail Napkins", sortOrder: 4150 }),
  mixology({ skuKey: "mixology_trash_bags", name: "Trash bags", sortOrder: 4160 }),
  mixology({ skuKey: "mixology_wine_glasses", name: "Wine Glasses", sortOrder: 4165 }),
  mixology({ skuKey: "vinyl_gloves", name: "Vinyl Gloves", sortOrder: 4170 }),
  mixology({ skuKey: "mixology_cutting_boards", name: "Cutting Boards", quantityHint: "x cutting boards", sortOrder: 4180 }),
  mixology({ skuKey: "mixology_knives", name: "Knives", quantityHint: "X knives", sortOrder: 4190 }),
  mixology({ skuKey: "peelers", name: "Peelers", sortOrder: 4200 }),
  mixology({ skuKey: "ramakins", name: "Ramakins", sortOrder: 4210 }),
  mixology({ skuKey: "shot_glasses", name: "Shot glasses", sortOrder: 4220 }),
  mixology({ skuKey: "mixology_mixing_bowls", name: "Mixing Bowls", quantityHint: "x mixing bowls", sortOrder: 4230 }),
  mixology({ skuKey: "wisks", name: "Wisks", quantityHint: "x wisks", sortOrder: 4240 }),
  mixology({ skuKey: "ice", name: "Ice", sortOrder: 4250 }),
  mixology({ skuKey: "liquid_labels", name: "Liquid Labels", sortOrder: 4260 }),
  mixology({ skuKey: "mixology_recipe_cards", name: "Recipe Cards", sortOrder: 4280 }),
  mixology({ skuKey: "mixology_bluetooth_speaker", name: "Bluetooth Speaker", sortOrder: 4290 }),
  mixology({ skuKey: "mixology_business_cards", name: "Business Cards", sortOrder: 4300 }),

  flavors({ skuKey: "flavors_large_metal_bowls", name: "Large Metal Bowls", quantityHint: "X large metal bowls", sortOrder: 5010 }),
  flavors({ skuKey: "flavors_small_bowls", name: "Small bowls", quantityHint: "X small bowls", sortOrder: 5020 }),
  flavors({ skuKey: "flavors_wire_frames", name: "Wire Frames", quantityHint: "X wire frames", sortOrder: 5030 }),
  flavors({ skuKey: "flavors_aluminum_trays", name: "Aluminum Trays", quantityHint: "X aluminum trays", sortOrder: 5040 }),
  flavors({ skuKey: "flavors_sternos", name: "Sternos", quantityHint: "X sternos", sortOrder: 5050 }),
  flavors({ skuKey: "flavors_lighter", name: "Lighter", quantityHint: "X lighter", sortOrder: 5060 }),
  flavors({ skuKey: "menu_tents", name: "Menu Tents", sortOrder: 5070 }),
  flavors({ skuKey: "flavors_tongs", name: "Tongs", quantityHint: "X tongs", sortOrder: 5080 }),
  flavors({ skuKey: "flavors_spoons", name: "Spoons", quantityHint: "X spoons", sortOrder: 5090 }),
  flavors({ skuKey: "flavors_plates", name: "Plates", quantityHint: "X plates", sortOrder: 5100 }),
  flavors({ skuKey: "flavors_plasticware", name: "Plasticware", sortOrder: 5110 }),
  flavors({ skuKey: "flavors_bowls", name: "Bowls", quantityHint: "X bowls", sortOrder: 5120 }),
  flavors({ skuKey: "flavors_dinner_napkins", name: "Dinner Napkins", sortOrder: 5130 }),
  flavors({ skuKey: "flavors_easels", name: "Easels", quantityHint: "X easels", sortOrder: 5140 }),
  flavors({ skuKey: "flavors_poster_boards", name: "Poster Boards", quantityHint: "X poster boards", sortOrder: 5150 }),
  flavors({ skuKey: "flavors_bluetooth_speaker", name: "Bluetooth Speaker", sortOrder: 5160 }),
  flavors({ skuKey: "flavors_silverware", name: "Silverware", sortOrder: 5170 }),
  flavors({ skuKey: "flavors_ceramic_plates", name: "Ceramic Plates", sortOrder: 5180 }),
  flavors({ skuKey: "flavors_ceramic_bowls", name: "Bowls", sortOrder: 5190 }),
  flavors({ skuKey: "flavors_business_cards", name: "Business Cards", sortOrder: 5200 }),

  paint({ skuKey: "paint_canvases", name: "Canvases", quantityHint: "X canvases", sortOrder: 6010 }),
  paint({ skuKey: "paint_paints", name: "Paints", quantityHint: "X paints", sortOrder: 6020 }),
  paint({ skuKey: "paint_easels", name: "Easels", quantityHint: "X easels", sortOrder: 6030 }),
  paint({ skuKey: "paint_white_aprons", name: "White aprons", quantityHint: "X white aprons", sortOrder: 6040 }),
  paint({ skuKey: "paint_black_aprons", name: "Black aprons", quantityHint: "X black aprons", sortOrder: 6050 }),
  paint({ skuKey: "paint_brush_sets", name: "Brush sets", quantityHint: "x brush sets", sortOrder: 6060 }),
  paint({ skuKey: "paint_paper_plates", name: "Paper plates", quantityHint: "x paper plates", sortOrder: 6070 }),
  paint({ skuKey: "paint_water_cups", name: "Water cups", quantityHint: "x water cups", sortOrder: 6080 }),
  paint({ skuKey: "paint_paper_towel_rolls", name: "Paper Towel Rolls", quantityHint: "x paper towel rolls", sortOrder: 6090 }),
  paint({ skuKey: "paint_tablecloths", name: "Tablecloths", quantityHint: "x tablecloths", sortOrder: 6100 }),
  paint({ skuKey: "paint_tape", name: "Tape", sortOrder: 6110 }),
  paint({ skuKey: "paint_dinner_napkins", name: "Dinner Napkins", sortOrder: 6120 }),
  paint({ skuKey: "paint_trash_bags", name: "Trash bags", sortOrder: 6130 }),
  paint({ skuKey: "paint_business_cards", name: "Business Cards", sortOrder: 6140 }),

  terrarium({ skuKey: "terrarium_glass_bowls", name: "Glass bowls", quantityHint: "X glass bowls", sortOrder: 7010 }),
  terrarium({ skuKey: "terrarium_dry_quarts_soil", name: "Dry Quarts of Soil", quantityHint: "X dry quarts of soil", sortOrder: 7020 }),
  terrarium({ skuKey: "terrarium_pounds_sand", name: "Pounds of Sand", quantityHint: "X pounds of sand", sortOrder: 7030 }),
  terrarium({ skuKey: "terrarium_dry_quarts_charcoal", name: "Dry Quarts of Charcoal", quantityHint: "X dry quarts of charcoal", sortOrder: 7040 }),
  terrarium({ skuKey: "terrarium_liters_moss", name: "Liters of Moss", quantityHint: "X liters of moss", sortOrder: 7050 }),
  terrarium({ skuKey: "terrarium_liters_rocks", name: "Liters of Rocks", quantityHint: "X liters of rocks", sortOrder: 7060 }),
  terrarium({ skuKey: "terrarium_succulents", name: "Succulents", quantityHint: "X succulents", sortOrder: 7070 }),
  terrarium({ skuKey: "terrarium_paper_towel_rolls", name: "Paper Towel Rolls", quantityHint: "X paper towel rolls", sortOrder: 7080 }),
  terrarium({ skuKey: "terrarium_ducks", name: "Ducks", quantityHint: "X ducks", sortOrder: 7090 }),
  terrarium({ skuKey: "terrarium_white_tablecloths", name: "White tablecloths", sortOrder: 7100 }),
  terrarium({ skuKey: "terrarium_tape", name: "Tape", sortOrder: 7110 }),
  terrarium({ skuKey: "terrarium_trash_bags", name: "Trash bags", sortOrder: 7120 }),
  terrarium({ skuKey: "terrarium_duct_tape", name: "Duct Tape", sortOrder: 7130 }),
  terrarium({ skuKey: "terrarium_ice_scoops", name: "Ice Scoops", sortOrder: 7140 }),
  terrarium({ skuKey: "terrarium_large_spoons", name: "Large Spoons", sortOrder: 7150 }),
  terrarium({ skuKey: "terrarium_small_spoons", name: "Small Spoons", sortOrder: 7160 }),
  terrarium({ skuKey: "terrarium_metal_bowls", name: "Metal bowls", sortOrder: 7170 }),
  terrarium({ skuKey: "terrarium_ceramic_bowls", name: "Ceramic bowls", sortOrder: 7180 }),
  terrarium({ skuKey: "terrarium_leaf_cups", name: "Leaf Cups", sortOrder: 7190 }),
  terrarium({ skuKey: "terrarium_polishing_cloths", name: "Polishing Cloths", sortOrder: 7200 }),
  terrarium({ skuKey: "terrarium_water_pitchers", name: "Water Pitchers", sortOrder: 7210 }),
  terrarium({ skuKey: "terrarium_scissors", name: "Scissors", sortOrder: 7220 }),
  terrarium({ skuKey: "terrarium_spray_cleaner_windex", name: "Spray Cleaner — Windex", sortOrder: 7230 }),
  terrarium({ skuKey: "terrarium_polishing_rags", name: "Polishing rags", sortOrder: 7240 }),
  terrarium({ skuKey: "terrarium_white_aprons", name: "White Aprons", quantityHint: "X white aprons", sortOrder: 7250 }),
  terrarium({ skuKey: "terrarium_black_aprons", name: "Black Aprons", quantityHint: "X black aprons", sortOrder: 7260 }),
  terrarium({ skuKey: "terrarium_print_outs", name: "Print Outs", sortOrder: 7270 }),
  terrarium({ skuKey: "terrarium_business_cards", name: "Business Cards", sortOrder: 7280 }),
];

function mergeCatalogRows(rows: CatalogSeedRow[]): CatalogSeedRow[] {
  const bySku = new Map<string, CatalogSeedRow>();
  for (const row of rows) {
    const existing = bySku.get(row.skuKey);
    if (!existing) {
      bySku.set(row.skuKey, {
        ...row,
        experienceKeys: [...row.experienceKeys],
        purchaseLinks: [...row.purchaseLinks],
      });
      continue;
    }
    const experienceKeys = [
      ...new Set([...existing.experienceKeys, ...row.experienceKeys]),
    ];
    bySku.set(row.skuKey, {
      ...existing,
      experienceKeys,
      notes: existing.notes || row.notes,
      purchaseLinks: existing.purchaseLinks.length
        ? existing.purchaseLinks
        : row.purchaseLinks,
      defaultVendorName: existing.defaultVendorName || row.defaultVendorName,
    });
  }
  return [...bySku.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export const INVENTORY_CATALOG = mergeCatalogRows(RAW_CATALOG);
