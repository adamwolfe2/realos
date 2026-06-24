"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  AuditAction,
  NoteType,
  OrgType,
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  SubscriptionTier,
  TenantStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireAgency,
  ForbiddenError,
  auditPayload,
  type ScopedContext,
} from "@/lib/tenancy/scope";
import {
  sendClientPortalReadyEmail,
  sendTeammateInviteEmail,
} from "@/lib/email/onboarding-emails";
import { getDefaultProjectTasks } from "@/lib/build/default-tasks";
import {
  pickUniqueSlug,
  deriveSlug,
  deriveModuleFlags,
} from "@/lib/actions/client-provisioning";

// ---------------------------------------------------------------------------
// Admin action: create a CLIENT Organization FROM SCRATCH — no IntakeSubmission
// required. This is the white-glove path the agency uses to stand up an
// incoming client end-to-end in one step: org + 28-task build checklist +
// tenantSiteConfig + (optional) first property + Clerk org + (optional) owner
// invitation.
//
// Mirrors convertIntakeToClient's ordering exactly: DB rows first
// (transactional), then Clerk (can't join a Prisma tx), then best-effort
// emails. If Clerk fails we flag the org AT_RISK + log a ClientNote rather than
// unwinding, so the operator can retry from /admin/clients/[id].
// ---------------------------------------------------------------------------

const MODULE_KEYS = [
  "website",
  "leadCapture",
  "pixel",
  "chatbot",
  "googleAds",
  "metaAds",
  "seo",
  "email",
  "outboundEmail",
  "referrals",
  "creativeStudio",
] as const;

const inputSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  shortName: z.string().trim().max(60).optional().or(z.literal("")),
  propertyType: z.nativeEnum(PropertyType),
  residentialSubtype: z.nativeEnum(ResidentialSubtype).optional().nullable(),
  commercialSubtype: z.nativeEnum(CommercialSubtype).optional().nullable(),
  primaryContactName: z.string().trim().min(2, "Contact name is required").max(120),
  primaryContactEmail: z.string().trim().email("Valid email required").max(160),
  primaryContactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  primaryContactRole: z.string().trim().max(80).optional().or(z.literal("")),
  hqCity: z.string().trim().max(80).optional().or(z.literal("")),
  hqState: z.string().trim().max(40).optional().or(z.literal("")),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
  subscriptionTier: z.nativeEnum(SubscriptionTier).optional().nullable(),
  firstPropertyName: z.string().trim().max(120).optional().or(z.literal("")),
  firstPropertyCity: z.string().trim().max(80).optional().or(z.literal("")),
  firstPropertyState: z.string().trim().max(40).optional().or(z.literal("")),
  sendInvite: z.boolean().default(true),
});

export type CreateClientInput = z.input<typeof inputSchema>;

export type CreateClientResult =
  | {
      ok: true;
      orgId: string;
      slug: string;
      clerkOrgId: string | null;
      /** Non-fatal issues (e.g. invite email failed) — org WAS created. */
      warnings: string[];
    }
  | { ok: false; error: string; orgId?: string };

const blank = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

