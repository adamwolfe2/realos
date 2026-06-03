import "server-only";
import {
  OrgType,
  PropertyType,
  SubscriptionStatus,
  SubscriptionTier,
  TenantStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Org provisioning for an accepted Proposal.
//
// Inside `runProvisioningForProposal` we open a Prisma transaction so the
// org create + slug uniqueness + ProposalAcceptance.provisionedOrgId all
// either land together or roll back together. Clerk-org + invite + welcome
// email happen OUTSIDE the transaction (Clerk can't participate in Prisma
// transactions) — see `clerk-invite.ts` and `welcome-email.ts`.
//
// Idempotency: if `ProposalAcceptance.provisionedOrgId` is already set we
// return the existing id. This makes the function safe to call on a Stripe
// retry of `invoice.paid` and matches the `processStripeEventOnce` model in
// `lib/proposals/idempotency.ts`.
//
// Tier inference: we read the most-recent TIER-kind line item from the
// proposal. Operators occasionally include an enterprise / custom tier with
// `defaultPriceCents=0` — that maps to SubscriptionTier.CUSTOM. Anything
// else maps slug → enum (tier-foundation = STARTER per the existing
// SubscriptionTier convention in schema.prisma).
// ---------------------------------------------------------------------------

export type ProvisionOrgArgs = {
  proposalId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
};

export type ProvisionOrgResult = {
  orgId: string;
  created: boolean;
};

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Reserved slug fragments. These overlap with first-party tenant subdomains
// (admin / portal / api) we don't want a real estate operator to claim by
// company name. Mirrors the spirit of `convert-intake.ts`'s slug guard.
const RESERVED_SLUGS = new Set<string>([
  "admin",
  "agency",
  "api",
  "app",
  "auth",
  "billing",
  "demo",
  "marketing",
  "portal",
  "proposal",
  "public",
  "site",
  "www",
]);

const SLUG_MAX = 32;

function baseSlugFrom(input: string): string {
  const lowered = input.trim().toLowerCase();
  const stripped = lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!stripped || RESERVED_SLUGS.has(stripped)) {
    // Defensive fallback — pre-empts a collision storm if every prospect
    // happens to be called "portal" or similar. cuid-style suffix shrinks
    // the bare slug to keep it readable.
    return `client-${Math.random().toString(36).slice(2, 8)}`;
  }
  return stripped.slice(0, SLUG_MAX);
}

async function pickUniqueSlug(
  tx: TxClient,
  source: string,
): Promise<string> {
  const base = baseSlugFrom(source);
  // Build the candidate list ONCE, then resolve every collision in a
  // single query. The previous version fired one findUnique per N (up
  // to 999 round-trips). One IN-clause query covers the whole window
  // and lets us pick the lowest-free slot in memory.
  const MAX_CANDIDATES = 999;
  const candidates: string[] = [base];
  for (let n = 2; n <= MAX_CANDIDATES; n++) {
    const suffix = `-${n}`;
    candidates.push(`${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`);
  }
  const taken = await tx.organization.findMany({
    where: { slug: { in: candidates } },
    select: { slug: true },
  });
  const takenSet = new Set(taken.map((o) => o.slug));
  const free = candidates.find((c) => !takenSet.has(c));
  if (!free) {
    throw new Error("Could not generate a unique organization slug");
  }
  return free;
}

// Map a proposal-catalog tier slug to the SubscriptionTier enum. Falls back
// to GROWTH (the middle tier — same default applied across the platform when
// a fresh signup hasn't picked a plan yet).
function tierFromCatalogSlug(slug: string | null): SubscriptionTier {
  switch (slug) {
    case "tier-foundation":
      return SubscriptionTier.STARTER;
    case "tier-growth":
      return SubscriptionTier.GROWTH;
    case "tier-scale":
      return SubscriptionTier.SCALE;
    case "tier-enterprise":
      return SubscriptionTier.CUSTOM;
    default:
      return SubscriptionTier.GROWTH;
  }
}

