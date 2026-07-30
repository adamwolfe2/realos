import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Regression for PORTAL-SITES-D001: the /n/[slug] neighborhood page's
// canonical URL was a bare relative path (`/n/${slug}`), which Next.js
// resolves against `metadataBase` (the PLATFORM app URL set in app/layout.tsx)
// — not the tenant's own custom domain or <slug>.leasestack.co subdomain.
// That told Google the platform, not the tenant site, is the canonical
// source for tenant content: SEO self-harm on every tenant site.
//
// Fix: build an absolute canonical URL from the tenant's own host via the
// same tenantPrimaryHost() helper the tenant sitemap already uses.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  neighborhoodPage: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: h.organization,
    neighborhoodPage: h.neighborhoodPage,
  },
}));

// React's cache() memoizes per-request via AsyncLocalStorage, which isn't
// set up outside a real Next request. Pass-through so the helper just runs.
vi.mock("react", async (importActual) => {
  const actual = await importActual<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-tenant-org-id": "org_1" }),
}));

vi.mock("@/lib/tenancy/resolve", () => ({
  readTenantHeaders: () => ({ orgId: "org_1" }),
}));

vi.mock("@/lib/brand/effective", () => ({
  getEffectiveBrand: () => ({ name: "Acme Brand" }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound() called");
  },
}));

const basePage = {
  id: "page_1",
  orgId: "org_1",
  propertyId: null,
  city: "Berkeley",
  state: "CA",
  neighborhood: "Downtown",
  slug: "downtown-berkeley",
  title: "Downtown Berkeley Apartments",
  metaDescription: "Guide to Downtown Berkeley rentals.",
  intro: "Intro copy",
  sections: [],
  faqs: [],
};

async function importMetadataFn() {
  const mod = await import("@/app/(tenant)/tenant-site/n/[slug]/page");
  return mod.generateMetadata;
}

describe("neighborhood page canonical URL uses the tenant's own host", () => {
  it("builds an absolute canonical against the tenant's custom domain, not a bare relative path", async () => {
    h.organization.findUnique.mockResolvedValueOnce({
      id: "org_1",
      slug: "acme",
      name: "Acme Brand",
      tenantSiteConfig: null,
      domains: [{ hostname: "www.acmeapartments.com", isPrimary: true }],
      properties: [],
    });
    h.neighborhoodPage.findFirst.mockResolvedValueOnce(basePage);

    const generateMetadata = await importMetadataFn();
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "downtown-berkeley" }),
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://www.acmeapartments.com/n/downtown-berkeley",
    );
    // The bug: a bare relative path resolves against metadataBase (the
    // platform's own app URL), not the tenant's domain.
    expect(metadata.alternates?.canonical).not.toBe(
      `/n/${basePage.slug}`,
    );
  });

  it("falls back to the <slug>.<platform> subdomain when no custom domain is bound", async () => {
    const prevPlatform = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN = "leasestack.co";
    try {
      h.organization.findUnique.mockResolvedValueOnce({
        id: "org_1",
        slug: "acme",
        name: "Acme Brand",
        tenantSiteConfig: null,
        domains: [],
        properties: [],
      });
      h.neighborhoodPage.findFirst.mockResolvedValueOnce(basePage);

      const generateMetadata = await importMetadataFn();
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "downtown-berkeley" }),
      });

      expect(metadata.alternates?.canonical).toBe(
        "https://acme.leasestack.co/n/downtown-berkeley",
      );
    } finally {
      if (prevPlatform === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
      else process.env.NEXT_PUBLIC_PLATFORM_DOMAIN = prevPlatform;
    }
  });
});
