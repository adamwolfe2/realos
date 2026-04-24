import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { OrgType, UserRole, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// ScopedContext. The single source of truth for "whose data is this request
// allowed to see?" for every tenant-scoped Prisma query and API handler.
//
// Resolution:
//   - getScope()       -> null | ScopedContext (no-throw, handles unauthed)
//   - requireAgency()  -> throws unless orgType == AGENCY
//   - requireClient()  -> throws unless orgType == CLIENT (or impersonating)
//   - requireScope()   -> throws on unauth; allows either orgType
//
// Impersonation:
//   Agency users can set `publicMetadata.impersonateOrgId` via the Clerk
//   Backend API (see lib/tenancy/impersonate.ts). When present, `orgId`
//   resolves to the target; `actualOrgId` stays the agency. All audit events
//   use `actualOrgId` as the actor and `orgId` as the subject.
// ---------------------------------------------------------------------------

export type ScopedContext = {
  userId: string;                 // Our internal User.id
  clerkUserId: string;            // Clerk user id
  orgId: string;                  // Effective org (respects impersonation)
  actualOrgId: string;            // Real org from the session
  orgType: OrgType;               // Effective org type
  actualOrgType: OrgType;         // Real org type from the session
  role: UserRole;
  email: string;
  isAgency: boolean;              // Shorthand for actualOrgType === AGENCY
  isImpersonating: boolean;
};

// DEMO_MODE fallback. When no Clerk session exists AND the flag is on, we
// resolve a synthetic scope pointed at the first CLIENT org in the DB (for
// /portal) or the first AGENCY org (for /admin). Requires DATABASE_URL to
// be set and the seed script to have run. Returns null if the DB is empty
// or unreachable; callers then surface their normal "not authenticated"
// error rather than leaking into prod.
async function getDemoScope(): Promise<ScopedContext | null> {
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true";
  if (!demoMode) return null;

  const agencyOrg = await prisma.organization
    .findFirst({ where: { orgType: OrgType.AGENCY } })
    .catch(() => null);
  const clientOrg = await prisma.organization
    .findFirst({ where: { orgType: OrgType.CLIENT } })
    .catch(() => null);

  const target = clientOrg ?? agencyOrg;
  if (!target) return null;

  // Synthesise a user-shaped scope. We don't touch Clerk or the User table;
  // audit writes are guarded elsewhere by isDemoMode() where relevant.
  return {
    userId: "demo-user",
    clerkUserId: "demo-user",
    orgId: target.id,
    actualOrgId: agencyOrg?.id ?? target.id,
    orgType: target.orgType,
    actualOrgType: agencyOrg?.orgType ?? target.orgType,
    role: (agencyOrg?.orgType ?? target.orgType) === OrgType.AGENCY
      ? UserRole.AGENCY_OWNER
      : UserRole.CLIENT_OWNER,
    email: "demo@leasestack.co",
    isAgency: (agencyOrg?.orgType ?? target.orgType) === OrgType.AGENCY,
    isImpersonating: false,
  };
}

export async function getScope(): Promise<ScopedContext | null> {
  const { userId: clerkUserId, sessionClaims } = await auth();
  if (!clerkUserId) {
    return await getDemoScope();
  }

  const user = await prisma.user
    .findUnique({
      where: { clerkUserId },
      include: { org: true },
    })
    .catch(() => null);
  if (!user || !user.org) return await getDemoScope();

  const actualOrgType = user.org.orgType;
  const isAgency = actualOrgType === OrgType.AGENCY;

  // Impersonation is expressed as `publicMetadata.impersonateOrgId`. The
  // default Clerk JWT does NOT include publicMetadata in sessionClaims, so we
  // try sessionClaims first (cheap), then fall back to a server-side fetch
  // via clerkClient (one extra request, always fresh). The fallback is what
  // makes impersonation actually work without a custom JWT template.
  let publicMetadata =
    (sessionClaims?.publicMetadata as Record<string, unknown> | undefined) ??
    {};
  if (isAgency && !publicMetadata.impersonateOrgId) {
    try {
      const client = await clerkClient();
      const fresh = await client.users.getUser(clerkUserId);
      publicMetadata = fresh.publicMetadata ?? {};
    } catch {
      // Network failure shouldn't block scope resolution; fall through with
      // whatever we had from sessionClaims.
    }
  }
  const impersonateOrgId =
    isAgency && typeof publicMetadata.impersonateOrgId === "string"
      ? (publicMetadata.impersonateOrgId as string)
      : undefined;

  let effectiveOrgId = user.orgId;
  let effectiveOrgType = actualOrgType;
  if (impersonateOrgId) {
    const target = await prisma.organization
      .findUnique({ where: { id: impersonateOrgId }, select: { id: true, orgType: true } })
      .catch(() => null);
    if (target) {
      effectiveOrgId = target.id;
      effectiveOrgType = target.orgType;
    }
  }

  return {
    userId: user.id,
    clerkUserId,
    orgId: effectiveOrgId,
    actualOrgId: user.orgId,
    orgType: effectiveOrgType,
    actualOrgType,
    role: user.role,
    email: user.email,
    isAgency,
    isImpersonating: !!impersonateOrgId && impersonateOrgId !== user.orgId,
  };
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireScope(): Promise<ScopedContext> {
  const scope = await getScope();
  if (!scope) throw new ForbiddenError("Not authenticated");
  return scope;
}

export async function requireAgency(): Promise<ScopedContext> {
  const scope = await requireScope();
  if (!scope.isAgency) throw new ForbiddenError("Agency access only");
  return scope;
}

export async function requireClient(): Promise<ScopedContext> {
  const scope = await requireScope();
  // Agency users get CLIENT access whenever they're impersonating.
  if (scope.orgType !== OrgType.CLIENT) {
    throw new ForbiddenError("Client context required");
  }
  return scope;
}

// ---------------------------------------------------------------------------
// tenantWhere(scope) — the mandatory filter for every tenant-scoped query.
// Every Prisma read/write on a model with orgId MUST spread this into its
// where clause. Code review should enforce this.
//
// Exception: `/api/admin/*` routes call `requireAgency()` and may pass
// `allAgencies: true` to the query helper if they need a cross-tenant view.
// ---------------------------------------------------------------------------

export function tenantWhere<T extends { orgId?: string }>(
  scope: ScopedContext
): T {
  return { orgId: scope.orgId } as T;
}

// Helper for admin cross-tenant queries. Must be called inside requireAgency().
export function agencyWhereAll(): Record<string, never> {
  return {};
}

// Audit-ready: builds the common AuditEvent create payload from a scope.
// DECISION: orgId on the audit row is the *effective* org (who the action
// affected). userId ties back to the agency actor even during impersonation,
// so we can prove the chain of custody.
export function auditPayload(
  scope: ScopedContext,
  input: {
    action: Prisma.AuditEventCreateInput["action"];
    entityType: string;
    entityId?: string;
    description?: string;
    diff?: Prisma.InputJsonValue;
  }
): Prisma.AuditEventUncheckedCreateInput {
  return {
    orgId: scope.orgId,
    userId: scope.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    description: input.description ?? null,
    diff: input.diff ?? Prisma.JsonNull,
  };
}
