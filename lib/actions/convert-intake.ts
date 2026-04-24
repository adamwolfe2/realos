"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import {
  AuditAction,
  NoteType,
  OrgType,
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
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
import { sendClientPortalReadyEmail } from "@/lib/email/onboarding-emails";

// ---------------------------------------------------------------------------
// Admin action: convert an IntakeSubmission into a fully provisioned CLIENT
// Organization + Clerk org + invitation to the primary contact.
//
// Ordering matters: DB rows first (transactional), then Clerk. Clerk can't
// participate in Prisma transactions so we accept a brief window where the
// Organization exists without a clerkOrgId. If the Clerk call fails we flag
// the org status = AT_RISK and log a ClientNote so the operator can retry.
// The invitation send is best-effort — a failure there logs a warning but
// does not unwind the org.
// ---------------------------------------------------------------------------

export type ConvertIntakeSuccess = {
  ok: true;
  orgId: string;
  clerkOrgId: string | null;
};

export type ConvertIntakeFailure = {
  ok: false;
  error: string;
  orgId?: string;          // Set when the org was created but Clerk failed
  clerkOrgId?: string | null;
};

export type ConvertIntakeResult =
  | ConvertIntakeSuccess
  | ConvertIntakeFailure;

export type RejectIntakeResult =
  | { ok: true }
  | { ok: false; error: string };

const SLUG_MAX = 60;
const SLUG_COLLISION_MAX = 50;

function deriveSlug(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
  return base || "tenant";
}

async function pickUniqueSlug(companyName: string): Promise<string> {
  const base = deriveSlug(companyName);
  let candidate = base;
  let n = 2;
  while (n <= SLUG_COLLISION_MAX + 1) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    n += 1;
  }
  throw new Error("Could not generate a unique tenant slug");
}

function deriveModuleFlags(selectedModules: unknown): {
  moduleWebsite: boolean;
  modulePixel: boolean;
  moduleChatbot: boolean;
  moduleGoogleAds: boolean;
  moduleMetaAds: boolean;
  moduleSEO: boolean;
  moduleEmail: boolean;
  moduleOutboundEmail: boolean;
  moduleReferrals: boolean;
  moduleCreativeStudio: boolean;
  moduleLeadCapture: boolean;
} {
  const selected = Array.isArray(selectedModules)
    ? selectedModules.filter((m): m is string => typeof m === "string")
    : [];
  const has = (key: string) => selected.includes(key);
  // DECISION: website + leadCapture are Core features (every operator gets
  // them, they're bundled in the base retainer). The intake UI marks them as
  // "Core" in MODULE_CATALOG. We force them on server-side so a prospect who
  // accidentally toggled them off still gets them provisioned.
  return {
    moduleWebsite: true,
    moduleLeadCapture: true,
    modulePixel: has("pixel"),
    moduleChatbot: has("chatbot"),
    // Support both snake_case and camelCase for safety across intake versions.
    moduleGoogleAds: has("google_ads") || has("googleAds"),
    moduleMetaAds: has("meta_ads") || has("metaAds"),
    moduleSEO: has("seo"),
    moduleEmail: has("email"),
    moduleOutboundEmail:
      has("outbound_email") || has("outboundEmail"),
    moduleReferrals: has("referrals"),
    moduleCreativeStudio:
      has("creative_studio") || has("creativeStudio"),
  };
}

