import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Embed-scrape (Core plan, no REST creds) listing sync with several
 * buildings. Before: any org with >1 AppFolio property, counting
 * IMPORTED/EXCLUDED rows, got NO listings at all. Now each card is filed
 * under the single ACTIVE property whose street address it carries.
 */

type Prop = {
  id: string;
  orgId: string;
  addressLine1: string | null;
  backendPlatform: string;
  backendPropertyId: string | null;
  backendPropertyGroup: string | null;
  lifecycle: string;
};

const state = vi.hoisted(() => ({
  props: [] as Prop[],
  listingCreates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    appFolioIntegration: {
      findUnique: vi.fn(async () => ({
        id: "int-1",
        orgId: "org-1",
        instanceSubdomain: "acme",
        clientIdEncrypted: null,
        clientSecretEncrypted: null,
        apiKeyEncrypted: null,
        useEmbedFallback: true,
        syncStatus: "idle",
        propertyGroupFilter: null,
      })),
      update: vi.fn(async () => ({})),
    },
    property: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        state.props.filter(
          (p) =>
            p.orgId === where.orgId &&
            p.backendPlatform === where.backendPlatform &&
            (where.lifecycle === undefined || p.lifecycle === where.lifecycle),
        ),
      ),
      update: vi.fn(async () => ({})),
    },
    listing: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.listingCreates.push(data);
        return data;
      }),
      aggregate: vi.fn(async () => ({
        _min: { priceCents: null },
        _max: { priceCents: null },
        _count: { _all: 0 },
      })),
    },
  },
}));

import { embedListingPropertyId, syncListingsForOrg } from "@/lib/integrations/appfolio";

function card(id: string, address: string): string {
  return `<div class="listing-item result js-listing-item" id="listing_${id}">
    <span class="js-listing-address">${address}</span>
    <span class="js-listing-blurb-rent">$2,000</span>
  </div>`;
}

const HTML = `<html><body>
  ${card("1", "1 Alpha Way, Berkeley, CA 94704")}
  ${card("2", "200 Oak St Unit 4, Berkeley, CA 94704")}
  ${card("3", "1200 Oak St, Berkeley, CA 94704")}
</body></html>`;

function prop(id: string, addressLine1: string | null, lifecycle = "ACTIVE"): Prop {
  return {
    id,
    orgId: "org-1",
    addressLine1,
    backendPlatform: "APPFOLIO",
    backendPropertyId: null,
    backendPropertyGroup: null,
    lifecycle,
  };
}

beforeEach(() => {
  state.listingCreates = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(HTML, { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embedListingPropertyId", () => {
  const props = [
    { id: "A", addressLine1: "1 Alpha Way" },
    { id: "B", addressLine1: "200 Oak St" },
  ];

  it("files a card under the building whose address it carries", () => {
    expect(embedListingPropertyId("200 Oak St Unit 4, Berkeley", props)).toBe("B");
    expect(embedListingPropertyId("1 ALPHA  WAY, Berkeley", props)).toBe("A");
  });

  it("never matches a longer street number (1200 Oak St is not 200 Oak St)", () => {
    expect(embedListingPropertyId("1200 Oak St, Berkeley", props)).toBeNull();
  });

  it("returns null for no address, no match, or an ambiguous match", () => {
    expect(embedListingPropertyId(null, props)).toBeNull();
    expect(embedListingPropertyId("9 Elm St", props)).toBeNull();
    expect(
      embedListingPropertyId("200 Oak St", [
        { id: "B", addressLine1: "200 Oak St" },
        { id: "B2", addressLine1: "200 oak st" },
      ]),
    ).toBeNull();
  });

  it("ignores properties with no street address", () => {
    expect(embedListingPropertyId("200 Oak St", [{ id: "X", addressLine1: null }])).toBeNull();
  });
});

describe("syncListingsForOrg (embed) — several buildings", () => {
  it("syncs each ACTIVE building's cards to that building and skips unmatched ones", async () => {
    state.props = [prop("A", "1 Alpha Way"), prop("B", "200 Oak St")];
    const out = await syncListingsForOrg("org-1");
    expect(out.error).toBeNull();
    const byProp = state.listingCreates.map((l) => [l.propertyId, l.backendListingId]);
    expect(byProp).toEqual([
      ["A", "1"],
      ["B", "2"],
    ]);
    expect(out.skippedUnknownProperty).toBe(1);
  });

  it("one ACTIVE building plus EXCLUDED address rows still gets its listings", async () => {
    state.props = [prop("A", "1 Alpha Way"), prop("X", null, "EXCLUDED"), prop("Y", null, "IMPORTED")];
    const out = await syncListingsForOrg("org-1");
    expect(out.error).toBeNull();
    expect(state.listingCreates.map((l) => [l.propertyId, l.backendListingId])).toEqual([
      ["A", "1"],
    ]);
  });
});