/**
 * Provision a CLIENT Organization for an accepted proposal — or return the
 * existing one if provisioning has already happened. Pass a Prisma
 * transaction client so the slug picker + org create + ProposalAcceptance
 * update all hold the same transactional fence as the caller's
 * `processStripeEventOnce` boundary.
 */
export async function provisionOrgForAcceptance(
  tx: TxClient,
  args: ProvisionOrgArgs,
): Promise<ProvisionOrgResult> {
  const proposal = await tx.proposal.findUnique({
    where: { id: args.proposalId },
    include: {
      acceptance: true,
      lineItems: {
        include: { catalogItem: { select: { slug: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!proposal) {
    throw new Error(`Proposal ${args.proposalId} not found`);
  }

  // Idempotency: short-circuit if provisioning already happened. Matches
  // the contract called out in the spec — Stripe will retry `invoice.paid`
  // on any non-2xx; we must not double-provision.
  if (proposal.acceptance?.provisionedOrgId) {
    return { orgId: proposal.acceptance.provisionedOrgId, created: false };
  }

  // Upsell path: when the proposal targets an existing Org we attach
  // billing context to that Org instead of creating a new one. This is
  // the "expand a current customer" lane — auto-provisioning collapses to
  // a metadata update.
  if (proposal.prospectOrgId) {
    const existing = await tx.organization.findUnique({
      where: { id: proposal.prospectOrgId },
      select: { id: true },
    });
    if (existing) {
      await tx.organization.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId: args.stripeCustomerId,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionStartedAt: new Date(),
        },
      });
      await markAcceptanceProvisioned(tx, proposal.id, existing.id);
      return { orgId: existing.id, created: false };
    }
  }

  // ── Fresh-tenant path ─────────────────────────────────────────────
  const tierLine = proposal.lineItems.find((l) => l.kind === "TIER");
  const tier = tierFromCatalogSlug(tierLine?.catalogItem?.slug ?? null);

  const slugSource =
    proposal.prospectCompany?.trim() ||
    proposal.prospectName.trim() ||
    `proposal-${proposal.number}`;
  const slug = await pickUniqueSlug(tx, slugSource);

  const created = await tx.organization.create({
    data: {
      name: proposal.prospectCompany?.trim() || proposal.prospectName,
      shortName:
        (proposal.prospectCompany?.trim() || proposal.prospectName).split(
          /\s+/,
        )[0] ?? null,
      slug,
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      status: TenantStatus.CONTRACT_SIGNED,
      primaryContactName: proposal.prospectName,
      primaryContactEmail: proposal.prospectEmail,
      stripeCustomerId: args.stripeCustomerId,
      subscriptionTier: tier,
      subscriptionStatus: proposal.trialDays > 0
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE,
      subscriptionStartedAt: new Date(),
    },
    select: { id: true },
  });

  await markAcceptanceProvisioned(tx, proposal.id, created.id);

  return { orgId: created.id, created: true };
}

async function markAcceptanceProvisioned(
  tx: TxClient,
  proposalId: string,
  orgId: string,
): Promise<void> {
  // Update by proposalId — the `ProposalAcceptance.proposalId` column has
  // a unique constraint, so this is a stable lookup. We do NOT set
  // provisionedAt here; the orchestrator sets it after the post-org steps
  // (Clerk invite, welcome email) run, so a partial run is visible in
  // the admin dashboard.
  // The Checked update input requires the relation form (`provisionedOrg:
  // { connect }`) rather than the raw FK. The Unchecked variant takes the
  // FK directly — we use that here since we only care about a single
  // scalar mutation, no relation cascading needed.
  await tx.proposalAcceptance.update({
    where: { proposalId },
    data: {
      provisionedOrgId: orgId,
    } satisfies Prisma.ProposalAcceptanceUncheckedUpdateInput,
  });
}
