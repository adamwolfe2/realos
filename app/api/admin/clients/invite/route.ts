import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  auditPayload,
  ForbiddenError,
  type ScopedContext,
} from "@/lib/tenancy/scope";
import { AuditAction, OrgType, UserRole } from "@prisma/client";
import { sendTeammateInviteEmail } from "@/lib/email/onboarding-emails";

const CLIENT_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
  UserRole.LEASING_AGENT,
]);

const AGENCY_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

const body = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum([
    "CLIENT_OWNER",
    "CLIENT_ADMIN",
    "CLIENT_VIEWER",
    "LEASING_AGENT",
    "CLIENT",
    "SALES_REP",
  ]),
  organizationId: z.string().min(1),
  // Optional property-level access list. When omitted or empty, the
  // invitee gets unrestricted org-wide access (legacy behavior). When
  // populated, they can ONLY see those properties' data — used to
  // invite, e.g., the Telegraph Commons team to an SG Real Estate org
  // without exposing the rest of the portfolio.
  propertyIds: z.array(z.string().min(1)).optional(),
});

// Legacy roles sent by the older InviteClientDialog get normalized to the
// current enum so the UI keeps working.
function normalizeRole(input: z.infer<typeof body>["role"]): UserRole {
  if (input === "CLIENT") return UserRole.CLIENT_OWNER;
  if (input === "SALES_REP") return UserRole.AGENCY_OPERATOR;
  return input as UserRole;
}

