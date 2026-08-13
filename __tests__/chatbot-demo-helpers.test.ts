import { describe, expect, it } from "vitest";
import {
  normalizeDemoUrl,
  derivePropertyName,
} from "@/lib/chatbot/demo-helpers";

describe("normalizeDemoUrl", () => {
  it("accepts bare domains and prepends https", () => {
    expect(normalizeDemoUrl("telegraphcommons.com")?.toString()).toBe(
      "https://telegraphcommons.com/",
    );
  });

  it("accepts full http(s) URLs", () => {
    expect(normalizeDemoUrl("http://example.com/floorplans")?.toString()).toBe(
      "http://example.com/floorplans",
    );
  });

  it("rejects non-http schemes, localhost, private ranges, and garbage", () => {
    for (const bad of [
      "ftp://example.com",
      "javascript:alert(1)",
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "169.254.1.1",
      "not a url at all",
      "internal-host",
    ]) {
      expect(normalizeDemoUrl(bad), bad).toBeNull();
    }
  });
});

describe("derivePropertyName", () => {
  it("takes the first segment of a separated title", () => {
    expect(
      derivePropertyName(
        "Telegraph Commons | Student Housing in Berkeley",
        "www.telegraphcommons.com",
      ),
    ).toBe("Telegraph Commons");
    expect(
      derivePropertyName("The Standard – Luxury Apartments", "thestandard.com"),
    ).toBe("The Standard");
  });

  it("falls back to a capitalized hostname when the title is unusable", () => {
    expect(derivePropertyName("", "www.telegraphcommons.com")).toBe(
      "Telegraphcommons",
    );
    expect(derivePropertyName("X", "example.com")).toBe("Example");
  });
});
