import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ph = vi.hoisted(() => ({ captureImmediate: vi.fn(), ctor: vi.fn() }));
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      ph.ctor(...args);
    }
    captureImmediate = ph.captureImmediate;
  },
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));

import { trackServer } from "@/lib/analytics-server";

describe("trackServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ph.captureImmediate.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("no-ops when the PostHog key is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await trackServer({ event: "signup", distinctId: "org1" });
    expect(ph.ctor).not.toHaveBeenCalled();
    expect(ph.captureImmediate).not.toHaveBeenCalled();
  });

  it("captures with the right args when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    await trackServer({ event: "card_added", distinctId: "org1", props: { a: 1 } });
    expect(ph.captureImmediate).toHaveBeenCalledWith({
      distinctId: "org1",
      event: "card_added",
      properties: { a: 1 },
    });
  });

  it("never throws into the request path", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    ph.captureImmediate.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      trackServer({ event: "x", distinctId: "o" }),
    ).resolves.toBeUndefined();
  });
});

describe("track (client)", () => {
  it("no-ops when the key is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const capture = vi.fn();
    vi.doMock("posthog-js", () => ({ default: { __loaded: true, capture } }));
    const { track } = await import("@/lib/analytics");
    track("demo_booked");
    expect(capture).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
