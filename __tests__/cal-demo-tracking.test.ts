import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ cal: vi.fn(), track: vi.fn() }));
vi.mock("@calcom/embed-react", () => ({
  default: () => null,
  getCalApi: async () => h.cal,
}));
vi.mock("@/lib/analytics", () => ({ track: h.track }));

import { demoContext, openCalModal } from "@/components/marketing/cal-embed";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { pathname: "/audit/tok_123" } });
});

describe("cal demo tracking", () => {
  it("demoContext extracts the audit shareToken", () => {
    expect(demoContext()).toEqual({ path: "/audit/tok_123", shareToken: "tok_123" });
    vi.stubGlobal("window", { location: { pathname: "/pricing" } });
    expect(demoContext()).toEqual({ path: "/pricing" });
  });

  it("emits demo_booked from Cal's bookingSuccessful listener, registered once", async () => {
    await openCalModal("a/b");
    await openCalModal("a/b");
    const onCalls = h.cal.mock.calls.filter((c) => c[0] === "on");
    expect(onCalls).toHaveLength(1);
    expect(onCalls[0][1].action).toBe("bookingSuccessful");
    onCalls[0][1].callback();
    expect(h.track).toHaveBeenCalledWith("demo_booked", {
      path: "/audit/tok_123",
      shareToken: "tok_123",
    });
  });
});
