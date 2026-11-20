import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * connectAppfolio used to stamp backendPlatform=APPFOLIO on EVERY property
 * with no platform, including buildings managed in another system. It now
 * marks only buildings whose address appears on an AppFolio listing card
 * (embed) and leaves linking to the sync's property_directory phase (REST).
 */

const h = vi.hoisted(() => ({
  probe: vi.fn(),
  runSync: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ encrypt: (v: string) => `enc:${v}` }));
vi.mock("@/lib/tenancy/scope", () => ({
  requireOrgWideAdmin: vi.fn(async () => ({ orgId: "org-1", userId: "u-1" })),
  assertOrgWideAccess: vi.fn(),
  requireWritableWorkspace: vi.fn(async () => ({ orgId: "org-1", userId: "u-1" })),
  auditPayload: (_s: unknown, p: unknown) => p,
}));
vi.mock("@/lib/onboarding/step-detectors", () => ({
  syncOnboardingProgressInBackground: vi.fn(),
}));
vi.mock("@/lib/integrations/appfolio-sync", () => ({ runAppfolioSync: h.runSync }));
vi.mock("@/lib/integrations/appfolio", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/appfolio")>(
    "@/lib/integrations/appfolio",
  );
  return { ...actual, probeEmbedScrape: h.probe };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    appFolioIntegration: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "int-1" })),
      update: vi.fn(async () => ({ id: "int-1" })),
    },
    property: { findMany: h.findMany, updateMany: h.updateMany },
    auditEvent: { create: vi.fn(async () => ({})) },
  },
}));

import { connectAppfolio } from "@/lib/actions/appfolio-connect";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.runSync.mockResolvedValue({ ok: true, stats: {} });
  h.updateMany.mockResolvedValue({ count: 1 });
  h.findMany.mockResolvedValue([
    { id: "B", addressLine1: "200 Oak St" },
    { id: "E", addressLine1: "77 Elsewhere Ave" },
  ]);
});

describe("connectAppfolio — which buildings get marked AppFolio", () => {
  it("embed: marks only the building listed on AppFolio, not one managed elsewhere", async () => {
    h.probe.mockResolvedValue({ ok: true, count: 1, addresses: ["200 Oak St Unit 4, Berkeley"] });
    const res = await connectAppfolio(form({ authMode: "embed", subdomain: "acme" }));
    expect(res.ok).toBe(true);
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    const arg = h.updateMany.mock.calls[0][0];
    expect(arg.where.id).toEqual({ in: ["B"] });
    expect(arg.where.orgId).toBe("org-1");
    expect(arg.data).toEqual({ backendPlatform: "APPFOLIO" });
  });

  it("embed: marks nothing when no card names any building", async () => {
    h.probe.mockResolvedValue({ ok: true, count: 1, addresses: ["9 Nowhere Rd"] });
    await connectAppfolio(form({ authMode: "embed", subdomain: "acme" }));
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("rest: marks nothing up front (the sync links buildings from property_directory)", async () => {
    const res = await connectAppfolio(
      form({ authMode: "rest", subdomain: "acme", clientId: "cid-1234", clientSecret: "sec-1234" }),
    );
    expect(res.ok).toBe(true);
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
