import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { OrgType, ProductLine, UserRole, Prisma } from "@prisma/client";

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
  productLine: ProductLine;       // Effective org product line
  role: UserRole;
  email: string;
  isAgency: boolean;              // Shorthand for actualOrgType === AGENCY
  isAlPartner: boolean;           // role === AL_PARTNER. Cross-org access to AUDIENCE_SYNC orgs
  isImpersonating: boolean;
  // Property-level RBAC gate.
  //   null  → unrestricted (org-wide access). Default for any user with
  //           zero UserPropertyAccess rows. Preserves legacy behavior for
  //           every existing user as we ship this feature.
  //   []    → impossible to construct from this resolver (we collapse
  //           empty grants to null), but if it ever appears callers MUST
  //           treat it as "see nothing" — never as "see everything."
  //   [...] → restricted to ONLY these property ids. Pages must filter
  //           their property dropdowns to this set AND gate every
  //           per-property query.
  //
  // Impersonation deliberately bypasses this gate — an agency user
  // impersonating a client sees the client's full portfolio so they
  // can support every property, regardless of any restrictions on
  // the agency user's own org.
  allowedPropertyIds: string[] | null;
};

// DEMO_MODE fallback. When no Clerk session exists AND the flag is on, we
// resolve a synthetic scope pointed at the first CLIENT org in the DB (for
// /portal) or the first AGENCY org (for /admin). Requires DATABASE_URL to
// be set and the seed script to have run. Returns null if the DB is empty
// or unreachable; callers then surface their normal "not authenticated"
// error rather than leaking into prod.
//
// PRODUCTION SAFETY: DEMO_MODE is hard-disabled when VERCEL_ENV=production
// or NODE_ENV=production. Even if an env var slips through with the flag
// set, prod traffic will never see synthesized demo scopes — the only
// source of truth in production is a real Clerk session.
async function getDemoScope(): Promise<ScopedContext | null> {
  // Belt-and-suspenders production refusal. If anyone ever sets
  // DEMO_MODE=true in a Vercel production environment by mistake, this
  // guard ensures unauthenticated traffic still goes through the normal
  // sign-in flow instead of leaking into a "first CLIENT org" surface.
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return null;
  }
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

  // DEMO_TARGET=client forces the demo to render the client-side /portal
  // surface (with all module pages) instead of bouncing to /admin. Useful
  // for design QA and customer demos where you want to see the operator
  // experience, not the agency overview. Default behavior preserved when
  // the flag is unset: prefer agency context when one exists.
  const demoTarget = process.env.DEMO_TARGET ?? process.env.NEXT_PUBLIC_DEMO_TARGET;
  const forceClient = demoTarget === "client";

  const target = forceClient ? (clientOrg ?? agencyOrg) : (agencyOrg ?? clientOrg);
  if (!target) return null;

  // When DEMO_TARGET=client, treat the resolved scope as a pure client
  // session — no agency context bleed, no /admin redirect. When unset (or
  // any other value), keep the original behavior: a partner viewing the
  // first client through agency lenses.
  const isAgencyScope = forceClient
    ? false
    : (agencyOrg?.orgType ?? target.orgType) === OrgType.AGENCY;
  const actualOrg = forceClient ? target : (agencyOrg ?? target);

  // Synthesise a user-shaped scope. We don't touch Clerk or the User table;
  // audit writes are guarded elsewhere by isDemoMode() where relevant.
  return {
    userId: "demo-user",
    clerkUserId: "demo-user",
    orgId: target.id,
    actualOrgId: actualOrg.id,
    orgType: target.orgType,
    actualOrgType: actualOrg.orgType,
    productLine: target.productLine ?? ProductLine.STUDENT_HOUSING,
    role: isAgencyScope ? UserRole.AGENCY_OWNER : UserRole.CLIENT_OWNER,
    email: "demo@leasestack.co",
    isAgency: isAgencyScope,
    isAlPartner: false,
    isImpersonating: false,
    // Demo scope is always unrestricted. The whole point of demo mode is
    // to render the full surface for showcasing, so we never hand it a
    // property gate.
    allowedPropertyIds: null,
  };
}

