import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  answerBlock,
  approvedBlocks,
  change,
  groundedIn,
  isProtectedTopic,
  isSteering,
  mentionsProtectedClass,
  readProposal,
  weekOf,
} from "@/lib/self-improve/proposal";

describe("fair-housing guards", () => {
  it("flags protected topics so they always need SG's answer", () => {
    expect(isProtectedTopic("Hello do you accept section 8 vouchers")).toBe(true);
    expect(isProtectedTopic("Children allowed?")).toBe(true);
    expect(isProtectedTopic("can I bring my emotional support animal")).toBe(true);
    expect(isProtectedTopic("is it possible to negotiate rent?")).toBe(false);
    expect(isProtectedTopic("for shared double, how many tables are there?")).toBe(false);
  });

  it("rejects wording that excludes or steers", () => {
    expect(isSteering("Sorry, we do not accept Section 8 vouchers.")).toBe(true);
    expect(isSteering("This is an adults only building.")).toBe(true);
    expect(isSteering("Perfect for young professionals.")).toBe(true);
    expect(isSteering("Every apartment is fully furnished.")).toBe(false);
    expect(mentionsProtectedClass("Great for families")).toBe(true);
    expect(mentionsProtectedClass("Furnished apartments two blocks to campus")).toBe(false);
  });
});

describe("grounding", () => {
  const kb = "EVERY APARTMENT: fully furnished (each bedroom: 2 full beds).\nRent includes water and trash.";
  it("needs the quoted fact verbatim (case and punctuation aside)", () => {
    expect(groundedIn(kb, "Rent includes water and trash")).toBe(true);
    expect(groundedIn(kb, "every apartment fully furnished")).toBe(true);
    expect(groundedIn(kb, "Rent is negotiable for long leases")).toBe(false);
    expect(groundedIn(kb, "water")).toBe(false); // too short to prove anything
  });
});

describe("knowledge base blocks", () => {
  it("approved answers survive a KB refresh as their own paragraphs", () => {
    const block = answerBlock("How do I pay?", "Pay online in the resident portal.\n\nCards and ACH.");
    expect(block).toBe('Approved answer (renters asked: "How do I pay?"):\nPay online in the resident portal.\nCards and ACH.');
    const kb = `Facts here.\n\n${block}\n\nApproved chatbot learning:\n- Guidance: ask for email\n\nLISTINGS refreshed`;
    expect(approvedBlocks(kb)).toEqual([block, "Approved chatbot learning:\n- Guidance: ask for email"]);
    expect(approvedBlocks(null)).toEqual([]);
  });
});

describe("weeks and change", () => {
  it("weekOf returns the Monday", () => {
    expect(weekOf(new Date("2026-11-25T16:00:00Z"))).toBe("2026-11-23");
    expect(weekOf(new Date("2026-11-23T00:00:00Z"))).toBe("2026-11-23");
    expect(weekOf(new Date("2026-11-29T23:00:00Z"))).toBe("2026-11-23");
  });

  it("change compares rates and knows which direction is better", () => {
    expect(change({ key: "unanswered", days: 14, before: { value: 4, of: 40 }, after: { value: 2, of: 40 } })).toEqual({ pct: -50, better: true });
    expect(change({ key: "popup_conversion", days: 14, before: { value: 5, of: 465 }, after: { value: 10, of: 465 } })).toEqual({ pct: 100, better: true });
    expect(change({ key: "leads", days: 14, before: { value: 4, of: null }, after: { value: 3, of: null } })).toEqual({ pct: -25, better: false });
    expect(change({ key: "popup_conversion", days: 14, before: { value: 0, of: 0 }, after: { value: 1, of: 10 } })).toEqual({ pct: null, better: null });
  });

  it("readProposal returns null for learning-loop rows and junk", () => {
    expect(readProposal(null)).toBeNull();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readProposal({ v: 2 })).toBeNull();
    spy.mockRestore();
  });
});

