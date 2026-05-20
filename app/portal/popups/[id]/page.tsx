import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { getPopupById } from "@/lib/popups/queries";
import { getSiteUrl } from "@/lib/brand";
import { PageHeader } from "@/components/admin/page-header";
import { PopupEditor } from "@/components/portal/popups/popup-editor";
import { InstallSnippet } from "@/app/portal/chatbot/install-snippet";

export const metadata: Metadata = { title: "Edit popup" };
export const dynamic = "force-dynamic";

export default async function PopupEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;
  const popup = await getPopupById(scope.orgId, id);
  if (!popup) notFound();

  const [properties, org] = await Promise.all([
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { slug: true },
    }),
  ]);

  // One-line embed snippet — same shape as chatbot install-snippet so
  // operators recognize the pattern. The popup script reads the slug
  // attribute, calls /api/public/popup/config/[slug], and renders.
  const snippet = `<script async src="${getSiteUrl()}/embed/popup.js" data-tenant="${org?.slug ?? ""}"></script>`;

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/popups"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden="true">←</span> All popups
          </Link>
        }
        title={popup.name}
        description="Edit copy, design, triggers, and capture settings. The preview on the right updates as you type. Don't forget to hit Save."
      />

      <PopupEditor
        initial={{
          id: popup.id,
          name: popup.name,
          status: popup.status,
          headline: popup.headline,
          body: popup.body,
          ctaText: popup.ctaText,
          ctaUrl: popup.ctaUrl,
          offerCode: popup.offerCode,
          secondaryText: popup.secondaryText,
          trigger: popup.trigger,
          triggerThreshold: popup.triggerThreshold,
          targetUrlPatterns: Array.isArray(popup.targetUrlPatterns)
            ? (popup.targetUrlPatterns as string[])
            : [],
          frequency: popup.frequency,
          position: popup.position,
          primaryColor: popup.primaryColor,
          textColor: popup.textColor,
          backgroundColor: popup.backgroundColor,
          heroImageUrl: popup.heroImageUrl,
          captureEmail: popup.captureEmail,
          capturePhone: popup.capturePhone,
          propertyId: popup.propertyId,
          // Phase 1 — design parity fields. NULL on legacy rows; the editor
          // and preview both fall through to v1 treatment when unset.
          eyebrowText: popup.eyebrowText,
          accentColor: popup.accentColor,
          theme: popup.theme,
          template: popup.template,
          featuredLabel: popup.featuredLabel,
          featuredValue: popup.featuredValue,
          featuredUnit: popup.featuredUnit,
          featuredCaption: popup.featuredCaption,
          secondaryCtaText: popup.secondaryCtaText,
          secondaryCtaUrl: popup.secondaryCtaUrl,
          secondaryCtaIcon: (popup.secondaryCtaIcon ?? null) as
            | "calendar"
            | "phone"
            | "external"
            | "arrow"
            | "none"
            | null,
          primaryCtaIcon: (popup.primaryCtaIcon ?? null) as
            | "calendar"
            | "phone"
            | "external"
            | "arrow"
            | "none"
            | null,
          dismissText: popup.dismissText,
          gradientColors: Array.isArray(popup.gradientColors)
            ? (popup.gradientColors as string[])
            : null,
        }}
        properties={properties}
      />

      <InstallSnippet snippet={snippet} />
    </div>
  );
}
