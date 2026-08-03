import { UserRole } from "@prisma/client";

/**
 * Roles allowed to write operational tenant data (manual entry, lead↔lease
 * links, and anything else that mints a customer-visible record).
 *
 * CLIENT_VIEWER is a read-only seat (schema.prisma) and AL_PARTNER is an
 * external partner identity — neither may mutate. Mirrors
 * ALLOWED_TOGGLE_ROLES in the marketplace toggle route.
 *
 * Extracted from lib/actions/manual-records.ts (2026-08-02) so the
 * lead→lease link route enforces the SAME set instead of re-deriving it.
 */
export const ALLOWED_WRITE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.LEASING_AGENT,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);
