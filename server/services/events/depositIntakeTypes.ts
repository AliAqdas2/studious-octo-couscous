/** Shared constants + payload types for Deposit Intake (plan 02). */

/** @deprecated Prefer DB venues via listActiveHouseVenueNames(). Kept for seed bootstrap. */
export const HOUSE_VENUES = [
  "Launch Glover Park",
  "Mr. Smith's of Georgetown",
  "City Tavern",
  "The Whittemore House",
  "The Wharf Penthouse",
  "Wingos!",
  "99 M St SE - Navy Yard",
  "The Foundry",
  "1015 15th Street NW",
  "Other",
] as const;

export const BAR_PAYMENT_MODES = [
  "Card on file",
  "Ticketed",
  "Fixed Open Bar",
] as const;

export const DISH_CONFIGURATIONS = [
  "Entree",
  "App + Entree",
  "App + Entree + Dessert",
] as const;

export const TRANSPORT_COMPANIES = [
  "Sammy Transport",
  "DC Nation Tours",
  "Other",
] as const;

/** Legacy intake value — Alberto is the Sammy Transport contact, not the company. */
export const TRANSPORT_COMPANY_LEGACY_MAP: Record<string, string> = {
  Alberto: "Sammy Transport",
};

export function normalizeTransportCompany(
  value: string | null | undefined
): (typeof TRANSPORT_COMPANIES)[number] | null {
  if (!value) return null;
  if (value === "Alberto") return "Sammy Transport";
  if ((TRANSPORT_COMPANIES as readonly string[]).includes(value)) {
    return value as (typeof TRANSPORT_COMPANIES)[number];
  }
  return null;
}

export const CHEESEBOARD_MIN_UNITS = 25;

/** Dave, Zach, Monica only (meeting). Match email local-part or full_name. */
export const DEPOSIT_VIEWER_NAMES = ["dave", "zach", "monica"] as const;

export interface CharcuterieSelection {
  style: "boards" | "platters" | null;
  amount?: number | null;
  enabled: boolean;
}

export interface FoodAdditionsIntake {
  charcuterie: CharcuterieSelection;
  additionalProtein: { enabled: boolean; amount?: number | null };
  mysteryIngredients: { enabled: boolean; amount?: number | null };
  alternativeSauces: { enabled: boolean; amount?: number | null };
  flavorsOfDcWarmMeal: { enabled: boolean; amount?: number | null };
}

export interface CustomAddonItem {
  enabled: boolean;
  amount?: number | null;
  embroidered?: boolean | null;
  customName?: boolean | null;
  logoOrdered?: boolean | null;
}

export interface CustomAddonsIntake {
  embroideredAprons: CustomAddonItem;
  engravedGlassware: CustomAddonItem;
  cheeseboard: CustomAddonItem;
  chocolateMold: CustomAddonItem;
  chefHats: CustomAddonItem;
  berets: CustomAddonItem;
}

export interface BarDetailsIntake {
  paymentMode?: (typeof BAR_PAYMENT_MODES)[number] | "Other" | null;
  paymentModeOther?: string | null;
  wineBeerSoft?: boolean | null;
  mixedDrinks?: "Top Shelf" | "Rail" | "Other" | null;
  mixedDrinksOther?: string | null;
}

export interface DepositIntakePayload {
  /** Prefill / editable core */
  startTime?: string | null;
  eventDate?: string | null;
  pocName?: string | null;
  pocEmail?: string | null;
  pocPhone?: string | null;
  headcountMin?: number | null;
  headcountMax?: number | null;

  alcoholIncluded: boolean;
  barDetails?: BarDetailsIntake | null;

  /** Cooking-only experience mode */
  isCompetition?: boolean | null;
  dishConfiguration?: (typeof DISH_CONFIGURATIONS)[number] | "Other" | null;
  dishConfigurationOther?: string | null;

  foodAdditions: FoodAdditionsIntake;
  customAddons: CustomAddonsIntake;

  transportationNeeded: boolean;
  transportCompany?: (typeof TRANSPORT_COMPANIES)[number] | null;
  transportCompanyOther?: string | null;

  venueMode: "go_to_them" | "house_venue";
  venue?: string | null;
  venueOther?: string | null;
  venueRestrictions?: string | null;

  /** Restricted — only applied when caller may view/edit deposit */
  depositAmount?: number | null;

  participationListUrl?: string | null;
  participationListType?: "sheets" | "forms" | null;
}

export function emptyFoodAdditions(): FoodAdditionsIntake {
  return {
    charcuterie: { enabled: false, style: null, amount: null },
    additionalProtein: { enabled: false, amount: null },
    mysteryIngredients: { enabled: false, amount: null },
    alternativeSauces: { enabled: false, amount: null },
    flavorsOfDcWarmMeal: { enabled: false, amount: null },
  };
}

export function emptyCustomAddons(): CustomAddonsIntake {
  return {
    embroideredAprons: {
      enabled: false,
      amount: null,
      embroidered: true,
      customName: null,
      logoOrdered: null,
    },
    engravedGlassware: { enabled: false, amount: null },
    cheeseboard: { enabled: false, amount: null },
    chocolateMold: { enabled: false, amount: null },
    chefHats: { enabled: false, amount: null, embroidered: null },
    berets: { enabled: false, amount: null, embroidered: null },
  };
}
