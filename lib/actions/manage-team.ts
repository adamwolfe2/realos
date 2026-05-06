"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { AuditAction, OrgType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireAgency,
  requireScope,
  ForbiddenError,
  auditPayload,
  type ScopedContext,
} from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Team management server actions.
//
// Admin (agency-side) and client-side (org-owner) operations share this file
// because the logic is nearly identical — the only difference is which roles
// each actor is allowed to grant/revoke. We enforce that per-action.
// ---------------------------------------------------------------------------

const AGENCY_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

const CLIENT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
  UserRole.LEASING_AGENT,
]);

export type ManageTeamResult =
  | { ok: true }
  | { ok: false; error: string };

// --- updateUserRole (agency) -----------------------------------------------

const updateRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(UserRole),
});

export async function updateUserRoleAsAgency(
  input: z.infer<typeof updateRoleSchema>
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, orgId: true, email: true, role: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: user.orgId } as ScopedContext,
      {
        action: AuditAction.UPDATE,
        entityType: "User",
        entityId: user.id,
        description: `Role changed from ${user.role} to ${parsed.data.role} (${user.email})`,
      }
    ),
  });

  revalidatePath(`/admin/clients/${user.orgId}`);
  return { ok: true };
}

// --- updateUserRole (client owner, restricted to CLIENT_* roles) ----------

export async function updateUserRoleAsClient(
  input: z.infer<typeof updateRoleSchema>
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const caller = await prisma.user.findUnique({
    where: { clerkUserId: scope.clerkUserId },
    select: { role: true, orgId: true },
  });
  if (!caller || caller.orgId !== scope.orgId) {
    return { ok: false, error: "Not authorized." };
  }
  if (caller.role !== UserRole.CLIENT_OWNER && caller.role !== UserRole.CLIENT_ADMIN) {
    return { ok: false, error: "Only Owners or Admins can change team roles." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, orgId: true, email: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.orgId !== scope.orgId) {
    return { ok: false, error: "That user isn't on your team." };
  }
  if (!CLIENT_ROLES.has(parsed.data.role)) {
    return { ok: false, error: "You can only assign client-team roles." };
  }
  if (AGENCY_ROLES.has(target.role)) {
    return { ok: false, error: "You can't modify an agency user from the portal." };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: target.id,
      description: `Role changed from ${target.role} to ${parsed.data.role} (${target.email})`,
    }),
  });

  revalidatePath("/portal/settings");
  return { ok: true };
}

// --- removeUserFromOrg -----------------------------------------------------

const removeSchema = z.object({ userId: z.string().cuid() });

async function revokePendingInvitations(email: string): Promise<void> {
  // Best-effort: find and revoke any outstanding Clerk invitations for this
  // email so a revoked teammate can't still sign up off a stale link.
  try {
    const client = await clerkClient();
    const list = await client.invitations.getInvitationList({ status: "pending" });
    const matches = list.data.filter(
      (inv) => inv.emailAddress.toLowerCase() === email.toLowerCase()
    );
    for (const inv of matches) {
      try {
        await client.invitations.revokeInvitation(inv.id);
      } catch (err) {
        console.warn(`[manage-team] failed to revoke invitation ${inv.id}`, err);
      }
    }
  } catch (err) {
    console.warn("[manage-team] listing Clerk invitations failed", err);
  }
}

export async function removeUserFromOrgAsAgency(
  input: z.infer<typeof removeSchema>
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, orgId: true, email: true, clerkUserId: true, role: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { clerkOrgId: true, orgType: true },
  });

  // Remove from Clerk: org membership if they accepted, pending invitation
  // otherwise. Either way, revoke any pending invitation for their email so
  // they can't resurrect the account via a stale link.
  try {
    const client = await clerkClient();
    if (
      org?.clerkOrgId &&
      user.clerkUserId &&
      !user.clerkUserId.startsWith("seed_pending_")
    ) {
      await client.organizations
        .deleteOrganizationMembership({
          organizationId: org.clerkOrgId,
          userId: user.clerkUserId,
        })
        .catch((err) => {
          console.warn(
            "[manage-team] Clerk org membership delete failed (continuing)",
            err
          );
        });
    }
  } catch (err) {
    console.warn("[manage-team] Clerk cleanup partial failure", err);
  }
  await revokePendingInvitations(user.email);

  await prisma.user.delete({ where: { id: user.id } });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: user.orgId } as ScopedContext,
      {
        action: AuditAction.DELETE,
        entityType: "User",
        entityId: user.id,
        description: `Removed ${user.email} (${user.role}) from tenant`,
      }
    ),
  });

  revalidatePath(`/admin/clients/${user.orgId}`);
  return { ok: true };
}