export async function POST(req: NextRequest) {
  let scope: ScopedContext;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  const email = parsed.email.toLowerCase();
  const role = normalizeRole(parsed.role);
  const firstName = parsed.name?.split(" ").slice(0, -1).join(" ") || parsed.name || null;
  const lastName =
    (parsed.name?.split(" ").length ?? 0) > 1
      ? (parsed.name?.split(" ").slice(-1)[0] ?? null)
      : null;

  const org = await prisma.organization.findUnique({
    where: { id: parsed.organizationId },
    select: { id: true, name: true, orgType: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (org.orgType !== OrgType.CLIENT) {
    return NextResponse.json(
      { error: "Can only invite users to CLIENT organizations" },
      { status: 400 }
    );
  }

  // Authorization:
  //   Agency actors can invite any role into any client org.
  //   Client actors (CLIENT_OWNER or CLIENT_ADMIN) can invite client-team roles
  //   only, and only into their own org.
  const caller = await prisma.user.findUnique({
    where: { clerkUserId: scope.clerkUserId },
    select: { role: true, orgId: true, firstName: true, lastName: true, email: true },
  });
  const callerIsAgency = !!caller && AGENCY_ROLES.has(caller.role);
  if (!callerIsAgency) {
    if (!caller || caller.orgId !== org.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (caller.role !== UserRole.CLIENT_OWNER && caller.role !== UserRole.CLIENT_ADMIN) {
      return NextResponse.json(
        { error: "Only Owners or Admins can invite teammates." },
        { status: 403 }
      );
    }
    if (!CLIENT_ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: "You can only invite client-team roles." },
        { status: 400 }
      );
    }
  }

  // Validate property ids belong to the target org BEFORE we touch
  // anything. A malformed list shouldn't half-create a user — we want
  // an atomic "either this whole invite is valid or none of it is."
  const requestedPropertyIds = parsed.propertyIds ?? [];
  let validPropertyIds: string[] = [];
  if (requestedPropertyIds.length > 0) {
    const found = await prisma.property.findMany({
      where: { id: { in: requestedPropertyIds }, orgId: org.id },
      select: { id: true },
    });
    validPropertyIds = found.map((p) => p.id);
    if (validPropertyIds.length !== requestedPropertyIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected properties don't belong to this organization.",
        },
        { status: 400 },
      );
    }
  }

  // Pre-create or update the DB User row so /api/auth/role can claim it by
  // email on first sign-in, even if the Clerk webhook isn't wired up yet.
  const pendingId = `seed_pending_${email}`;
  const existing = await prisma.user.findUnique({ where: { email } });
  let userId: string;
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        orgId: org.id,
        role,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
      },
    });
    userId = updated.id;
  } else {
    const created = await prisma.user.create({
      data: {
        clerkUserId: pendingId,
        email,
        firstName,
        lastName,
        role,
        orgId: org.id,
      },
    });
    userId = created.id;
  }

  // Replace any existing property access for this user with the new
  // selection. Do it as a delete-then-create so the row set is exactly
  // what was requested — easier mental model than diffing.
  //   * Empty selection => unrestricted (no rows).
  //   * Non-empty selection => restricted to those properties only.
  // Wrapped in a transaction so a failure during create doesn't leave
  // the user with zero rows (which would silently widen them).
  await prisma.$transaction(async (tx) => {
    await tx.userPropertyAccess.deleteMany({ where: { userId } });
    if (validPropertyIds.length > 0) {
      await tx.userPropertyAccess.createMany({
        data: validPropertyIds.map((propertyId) => ({
          userId,
          propertyId,
          grantedBy: scope.userId,
        })),
      });
    }
  });

  // Best-effort Clerk invitation. We pass `notify: false` so Clerk does NOT
  // send its own (un-brandable) email. We then send a LeaseStack-branded
  // Resend email that explicitly names the inviting organization. Skips
  // silently when Clerk isn't fully configured so the DB seed still lets
  // operators onboard via manual /sign-up.
  let clerkInviteSent = false;
  let clerkError: string | null = null;
  let acceptUrl: string | null = null;
  try {
    const client = await clerkClient();
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/redirect`;
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { orgId: org.id, role },
      redirectUrl: redirectUrl || undefined,
      ignoreExisting: true,
      notify: false,
    });
    acceptUrl = invitation.url ?? null;
    clerkInviteSent = true;
  } catch (err) {
    clerkError = err instanceof Error ? err.message : "Clerk invitation failed";
    console.warn("[invite] Clerk invitation failed (continuing):", clerkError);
  }

  // Send our own LeaseStack-branded invitation email naming the inviting org.
  // Falls back to /sign-up?email=… when Clerk did not return a ready-to-
  // accept ticket URL (e.g. Clerk skipped because the user already exists,
  // or Clerk isn't configured). The pre-filled email means the invitee
  // never sees a "couldn't find your account" dead-end on /sign-in even
  // when the Clerk one-click URL is unavailable.
  let inviteEmailSent = false;
  let inviteEmailError: string | null = null;
  try {
    const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign-up?email=${encodeURIComponent(email)}`;
    const inviterName =
      [caller?.firstName, caller?.lastName].filter(Boolean).join(" ").trim() ||
      null;
    const result = await sendTeammateInviteEmail({
      to: email,
      orgName: org.name,
      role,
      acceptUrl: acceptUrl ?? fallbackUrl,
      inviterName,
      inviterEmail: caller?.email ?? null,
    });
    if (result.ok) {
      inviteEmailSent = true;
    } else {
      inviteEmailError = result.error ?? "Email send failed";
      console.warn("[invite] LeaseStack invitation email failed:", inviteEmailError);
    }
  } catch (err) {
    inviteEmailError =
      err instanceof Error ? err.message : "LeaseStack invitation email failed";
    console.warn("[invite] LeaseStack invitation email threw:", inviteEmailError);
  }

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: org.id },
      {
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: userId,
        description: `Invited ${email} to ${org.name} as ${role}${
          inviteEmailSent ? "" : " (invite email not sent)"
        }`,
      }
    ),
  });

  // Always return the best-available link so the UI can offer a manual
  // copy fallback when the email failed (Resend mis-config, domain not
  // verified, recipient bouncing, etc.). Prefer the Clerk one-click accept
  // URL; fall back to /sign-up?email=… so the invitee lands on a form
  // pre-filled with their email. The DB row we created above is keyed by
  // email, so /api/auth/role will claim it on first sign-up regardless of
  // which path they take.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fallbackSignUp = `${baseUrl}/sign-up?email=${encodeURIComponent(email)}`;
  const inviteLink = acceptUrl ?? fallbackSignUp;

  return NextResponse.json({
    ok: true,
    userId,
    clerkInviteSent,
    clerkError,
    inviteEmailSent,
    inviteEmailError,
    inviteLink,
    signUpUrl: fallbackSignUp,
  });
}
