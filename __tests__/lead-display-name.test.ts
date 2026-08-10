import { describe, expect, it } from "vitest";
import { leadDisplayName } from "@/lib/leads/display-name";

describe("leadDisplayName", () => {
  it("keeps captured names authoritative, including partial names", () => {
    expect(
      leadDisplayName({
        firstName: "  Ada ",
        lastName: " Lovelace ",
        email: "different.person@example.com",
      }),
    ).toBe("Ada Lovelace");
    expect(
      leadDisplayName({ firstName: "Cher", lastName: null, email: "x@example.com" }),
    ).toBe("Cher");
  });

  it.each([
    ["john.smith@example.com", "John Smith"],
    ["john_smith@example.com", "John Smith"],
    ["john-smith@example.com", "John Smith"],
    ["phuongpham@example.com", "Phuongpham"],
    ["darylarnold99@example.com", "Darylarnold"],
  ])("derives a conservative display label from %s", (email, expected) => {
    expect(leadDisplayName({ firstName: null, lastName: null, email })).toBe(expected);
  });

  it.each([
    "leasing@example.com",
    "info@example.com",
    "contact@example.com",
    "124090880@example.com",
  ])("uses the email for role-based or numeric local parts: %s", (email) => {
    expect(leadDisplayName({ firstName: null, lastName: null, email })).toBe(email);
  });

  it("uses a cohesive final fallback without claiming a person identity", () => {
    expect(leadDisplayName({ firstName: null, lastName: null, email: null })).toBe(
      "Unidentified lead",
    );
  });
});
