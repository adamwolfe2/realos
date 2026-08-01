import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Wave 3 Phase 1: pixel URL -> property attribution.
//
// CONSERVATIVE RULE: a CursiveIntegration row explicitly bound to a property
// (propertyId set) always keeps that binding — URL inference never runs for
// bound pixels. Only legacy org-wide rows (propertyId null) fall back to
// resolvePropertyForChatPage(pageUrl, orgProperties).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  cursiveIntegration: { updateMany: vi.fn(async () => ({ count: 1 })) },
  visitor: {
    findFirst: vi.fn(async () => null as any),
    create: vi.fn(async (args: any) => ({ id: "visitor_1", ...args.data })),
    update: vi.fn(async (args: any) => ({ id: "visitor_1", ...args.data })),
  },
  property: {
    findMany: vi.fn(async () => [] as Array<{ id: string; slug: string; name: string }>),
  },
  webhookEvent: { create: vi.fn(async () => ({ id: "wh_1" })) },
  // Wave 3 Phase 3: session/event bridge, only exercised by page_view events.
  visitorSession: {
    findFirst: vi.fn(async () => null as any),
    create: vi.fn(async (args: any) => ({ id: "session_1", ...args.data })),
    update: vi.fn(async (args: any) => ({ id: "session_1", ...args.data })),
  },
  visitorEvent: {
    create: vi.fn(async (args: any) => ({ id: "event_1", ...args.data })),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h }));

import { processCursiveEvent } from "@/lib/webhooks/cursive-process";

const ORG = "org_1";

// identified=true (normalizedEmail + firstName + lastName present) but
// deliverability stays 0 and no verified email, so leadWorthy is false —
// keeps the test from needing to mock the Lead model at all.
function baseEvent(pageUrl: string) {
  return {
    event_type: "identify",
    page_url: pageUrl,
    FIRST_NAME: "Jamie",
    LAST_NAME: "Rivera",
    PERSONAL_EMAILS: "jamie@example.com",
  };
}

