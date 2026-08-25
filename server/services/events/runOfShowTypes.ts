import {
  normalizeTransportCompany,
  TRANSPORT_COMPANIES,
} from "./depositIntakeTypes.js";

/** Run of Show form constants + payload (plan 05). */

export const ROS_ARRIVAL_METHODS = [
  "Motorcoach",
  "Uber",
  "Own",
  "All of the above",
] as const;

export const ROS_MEDIA_PERMISSIONS = [
  "marketing_ok",
  "internal_only",
  "no_photos",
] as const;

export const ROS_MEDIA_LABELS: Record<
  (typeof ROS_MEDIA_PERMISSIONS)[number],
  string
> = {
  marketing_ok: "OK for client + marketing use",
  internal_only: "OK internal only, not marketing",
  no_photos: "No photos",
};

/** Talk-track helper shown next to multimedia (C051). */
export const ROS_MEDIA_TALK_TRACK =
  "Is it OK to take photos of the experience for you to use? — Yes for marketing, Yes for internal only (not marketing), or No don't take photos.";

export const ROS_SEATING_STYLES = [
  "At random",
  "Client pre-organized groups",
] as const;

export const ROS_WINE_OR_BEER = [
  "Wine",
  "Beer",
  "Both",
  "Neither / soft drinks only",
] as const;

export interface RosMenuConfirm {
  app?: string | null;
  entree?: string | null;
  dessert?: string | null;
  confirmed?: boolean;
}

/** Non-cooking ROS “confirm X” (painting / cocktails / itinerary / …). */
export interface RosActivityConfirm {
  label?: string | null;
  notes?: string | null;
  confirmed?: boolean;
}

export interface RosBarCheck {
  handling?: boolean | null;
  consumption?: boolean | null;
  wineOrBeer?: (typeof ROS_WINE_OR_BEER)[number] | null;
  notes?: string | null;
}

export interface RosDayOfPoc {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface RosFoodAdditionsProgress {
  charcuterieCount?: number | null;
  charcuterieOptional?: boolean;
  additionalProtein?: string | number | null;
  additionalProteinOptional?: boolean;
  mysteryIngredients?: boolean | null;
  alternativeSauces?: boolean | null;
}

export interface RosCustomAddonProgress {
  logoSentToEmbroiderist?: boolean | null;
  customName?: boolean | null;
  progress?: boolean | null;
  embroidered?: boolean | null;
  notes?: string | null;
}

export interface RosCustomAddonsProgress {
  embroideredAprons?: RosCustomAddonProgress;
  engravedGlassware?: RosCustomAddonProgress;
  cheeseboard?: RosCustomAddonProgress;
  chocolateMold?: RosCustomAddonProgress;
  chefHats?: RosCustomAddonProgress;
  berets?: RosCustomAddonProgress;
}

export interface RosTransportConfirm {
  needed?: boolean | null;
  company?: (typeof TRANSPORT_COMPANIES)[number] | null;
  companyOther?: string | null;
}

export interface RunOfShowPayload {
  /** When Ops scheduled the ROS meeting (~2.5 weeks). */
  scheduledAt?: string | null;
  calendarInviteSent?: boolean | null;
  menu?: RosMenuConfirm | null;
  /** Non-cooking activity confirmation (meeting confirm-X). */
  activityConfirm?: RosActivityConfirm | null;
  bar?: RosBarCheck | null;
  arrivalMethod?: (typeof ROS_ARRIVAL_METHODS)[number] | null;
  timeChanged?: boolean | null;
  newStartTime?: string | null;
  headcountConfirmed?: number | null;
  dayOfPoc?: RosDayOfPoc | null;
  mediaPermission?: (typeof ROS_MEDIA_PERMISSIONS)[number] | null;
  seatingCurated?: boolean | null;
  seatingStyle?: (typeof ROS_SEATING_STYLES)[number] | null;
  foodAdditions?: RosFoodAdditionsProgress | null;
  customAddons?: RosCustomAddonsProgress | null;
  transport?: RosTransportConfirm | null;
  /** ROS template Drive/doc URL (Admin artifact C036). */
  rosTemplateUrl?: string | null;
  notes?: string | null;
  completedAt?: string | null;
}

export interface EventArtifactsPayload {
  participationListUrl?: string | null;
  participationListType?: "sheets" | "forms" | null;
  postEventSurveyUrl?: string | null;
  workflowCrmUrl?: string | null;
  beoUrl?: string | null;
  beoShellUrl?: string | null;
  fareharborLink?: string | null;
  rosTemplateUrl?: string | null;
}

export function normalizeRosTransportCompany(
  value: string | null | undefined
): (typeof TRANSPORT_COMPANIES)[number] | null {
  return normalizeTransportCompany(value);
}
