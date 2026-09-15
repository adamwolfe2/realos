import { describe, it, expect } from "vitest";
import {
  isVisibleWebsiteBuild,
  visibleWebsiteBuilds,
  toBuildStatus,
  TERMINAL_RETENTION_DAYS,
} from "@/lib/billing/website-builds";

const NOW = new Date("2026-09-15T18:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("website build visibility", () => {
  it("hides abandoned checkouts", () => {
    // The exact shape of SG Real Estate's two rows: Stripe checkout
    // expired unpaid on 2026-07-30, still status "abandoned" today.
    expect(
      isVisibleWebsiteBuild(
        { status: "abandoned", createdAt: daysAgo(47) },
        NOW,
      ),
    ).toBe(false);
  });

  it("hides failed rows", () => {
    expect(
      isVisibleWebsiteBuild({ status: "failed", createdAt: daysAgo(1) }, NOW),
    ).toBe(false);
  });

  it("shows builds actually in the queue", () => {
    for (const status of ["requested", "scoping", "designing", "building", "review"]) {
      expect(
        isVisibleWebsiteBuild({ status, createdAt: daysAgo(3) }, NOW),
        status,
      ).toBe(true);
    }
  });

  it("keeps a recently launched build, drops an old one", () => {
    expect(
      isVisibleWebsiteBuild(
        { status: "live", createdAt: daysAgo(90), launchedAt: daysAgo(5) },
        NOW,
      ),
    ).toBe(true);
    expect(
      isVisibleWebsiteBuild(
        {
          status: "live",
          createdAt: daysAgo(400),
          launchedAt: daysAgo(TERMINAL_RETENTION_DAYS + 1),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("keeps a recently cancelled build, drops an old one", () => {
    expect(
      isVisibleWebsiteBuild(
        { status: "cancelled", createdAt: daysAgo(60), cancelledAt: daysAgo(2) },
        NOW,
      ),
    ).toBe(true);
    expect(
      isVisibleWebsiteBuild(
        { status: "cancelled", createdAt: daysAgo(60), cancelledAt: daysAgo(31) },
        NOW,
      ),
    ).toBe(false);
  });

  it("uses createdAt when a terminal row has no terminal timestamp", () => {
    expect(
      isVisibleWebsiteBuild({ status: "live", createdAt: daysAgo(2) }, NOW),
    ).toBe(true);
    expect(
      isVisibleWebsiteBuild({ status: "live", createdAt: daysAgo(31) }, NOW),
    ).toBe(false);
  });

  it("hides unknown statuses rather than rendering an empty stepper", () => {
    expect(
      isVisibleWebsiteBuild({ status: "on_hold", createdAt: daysAgo(1) }, NOW),
    ).toBe(false);
  });

  it("filters a mixed list", () => {
    const rows = [
      { id: "a", status: "abandoned", createdAt: daysAgo(47) },
      { id: "b", status: "abandoned", createdAt: daysAgo(47) },
      { id: "c", status: "building", createdAt: daysAgo(4) },
    ];
    expect(visibleWebsiteBuilds(rows, NOW).map((r) => r.id)).toEqual(["c"]);
  });

  it("narrows unknown statuses to a renderable stage", () => {
    expect(toBuildStatus("abandoned")).toBe("requested");
    expect(toBuildStatus("review")).toBe("review");
    expect(toBuildStatus("cancelled")).toBe("cancelled");
  });
});
