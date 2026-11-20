import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Portal capture pages on a multi-property org: the property switcher and a
// restricted user's grant must narrow every number and transcript, not just
// the main list.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  aggregate: vi.fn(),
  groupBy: vi.fn(),
  convFindMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    popupCampaign: { aggregate: h.aggregate },
    popupEvent: { groupBy: h.groupBy },
    chatbotConversation: { findMany: h.convFindMany },
  },
}));

const { getPopupSummary } = await import("@/lib/popups/queries");
const { runChatbotLearningLoop } = await import("@/lib/chatbot/learning/run");

beforeEach(() => {
  vi.clearAllMocks();
  h.aggregate.mockResolvedValue({ _sum: {}, _count: { _all: 0 } });
  h.groupBy.mockResolvedValue([]);
});

describe("getPopupSummary property scoping", () => {
  it("scopes campaign counters and 28d events to the selected properties plus org-wide campaigns", async () => {
    await getPopupSummary("org_1", ["prop_a"]);
    const scoped = { OR: [{ propertyId: { in: ["prop_a"] } }, { propertyId: null }] };
    expect(h.aggregate.mock.calls[0][0].where).toMatchObject({ orgId: "org_1", ...scoped });
    expect(h.groupBy.mock.calls[0][0].where).toMatchObject({ orgId: "org_1", campaign: scoped });
  });

  it("stays org-wide when no property set applies", async () => {
    await getPopupSummary("org_1");
    expect(h.aggregate.mock.calls[0][0].where.OR).toBeUndefined();
    expect(h.groupBy.mock.calls[0][0].where.campaign).toBeUndefined();
  });

  it("an empty set (restricted user, forbidden selection) only counts org-wide campaigns", async () => {
    await getPopupSummary("org_1", []);
    expect(h.aggregate.mock.calls[0][0].where.OR).toEqual([
      { propertyId: { in: [] } },
      { propertyId: null },
    ]);
  });
});

describe("chatbot learning loop property scoping", () => {
  it("an empty grant scans only org-level conversations, never the whole org", async () => {
    h.convFindMany.mockResolvedValue([]);
    // effectivePropertyIds() returns [] for a restricted user with no grant
    // (or a forbidden selection). That must not widen to every property.
    await runChatbotLearningLoop({ orgId: "org_1", propertyIds: [], dryRun: true });
    expect(h.convFindMany.mock.calls[0][0].where).toEqual({
      orgId: "org_1",
      OR: [{ propertyId: { in: [] } }, { propertyId: null }],
    });
  });

  it("no property set (cron, unrestricted) scans the whole org", async () => {
    h.convFindMany.mockResolvedValue([]);
    await runChatbotLearningLoop({ orgId: "org_1", dryRun: true });
    expect(h.convFindMany.mock.calls[0][0].where).toEqual({ orgId: "org_1" });
  });
});

// Heavy server components: structural checks, same approach as
// lead-detail-viewer-controls.test.ts.
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("portal capture pages honour the property grant", () => {
  it("popups list passes the effective property set to the summary and filters on an empty set", () => {
    const src = read("app/portal/popups/page.tsx");
    expect(src).toMatch(/getPopupSummary\(scope\.orgId, effectiveIds\)/);
    // [] (forbidden selection) must narrow, not fall back to every popup.
    expect(src).not.toMatch(/effectiveIds && effectiveIds\.length > 0/);
  });

  it("lead detail narrows linked and orphaned conversations to the user's properties", () => {
    const src = read("app/portal/leads/[id]/page.tsx");
    const include = src.slice(src.indexOf("conversations: {"), src.indexOf("residents: {"));
    expect(include).toMatch(/where: propertyOrOrgLevelWhereFragment\(scope, null\)/);
    const orphaned = src.slice(src.indexOf("const orphanedConversations"), src.indexOf("const allConversations"));
    expect(orphaned).toMatch(/propertyOrOrgLevelWhereFragment\(scope, null\)/);
  });
});
