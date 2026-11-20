import { PROPERTY_SCOPED_ROLES } from "@/lib/agency/role-rank";
import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// What the Team panel shows a property-restricted viewer.
//
// The server actions (manage-team.ts, the invite route) only let a restricted
// admin act on teammates whose grants sit entirely inside the admin's own
// properties. The panel used to list every teammate in the org, with their
// grant counts and the org's full property list (100+ AppFolio rows
// included), so a teammate scoped to property B saw who works on A and C.
// Unrestricted viewers keep the full list.
// ---------------------------------------------------------------------------

type Viewer = { userId: string; allowedPropertyIds: string[] | null };

export function teamMembersForViewer<
  M extends { id: string; propertyIds: string[] },
>(viewer: Viewer, members: M[]): M[] {
  if (!viewer.allowedPropertyIds) return members;
  const held = new Set(viewer.allowedPropertyIds);
  return members.filter(
    (m) =>
      m.id === viewer.userId ||
      (m.propertyIds.length > 0 && m.propertyIds.every((id) => held.has(id))),
  );
}

/**
 * An invite from this viewer for this role must name properties: scoped
 * roles (LEASING_AGENT, CLIENT_VIEWER) always do, and a restricted inviter
 * can only hand out properties they hold. The invite route enforces both;
 * this keeps the form from offering an "org-wide" default it will reject.
 */
export function inviteMustNameProperties(
  inviterRestricted: boolean,
  role: UserRole,
): boolean {
  return inviterRestricted || PROPERTY_SCOPED_ROLES.has(role);
}