// --- generateProposals: model output is checked in code -------------------

const createKb = vi.fn();
const createSite = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findMany: vi.fn(async () => [{ id: "p1", name: "The Lair", websiteUrl: "https://lair.com", chatbotConfig: { chatbotKnowledgeBase: "EVERY APARTMENT: fully furnished.\nRent includes water and trash." } }]) },
    chatbotConversation: {
      findMany: vi.fn(async () => [
        { id: "c1", propertyId: "p1", messages: [{ role: "user", content: "Children allowed?" }, { role: "assistant", content: "I don't have that in front of me." }] },
        { id: "c2", propertyId: "p1", messages: [{ role: "user", content: "Is water included?" }, { role: "assistant", content: "I'm not sure." }] },
        { id: "c3", propertyId: "p1", messages: [{ role: "user", content: "Can I negotiate rent?" }, { role: "assistant", content: "I'm not sure." }] },
      ]),
    },
    popupCampaign: { findMany: vi.fn(async () => []) },
    popupEvent: { groupBy: vi.fn(async () => []) },
    chatbotKnowledgeSuggestion: { findMany: vi.fn(async () => []), createMany: (a: unknown) => createKb(a) },
    siteImprovementRecommendation: { findMany: vi.fn(async () => []), createMany: (a: unknown) => createSite(a) },
    tenantSiteConfig: { findUnique: vi.fn(async () => null) },
    lead: { count: vi.fn(async () => 3) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/portal/needs-attention", () => ({ getNeedsAttention: vi.fn(async () => []) }));
vi.mock("@/lib/cost-tracker/log", () => ({ logUsage: vi.fn(async () => {}) }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: () => "model" }));
// The model "answers" all three, including the fair-housing one and one
// it can't ground: code must turn both into Needs SG's answer.
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: {
      answers: [
        { i: 0, status: "answer", answer: "No children.", kbQuote: "EVERY APARTMENT: fully furnished", askSg: "" },
        { i: 1, status: "answer", answer: "Yes, water and trash are included.", kbQuote: "Rent includes water and trash", askSg: "" },
        { i: 2, status: "answer", answer: "Rent is negotiable.", kbQuote: "Rent is negotiable on request", askSg: "" },
      ],
      popup: null,
      site: [],
    },
    usage: { inputTokens: 10, outputTokens: 10 },
  })),
}));

describe("generateProposals", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test";
    createKb.mockReset();
  });

  it("keeps only grounded, non-protected drafts; the rest need SG's answer", async () => {
    const { generateProposals } = await import("@/lib/self-improve/generate");
    const r = await generateProposals("org");
    expect(r).toMatchObject({ llmCalls: 1, answers: 1, needsAnswer: 2 });
    const rows = (createKb.mock.calls[0][0] as { data: { suggestedText: string; proposal: Record<string, unknown> }[] }).data;
    const by = (q: string) => rows.find((x) => x.proposal.question === q)!;
    expect(by("Children allowed?").proposal).toMatchObject({ needsAnswer: true, fairHousing: expect.any(String) });
    expect(by("Children allowed?").suggestedText).toBe("");
    expect(by("Is water included?").suggestedText).toBe("Yes, water and trash are included.");
    expect(by("Can I negotiate rent?").proposal.needsAnswer).toBe(true);
  });
});

describe("guards added after review", () => {
  it("catches sex-based and postposed exclusions; CRLF KBs keep approved blocks", () => {
    expect(isProtectedTopic("is there a women only floor?")).toBe(true);
    expect(isSteering("Women-only floor available.")).toBe(true);
    expect(isSteering("Families are not allowed in studios.")).toBe(true);
    expect(isSteering("Pets are allowed with a deposit.")).toBe(false);
    expect(approvedBlocks('Facts\r\n\r\nApproved answer (renters asked: "x"):\r\ny')).toHaveLength(1);
  });
});
