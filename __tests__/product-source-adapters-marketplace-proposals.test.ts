import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dbAccess: vi.fn((property: PropertyKey) => {
    throw new Error(`Unexpected Prisma access: ${String(property)}`);
  }),
}));

// The proposal catalog shares a module with DB-backed helpers. The adapter is
// allowed to observe the static array only, so make any Prisma access fail.
vi.mock("@/lib/db", () => ({
  prisma: new Proxy({}, { get: (_target, property) => h.dbAccess(property) }),
}));

import { MARKETPLACE_ENTRIES } from "@/lib/marketplace/catalog";
import { PROPOSAL_CATALOG } from "@/lib/proposals/catalog";
import { MARKETPLACE_SOURCE_RECORDS } from "@/lib/products/adapters/marketplace";
import { PROPOSAL_SOURCE_RECORDS } from "@/lib/products/adapters/proposals";

describe("marketplace product-source adapter", () => {
  it("normalizes every entry deterministically without losing stable metadata", () => {
    expect(MARKETPLACE_SOURCE_RECORDS).toHaveLength(MARKETPLACE_ENTRIES.length);
    expect(
      MARKETPLACE_SOURCE_RECORDS.map((record) => ({
        sourceId: record.sourceId,
        priceCents: record.priceCents,
        stripeLookupKey: record.stripeLookupKey,
        claim: record.claim,
      })),
    ).toEqual(
      MARKETPLACE_ENTRIES.map((entry) => ({
        sourceId: entry.slug,
        priceCents: entry.monthlyPriceCents,
        stripeLookupKey: entry.stripeLookupKey ?? null,
        claim: entry.tagline,
      })),
    );
    expect(MARKETPLACE_SOURCE_RECORDS).toBe(
      MARKETPLACE_SOURCE_RECORDS,
    );
  });

  it("preserves withheld, coming, concierge, included, and sellable states", () => {
    expect(
      Object.fromEntries(
        MARKETPLACE_SOURCE_RECORDS.map(({ sourceId, commercialState }) => [
          sourceId,
          commercialState,
        ]),
      ),
    ).toMatchObject({
      "visitor-pixel": "withheld",
      "embeddable-popups": "withheld",
      "email-nurture": "coming",
      "outbound-email": "coming",
      "seo-aeo": "concierge",
      "marketing-site": "concierge",
      "lead-capture": "included",
      reputation: "included",
      "ai-chatbot": "sellable",
      referrals: "sellable",
      "reputation-pro": "sellable",
    });

    const withheld = MARKETPLACE_SOURCE_RECORDS.find(
      ({ sourceId }) => sourceId === "visitor-pixel",
    );
    expect(withheld).toMatchObject({
      customerVisible: false,
      selfServe: false,
      stripePriceMapped: false,
    });
  });

  it("maps only honest single-product matches and leaves orphans explicit", () => {
    expect(
      Object.fromEntries(
        MARKETPLACE_SOURCE_RECORDS.map(({ sourceId, productKey }) => [
          sourceId,
          productKey,
        ]),
      ),
    ).toEqual({
      "visitor-pixel": null,
      "lead-capture": "connected-data-foundation",
      "ai-chatbot": "ai-leasing-chatbot",
      "embeddable-popups": "conversion-offers",
      "seo-aeo": "search-opportunity-engine",
      "marketing-site": null,
      reputation: "reputation-rescue",
      referrals: null,
      "reputation-pro": "reputation-rescue",
      "white-label": null,
      "email-nurture": null,
      "outbound-email": null,
    });
  });
});

describe("proposal product-source adapter", () => {
  it("normalizes every static row while preserving ids, prices, activity, and claims", () => {
    expect(PROPOSAL_SOURCE_RECORDS).toHaveLength(PROPOSAL_CATALOG.length);
    expect(
      PROPOSAL_SOURCE_RECORDS.map((record) => ({
        sourceId: record.sourceId,
        label: record.label,
        priceCents: record.priceCents,
        commercialState: record.commercialState,
        claim: record.claim,
      })),
    ).toEqual(
      PROPOSAL_CATALOG.map((item) => ({
        sourceId: item.slug,
        label: item.label,
        priceCents: item.defaultPriceCents,
        commercialState: item.active ? "active" : "inactive",
        claim: item.description,
      })),
    );
  });

  it("retains safe Stripe mapping metadata without exposing DB behavior", () => {
    expect(
      PROPOSAL_SOURCE_RECORDS.find(
        ({ sourceId }) => sourceId === "tier-growth",
      ),
    ).toMatchObject({
      stripeLookupKey: "ls_growth_monthly_v1",
      stripePriceMapped: true,
      billingCadence: "monthly",
    });
    expect(
      PROPOSAL_SOURCE_RECORDS.find(
        ({ sourceId }) => sourceId === "addon-website-build",
      ),
    ).toMatchObject({
      recordKind: "service",
      billingCadence: "one_time",
      stripeLookupKey: null,
      stripePriceMapped: false,
    });
    expect(
      PROPOSAL_SOURCE_RECORDS.find(
        ({ sourceId }) => sourceId === "addon-pixel-overage",
      ),
    ).toMatchObject({
      billingCadence: "metered",
      stripeLookupKey: "ls_pixel_overage_per_visitor_v1",
      stripePriceMapped: true,
    });
    expect(h.dbAccess).not.toHaveBeenCalled();
  });

  it("maps canonical products conservatively and keeps bundles/services orphaned", () => {
    expect(
      Object.fromEntries(
        PROPOSAL_SOURCE_RECORDS.map(({ sourceId, productKey }) => [
          sourceId,
          productKey,
        ]),
      ),
    ).toMatchObject({
      "tier-foundation": null,
      "tier-growth": null,
      "tier-scale": null,
      "tier-enterprise": null,
      "addon-reputation-pro": "reputation-rescue",
      "addon-keyword-trends": "search-opportunity-engine",
      "addon-aeo-boost": "search-opportunity-engine",
      "addon-audience-sync": null,
      "addon-outbound-email-engine": null,
      "addon-chatbot-pro": "ai-leasing-chatbot",
      "addon-cursive-pixel-pro": null,
      "addon-insights-pro": "monday-action-brief",
      "addon-integrations-pro": "connected-data-foundation",
      "addon-website-build": "website-build",
      "setup-aeo-status-report": "search-opportunity-engine",
      "sprint-30-day-implementation": null,
      "addon-white-glove-coordination": null,
      "addon-commercial-retainer": null,
    });
  });

  it("contains no live or mutating dependency imports", () => {
    const adapterSources = ["marketplace.ts", "proposals.ts"].map((file) =>
      fs.readFileSync(
        path.resolve(process.cwd(), "lib/products/adapters", file),
        "utf8",
      ),
    );

    for (const source of adapterSources) {
      expect(source).not.toMatch(/ensureCatalogSeeded|\bfetch\s*\(|process\.env/);
      expect(source).not.toMatch(/@\/lib\/(db|stripe)|server-action|actions\//);
    }
  });
});
