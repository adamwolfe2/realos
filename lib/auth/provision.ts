import "server-only";
import { prisma } from "@/lib/db";
import { trackServer } from "@/lib/analytics-server";
import { alertFunnelStep } from "@/lib/notifications/funnel-alert";
import { AuditAction, OrgType, ProductLine, UserRole, TenantStatus } from "@prisma/client";
import { escapeLikePattern } from "@/lib/leads/find-by-email";

// The CLIENT org that names this email as its primary contact: the durable
// record of an owner invite (create-client, convert-intake, proposal
// provisioning set primaryContactEmail and create no User). Callers only get
// here when no User row holds this email. Excluded when THIS email was ever
// removed from the org (manage-team writes the DELETE/User audit with
// diff.removedEmail in the same transaction as the delete; older rows are
// matched by their "Removed <email> (" description), so a removed owner
// never re-binds while other teammates' joins/removals don't matter.
// Escaped case-insensitive equals (Prisma compiles it to ILIKE), oldest
// first. `onlyOrgId` lets invite metadata pick among matches, never bind
// alone.
export function findOrgByPrimaryContact(email: string, onlyOrgId?: string) {
  const normalized = email.toLowerCase().trim();
  return prisma.organization.findFirst({
    where: {
      primaryContactEmail: {
        equals: escapeLikePattern(normalized),
        mode: "insensitive",
      },
      orgType: OrgType.CLIENT,
      auditEvents: {
        none: {
          action: AuditAction.DELETE,
          entityType: "User",
          OR: [
            { diff: { path: ["removedEmail"], equals: normalized } },
            // Old rows keep the email's original casing; startsWith is a
            // LIKE, so escape it too.
            {
              description: {
                startsWith: escapeLikePattern(`Removed ${normalized} (`),
                mode: "insensitive",
              },
            },
          ],
        },
      },
      ...(onlyOrgId ? { id: onlyOrgId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// First-sign-in provisioning.
//
// Called by /api/auth/role when a Clerk-authenticated user lands without a
// matching LeaseStack User row. Without this path a new self-signup user is
// dead-ended at /auth/redirect with "Your account is not set up yet" — the
// Clerk webhook is async and might not have fired (or might never fire if
// CLERK_WEBHOOK_SECRET isn't configured), and the legacy email-match
// fallback only worked for invitees with a pre-seeded User row.
//
// Behavior:
//   - Already-linked Clerk userId → no-op, return the existing user.
//   - Email match → claim the row in place (legacy invite path).
//   - No match → create a fresh CLIENT Organization + CLIENT_OWNER User
//     pair so the operator lands in their own portal with the setup
//     wizard. Slug is derived from email local-part with a uniqueness
//     suffix on collision.
//
// Idempotent: the unique slug and clerkUserId indexes guarantee
// that a concurrent second call collapses into a single row.
// ---------------------------------------------------------------------------

export type ProvisionedUser = {
  id: string;
  role: UserRole;
  orgId: string;
  org: { orgType: OrgType; slug: string };
  created: boolean;
};

export async function provisionUserForClerk(args: {
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}): Promise<ProvisionedUser> {
  const email = args.email.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email for provisioning");
  }

  // 1. Already linked? Return as-is.
  const linked = await prisma.user.findUnique({
    where: { clerkUserId: args.clerkUserId },
    select: {
      id: true,
      role: true,
      orgId: true,
      org: { select: { orgType: true, slug: true } },
    },
  });
  if (linked && linked.org) {
    return {
      id: linked.id,
      role: linked.role,
      orgId: linked.orgId,
      org: linked.org,
      created: false,
    };
  }

  // 2. Email match — claim the pre-existing row in place. This covers the
  // invite flow where an admin pre-created the User with a placeholder
  // clerkUserId like "seed_pending_<email>".
  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      orgId: true,
      org: { select: { orgType: true, slug: true } },
    },
  });
  if (byEmail && byEmail.org) {
    await prisma.user
      .update({
        where: { id: byEmail.id },
        data: {
          clerkUserId: args.clerkUserId,
          firstName: args.firstName,
          lastName: args.lastName,
          lastLoginAt: new Date(),
        },
      })
      .catch(() => undefined);
    return {
      id: byEmail.id,
      role: byEmail.role,
      orgId: byEmail.orgId,
      org: byEmail.org,
      created: false,
    };
  }

  // 2b. Owner invite whose user.created webhook failed: claim the org that
  // names this email as primary contact instead of a new workspace.
  const ownerOrg = await findOrgByPrimaryContact(email);
  if (ownerOrg) {
    try {
      const bound = await prisma.user.create({
        data: {
          clerkUserId: args.clerkUserId,
          email,
          firstName: args.firstName,
          lastName: args.lastName,
          role: UserRole.CLIENT_OWNER,
          lastLoginAt: new Date(),
          orgId: ownerOrg.id,
        },
        select: USER_SELECT,
      });
      return { ...bound, org: bound.org!, created: false };
    } catch (err) {
      return recoverFromCreateRace(err, args.clerkUserId);
    }
  }

  // 3. Greenfield self-signup — provision a fresh CLIENT Organization +
  // CLIENT_OWNER User. Slug derives from the email local-part; conflicts
  // get a numeric suffix.
  const slug = await uniqueOrgSlug(email);
  const displayName =
    [args.firstName, args.lastName].filter(Boolean).join(" ").trim() || email;
  const orgName = `${displayName}'s workspace`;

  // Three callers race here right after sign-up (Clerk webhook,
  // /api/auth/role, scope self-heal). The loser's create fails with P2002;
  // the nested org create rolls back with it, so return the winner's row.
  let created;
  try {
    created = await prisma.user.create({
      data: {
        clerkUserId: args.clerkUserId,
        email,
        firstName: args.firstName,
        lastName: args.lastName,
        role: UserRole.CLIENT_OWNER,
        lastLoginAt: new Date(),
        org: {
          create: {
            name: orgName,
            slug,
            orgType: OrgType.CLIENT,
            productLine: ProductLine.STUDENT_HOUSING,
            status: TenantStatus.INTAKE_RECEIVED,
            primaryContactEmail: email,
            primaryContactName:
              [args.firstName, args.lastName].filter(Boolean).join(" ").trim() ||
              null,
            // Start the new self-serve onboarding wizard from step one.
            // The portal layout reads this field and bounces the user to
            // /onboarding until they hit "done". Existing orgs (created
            // before this column existed) leave it null and skip the
            // wizard — they already have a working workspace.
            onboardingStep: "welcome",
            // All product modules default to off — the operator opts in via
            // the setup hub. moduleWebsite stays true (schema default) so
            // the welcome flow can show the marketing-site step.
          },
        },
      },
      select: {
        id: true,
        role: true,
        orgId: true,
        org: { select: { orgType: true, slug: true } },
      },
    });
  } catch (err) {
    return recoverFromCreateRace(err, args.clerkUserId);
  }

  // Self-serve signups land here, not in the Clerk organization.created
  // webhook, so the funnel event and the ops alert fire from this spot.
  if (created.orgId) {
    await trackServer({ event: "signup", distinctId: created.orgId });
    await alertFunnelStep({ orgId: created.orgId, step: "signup" });
  }

  return {
    id: created.id,
    role: created.role,
    orgId: created.orgId,
    org: created.org!,
    created: true,
  };
}

const USER_SELECT = {
  id: true,
  role: true,
  orgId: true,
  org: { select: { orgType: true, slug: true } },
} as const;

async function recoverFromCreateRace(
  err: unknown,
  clerkUserId: string,
): Promise<ProvisionedUser> {
  const isUnique =
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002";
  if (!isUnique) throw err;
  // Only the same Clerk user's row counts as the winner. Anything else
  // (e.g. a slug clash with a different user) rethrows; the caller retries
  // and steps 1-2 resolve it normally.
  const winner = await prisma.user.findUnique({
    where: { clerkUserId },
    select: USER_SELECT,
  });
  if (!winner?.org) throw err;
  return {
    id: winner.id,
    role: winner.role,
    orgId: winner.orgId,
    org: winner.org,
    created: false,
  };
}

async function uniqueOrgSlug(email: string): Promise<string> {
  const base = (email.split("@")[0] ?? "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

  // Try base, then base-2, base-3, … up to a safety cap. Realistically
  // collisions on the local-part side are rare enough that we'll always
  // resolve in 1-2 attempts.
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const exists = await prisma.organization
      .findUnique({ where: { slug: candidate }, select: { id: true } })
      .catch(() => null);
    if (!exists) return candidate;
  }
  // Final fallback — append timestamp so we never hard-fail provisioning.
  return `${base}-${Date.now().toString(36)}`;
}
