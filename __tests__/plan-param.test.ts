import { describe, it, expect } from "vitest";
import { parsePlanParam, tierForPlan } from "@/lib/onboarding/plan-param";

describe("plan param carried from /pricing to onboarding", () => {
  it("accepts only the three public plans", () => {
    expect(parsePlanParam("growth")).toBe("growth");
    expect(parsePlanParam("GROWTH")).toBeNull();
    expect(parsePlanParam("toString")).toBeNull();
    expect(parsePlanParam("enterprise")).toBeNull();
    expect(parsePlanParam(undefined)).toBeNull();
    expect(parsePlanParam("/evil")).toBeNull();
  });
  it("maps to the subscription tier", () => {
    expect(tierForPlan("starter")).toBe("STARTER");
    expect(tierForPlan("scale")).toBe("SCALE");
  });
});
