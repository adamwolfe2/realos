import { describe, it, expect } from "vitest";
import {
  FEATURE_CATALOG,
  ALWAYS_ON_MODULE_KEYS,
  BASE_PLATFORM_CENTS,
  cartMonthlyCentsPerProperty,
  buildModuleStateFromSelection,
  inferTierFromSelection,
} from "@/lib/billing/features";

// Pure-function coverage for the à-la-carte billing math + the canonical module
// state. buildModuleStateFromSelection([]) is the state the subscription-cancel
// webhook writes to revoke entitlements, so these lock in "no paid module is
// silently left enabled".

describe("billing — à-la-carte cart total", () => {
  it("empty cart bills only the base platform", () => {
    expect(cartMonthlyCentsPerProperty([])).toBe(BASE_PLATFORM_CENTS);
  });

  it("total = base + the sum of selected feature prices", () => {
    const chatbot = FEATURE_CATALOG.find((f) => f.key === "moduleChatbot")!;
    const pixel = FEATURE_CATALOG.find((f) => f.key === "modulePixel")!;
    expect(
      cartMonthlyCentsPerProperty(["moduleChatbot", "modulePixel"]),
    ).toBe(BASE_PLATFORM_CENTS + chatbot.monthlyCents + pixel.monthlyCents);
  });

  it("ignores unknown keys (a crafted/stale key can't inflate the total)", () => {
    expect(cartMonthlyCentsPerProperty(["notARealModule"])).toBe(
      BASE_PLATFORM_CENTS,
    );
  });
});

describe("billing — buildModuleStateFromSelection", () => {
  it("empty selection turns every paid module OFF and keeps always-on ON", () => {
    const state = buildModuleStateFromSelection([]);
    for (const f of FEATURE_CATALOG) {
      expect(state[f.key]).toBe(false);
    }
    for (const k of ALWAYS_ON_MODULE_KEYS) {
      expect(state[k]).toBe(true);
    }
  });

  it("enables only the selected features", () => {
    const state = buildModuleStateFromSelection(["moduleChatbot"]);
    expect(state.moduleChatbot).toBe(true);
    for (const f of FEATURE_CATALOG) {
      if (f.key !== "moduleChatbot") expect(state[f.key]).toBe(false);
    }
  });

  it("emits a key for EVERY catalog module (regression: cancel handler must revoke all)", () => {
    const state = buildModuleStateFromSelection([]);
    for (const f of FEATURE_CATALOG) {
      expect(state).toHaveProperty(f.key);
    }
  });
});

describe("billing — inferTierFromSelection", () => {
  it("empty selection = STARTER", () => {
    expect(inferTierFromSelection([])).toBe("STARTER");
  });
});
