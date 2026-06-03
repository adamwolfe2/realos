import "server-only";
import type { ProposalAcceptance } from "@prisma/client";
import { prisma } from "@/lib/db";
import { captureWithContext } from "@/lib/sentry";
import { provisionOrgForAcceptance } from "./org";
import { inviteOwnerForProvisionedOrg } from "./clerk-invite";
import { sendWelcomeEmail } from "./welcome-email";

// ---------------------------------------------------------------------------
// Provisioning orchestrator — the single entry point the Stripe webhook
// hits AFTER it has created the ProposalAcceptance row inside its own
// `processStripeEventOnce` transaction (see app/api/webhooks/stripe).
//
// Why we trust the webhook's outer dedupe:
//
//   The webhook handler already wraps the full "accept → provision" flow in
//   processStripeEventOnce(eventId), and that wrapper opens the Prisma
//   transaction. We can't run Clerk/Resend inside a Prisma transaction
//   (they're HTTP, they can't roll back). So we split:
//
//     INSIDE  the webhook's transaction:  org create + provisionedOrgId
//     OUTSIDE the webhook's transaction:  Clerk org + invite + welcome email
//                                         + provisionedAt timestamp
//
//   The webhook calls this function once per accepted event. It MUST be
//   invoked with the just-created `acceptance` row so we know which
//   stripeCustomerId to attach the org to. The eventId is captured for
//   audit / Sentry tagging only.
//
// Idempotency: provisionOrgForAcceptance is internally idempotent — if a
// previous run already set ProposalAcceptance.provisionedOrgId we re-use
// it without re-creating the Organization.
//
// Why we still set `provisionedAt`:
//
//   The admin UI renders a "Provisioned <ago>" pill keyed off provisionedAt.
//   Without it, even successful provisionings would look stuck. We mark
//   provisionedAt regardless of Clerk / Resend outcome — the operator can
//   replay secondary steps from the admin "Retry provisioning" button.
// ---------------------------------------------------------------------------

export type RunProvisioningArgs = {
  proposalId: string;
  /** Stripe event id, captured for Sentry context. */
  eventId: string;
  /** Stripe event type — accepted for forwards-compatibility; not used here. */
  eventType?: string;
  /**
   * The ProposalAcceptance row created by the webhook handler. Carries the
   * stripeCustomerId + stripeSubscriptionId we need to attach to the
   * provisioned Organization. Either this OR the raw stripeCustomerId /
   * stripeSubscriptionId pair must be supplied.
   */
  acceptance?: Pick<
    ProposalAcceptance,
    "stripeCustomerId" | "stripeSubscriptionId" | "provisionedOrgId"
  >;
  /** Raw Stripe customer id (alternative to `acceptance`). */
  stripeCustomerId?: string;
  /** Raw Stripe subscription id (alternative to `acceptance`). */
  stripeSubscriptionId?: string | null;
};

export type RunProvisioningResult = {
  orgId: string;
  clerkOrgId: string | null;
  warnings: string[];
};

/**
 * End-to-end provisioning for an accepted proposal. Assumes the caller is
 * already inside a `processStripeEventOnce` dedupe boundary — we do NOT
 * call it again here.
 */
export async function runProvisioningForProposal(
  args: RunProvisioningArgs,
): Promise<RunProvisioningResult> {
  const warnings: string[] = [];

  // Resolve customer + sub ids from whichever input the caller supplied.
  // If neither acceptance nor raw ids landed (shouldn't happen but cheap
  // to guard) fall back to reading the row directly.
  let stripeCustomerId =
    args.acceptance?.stripeCustomerId ?? args.stripeCustomerId ?? null;
  let stripeSubscriptionId =
    args.acceptance?.stripeSubscriptionId ?? args.stripeSubscriptionId ?? null;
  if (!stripeCustomerId) {
    const row = await prisma.proposalAcceptance.findUnique({
      where: { proposalId: args.proposalId },
      select: { stripeCustomerId: true, stripeSubscriptionId: true },
    });
    stripeCustomerId = row?.stripeCustomerId ?? null;
    stripeSubscriptionId = row?.stripeSubscriptionId ?? null;
  }
  if (!stripeCustomerId) {
    throw new Error(
      `runProvisioningForProposal: no stripeCustomerId available for proposal ${args.proposalId}`,
    );
  }

  // ── Step 1: org create (idempotent on existing provisionedOrgId) ──
  // Uses the global `prisma` client rather than a passed-in transaction
  // because the org create itself is a single statement; the higher-level
  // dedupe + acceptance write fence still holds at the webhook layer.
  const { orgId } = await provisionOrgForAcceptance(prisma, {
    proposalId: args.proposalId,
    stripeCustomerId,
    stripeSubscriptionId,
  });

  // ── Step 2: Clerk org + invitation (non-fatal) ────────────────────
  let clerkOrgId: string | null = null;
  let inviteAcceptUrl: string | null = null;

  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: { prospectEmail: true, prospectName: true },
  });
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true, clerkOrgId: true },
  });

  if (proposal && org) {
    const inviteResult = await inviteOwnerForProvisionedOrg({
      orgId,
      prospectEmail: proposal.prospectEmail,
      prospectName: proposal.prospectName,
    });
    if (inviteResult.ok) {
      clerkOrgId = inviteResult.clerkOrgId;
      inviteAcceptUrl = inviteResult.inviteAcceptUrl;
    } else {
      warnings.push(`clerk_invite: ${inviteResult.error}`);
      captureWithContext(new Error(inviteResult.error), {
        proposalId: args.proposalId,
        orgId,
        eventId: args.eventId,
        step: "clerk_invite",
      });
    }

    // ── Step 3: Welcome email (non-fatal) ──────────────────────────
    const emailResult = await sendWelcomeEmail({
      prospectEmail: proposal.prospectEmail,
      prospectName: proposal.prospectName,
      orgName: org.name,
      orgSlug: org.slug,
      inviteAcceptUrl,
    });
    if (!emailResult.ok) {
      warnings.push(`welcome_email: ${emailResult.error}`);
      captureWithContext(new Error(emailResult.error), {
        proposalId: args.proposalId,
        orgId,
        eventId: args.eventId,
        step: "welcome_email",
      });
    }
  } else {
    warnings.push("post_provision_lookup_missing");
  }

  // ── Step 4: mark provisionedAt regardless of secondary outcomes ──
  try {
    await prisma.proposalAcceptance.update({
      where: { proposalId: args.proposalId },
      data: { provisionedAt: new Date() },
    });
  } catch (err) {
    warnings.push(
      `provisioned_at_update: ${err instanceof Error ? err.message : String(err)}`,
    );
    captureWithContext(err, {
      proposalId: args.proposalId,
      orgId,
      eventId: args.eventId,
      step: "provisioned_at",
    });
  }

  return { orgId, clerkOrgId, warnings };
}
