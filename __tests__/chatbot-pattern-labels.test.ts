import { describe, expect, it } from "vitest";
import { patternReason, patternTitle } from "@/lib/chatbot/learning/pattern-labels";

describe("fix pattern labels", () => {
  it("labels both patternTypes the learning engine writes", () => {
    expect(patternReason("weak_cta_human_contact_punt")).not.toBe("the answer was missing");
    expect(patternReason("capture_after_pricing_or_availability")).not.toBe("the answer was missing");
    expect(patternTitle("capture_after_pricing_or_availability")).toBe("Left without contact info");
  });

  it("falls back for unknown types", () => {
    expect(patternTitle("some_new_type")).toBe("Some new type");
    expect(patternReason("some_new_type")).toBe("the answer was missing");
  });
});
