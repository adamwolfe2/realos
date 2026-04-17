import "server-only";
import { prisma } from "@/lib/db";
import {
  OrgType,
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  TenantStatus,
  Prisma,
} from "@prisma/client";
import { attachDomainToProject } from "./domain-attach";
import { getDefaultProjectTasks } from "./default-tasks";

// ---------------------------------------------------------------------------
// Tenant provisioning entrypoint.
// Called from:
//   - Sprint 03 intake wizard, after consultation converts an IntakeSubmission
//   - Sprint 04 admin manual "Create tenant" flow
//
// Steps:
//   1. Create Organization row (orgType CLIENT, slug, branding, modules)
//   2. Seed a first Property shell (operator fills in listings later)
//   3. Create a Project with the 28-task operator checklist
//   4. Optionally attach a custom domain (creates DomainBinding + calls
//      Vercel). DNS still has to be pointed by the client.
//   5. Write an IMPERSONATE-style audit row (CREATE action).
//
// Returns the new tenant's org id + project id so the caller can surface a
// progress link or impersonation bootstrap.
// ---------------------------------------------------------------------------

export type ProvisionTenantInput = {
  name: string;
  shortName?: string;
  slug: string;
  propertyType: PropertyType;
  residentialSubtype?: ResidentialSubtype;
  commercialSubtype?: CommercialSubtype;
  primaryContact: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };
  hq?: { city?: string; state?: string; postalCode?: string };
  modules?: {
    website?: boolean;
    pixel?: boolean;
    chatbot?: boolean;
    googleAds?: boolean;
    metaAds?: boolean;
    seo?: boolean;
    email?: boolean;
    outboundEmail?: boolean;
    referrals?: boolean;
    creativeStudio?: boolean;
    leadCapture?: boolean;
  };
  bringYourOwnSite?: boolean;
  customDomain?: string;          // Optional, must be a verified hostname
  firstPropertyName?: string;     // Auto-seed the first property
  intakeSubmissionId?: string;    // Link back to the intake if converting
};

export type ProvisionTenantResult = {
  orgId: string;
  projectId: string;
  propertyId: string | null;
  domainBindingId: string | null;
  vercelDomainAttached: boolean;
};

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function pickUniqueSlug(desired: string): Promise<string> {
  const base = normalizeSlug(desired) || "tenant";
  let candidate = base;
  let n = 2;
  // Simple conflict resolution; real-world collisions are rare in our size tier.
  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n++}`;
    if (n > 50) throw new Error("Could not generate a unique tenant slug");
  }
}

export async function provisionTenant(
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const slug = await pickUniqueSlug(input.slug);

  const modules = {
    moduleWebsite: input.modules?.website ?? true,
    modulePixel: input.modules?.pixel ?? false,
    moduleChatbot: input.modules?.chatbot ?? false,
    moduleGoogleAds: input.modules?.googleAds ?? false,
    moduleMetaAds: input.modules?.metaAds ?? false,
    moduleSEO: input.modules?.seo ?? false,
    moduleEmail: input.modules?.email ?? false,
    moduleOutboundEmail: input.modules?.outboundEmail ?? false,
    moduleReferrals: input.modules?.referrals ?? false,
    moduleCreativeStudio: input.modules?.creativeStudio ?? false,
    moduleLeadCapture: input.modules?.leadCapture ?? true,
  };

  const defaultTasks = getDefaultProjectTasks();

  // Transaction: org + property + project + tasks. Domain attachment is
  // outside the transaction because it hits the Vercel API.
  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        shortName: input.shortName ?? null,
        slug,
        orgType: OrgType.CLIENT,
        propertyType: input.propertyType,
        residentialSubtype: input.residentialSubtype,
        commercialSubtype: input.commercialSubtype,
        status: TenantStatus.BUILD_IN_PROGRESS,
        primaryContactName: input.primaryContact.name,
        primaryContactEmail: input.primaryContact.email,
        primaryContactPhone: input.primaryContact.phone ?? null,
        primaryContactRole: input.primaryContact.role ?? null,
        hqCity: input.hq?.city ?? null,
        hqState: input.hq?.state ?? null,
        hqPostalCode: input.hq?.postalCode ?? null,
        bringYourOwnSite: input.bringYourOwnSite ?? false,
        ...modules,
        tenantSiteConfig: {
          create: {
            siteTitle: input.name,
            primaryCtaText: "Apply Now",
            showListings: true,
            showFloorPlans: true,
            showAmenities: true,
            enableExitIntent: true,
          },
        },
      },
    });

    const property =
      input.firstPropertyName != null
        ? await tx.property.create({
            data: {
              orgId: org.id,
              name: input.firstPropertyName,
              slug: normalizeSlug(input.firstPropertyName) || "primary",
              propertyType: input.propertyType,
              residentialSubtype: input.residentialSubtype,
              commercialSubtype: input.commercialSubtype,
            },
          })
        : null;

    const project = await tx.project.create({
      data: {
        orgId: org.id,
        name: `${input.name} Build`,
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

    if (input.intakeSubmissionId) {
      await tx.intakeSubmission.update({
        where: { id: input.intakeSubmissionId },
        data: {
          orgId: org.id,
          convertedAt: new Date(),
          status: "converted",
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        orgId: org.id,
        action: "CREATE",
        entityType: "Organization",
        entityId: org.id,
        description: `Provisioned tenant ${org.name} (${slug})`,
        diff: Prisma.JsonNull,
      },
    });

    return { org, property, project };
  });

  // 2. Optional custom domain attachment. Failures are captured but don't
  // roll back tenant creation; the agency operator can retry from the admin.
  let domainBindingId: string | null = null;
  let vercelDomainAttached = false;
  if (input.customDomain) {
    const hostname = input.customDomain.trim().toLowerCase();
    try {
      const binding = await prisma.domainBinding.create({
        data: {
          orgId: created.org.id,
          hostname,
          isPrimary: true,
          sslStatus: "pending",
          dnsConfigured: false,
        },
      });
      domainBindingId = binding.id;

      const attached = await attachDomainToProject(hostname);
      vercelDomainAttached = true;

      await prisma.domainBinding.update({
        where: { id: binding.id },
        data: {
          vercelDomainId: typeof attached?.name === "string" ? attached.name : null,
        },
      });
    } catch (err) {
      // DECISION: log + continue. Domain attach is a retriable step.
      console.error(
        `[provisionTenant] Custom domain attach failed for ${hostname}:`,
        err
      );
    }
  }

  return {
    orgId: created.org.id,
    projectId: created.project.id,
    propertyId: created.property?.id ?? null,
    domainBindingId,
    vercelDomainAttached,
  };
}