export async function getScope(): Promise<ScopedContext | null> {
  // Defensive: auth() throws if the request didn't pass through
  // clerkMiddleware (e.g. a route inadvertently added to a bypass list
  // in middleware.ts). Treat that as "no session" instead of bubbling
  // a 500 — callers that genuinely need auth use requireScope() and
  // will surface a 403 from the null result.
  let clerkUserId: string | null = null;
  let sessionClaims: Awaited<ReturnType<typeof auth>>["sessionClaims"] = null;
  try {
    const session = await auth();
    clerkUserId = session.userId;
    sessionClaims = session.sessionClaims;
  } catch (err) {
    console.error("[scope] auth() failed; treating as anonymous:", err);
    return await getDemoScope();
  }
  if (!clerkUserId) {
    return await getDemoScope();
  }

  let user = await prisma.user
    .findUnique({
      where: { clerkUserId },
      include: { org: true },
    })
    .catch(() => null);

  // Self-heal: if the Clerk session is valid but there's no LeaseStack
  // User row yet (Clerk webhook not configured / hasn't fired / fired
  // partially), eager-provision now so the user lands in a working
  // portal instead of looping back to /sign-in. This mirrors the same
  // logic /api/auth/role uses on first sign-in but applies to ANY page
  // load — covers the case where a user's session predates the migration
  // that introduced provisioning, or someone tampered with the User row.
  if (!user || !user.org) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server");
      const clerkUser = await currentUser();
      const email =
        clerkUser?.emailAddresses?.find(
          (e) => e.id === clerkUser?.primaryEmailAddressId,
        )?.emailAddress ??
        clerkUser?.emailAddresses?.[0]?.emailAddress ??
        null;
      if (email) {
        const { provisionUserForClerk } = await import("@/lib/auth/provision");
        await provisionUserForClerk({
          clerkUserId,
          email,
          firstName: clerkUser?.firstName ?? null,
          lastName: clerkUser?.lastName ?? null,
        });
        user = await prisma.user
          .findUnique({
            where: { clerkUserId },
            include: { org: true },
          })
          .catch(() => null);
      }
    } catch (err) {
      console.error("[scope] self-heal provision failed:", err);
    }
  }
  if (!user || !user.org) return await getDemoScope();

  const actualOrgType = user.org.orgType;
  const actualProductLine = user.org.productLine ?? ProductLine.STUDENT_HOUSING;
  const isAgency = actualOrgType === OrgType.AGENCY;
  const isAlPartner = user.role === UserRole.AL_PARTNER;

  // Impersonation is expressed as `publicMetadata.impersonateOrgId`. The
  // default Clerk JWT does NOT include publicMetadata in sessionClaims, so we
  // try sessionClaims first (cheap), then fall back to a server-side fetch
  // via clerkClient (one extra request, always fresh). The fallback is what
  // makes impersonation actually work without a custom JWT template.
  //
  // AGENCY users can impersonate any org. AL_PARTNER users can impersonate
  // any AUDIENCE_SYNC org (enforced below by re-checking productLine on the
  // target).
  //
  // SECURITY: impersonation is bound to the Clerk SESSION that started it.
  // Without this binding, an agency user who forgets to end impersonation
  // and then signs out leaves stale impersonateOrgId on publicMetadata that
  // gets inherited by the NEXT session (including incognito sign-ins with
  // a secondary email on the same Clerk user). That's how a brand-new
  // sign-in landed inside SG Real Estate. Now we cross-check the session
  // id; mismatched sessions ignore the impersonation entirely.
  const canImpersonate = isAgency || isAlPartner;
  let publicMetadata =
    (sessionClaims?.publicMetadata as Record<string, unknown> | undefined) ??
    {};
  const currentSessionId =
    (sessionClaims as { sid?: string } | null)?.sid ?? null;
  if (canImpersonate && !publicMetadata.impersonateOrgId) {
    try {
      const client = await clerkClient();
      const fresh = await client.users.getUser(clerkUserId);
      publicMetadata = fresh.publicMetadata ?? {};
    } catch {
      // Network failure shouldn't block scope resolution; fall through with
      // whatever we had from sessionClaims.
    }
  }
  const storedSessionId =
    typeof publicMetadata.impersonateSessionId === "string"
      ? (publicMetadata.impersonateSessionId as string)
      : null;
  const sessionMatchesImpersonation =
    !!storedSessionId &&
    !!currentSessionId &&
    storedSessionId === currentSessionId;

  // Stale impersonation on a different session: clear it asynchronously so
  // it can't leak again on the next page load, and ignore it for this
  // request. Best-effort cleanup; we don't await it so it doesn't block
  // the request.
  if (
    canImpersonate &&
    typeof publicMetadata.impersonateOrgId === "string" &&
    !sessionMatchesImpersonation
  ) {
    try {
      const client = await clerkClient();
      const cleaned = { ...(publicMetadata ?? {}) };
      delete cleaned.impersonateOrgId;
      delete cleaned.impersonateSessionId;
      delete cleaned.impersonateStartedAt;
      void client.users
        .updateUserMetadata(clerkUserId, { publicMetadata: cleaned })
        .catch(() => undefined);
    } catch {
      // ignore
    }
  }

  const impersonateOrgId =
    canImpersonate &&
    sessionMatchesImpersonation &&
    typeof publicMetadata.impersonateOrgId === "string"
      ? (publicMetadata.impersonateOrgId as string)
      : undefined;

  let effectiveOrgId = user.orgId;
  let effectiveOrgType = actualOrgType;
  let effectiveProductLine = actualProductLine;
  if (impersonateOrgId) {
    const target = await prisma.organization
      .findUnique({
        where: { id: impersonateOrgId },
        select: { id: true, orgType: true, productLine: true },
      })
      .catch(() => null);
    if (target) {
      // AL partners are gated to AUDIENCE_SYNC targets only. Silently fall
      // back to their own org if they try to impersonate something else.
      if (isAlPartner && target.productLine !== ProductLine.AUDIENCE_SYNC) {
        // ignore
      } else {
        effectiveOrgId = target.id;
        effectiveOrgType = target.orgType;
        effectiveProductLine = target.productLine ?? actualProductLine;
      }
    }
  }

  // Load property-level access grants. Empty result set => unrestricted
  // (legacy behavior for every existing user). Impersonation deliberately
  // BYPASSES this gate so an agency user supporting a client sees the
  // full portfolio regardless of any restrictions on their own org.
  let allowedPropertyIds: string[] | null = null;
  const isImpersonating = !!impersonateOrgId && impersonateOrgId !== user.orgId;
  if (!isImpersonating) {
    const grants = await prisma.userPropertyAccess
      .findMany({
        where: { userId: user.id },
        select: { propertyId: true },
      })
      .catch(() => [] as Array<{ propertyId: string }>);
    if (grants.length > 0) {
      allowedPropertyIds = grants.map((g) => g.propertyId);
    }
  }

  return {
    userId: user.id,
    clerkUserId,
    orgId: effectiveOrgId,
    actualOrgId: user.orgId,
    orgType: effectiveOrgType,
    actualOrgType,
    productLine: effectiveProductLine,
    role: user.role,
    email: user.email,
    isAgency,
    isAlPartner,
    isImpersonating,
    allowedPropertyIds,
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

// Used by /portal/audiences. Allows:
//   - Members of an AUDIENCE_SYNC client org
//   - AGENCY users impersonating an AUDIENCE_SYNC org
//   - AL_PARTNER users (whose own org is AGENCY-typed) impersonating an
//     AUDIENCE_SYNC org. Without an active impersonation they're allowed
//     in for the segment list / catalog view across all AUDIENCE_SYNC orgs.
export async function requireAudienceSync(): Promise<ScopedContext> {
  const scope = await requireScope();
  if (scope.isAgency || scope.isAlPartner) return scope;
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC) {
    throw new ForbiddenError("Audience Sync access only");
  }
  return scope;
}

export class TrialExpiredError extends ForbiddenError {
  constructor() {
    super(
      "Your free trial has ended. Activate your subscription from /portal/billing to continue.",
    );
    this.name = "TrialExpiredError";
    this.status = 402; // Payment Required
  }
}

// Gate for mutating actions. Returns the scope on success; throws
// TrialExpiredError if the org is in trial_expired state. Agency users
// impersonating a client bypass the gate so support workflows keep
// working when a customer's trial lapses.
//
// Call this from mutating route handlers + server actions instead of
// requireScope() to enforce the read-only gate. Read-only routes (GET
// endpoints, dashboard queries) keep using requireScope() so customers
// can still review and export their data after a trial lapse.
export async function requireWritableWorkspace(): Promise<ScopedContext> {
  const scope = await requireScope();
  if (scope.isImpersonating) return scope;
  const { isWorkspaceReadOnly } = await import("@/lib/billing/trial-status");
  const { prisma } = await import("@/lib/db");
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
    },
  });
  if (!org) return scope;
  if (isWorkspaceReadOnly(org, { isImpersonating: false })) {
    throw new TrialExpiredError();
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
