import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ph = vi.hoisted(() => ({
  captureImmediate: vi.fn(),
  ctor: vi.fn(),
  listeners: {} as Record<string, (e: unknown) => void>,
  after: vi.fn(),
  sentry: vi.fn(),
}));
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      ph.ctor(...args);
    }
    captureImmediate = ph.captureImmediate;
    on(event: string, cb: (e: unknown) => void) {
      ph.listeners[event] = cb;
      return () => undefined;
    }
  },
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: ph.sentry }));
vi.mock("next/server", () => ({ after: ph.after }));

async function load() {
  vi.resetModules();
  return import("@/lib/analytics-server");
}

describe("trackServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ph.captureImmediate.mockResolvedValue(undefined);
    // Default: no request scope, after() throws -> inline fallback.
    ph.after.mockImplementation(() => {
      throw new Error("outside request scope");
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("no-ops when the PostHog key is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { trackServer } = await load();
    await trackServer({ event: "signup", distinctId: "org1" });
    expect(ph.ctor).not.toHaveBeenCalled();
    expect(ph.captureImmediate).not.toHaveBeenCalled();
  });

  it("uses a short timeout, no retries, and captures with the right args", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { trackServer } = await load();
    await trackServer({ event: "card_added", distinctId: "org1", props: { a: 1 } });
    expect(ph.ctor).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ requestTimeout: 2000, fetchRetryCount: 0 }),
    );
    expect(ph.captureImmediate).toHaveBeenCalledWith({
      distinctId: "org1",
      event: "card_added",
      properties: { a: 1 },
    });
  });

  it("schedules via after() when in a request scope (does not run inline)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    ph.after.mockImplementation(() => undefined);
    const { trackServer } = await load();
    await trackServer({ event: "signup", distinctId: "o" });
    expect(ph.after).toHaveBeenCalledTimes(1);
    expect(ph.captureImmediate).not.toHaveBeenCalled();
  });

  it("passes a stable uuid derived from dedupeKey", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { trackServer } = await load();
    await trackServer({ event: "card_added", distinctId: "o", dedupeKey: "evt_1:card_added" });
    await trackServer({ event: "card_added", distinctId: "o", dedupeKey: "evt_1:card_added" });
    const [a, b] = ph.captureImmediate.mock.calls.map((c) => c[0].uuid);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).toBe(b);
  });

  it("logs SDK errors from the error listener (the SDK never rejects)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { trackServer } = await load();
    await trackServer({ event: "x", distinctId: "o" });
    const boom = new Error("network");
    ph.listeners.error(boom);
    expect(spy).toHaveBeenCalledWith("[analytics] posthog error:", boom);
    expect(ph.sentry).toHaveBeenCalledWith(boom, { area: "analytics" });
  });

  it("never throws even if capture rejects", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    ph.captureImmediate.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { trackServer } = await load();
    await expect(trackServer({ event: "x", distinctId: "o" })).resolves.toBeUndefined();
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
