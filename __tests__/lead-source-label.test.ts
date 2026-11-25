import { describe, expect, it } from "vitest";
import { leadSourceLabel } from "@/lib/format";

describe("leadSourceLabel", () => {
  it("never shows internal popup ids", () => {
    expect(leadSourceLabel("FORM", "popup:cmwbu4xw50001tb3l8tm5gzur")).toBe("Website pop-up");
  });
  it("drops id-like detail, keeps human detail", () => {
    expect(leadSourceLabel("FORM", "cmwbu4xw50001tb3l8tm5gzur")).toBe("Website form");
    expect(leadSourceLabel("FORM", "Contact page")).toBe("Website form · Contact page");
  });
  it("hides chatbot prefix:value details", () => {
    expect(leadSourceLabel("CHATBOT", "chatbot:/contact")).toBe("Chatbot");
  });
  it("labels AppFolio imports and raw enums", () => {
    expect(leadSourceLabel("OTHER", null, "appfolio")).toBe("AppFolio");
    expect(leadSourceLabel("OTHER", null)).toBe("Other");
  });
});