export async function removeUserFromOrgAsClient(
  input: z.infer<typeof removeSchema>
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const caller = await prisma.user.findUnique({
    where: { clerkUserId: scope.clerkUserId },
    select: { id: true, role: true, orgId: true },
  });
  if (!caller || caller.orgId !== scope.orgId) {
    return { ok: false, error: "Not authorized." };
  }
  if (caller.role !== UserRole.CLIENT_OWNER && caller.role !== UserRole.CLIENT_ADMIN) {
    return { ok: false, error: "Only Owners or Admins can remove teammates." };
  }
  if (caller.id === parsed.data.userId) {
    return { ok: false, error: "You can't remove yourself." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, orgId: true, email: true, clerkUserId: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.orgId !== scope.orgId) {
    return { ok: false, error: "That user isn't on your team." };
  }
  if (AGENCY_ROLES.has(target.role)) {
    return { ok: false, error: "You can't remove an agency user from the portal." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: target.orgId },
    select: { clerkOrgId: true, orgType: true },
  });

  try {
    const client = await clerkClient();
    if (
      org?.clerkOrgId &&
      target.clerkUserId &&
      !target.clerkUserId.startsWith("seed_pending_")
    ) {
      await client.organizations
        .deleteOrganizationMembership({
          organizationId: org.clerkOrgId,
          userId: target.clerkUserId,
        })
        .catch((err) => {
          console.warn(
            "[manage-team] Clerk org membership delete failed (continuing)",
            err
          );
        });
    }
  } catch (err) {
    console.warn("[manage-team] Clerk cleanup partial failure", err);
  }
  await revokePendingInvitations(target.email);

  await prisma.user.delete({ where: { id: target.id } });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: target.id,
      description: `Removed ${target.email} (${target.role}) from team`,
    }),
  });

  revalidatePath("/portal/settings");
  return { ok: true };
}

// --- updatePropertyAccess --------------------------------------------------
//
// Rewrites the UserPropertyAccess row set for a target user. Empty list =
// unrestricted (org-wide access). Non-empty = restricted to those properties.
// Wrapped in a transaction so a half-applied write can never leave the user
// with zero rows when the caller intended a non-empty set (which would
// silently widen them).
//
// Authorization mirrors role-update: agency callers can edit any client
// org's user; client callers can only edit users in their own org and must
// be CLIENT_OWNER or CLIENT_ADMIN.

const updatePropertyAccessSchema = z.object({
  userId: z.string().cuid(),
  propertyIds: z.array(z.string().min(1)),
});

async function applyPropertyAccess(
  scope: ScopedContext,
  userId: string,
  propertyIds: string[],
): Promise<ManageTeamResult> {
  // Validate the requested property ids belong to the user's org. We
  // load the user inside the same call to atomically check membership +
  // org-validate the property ids in one round trip.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, orgId: true, email: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found." };

  if (propertyIds.length > 0) {
    const found = await prisma.property.findMany({
      where: { id: { in: propertyIds }, orgId: target.orgId },
      select: { id: true },
    });
    if (found.length !== propertyIds.length) {
      return {
        ok: false,
        error:
          "One or more selected properties don't belong to this organization.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPropertyAccess.deleteMany({ where: { userId } });
    if (propertyIds.length > 0) {
      await tx.userPropertyAccess.createMany({
        data: propertyIds.map((propertyId) => ({
          userId,
          propertyId,
          grantedBy: scope.userId,
        })),
      });
    }
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: target.orgId } as ScopedContext,
      {
        action: AuditAction.UPDATE,
        entityType: "UserPropertyAccess",
        entityId: userId,
        description:
          propertyIds.length === 0
            ? `Cleared property restrictions for ${target.email} (org-wide access)`
            : `Restricted ${target.email} to ${propertyIds.length} property/properties`,
        diff: { propertyIds },
      },
    ),
  });

  revalidatePath("/portal/settings");
  revalidatePath(`/admin/clients/${target.orgId}`);
  return { ok: true };
}

export async function updatePropertyAccessAsAgency(
  input: z.infer<typeof updatePropertyAccessSchema>,
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }
  const parsed = updatePropertyAccessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }
  return applyPropertyAccess(scope, parsed.data.userId, parsed.data.propertyIds);
}

export async function updatePropertyAccessAsClient(
  input: z.infer<typeof updatePropertyAccessSchema>,
): Promise<ManageTeamResult> {
  let scope: ScopedContext;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }
  // Client callers must be Owner or Admin within their own org.
  const caller = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { role: true, orgId: true },
  });
  if (!caller) return { ok: false, error: "Caller not found." };
  if (
    caller.role !== UserRole.CLIENT_OWNER &&
    caller.role !== UserRole.CLIENT_ADMIN
  ) {
    return {
      ok: false,
      error: "Only Owners or Admins can change property access.",
    };
  }
  const parsed = updatePropertyAccessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }
  // Verify target user is in the same org.
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { orgId: true },
  });
  if (!target || target.orgId !== caller.orgId) {
    return { ok: false, error: "User not in your organization." };
  }
  return applyPropertyAccess(scope, parsed.data.userId, parsed.data.propertyIds);
}
