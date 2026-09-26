import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

// Onboarding wizard routes rename the org and rewrite module flags. Only
// admin-level seats may do that; viewers and leasing agents may not
// (SECURITY_AUDIT AUTHZ-WIZ). Self-serve sign-up provisions CLIENT_OWNER.
const WIZARD_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
]);

/** 403 response when `role` can't run the wizard, else null. */
export function wizardRoleForbidden(role: UserRole): NextResponse | null {
  if (WIZARD_ROLES.has(role)) return null;
  return NextResponse.json(
    { ok: false, error: "Only an owner or admin can set up this workspace." },
    { status: 403 },
  );
}
