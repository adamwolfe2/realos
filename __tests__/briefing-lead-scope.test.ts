import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { leadPropertyScope } from "../lib/briefing/queries";

describe("briefing leadPropertyScope", () => {
  it("explicit selection wins", () => {
    expect(leadPropertyScope({ propertyIds: ["a"], marketablePropertyIds: ["a", "b"] })).toEqual({
      propertyId: "a",
    });
  });

  it("no selection defaults to marketable buildings plus unassigned leads, AND-wrapped", () => {
    expect(leadPropertyScope({ propertyIds: null, marketablePropertyIds: ["a", "b"] })).toEqual({
      AND: [{ OR: [{ propertyId: { in: ["a", "b"] } }, { propertyId: null }] }],
    });
  });

  it("an org with no marketable buildings keeps the old org-wide read", () => {
    expect(leadPropertyScope({ propertyIds: [], marketablePropertyIds: [] })).toEqual({});
  });
});
