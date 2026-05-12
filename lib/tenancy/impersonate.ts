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

  // SECURITY: bind impersonation to the CURRENT Clerk session id. Without
  // this, the impersonateOrgId on publicMetadata survives sign-out (it's
  // global to the Clerk user) and a subsequent sign-in (including via a
  // secondary email or a magic link) inherits the impersonation — which
  // means a brand-new looking account lands inside someone else's tenant
  // data. Cross-checking the session id in scope.ts ensures stale
  // impersonations from prior sessions get ignored.
  //
  // Also stamp the start time so we can age out impersonations even on
  // the same session (e.g. 8h cap), preventing forever-impersonations.
  const { auth } = await import("@clerk/nextjs/server");
  const a = await auth();
  const currentSessionId =
    (a.sessionClaims as { sid?: string } | null)?.sid ?? a.sessionId ?? null;

  const client = await clerkClient();
  const current = await client.users.getUser(scope.clerkUserId);
  const publicMetadata = { ...(current.publicMetadata ?? {}) };
  publicMetadata.impersonateOrgId = target.id;
  publicMetadata.impersonateSessionId = currentSessionId;
  publicMetadata.impersonateStartedAt = new Date().toISOString();
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
  delete publicMetadata.impersonateSessionId;
  delete publicMetadata.impersonateStartedAt;
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
