import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { getEffectiveBrand } from "@/lib/brand/effective";
import { NeighborhoodPageStatus } from "@prisma/client";
import { parseStored } from "@/lib/actions/neighborhood-pages-helpers";

// ---------------------------------------------------------------------------
// Public render for per-neighborhood landing pages.
//
// Path on the tenant marketing site: /n/<slug>
//
// Optimized for:
//   * Google: clean H1/H2 hierarchy, descriptive meta, JSON-LD WebPage.
//   * AI answer engines: a FAQPage JSON-LD block so ChatGPT / Perplexity /
//     Claude / Gemini can lift questions+answers verbatim with attribution.
//
// Tenant resolution + white-label awareness come from the surrounding
// (tenant) layout. We deliberately render only PUBLISHED pages; DRAFT
// and ARCHIVED 404 so the operator can preview through the portal but
// nothing leaks to crawlers until it's actually ready.
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  // We can't filter by orgId here (static params run once across all
  // tenant rewrites), so just return every published page's slug. Next
  // will pair them with the appropriate org at request time via the
  // hostname-rewritten tenant headers.
  const pages = await prisma.neighborhoodPage.findMany({
    where: { status: NeighborhoodPageStatus.PUBLISHED },
    select: { slug: true },
    take: 5000,
  });
  return pages.map((p) => ({ slug: p.slug }));
}

async function loadPublishedPage(orgId: string, slug: string) {
  const row = await prisma.neighborhoodPage.findFirst({
    where: { orgId, slug, status: NeighborhoodPageStatus.PUBLISHED },
  });
  return parseStored(row);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return { title: "Not found" };
  const { slug } = await params;
  const page = await loadPublishedPage(tenant.id, slug);
  if (!page) return { title: "Not found" };
  return {
    title: page.title,
    description: page.metaDescription,
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      siteName: tenant.name,
    },
    alternates: { canonical: `/n/${page.slug}` },
  };
}

export default async function NeighborhoodPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();
  const { slug } = await params;
  const page = await loadPublishedPage(tenant.id, slug);
  if (!page) notFound();

  const brand = getEffectiveBrand(tenant);
  const property = page.propertyId
    ? (tenant.properties.find((p) => p.id === page.propertyId) ?? null)
    : null;

  // JSON-LD WebPage + FAQPage. Two schemas, one shared <script type=...>
  // block. Engines treat the page as the canonical source of these
  // facts when they have schema attached.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      description: page.metaDescription,
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        name: tenant.name,
        publisher: {
          "@type": "Organization",
          name: brand.name,
        },
      },
      about: {
        "@type": "Place",
        name: `${page.neighborhood}, ${page.city}${
          page.state ? `, ${page.state}` : ""
        }`,
        address: {
          "@type": "PostalAddress",
          addressLocality: page.city,
          ...(page.state ? { addressRegion: page.state } : {}),
          addressCountry: "US",
        },
      },
      ...(property?.addressLine1
        ? {
            mainEntity: {
              "@type": "ApartmentComplex",
              name: property.name,
              address: {
                "@type": "PostalAddress",
                streetAddress: property.addressLine1,
                addressLocality: property.city ?? page.city,
                addressRegion: property.state ?? page.state ?? undefined,
                addressCountry: "US",
              },
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    },
  ];

  return (
    <article>
      {/* JSON-LD blocks — placed early so crawlers see them before content. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="max-w-3xl mx-auto px-4 md:px-6 pt-20 pb-8">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-2">
          {brand.name} · Neighborhood guide
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight">
          {page.title}
        </h1>
        <p className="mt-3 text-base opacity-70 max-w-2xl">
          {page.metaDescription}
        </p>
      </header>

      <section className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {page.intro}
        </p>
      </section>

      {page.sections.map((s, idx) => (
        <section
          key={idx}
          className="max-w-3xl mx-auto px-4 md:px-6 py-6 border-t border-slate-100"
        >
          <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-3">
            {s.heading}
          </h2>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {s.body}
          </p>
        </section>
      ))}

      {page.faqs.length > 0 ? (
        <section className="max-w-3xl mx-auto px-4 md:px-6 py-10 border-t border-slate-100">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-5">
            Frequently asked
          </h2>
          <div className="space-y-4">
            {page.faqs.map((f, idx) => (
              <details key={idx} className="border rounded-md p-4 group">
                <summary className="cursor-pointer font-medium text-[15px]">
                  {f.question}
                </summary>
                <p className="opacity-80 mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed">
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 border-t border-slate-100 text-center">
        <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-3">
          {property
            ? `Interested in ${property.name}?`
            : `Looking to rent in ${page.neighborhood}?`}
        </h2>
        <p className="opacity-70 mb-4">
          Apply online or schedule a tour — we respond the same business day.
        </p>
        <div className="inline-flex gap-3">
          <Link
            href="/apply"
            className="inline-block px-5 py-2.5 text-sm font-semibold rounded"
            style={{
              backgroundColor: "var(--tenant-primary)",
              color: "white",
            }}
          >
            Apply now
          </Link>
          <Link
            href="/schedule"
            className="inline-block px-5 py-2.5 text-sm font-semibold rounded border border-slate-200"
          >
            Schedule a tour
          </Link>
        </div>
      </section>
    </article>
  );
}