export async function createClientDirect(
  raw: unknown,
): Promise<CreateClientResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const input = parsed.data;
  const email = input.primaryContactEmail.toLowerCase();

  // Duplicate-org guard: block if a CLIENT org already exists for this email.
  const existingOrg = await prisma.organization.findFirst({
    where: { orgType: OrgType.CLIENT, primaryContactEmail: email },
    select: { id: true, name: true, slug: true },
  });
  if (existingOrg) {
    return {
      ok: false,
      error: `A client org already exists for ${email} (${existingOrg.name} · ${existingOrg.slug}). Open that client instead of creating a duplicate.`,
      orgId: existingOrg.id,
    };
  }

  const slug = await pickUniqueSlug(input.shortName || input.companyName);
  const modules = deriveModuleFlags(input.modules);
  const defaultTasks = getDefaultProjectTasks();

  const wantsProperty = !!blank(input.firstPropertyName);
  const propertyName = blank(input.firstPropertyName);

  // Step 1: org + project (28-task checklist) + tenantSiteConfig + optional
  // first property, all in one transaction.
  let org: { id: string; name: string; slug: string };
  try {
    org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: input.companyName,
          shortName: blank(input.shortName),
          slug,
          orgType: OrgType.CLIENT,
          propertyType: input.propertyType,
          residentialSubtype: input.residentialSubtype ?? null,
          commercialSubtype: input.commercialSubtype ?? null,
          status: TenantStatus.CONTRACT_SIGNED,
          primaryContactName: input.primaryContactName,
          primaryContactEmail: email,
          primaryContactPhone: blank(input.primaryContactPhone),
          primaryContactRole: blank(input.primaryContactRole),
          hqCity: blank(input.hqCity),
          hqState: blank(input.hqState),
          subscriptionTier: input.subscriptionTier ?? null,
          bringYourOwnSite: true,
          ...modules,
          tenantSiteConfig: {
            create: {
              siteTitle: input.companyName,
              primaryCtaText: "Apply Now",
              showListings: true,
              showFloorPlans: true,
              showAmenities: true,
              enableExitIntent: true,
            },
          },
        },
        select: { id: true, name: true, slug: true },
      });

      await tx.project.create({
        data: {
          orgId: created.id,
          name: `${created.name} Build`,
          description: "Tenant onboarding checklist",
          status: "active",
          startedAt: new Date(),
          tasks: {
            createMany: {
              data: defaultTasks.map((t, idx) => ({
                title: t.label,
                description: t.description ?? null,
                phase: t.phase != null ? String(t.phase) : null,
                sortOrder: idx,
              })),
            },
          },
        },
      });

      if (wantsProperty && propertyName) {
        await tx.property.create({
          data: {
            orgId: created.id,
            name: propertyName,
            slug: deriveSlug(propertyName),
            propertyType: input.propertyType,
            residentialSubtype: input.residentialSubtype ?? null,
            commercialSubtype: input.commercialSubtype ?? null,
            city: blank(input.firstPropertyCity),
            state: blank(input.firstPropertyState),
          },
        });
      }

      await tx.auditEvent.create({
        data: auditPayload({ ...scope, orgId: created.id } as ScopedContext, {
          action: AuditAction.CREATE,
          entityType: "Organization",
          entityId: created.id,
          description: `Created client ${created.name} (${created.slug}) directly via admin`,
          diff: {
            slug: created.slug,
            modules: input.modules,
            firstProperty: propertyName ?? null,
          } as Prisma.InputJsonValue,
        }),
      });

      return created;
    });
  } catch (err) {
    console.error("createClientDirect: DB transaction failed", err);
    // P2002 = unique constraint violation. The only user-facing unique field
    // here is Organization.slug — a concurrent create raced us to the same
    // slug between pickUniqueSlug() and the insert (TOCTOU). Surface a clean,
    // retryable message rather than leaking the Prisma internals.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        error:
          "That workspace URL was just taken by another submission. Try again — a fresh one will be generated.",
      };
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Failed to create organization: ${err.message}`
          : "Failed to create organization",
    };
  }

  // Step 2: create the Clerk organization. Failure flags AT_RISK + logs a
  // note for retry; we do not unwind the org.
  let clerkOrgId: string | null = null;
  try {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.createOrganization({
      name: org.name,
      slug: org.slug,
      createdBy: scope.clerkUserId,
    });
    clerkOrgId = clerkOrg.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { clerkOrgId },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Clerk organization creation failed";
    console.error("createClientDirect: Clerk createOrganization failed", err);
    try {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          status: TenantStatus.AT_RISK,
          atRiskReason: `Clerk org provisioning failed: ${message}`,
        },
      });
      await prisma.clientNote.create({
        data: {
          orgId: org.id,
          authorUserId: scope.userId,
          noteType: NoteType.SUPPORT,
          body: `Clerk organization could not be created during admin client creation. Error: ${message}`,
          pinned: true,
        },
      });
    } catch (noteErr) {
      console.error("createClientDirect: failed to write at-risk note", noteErr);
    }
    revalidatePath("/admin/clients");
    return {
      ok: false,
      error: `Client org created, but Clerk provisioning failed: ${message}`,
      orgId: org.id,
    };
  }

  // Step 3 + 4: invite the primary contact (best-effort). Skipped when the
  // operator unchecks "send invite" (e.g. they'll invite the owner later or
  // are setting up a demo tenant). Failures here do NOT unwind the org, but we
  // collect them as warnings so the operator isn't told "invite sent" when it
  // silently failed (they can resend from the client detail page).
  const warnings: string[] = [];
  if (input.sendInvite) {
    let inviteAcceptUrl: string | null = null;
    try {
      const client = await clerkClient();
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/redirect`;
      const invitation = await client.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { orgId: org.id, role: "CLIENT_OWNER" },
        redirectUrl: redirectUrl || undefined,
        ignoreExisting: true,
        notify: false,
      });
      inviteAcceptUrl = invitation.url ?? null;
    } catch (err) {
      console.warn("createClientDirect: Clerk invitation failed (continuing)", err);
      warnings.push("Clerk invitation could not be created — resend from the client page.");
    }

    try {
      const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign-up`;
      await sendTeammateInviteEmail({
        to: email,
        orgName: org.name,
        role: "CLIENT_OWNER",
        acceptUrl: inviteAcceptUrl ?? fallbackUrl,
        inviterName: null,
        inviterEmail: null,
      });
    } catch (err) {
      console.warn("createClientDirect: invite email failed (continuing)", err);
      warnings.push("Invite email failed to send — resend from the client page.");
    }

    try {
      await sendClientPortalReadyEmail({
        to: email,
        contactName: input.primaryContactName,
        orgName: org.name,
        orgSlug: org.slug,
      });
    } catch (err) {
      console.warn("createClientDirect: portal-ready email failed (continuing)", err);
    }
  }

  revalidatePath("/admin/clients");
  return { ok: true, orgId: org.id, slug: org.slug, clerkOrgId, warnings };
}
