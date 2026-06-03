import { NextResponse, type NextRequest } from "next/server";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import {
  createCheckoutSessionForProposal,
  ProposalCheckoutValidationError,
} from "@/lib/proposals/build-checkout-session";
import {
  checkRateLimit,
  getIp,
  proposalAcceptLimiter,
  rateLimited,
} from "@/lib/rate-limit";
import { captureWithContext } from "@/lib/sentry";

// ---------------------------------------------------------------------------
// Public accept-and-pay endpoint for /proposal/[token].
//
// Flow:
//   1. Resolve token (anti-enumeration — null for not-found/revoked/expired).
//   2. Load the proposal + its line items.
//   3. Validate status is SENT or VIEWED — anything else collapses to 404
//      so a probe can't tell if a proposal is already ACCEPTED / VOIDED
//      via the same token (success page handles the accepted case on a
//      revoked-after-accept token, this route does not).
//   4. Build the Stripe Checkout session via the shared lib (handles
//      customer reuse, idempotency keys, mode selection, trials, discounts).
//   5. Persist stripeCustomerId + stripeCheckoutId on the proposal so the
//      admin UI shows the link and the webhook handlers can correlate.
//   6. Return `{ redirectUrl }`; the client navigates from there.
//
// Rate limit: 5/min/IP — the most expensive endpoint in the proposal flow.
// Errors:
//   - 404 for any token / status problem (no oracle)
//   - 422 for ProposalCheckoutValidationError (e.g. mixed proposals)
//   - 500 + Sentry on anything else
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.leasestack.co";
  return raw.replace(/\/+$/, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(
    proposalAcceptLimiter,
    `proposal-accept:${ip}`,
  );
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60) as NextResponse;
  }

  let token: string;
  try {
    ({ token } = await params);
  } catch (err) {
    captureWithContext(err, { route: "api/proposals/[token]/accept" });
    return new NextResponse(null, { status: 404 });
  }

  const resolved = await resolveLiveShareToken(token);
  if (!resolved) {
    return new NextResponse(null, { status: 404 });
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: resolved.proposalId },
    include: { lineItems: true },
  });
  if (!proposal) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    proposal.status !== ProposalStatus.SENT &&
    proposal.status !== ProposalStatus.VIEWED
  ) {
    // Already accepted / declined / expired / voided / draft — no oracle.
    return new NextResponse(null, { status: 404 });
  }

  const base = getAppBaseUrl();
  const successUrl = `${base}/proposal/${encodeURIComponent(token)}/success`;
  const cancelUrl = `${base}/proposal/${encodeURIComponent(token)}?canceled=1`;

  let result;
  try {
    result = await createCheckoutSessionForProposal({
      proposal,
      successUrl,
      cancelUrl,
    });
  } catch (err) {
    if (err instanceof ProposalCheckoutValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    captureWithContext(err, {
      route: "api/proposals/[token]/accept",
      proposalId: proposal.id,
    });
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 },
    );
  }

  if (!result.session.url) {
    captureWithContext(
      new Error("Stripe Checkout session returned without a url"),
      {
        route: "api/proposals/[token]/accept",
        proposalId: proposal.id,
        sessionId: result.session.id,
      },
    );
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 },
    );
  }

  // Persist Stripe state on the proposal so admin UI + webhook handlers can
  // correlate. Build an explicit data object so we don't accidentally write
  // a null over a previously valid customer id on a regenerated session.
  try {
    const updateData: Parameters<typeof prisma.proposal.update>[0]["data"] = {
      stripeCheckoutId: result.session.id,
    };
    if (result.stripeCustomerId) {
      updateData.stripeCustomerId = result.stripeCustomerId;
    }
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: updateData,
    });
  } catch (err) {
    // Non-fatal: Stripe created the session, the client can still pay. Log
    // for admin reconciliation but don't block the redirect.
    captureWithContext(err, {
      route: "api/proposals/[token]/accept",
      proposalId: proposal.id,
      handler: "persist-stripe-refs",
    });
  }

  return NextResponse.json({ redirectUrl: result.session.url });
}
