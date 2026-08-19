import { describe, it, expect } from "vitest";
import { isOwnDomain, isOwnUrl } from "@/lib/audit/own-domain";

// Adam 2026-08-19: a "Warwick" audit was run against leasestack.co, so
// every engine prompt, mention scan and AI Overview query was about
// LeaseStack while the report rendered the Warwick name over it. Auditing
// ourselves has no legitimate use, so it's refused at the API boundary.
describe("isOwnDomain", () => {
  it("catches our hosts however they're written", () => {
    for (const own of [
      "leasestack.co",
      "www.leasestack.co",
      "LeaseStack.co",
      "  leasestack.co  ",
      "app.leasestack.co",
      "leasestack.com",
      "realos.vercel.app",
    ]) {
      expect(isOwnDomain(own)).toBe(true);
    }
  });

  it("lets real prospect domains through", () => {
    for (const prospect of [
      "thewarwickhillcrest.com",
      "livehigby.com",
      "telegraphcommons.com",
      // Substring lookalikes must not be swept up.
      "leasestack.co.uk",
      "notleasestack.co",
      "myleasestack.com",
    ]) {
      expect(isOwnDomain(prospect)).toBe(false);
    }
  });

  it("treats an empty host as not ours rather than throwing", () => {
    expect(isOwnDomain("")).toBe(false);
    expect(isOwnDomain("   ")).toBe(false);
  });
});

describe("isOwnUrl", () => {
  it("resolves the host out of a full URL", () => {
    expect(isOwnUrl("https://leasestack.co/apple-icon.png?v=3")).toBe(true);
    expect(isOwnUrl("https://thewarwickhillcrest.com/logo.svg")).toBe(false);
  });

  it("fails closed on anything unparseable", () => {
    // Used as a guard, so 'unknown' must never read as 'safe'.
    expect(isOwnUrl("not a url")).toBe(true);
    expect(isOwnUrl("")).toBe(true);
  });
});
