import { base44 } from "@/api/base44Client";
import { OPS_HOME_PATH } from "@/lib/operationalAccess.js";

export const MY_ONBOARDING_PATH = "/MyOnboarding";
export const DEFAULT_APP_PATH = "/Dashboard";

export async function resolvePostLoginPath(user) {
  if (!user) return DEFAULT_APP_PATH;
  if (user.role === "admin") return DEFAULT_APP_PATH;

  try {
    const assignments = await base44.entities.RoleAssignment.filter({
      user_id: user.id,
    });
    const assignment = assignments[0];
    if (
      assignment?.role === "Onboarding" &&
      assignment?.is_active !== false
    ) {
      return MY_ONBOARDING_PATH;
    }
    if (assignment?.role === "Ops" && assignment?.is_active !== false) {
      return OPS_HOME_PATH;
    }
  } catch {
    return DEFAULT_APP_PATH;
  }

  return DEFAULT_APP_PATH;
}
