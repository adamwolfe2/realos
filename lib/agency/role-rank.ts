import { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Pure (sync) role-rank helpers — separated from `lib/actions/manage-team.ts`
// because Next.js requires every export from a "use server" file to be an
// async function. These helpers live here so they can be:
//   - imported by the server action without breaking the build
//   - imported by tests directly
//   - reused by other call sites (API routes, UI guards) without crossing
//     the server-actions boundary
//
// Higher rank == more privilege.
//   - Actor must have rank >= target's current role's rank.
//   - For role UPDATES, actor must have rank >= the NEW role's rank.
//   - Only AGENCY_OWNER can grant/manage AGENCY_OWNER.
//   - System must always have at least one AGENCY_OWNER. Last-owner
//     protection is enforced at the call site, not here.
// ---------------------------------------------------------------------------

export const AGENCY_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

export const CLIENT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
  UserRole.LEASING_AGENT,
]);

export const AGENCY_ROLE_RANK: Record<
  "AGENCY_OWNER" | "AGENCY_ADMIN" | "AGENCY_OPERATOR",
  number
> = {
  AGENCY_OWNER: 100,
  AGENCY_ADMIN: 50,
  AGENCY_OPERATOR: 10,
};

export function agencyRoleRank(role: UserRole): number {
  if (role === UserRole.AGENCY_OWNER) return AGENCY_ROLE_RANK.AGENCY_OWNER;
  if (role === UserRole.AGENCY_ADMIN) return AGENCY_ROLE_RANK.AGENCY_ADMIN;
  if (role === UserRole.AGENCY_OPERATOR) return AGENCY_ROLE_RANK.AGENCY_OPERATOR;
  // Client-side / non-agency roles have no rank in the agency hierarchy.
  return 0;
}

export type RankCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Rank-aware gate for agency-side mutations on another agency user.
 * - For role UPDATES, pass `newRole`.
 * - For REMOVALS, omit `newRole`.
 * Returns `{ ok: true }` when the actor is permitted to perform the action.
 */
export function canManageAgencyRole(
  actorRole: UserRole,
  targetRole: UserRole,
  newRole?: UserRole,
): RankCheckResult {
  if (!AGENCY_ROLES.has(targetRole)) {
    return { ok: false, reason: "Target is not an agency-side user." };
  }
  if (!AGENCY_ROLES.has(actorRole)) {
    return { ok: false, reason: "Actor is not an agency-side user." };
  }

  const actorRank = agencyRoleRank(actorRole);
  const targetRank = agencyRoleRank(targetRole);

  // Owner-specific privilege: only AGENCY_OWNER can manage another
  // AGENCY_OWNER (remove, demote, or promote a user to owner).
  if (
    targetRole === UserRole.AGENCY_OWNER &&
    actorRole !== UserRole.AGENCY_OWNER
  ) {
    return {
      ok: false,
      reason: "Only an AGENCY_OWNER can manage an AGENCY_OWNER.",
    };
  }

  // General rank gate: actor must have at least the target's rank.
  if (actorRank < targetRank) {
    return {
      ok: false,
      reason: "You don't have a high enough role to manage this agency user.",
    };
  }

  if (newRole !== undefined) {
    // Promotion to AGENCY_OWNER is owner-only.
    if (newRole === UserRole.AGENCY_OWNER && actorRole !== UserRole.AGENCY_OWNER) {
      return {
        ok: false,
        reason: "Only an AGENCY_OWNER can promote a user to AGENCY_OWNER.",
      };
    }
    // Actor cannot grant a role above their own rank.
    const newRank = agencyRoleRank(newRole);
    if (newRank > actorRank) {
      return {
        ok: false,
        reason: "You can't grant a role above your own.",
      };
    }
  }

  return { ok: true };
}
