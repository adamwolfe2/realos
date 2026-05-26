import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { IntakeForm } from "@/components/site-engine/intake-form";
import type { IntakeFormInput } from "@/lib/site-engine/intake-schema";
import {
  loadDesignLanguageIndex,
  loadPaletteIndex,
  loadPresetIndex,
} from "@/lib/site-engine/visual-direction-catalogs";

export const metadata: Metadata = { title: "Request a website build" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/sites/request — logged-in version of the intake form. Reuses
// IntakeForm, pre-filled from the caller's Organization and User row.
// ---------------------------------------------------------------------------

export default async function PortalSiteRequestPage() {
  const scope = await requireScope();

  // Pull the org + the user for pre-fill data. Also surface any existing
  // SiteRequest so we can show "you've already submitted one" instead of
  // letting the operator double-submit. Catalog loaders pull the kit's
  // INDEX.json snapshots from /public/site-engine.
  const [org, user, existing, presetIndex, designLanguageIndex, paletteIndex] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        primaryContactName: true,
        primaryContactEmail: true,
        primaryContactPhone: true,
        primaryColor: true,
        hqCity: true,
        hqState: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: scope.userId },
      select: { email: true, firstName: true, lastName: true, phone: true },
    }),
    prisma.siteRequest.findFirst({
      where: { orgId: scope.orgId },
      orderBy: { submittedAt: "desc" },
      select: { id: true, slug: true, status: true, submittedAt: true },
    }),
    loadPresetIndex(),
    loadDesignLanguageIndex(),
    loadPaletteIndex(),
  ]);

  const submitterName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    org?.primaryContactName ||
    "";
  const submitterEmail = user?.email || org?.primaryContactEmail || "";

  const defaults: Partial<IntakeFormInput> = {
    submittedByName: submitterName,
    submittedByEmail: submitterEmail,
    submittedByPhone: user?.phone ?? org?.primaryContactPhone ?? undefined,
    submittedByCompany: org?.name ?? undefined,
    brandName: org?.name ?? "",
    brandColorHex: org?.primaryColor ?? undefined,
    hqCity: org?.hqCity ?? undefined,
    hqState: org?.hqState ?? undefined,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Request a website build"
        description="Tell us about the site you want and we'll hand-build it. Pre-filled from your portal profile — edit anything that's wrong."
      />

      {existing ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                You already have a site request in progress.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Status: {existing.status} · submitted{" "}
                {new Date(existing.submittedAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`/portal/sites/${encodeURIComponent(existing.slug)}`}
              className="text-sm text-primary underline underline-offset-2"
            >
              View status
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Submitting again will create a second request — only do that if
            this is for a different brand or property.
          </p>
        </div>
      ) : null}

      <IntakeForm
        defaults={defaults}
        hideSubmitterFields={false}
        redirectAfter="portal"
        storageKeySuffix={scope.userId}
        visualDirectionCatalogs={{
          presets: presetIndex.presets,
          designLanguages: designLanguageIndex.designLanguages,
          palettes: paletteIndex.palettes,
        }}
      />
    </div>
  );
}
