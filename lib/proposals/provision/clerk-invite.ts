import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Clerk invitation for an auto-provisioned tenant.
//
// Mirrors `lib/actions/convert-intake.ts` Step 2 + 3 closely:
//
//   1. Create the Clerk Organization (named after the LeaseStack Org) so
//      the prospect lands in a single-tenant Clerk org on first login.
//   2. Issue a Clerk invitation with `notify: false` and `ignoreExisting:
//      true` so a re-run (Stripe retry; idempotent by design) doesn't
//      throw "invitation already exists". We send our own branded welcome
//      email separately.
//
// Idempotency:
//   - `clerkOrgId` is stored on the Organization. If it's already populated
//     we re-use it and skip the create. Clerk's `createOrganization` is
//     NOT idempotent by name, so this defensive check matters on retry.
//   - `ignoreExisting: true` on the invitation guarantees a second call
//     returns the existing invitation row instead of throwing.
//
// Non-fatal: every Clerk error is logged + returned in the `error` field so
// the orchestrator can mark provisioning complete anyway. The operator can
// retry from the admin UI; the email already promised a portal so blocking
// the flow on a Clerk hiccup would be worse than continuing.
// ---------------------------------------------------------------------------

export type InviteOwnerArgs = {
  orgId: string;
  prospectEmail: string;
  prospectName: string;
};

export type InviteOwnerResult =
  | { ok: true; clerkOrgId: string; inviteAcceptUrl: string | null }
  | { ok: false; error: string };

export async function inviteOwnerForProvisionedOrg(
  args: InviteOwnerArgs,
): Promise<InviteOwnerResult> {
  const org = await prisma.organization.findUnique({
    where: { id: args.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      clerkOrgId: true,
    },
  });
  if (!org) {
    return { ok: false, error: `Organization ${args.orgId} not found` };
  }

  let client;
  try {
    client = await clerkClient();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Clerk client unavailable: ${err.message}`
          : "Clerk client unavailable",
    };
  }

  // ── Step 1: Clerk Organization (idempotent on our side) ────────────
  let clerkOrgId = org.clerkOrgId;
  if (!clerkOrgId) {
    try {
      // No `createdBy` here — proposals are pre-signup, so the prospect
      // doesn't have a Clerk user yet. Clerk allows omitting createdBy,
      // leaving the org membership empty until the invitee accepts.
      const clerkOrg = await client.organizations.createOrganization({
        name: org.name,
        slug: org.slug,
      });
      clerkOrgId = clerkOrg.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { clerkOrgId },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Clerk createOrganization failed";
      return { ok: false, error: `Clerk org creation failed: ${message}` };
    }
  }

  // ── Step 2: Invitation ─────────────────────────────────────────────
  let inviteAcceptUrl: string | null = null;
  // Track whether we created the Clerk org in THIS call so we can roll
  // back on invitation failure. If clerkOrgId was already populated
  // before this call, we leave it alone — operator may have invited
  // someone else previously and we shouldn't drop their org.
  const createdClerkOrgThisCall = !org.clerkOrgId && clerkOrgId !== null;
  try {
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/redirect`;
    const invitation = await client.invitations.createInvitation({
      emailAddress: args.prospectEmail,
      publicMetadata: { orgId: org.id, role: "CLIENT_OWNER" },
      redirectUrl: redirectUrl || undefined,
      ignoreExisting: true,
      notify: false,
    });
    inviteAcceptUrl = invitation.url ?? null;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Clerk invitation failed";
    // Orphan cleanup: if we just created the Clerk org on this call AND
    // the invitation failed, drop the empty Clerk org + clear the
    // clerkOrgId pointer so a retry doesn't reuse a half-baked
    // organization (or pile up empty orgs in Clerk). Cleanup is
    // best-effort; we log + continue if it fails so the original
    // invitation error is the one surfaced to the operator.
    if (createdClerkOrgThisCall && clerkOrgId) {
      try {
        await client.organizations.deleteOrganization(clerkOrgId);
      } catch (cleanupErr) {
        console.error(
          `[provision/clerk-invite] failed to delete orphan Clerk org ${clerkOrgId}:`,
          cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
        );
      }
      try {
        await prisma.organization.update({
          where: { id: org.id },
          data: { clerkOrgId: null },
        });
      } catch (dbErr) {
        console.error(
          `[provision/clerk-invite] failed to clear clerkOrgId on org ${org.id}:`,
          dbErr instanceof Error ? dbErr.message : dbErr,
        );
      }
    }
    return {
      ok: false,
      error: `Clerk invitation failed: ${message}`,
    };
  }

  return { ok: true, clerkOrgId, inviteAcceptUrl };
}
