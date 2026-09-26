import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { TenantNav } from "@/components/tenant-site/nav";
import { TenantFooter } from "@/components/tenant-site/footer";
import { ExitIntentPopup } from "@/components/tenant-site/exit-intent-popup";
import { ChatbotLoaderFor } from "@/components/chatbot/chatbot-loader";
import { CursivePixelLoader } from "@/components/pixel/cursive-pixel-loader";
import { getEffectiveBrand } from "@/lib/brand/effective";
import {
  TenantAnalytics,
  readGtmContainerId,
} from "@/components/tenant-site/tenant-analytics";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return { title: "Not found" };
  const config = tenant.tenantSiteConfig;
  const title = config?.metaTitle ?? config?.siteTitle ?? tenant.name;
  const description = config?.metaDescription ?? null;

  // White-label aware: strip the LeaseStack favicon + mask icon from the
  // tenant-facing marketing site when the parent org has the add-on
  // active. Without an override we point at the tenant's logoUrl (if
  // any) so the browser tab carries the building's brand, not ours.
  // Falls through to the root layout's icons[] when the org isn't
  // white-labeled (existing behaviour).
  const brand = getEffectiveBrand(tenant);
  const tenantIcon =
    brand.isWhiteLabeled && (brand.logoUrl ?? tenant.logoUrl)
      ? (brand.logoUrl ?? tenant.logoUrl) || undefined
      : undefined;

  return {
    title,
    description: description ?? undefined,
    openGraph: {
      title,
      description: description ?? undefined,
      ...(config?.ogImageUrl ? { images: [config.ogImageUrl] } : {}),
      siteName: tenant.name,
    },
    ...(tenantIcon
      ? {
          icons: {
            icon: tenantIcon,
            shortcut: tenantIcon,
            apple: tenantIcon,
            // Drop the LeaseStack mask-icon entirely when white-labeled.
            other: [],
          },
        }
      : {}),
  };
}

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const config = tenant.tenantSiteConfig;

  // Bring-your-own-site mode: client hosts the marketing site elsewhere and
  // only wants our chatbot + pixel scripts. Skip the full layout.
  // We do NOT inject GTM/GA4 here — the tenant manages those on their own site.
  if (tenant.bringYourOwnSite) {
    return (
      <>
        {config?.chatbotEnabled ? (
          <ChatbotLoaderFor tenant={tenant} config={config} />
        ) : null}
        {config?.enablePixel ? (
          <CursivePixelLoader orgId={tenant.id} />
        ) : null}
      </>
    );
  }

  const brandStyle = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ...({
      "--tenant-primary": tenant.primaryColor ?? "#111827",
      "--tenant-secondary": tenant.secondaryColor ?? "#f9fafb",
    } as React.CSSProperties),
  };

  return (
    <div
      data-tenant-slug={tenant.slug}
      className="min-h-screen flex flex-col bg-white text-slate-900"
      style={brandStyle}
    >
      <TenantAnalytics
        ga4MeasurementId={config?.ga4MeasurementId ?? null}
        gtmContainerId={readGtmContainerId(config?.customJson)}
      />
      <TenantNav tenant={tenant} />
      <main className="flex-1">{children}</main>
      <TenantFooter tenant={tenant} />
      {config?.chatbotEnabled ? (
        <ChatbotLoaderFor tenant={tenant} config={config} />
      ) : null}
      {config?.enablePixel ? (
        <CursivePixelLoader orgId={tenant.id} />
      ) : null}
      {config?.enableExitIntent ? (
        <ExitIntentPopup
          orgId={tenant.id}
          headline={config.exitIntentHeadline ?? null}
          body={config.exitIntentBody ?? null}
          ctaText={config.exitIntentCtaText ?? null}
          offerCode={config.exitIntentOfferCode ?? null}
        />
      ) : null}
    </div>
  );
}
