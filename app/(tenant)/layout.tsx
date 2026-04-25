import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { TenantNav } from "@/components/tenant-site/nav";
import { TenantFooter } from "@/components/tenant-site/footer";
import { ExitIntentPopup } from "@/components/tenant-site/exit-intent-popup";
import { ChatbotLoaderFor } from "@/components/chatbot/chatbot-loader";
import { CursivePixelLoader } from "@/components/pixel/cursive-pixel-loader";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return { title: "Not found" };
  const config = tenant.tenantSiteConfig;
  const title = config?.metaTitle ?? config?.siteTitle ?? tenant.name;
  const description = config?.metaDescription ?? null;
  return {
    title,
    description: description ?? undefined,
    openGraph: {
      title,
      description: description ?? undefined,
      ...(config?.ogImageUrl ? { images: [config.ogImageUrl] } : {}),
      siteName: tenant.name,
    },
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