// page_view (not identify) is what triggers the VisitorSession/VisitorEvent
// bridge in recordPageViewSession. Still needs identity fields — the
// resolution gate (`isResolution`) skips and never reaches the bridge for a
// bare anonymous page_view.
function pageViewEvent(pageUrl: string) {
  return {
    event_type: "page_view",
    page_url: pageUrl,
    FIRST_NAME: "Jamie",
    LAST_NAME: "Rivera",
    PERSONAL_EMAILS: "jamie@example.com",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cursive pixel property attribution", () => {
  it("keeps an explicitly bound pixel's propertyId and never looks up org properties", async () => {
    await processCursiveEvent(baseEvent("https://example.com/communities/maple-ridge"), {
      orgId: ORG,
      cursivePixelId: "px_bound",
      installedOnDomain: "example.com",
      propertyId: "prop_bound",
    });

    expect(h.property.findMany).not.toHaveBeenCalled();
    expect(h.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_bound" }),
      }),
    );
  });

  it("resolves a null (legacy org-wide) row to the property whose slug matches the URL", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_maple", slug: "maple-ridge", name: "Maple Ridge" },
      { id: "prop_oak", slug: "oak-terrace", name: "Oak Terrace" },
    ]);

    await processCursiveEvent(baseEvent("https://example.com/communities/maple-ridge"), {
      orgId: ORG,
      cursivePixelId: "px_orgwide",
      installedOnDomain: "example.com",
      propertyId: null,
    });

    expect(h.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_maple" }),
      }),
    );
  });

  it("stays null for a legacy org-wide row when the URL matches no property", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_maple", slug: "maple-ridge", name: "Maple Ridge" },
      { id: "prop_oak", slug: "oak-terrace", name: "Oak Terrace" },
    ]);

    await processCursiveEvent(baseEvent("https://example.com/about-us"), {
      orgId: ORG,
      cursivePixelId: "px_orgwide2",
      installedOnDomain: "example.com",
      propertyId: null,
    });

    expect(h.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: null }),
      }),
    );
  });

  it("single-property org + non-matching URL stays null (pixel path skips the single-property fallback)", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_solo", slug: "maple-ridge", name: "Maple Ridge" },
    ]);

    await processCursiveEvent(
      baseEvent("https://unrelated-corporate-site.com/careers"),
      {
        orgId: ORG,
        cursivePixelId: "px_solo",
        installedOnDomain: "unrelated-corporate-site.com",
        propertyId: null,
      },
    );

    expect(h.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: null }),
      }),
    );
  });

  it("does not match a slug spoofed via the query string", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_oak", slug: "oak-terrace", name: "Oak Terrace" },
      { id: "prop_maple", slug: "maple-ridge", name: "Maple Ridge" },
    ]);

    await processCursiveEvent(baseEvent("https://example.com/?x=oak-terrace"), {
      orgId: ORG,
      cursivePixelId: "px_spoof",
      installedOnDomain: "example.com",
      propertyId: null,
    });

    expect(h.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: null }),
      }),
    );
  });

  it("caches the org property list across events sharing one Map", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_maple", slug: "maple-ridge", name: "Maple Ridge" },
    ]);
    const cache = new Map<string, Array<{ id: string; slug: string; name: string }>>();

    await processCursiveEvent(
      baseEvent("https://example.com/communities/maple-ridge"),
      { orgId: ORG, cursivePixelId: "px_a", installedOnDomain: "example.com", propertyId: null },
      cache,
    );
    h.visitor.findFirst.mockResolvedValueOnce(null);
    await processCursiveEvent(
      baseEvent("https://example.com/communities/maple-ridge"),
      { orgId: ORG, cursivePixelId: "px_b", installedOnDomain: "example.com", propertyId: null },
      cache,
    );

    expect(h.property.findMany).toHaveBeenCalledTimes(1);
  });

  // Wave 3 Phase 3: the VisitorSession/VisitorEvent bridge reuses the exact
  // attributedPropertyId already resolved above (integration.propertyId ??
  // URL inference) — no second inference pass for the pixel engagement rows.
  it("threads the attributed propertyId onto the VisitorSession + VisitorEvent bridge rows", async () => {
    await processCursiveEvent(
      pageViewEvent("https://example.com/communities/maple-ridge"),
      {
        orgId: ORG,
        cursivePixelId: "px_bound",
        installedOnDomain: "example.com",
        propertyId: "prop_bound",
      },
    );

    expect(h.property.findMany).not.toHaveBeenCalled();
    expect(h.visitorSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_bound" }),
      }),
    );
    expect(h.visitorEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_bound" }),
      }),
    );
  });

  it("resolves a legacy org-wide row's URL match onto the session/event bridge rows too", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_maple", slug: "maple-ridge", name: "Maple Ridge" },
    ]);

    await processCursiveEvent(
      pageViewEvent("https://example.com/communities/maple-ridge"),
      {
        orgId: ORG,
        cursivePixelId: "px_orgwide",
        installedOnDomain: "example.com",
        propertyId: null,
      },
    );

    expect(h.visitorSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_maple" }),
      }),
    );
    expect(h.visitorEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_maple" }),
      }),
    );
  });

  // Regression (2026-08-01 review): the event write used to read
  // args.propertyId directly instead of the session's effective
  // (backfilled) propertyId. An already-attributed session whose CURRENT
  // event's URL doesn't resolve to any property used to write that event
  // with propertyId: null, orphaning it from property-filtered reads even
  // though it belongs to an already-attributed session.
  it("keeps an already-attributed session's propertyId on the event even when this event's URL doesn't resolve", async () => {
    h.visitorSession.findFirst.mockResolvedValueOnce({
      id: "session_attributed",
      startedAt: new Date(),
      propertyId: "prop_bound",
    });

    await processCursiveEvent(
      pageViewEvent("https://unrelated-corporate-site.com/careers"),
      {
        orgId: ORG,
        cursivePixelId: "px_orgwide_midvisit",
        installedOnDomain: "unrelated-corporate-site.com",
        propertyId: null,
      },
    );

    expect(h.visitorSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session_attributed" },
        data: expect.objectContaining({ propertyId: "prop_bound" }),
      }),
    );
    expect(h.visitorEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ propertyId: "prop_bound" }),
      }),
    );
  });
});
