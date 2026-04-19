import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { requireAgency, auditPayload, ForbiddenError } from "@/lib/tenancy/scope";
import { AuditAction, UserRole } from "@prisma/client";

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
});

// Legacy roles sent by the older InviteClientDialog get normalized to the
// current enum so the UI keeps working.
function normalizeRole(input: z.infer<typeof body>["role"]): UserRole {
  if (input === "CLIENT") return UserRole.CLIENT_OWNER;
  if (input === "SALES_REP") return UserRole.AGENCY_OPERATOR;
  return input as UserRole;
}

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireAgency();
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
  if (org.orgType !== "CLIENT") {
    return NextResponse.json(
      { error: "Can only invite users to CLIENT organizations" },
      { status: 400 }
    );
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

  // Best-effort Clerk invitation — sends the sign-up email. Skips silently
  // when Clerk isn't fully configured (e.g. Resend not set up yet) so the
  // DB seed still lets operators onboard via manual /sign-up.
  let clerkInviteSent = false;
  let clerkError: string | null = null;
  try {
    const client = await clerkClient();
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/redirect`;
    await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { orgId: org.id, role },
      redirectUrl: redirectUrl || undefined,
      ignoreExisting: true,
    });
    clerkInviteSent = true;
  } catch (err) {
    clerkError = err instanceof Error ? err.message : "Clerk invitation failed";
    console.warn("[invite] Clerk invitation failed (continuing):", clerkError);
  }

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: org.id },
      {
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: userId,
        description: `Invited ${email} to ${org.name} as ${role}${
          clerkInviteSent ? "" : " (Clerk email not sent)"
        }`,
      }
    ),
  });

  return NextResponse.json({
    ok: true,
    userId,
    clerkInviteSent,
    clerkError,
    signUpUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign-up`,
  });
}
