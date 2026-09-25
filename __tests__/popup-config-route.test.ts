import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Popup config route — the embed's only network dependency. Covers the
// three "quiet failure" branches (unknown slug, module off, inactive
// popups excluded via getActivePopupsForEmbed) plus the public-safe
// projection (no orgId/propertyId leak) and CORS/cache headers.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getActivePopupsForEmbed: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { organization: { findUnique: h.findUnique } },
}));
vi.mock("@/lib/popups/queries", () => ({
  getActivePopupsForEmbed: h.getActivePopupsForEmbed,
}));
vi.mock("@/lib/rate-limit", () => ({
  chatbotConfigLimiter: {},
  WIDGET_FALLBACK: { chatbotConfig: {} },
  getIp: () => "1.2.3.4",
  checkRateLimit: async () => ({ allowed: true }),
}));

import { GET } from "@/app/api/public/popup/config/[slug]/route";

function req(qs = "") {
  return {
    nextUrl: { searchParams: new URLSearchParams(qs) },
  } as never;
}
function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

const POPUP_ROW = {
  id: "pop_1",
  headline: "Move in by June",
  body: "Save big",
  ctaText: "Apply now",
  ctaUrl: "https://example.com/apply",
  offerCode: "JUNE100",
  secondaryText: null,
  trigger: "EXIT_INTENT",
  triggerThreshold: 0,
  targetUrlPatterns: ["/apply"],
  frequency: "session",
  position: "CENTER",
  primaryColor: "#2563EB",
  textColor: "#0F172A",
  backgroundColor: "#FFFFFF",
  heroImageUrl: null,
  captureEmail: true,
  capturePhone: false,
  eyebrowText: null,
  accentColor: null,
  theme: "LIGHT",
  template: null,
  featuredLabel: null,
  featuredValue: null,
  featuredUnit: null,
  featuredCaption: null,
  secondaryCtaText: null,
  secondaryCtaUrl: null,
  secondaryCtaIcon: null,
  primaryCtaIcon: null,
  dismissText: null,
  gradientColors: null,
  // Private fields the payload must never leak.
  orgId: "org_secret",
  propertyId: "prop_secret",
  shownCount: 999,
  convertedCount: 4,
};

beforeEach(() => {
  h.findUnique.mockReset();
  h.getActivePopupsForEmbed.mockReset().mockResolvedValue([POPUP_ROW]);
});

describe("GET /api/public/popup/config/[slug]", () => {
  it("returns empty popups (soft-404) for an unknown slug", async () => {
    h.findUnique.mockResolvedValue(null);
    const res = await GET(req(), ctx("does-not-exist"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, popups: [] });
    expect(h.getActivePopupsForEmbed).not.toHaveBeenCalled();
  });

  it("returns empty popups when modulePopups is off", async () => {
    h.findUnique.mockResolvedValue({ id: "org_1", modulePopups: false });
    const res = await GET(req(), ctx("some-org"));
    const json = await res.json();
    expect(json.popups).toEqual([]);
    expect(h.getActivePopupsForEmbed).not.toHaveBeenCalled();
  });

  it("projects only public-safe fields — no orgId/propertyId/counters", async () => {
    h.findUnique.mockResolvedValue({ id: "org_1", modulePopups: true });
    const res = await GET(req(), ctx("telegraph-commons"));
    const json = await res.json();
    expect(json.popups).toHaveLength(1);
    const p = json.popups[0];
    expect(p.headline).toBe("Move in by June");
    expect(p.offerCode).toBe("JUNE100");
    expect(p).not.toHaveProperty("orgId");
    expect(p).not.toHaveProperty("propertyId");
    expect(p).not.toHaveProperty("shownCount");
    expect(p).not.toHaveProperty("convertedCount");
  });

  it("uses uniform CORS + cache headers across the found and not-found branches", async () => {
    h.findUnique.mockResolvedValue(null);
    const notFound = await GET(req(), ctx("nope"));
    h.findUnique.mockResolvedValue({ id: "org_1", modulePopups: true });
    const found = await GET(req(), ctx("telegraph-commons"));
    for (const res of [notFound, found]) {
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    }
  });

  it("rejects an oversized slug before hitting the db", async () => {
    const res = await GET(req(), ctx("x".repeat(101)));
    expect(res.status).toBe(400);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("passes the ?property= slug through to getActivePopupsForEmbed, capped at 100 chars", async () => {
    h.findUnique.mockResolvedValue({ id: "org_1", modulePopups: true });
    await GET(req("property=telegraph-commons"), ctx("some-org"));
    expect(h.getActivePopupsForEmbed).toHaveBeenCalledWith("org_1", "telegraph-commons");

    h.getActivePopupsForEmbed.mockClear();
    await GET(req("property=" + "y".repeat(101)), ctx("some-org"));
    expect(h.getActivePopupsForEmbed).toHaveBeenCalledWith("org_1", null);
  });
});
