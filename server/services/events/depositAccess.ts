import type { AuthUser } from "../auth/authService.js";
import { env } from "../../config/env.js";
import { DEPOSIT_VIEWER_NAMES } from "./depositIntakeTypes.js";

/**
 * Deposit amount viewers: Dave, Zach, Monica only (meeting).
 * Optional env DEPOSIT_AMOUNT_VIEWERS = comma-separated emails overrides/extends matching.
 */
export function canViewDepositAmount(
  user: AuthUser | null | undefined
): boolean {
  if (!user) return false;

  const email = (user.email || "").trim().toLowerCase();
  const fullName = (user.full_name || "").trim().toLowerCase();

  const envList = (process.env.DEPOSIT_AMOUNT_VIEWERS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));

  if (envList.length > 0 && envList.includes(email)) {
    return true;
  }

  const local = email.split("@")[0] || "";
  for (const name of DEPOSIT_VIEWER_NAMES) {
    if (local === name || local.startsWith(`${name}.`) || local.startsWith(`${name}_`)) {
      return true;
    }
    if (
      fullName === name ||
      fullName.startsWith(`${name} `) ||
      fullName.includes(` ${name} `) ||
      fullName.endsWith(` ${name}`)
    ) {
      return true;
    }
  }

  void env;
  return false;
}

/** Strip deposit fields from an API event record when viewer is not allowed. */
export function redactDepositFields(
  record: Record<string, unknown>,
  user: AuthUser | null | undefined
): Record<string, unknown> {
  if (canViewDepositAmount(user)) {
    return { ...record, can_view_deposit_amount: true };
  }
  const next: Record<string, unknown> = {
    ...record,
    can_view_deposit_amount: false,
  };
  delete next.deposit_amount;
  delete next.depositAmount;
  return next;
}
