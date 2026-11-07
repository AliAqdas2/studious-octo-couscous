import type { AuthUser } from "../auth/authService.js";
import {
  DEPOSIT_VIEWER_EMAILS,
  DEPOSIT_VIEWER_NAMES,
} from "./depositIntakeTypes.js";

/**
 * Deposit amount viewers: Dave, Zach, Monica only (meeting).
 * Primary: known emails. Extra: DEPOSIT_AMOUNT_VIEWERS env (comma-separated).
 * Fallback: email local-part / full_name match against dave|zach|monica.
 */
export function canViewDepositAmount(
  user: AuthUser | null | undefined
): boolean {
  if (!user) return false;

  const email = (user.email || "").trim().toLowerCase();
  const fullName = (user.full_name || "").trim().toLowerCase();

  if (
    email &&
    (DEPOSIT_VIEWER_EMAILS as readonly string[]).includes(email)
  ) {
    return true;
  }

  const envList = (process.env.DEPOSIT_AMOUNT_VIEWERS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));

  if (email && envList.includes(email)) {
    return true;
  }

  const local = email.split("@")[0] || "";
  for (const name of DEPOSIT_VIEWER_NAMES) {
    if (
      local === name ||
      local.startsWith(`${name}.`) ||
      local.startsWith(`${name}_`)
    ) {
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
  delete next.deposit_payment_url;
  delete next.depositPaymentUrl;
  return next;
}
