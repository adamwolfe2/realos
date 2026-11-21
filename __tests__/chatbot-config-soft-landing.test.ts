import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Soft landing (plans/go-live-trial slice 4): the public widget config is
// the switch the embed reads. An expired trial with no card must get
// enabled:false; a card-on-file trial past its end must keep its chatbot.

const h = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  resolveChatbotConfig: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { organization: h.organization } }));
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: h.resolveChatbotConfig,
}));
vi.mock("@/lib/rate-limit", () => ({
  chatbotConfigLimiter: null,
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getIp: () => "1.1.1.1",
  rateLimited: vi.fn(),
  WIDGET_FALLBACK: {},
}));

import { GET } from "@/app/api/public/chatbot/config/route";

const past = new Date(Date.now() - 60_000);
const org = {
  id: "org1",
  name: "Oak",
  shortName: null,
  orgType: "CLIENT",
  moduleChatbot: true,
  subscriptionStatus: "TRIALING",
  trialStartedAt: new Date("2026-08-01T00:00:00Z"),
  trialEndsAt: past,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  primaryColor: null,
  logoUrl: null,
  properties: [],
  tenantSiteConfig: null,
};

const call = () =>
  GET(new NextRequest("http://localhost/api/public/chatbot/config?slug=oak"));

beforeEach(() => {
  vi.clearAllMocks();
  h.resolveChatbotConfig.mockResolvedValue({ chatbotEnabled: false });
});

describe("GET /api/public/chatbot/config soft landing", () => {
  it("disables the widget for an expired trial with no card", async () => {
    h.organization.findUnique.mockResolvedValue(org);
    const res = await call();
    expect(await res.json()).toEqual({ enabled: false });
    expect(h.resolveChatbotConfig).not.toHaveBeenCalled();
  });

  it("keeps a card-on-file trial past its end running", async () => {
    h.organization.findUnique.mockResolvedValue({ ...org, currentPeriodEnd: past });
    await call();
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", null);
  });

  it("keeps paying customers running", async () => {
    h.organization.findUnique.mockResolvedValue({ ...org, subscriptionStatus: "ACTIVE" });
    await call();
    expect(h.resolveChatbotConfig).toHaveBeenCalled();
  });
});

// Untagged embed (no data-property): chatbot.js sends ?page= so a sibling
// building's site never gets the flagship's persona and knowledge base.
describe("GET /api/public/chatbot/config untagged embed host", () => {
  const multi = {
    ...org,
    subscriptionStatus: "ACTIVE",
    properties: [
      { id: "flag", name: "Oak", slug: "oak", websiteUrl: "https://oakliving.com", lifecycle: "ACTIVE" },
      { id: "sib", name: "Elm", slug: "elm", websiteUrl: "www.liveatelm.com", lifecycle: "ACTIVE" },
      { id: "old", name: "Fir", slug: "fir", websiteUrl: "fir.com", lifecycle: "EXCLUDED" },
    ],
  };
  const get = (qs: string) =>
    GET(new NextRequest(`http://localhost/api/public/chatbot/config?slug=oak${qs}`));
  beforeEach(() => h.organization.findUnique.mockResolvedValue(multi));

  it("no host: legacy org-slug match", async () => {
    await get("");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", "flag");
  });

  it("host of a sibling's website: that sibling", async () => {
    await get("&page=liveatelm.com/");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", "sib");
  });

  it("unknown host on a multi-property org: org-level, not the flagship", async () => {
    await get("&page=brand-new.com/apply");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", null);
  });

  it("host of a non-ACTIVE property never resolves to it", async () => {
    await get("&page=fir.com/");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", null);
  });

  it("shared company site: the path picks the building", async () => {
    // Oak owns the host; Elm lives at /elm on it.
    await get("&page=oakliving.com/elm");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", "sib");
  });

  it("explicit ?property= still wins over page", async () => {
    await get("&property=oak&page=liveatelm.com/");
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org1", "flag");
  });
});