export async function convertIntakeToClient(
  intakeId: string
): Promise<ConvertIntakeResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const intake = await prisma.intakeSubmission.findUnique({
    where: { id: intakeId },
  });
  if (!intake) {
    return { ok: false, error: "Intake submission not found" };
  }

  if (intake.status === "converted" && intake.orgId) {
    return {
      ok: false,
      error: "Intake has already been converted",
      orgId: intake.orgId,
    };
  }
  if (
    intake.status !== "submitted" &&
    intake.status !== "consultation_booked" &&
    intake.status !== "in_review"
  ) {
    return {
      ok: false,
      error: `Intake status "${intake.status}" can't be converted`,
    };
  }

  // Duplicate-org guard: block if a CLIENT org already exists for this email
  // or if an existing IntakeSubmission is already linked to an org with the
  // same primary contact email. This catches cases where the same company
  // submitted two intakes with slightly different names.
  if (intake.primaryContactEmail) {
    const existingOrg = await prisma.organization.findFirst({
      where: {
        orgType: OrgType.CLIENT,
        primaryContactEmail: intake.primaryContactEmail,
      },
      select: { id: true, name: true, slug: true },
    });
    if (existingOrg) {
      return {
        ok: false,
        error: `A client org already exists for ${intake.primaryContactEmail} (${existingOrg.name} · ${existingOrg.slug}). Open that client instead of creating a duplicate.`,
        orgId: existingOrg.id,
      };
    }
  }

  const slug = await pickUniqueSlug(
    intake.shortName?.trim() || intake.companyName
  );
  const modules = deriveModuleFlags(intake.selectedModules);

  // Step 1: create Organization + link intake in a single transaction.
  let org: { id: string; name: string; slug: string };
  try {
    org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: intake.companyName,
          shortName: intake.shortName ?? null,
          slug,
          orgType: OrgType.CLIENT,
          propertyType: intake.propertyType as PropertyType,
          residentialSubtype:
            (intake.residentialSubtype as ResidentialSubtype | null) ??
            null,
          commercialSubtype:
            (intake.commercialSubtype as CommercialSubtype | null) ?? null,
          status: TenantStatus.CONTRACT_SIGNED,
          primaryContactName: intake.primaryContactName,
          primaryContactEmail: intake.primaryContactEmail,
          primaryContactPhone: intake.primaryContactPhone ?? null,
          primaryContactRole: intake.primaryContactRole ?? null,
          hqCity: intake.hqCity ?? null,
          hqState: intake.hqState ?? null,
          bringYourOwnSite: true,
          ...modules,
        },
        select: { id: true, name: true, slug: true },
      });

      await tx.intakeSubmission.update({
        where: { id: intake.id },
        data: {
          status: "converted",
          convertedAt: new Date(),
          reviewedAt: intake.reviewedAt ?? new Date(),
          orgId: created.id,
        },
      });

      await tx.auditEvent.create({
        data: auditPayload(
          { ...scope, orgId: created.id } as ScopedContext,
          {
            action: AuditAction.CREATE,
            entityType: "Organization",
            entityId: created.id,
            description: `Converted intake ${intake.id} to client ${created.name} (${created.slug})`,
            diff: {
              intakeId: intake.id,
              slug: created.slug,
            } as Prisma.InputJsonValue,
          }
        ),
      });

      return created;
    });
  } catch (err) {
    console.error("convertIntakeToClient: DB transaction failed", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Failed to create organization: ${err.message}`
          : "Failed to create organization",
    };
  }

  // Step 2: create the Clerk organization. If this fails we don't unwind
  // (operator can retry), but we surface the error and flag the org.
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
    console.error(
      "convertIntakeToClient: Clerk createOrganization failed",
      err
    );
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
          body: `Clerk organization could not be created during intake conversion. Error: ${message}`,
          pinned: true,
        },
      });
    } catch (noteErr) {
      console.error(
        "convertIntakeToClient: failed to write at-risk note",
        noteErr
      );
    }

    revalidatePath("/admin/intakes");
    revalidatePath(`/admin/intakes/${intakeId}`);
    return {
      ok: false,
      error: `Client org created, but Clerk provisioning failed: ${message}`,
      orgId: org.id,
      clerkOrgId: null,
    };
  }

  // Step 3: invite the primary contact. Best-effort — failures are logged
  // but do not unwind the conversion.
  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      emailAddress: intake.primaryContactEmail,
      role: "org:admin",
      inviterUserId: scope.clerkUserId,
    });
  } catch (err) {
    console.warn(
      "convertIntakeToClient: Clerk invitation failed (continuing)",
      err
    );
  }

  // Step 4: send the portal-ready welcome email. Best-effort — a failure here
  // must not roll back the conversion or block the success response.
  if (intake.primaryContactEmail && intake.primaryContactName) {
    try {
      await sendClientPortalReadyEmail({
        to: intake.primaryContactEmail,
        contactName: intake.primaryContactName,
        orgName: org.name,
        orgSlug: org.slug,
      });
    } catch (err) {
      console.warn(
        "convertIntakeToClient: portal-ready email failed (continuing)",
        err
      );
    }
  }

  revalidatePath("/admin/intakes");
  revalidatePath(`/admin/intakes/${intakeId}`);

  return { ok: true, orgId: org.id, clerkOrgId };
}

export async function rejectIntake(
  intakeId: string,
  reason?: string
): Promise<RejectIntakeResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const intake = await prisma.intakeSubmission.findUnique({
    where: { id: intakeId },
    select: { id: true, status: true, orgId: true, companyName: true },
  });
  if (!intake) {
    return { ok: false, error: "Intake submission not found" };
  }
  if (intake.status === "converted") {
    return { ok: false, error: "Cannot reject an already-converted intake" };
  }
  if (intake.status === "rejected") {
    return { ok: true };
  }

  try {
    await prisma.intakeSubmission.update({
      where: { id: intake.id },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
      },
    });

    // Audit row hangs off the agency org (no CLIENT org was created).
    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "IntakeSubmission",
        entityId: intake.id,
        description: `Rejected intake for ${intake.companyName}${
          reason ? `: ${reason}` : ""
        }`,
        diff: {
          status: "rejected",
          reason: reason ?? null,
        } as Prisma.InputJsonValue,
      }),
    });
  } catch (err) {
    console.error("rejectIntake failed", err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to reject intake",
    };
  }

  revalidatePath("/admin/intakes");
  revalidatePath(`/admin/intakes/${intakeId}`);

  return { ok: true };
}
