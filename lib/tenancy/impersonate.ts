import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { AuditAction, OrgType } from "@prisma/client";
import { requireAgency, auditPayload, type ScopedContext } from "./scope";

// ---------------------------------------------------------------------------
// Agency impersonation.
//
// Writes `publicMetadata.impersonateOrgId` on the agency user's Clerk record.
// getScope() picks that up on the next request and switches the effective
// orgId to the target. Ends by clearing the metadata key.
//
// Every start/end is mirrored to AuditEvent for compliance.
// ---------------------------------------------------------------------------

export async function startImpersonation(targetOrgId: string): Promise<{
  ok: true;
  targetOrgId: string;
  targetOrgName: string;
}> {
  const scope = await requireAgency();
  const target = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { id: true, name: true, orgType: true, slug: true },
  });
  if (!target) throw new Error("Impersonation target not found");
  if (target.orgType !== OrgType.CLIENT) {
    throw new Error("Cannot impersonate a non-CLIENT organization");
  }

  const client = await clerkClient();
  const current = await client.users.getUser(scope.clerkUserId);
  const publicMetadata = { ...(current.publicMetadata ?? {}) };
  publicMetadata.impersonateOrgId = target.id;
  await client.users.updateUserMetadata(scope.clerkUserId, {
    publicMetadata,
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: target.id } as ScopedContext,
      {
        action: AuditAction.IMPERSONATE_START,
        entityType: "Organization",
        entityId: target.id,
        description: `Agency user ${scope.email} started impersonating ${target.name}`,
      }
    ),
  });

  return { ok: true, targetOrgId: target.id, targetOrgName: target.name };
}

export async function endImpersonation(): Promise<{ ok: true }> {
  const scope = await requireAgency();

  const client = await clerkClient();
  const current = await client.users.getUser(scope.clerkUserId);
  const publicMetadata = { ...(current.publicMetadata ?? {}) };
  const previousTarget = publicMetadata.impersonateOrgId;
  delete publicMetadata.impersonateOrgId;
  await client.users.updateUserMetadata(scope.clerkUserId, {
    publicMetadata,
  });

  if (typeof previousTarget === "string" && previousTarget) {
    await prisma.auditEvent.create({
      data: auditPayload(
        { ...scope, orgId: previousTarget } as ScopedContext,
        {
          action: AuditAction.IMPERSONATE_END,
          entityType: "Organization",
          entityId: previousTarget,
          description: `Agency user ${scope.email} ended impersonation`,
        }
      ),
    });
  }

  return { ok: true };
}
