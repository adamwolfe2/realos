import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  urlPinnedPropertyId,
  withoutPropertyParams,
} from "@/lib/portal/active-property-constants";

// ---------------------------------------------------------------------------
// Regression (multi-property): on a deep link like /portal/leads?property=A,
// the sidebar switcher showed the cookie (B or "All") while the page showed
// A, and switching to B did nothing because the URL param outranks the
// cookie in parsePropertyFilter.
// ---------------------------------------------------------------------------

describe("switcher URL sync helpers", () => {
  it("reads the pinned property from ?property= and single ?properties=", () => {
    expect(urlPinnedPropertyId(new URLSearchParams("property=prop-a"))).toBe("prop-a");
    expect(urlPinnedPropertyId(new URLSearchParams("properties=prop-b"))).toBe("prop-b");
    expect(urlPinnedPropertyId(new URLSearchParams("properties=prop-a,prop-b"))).toBeNull();
    expect(urlPinnedPropertyId(new URLSearchParams("range=30"))).toBeNull();
  });

  it("strips both property params and keeps the rest", () => {
    expect(withoutPropertyParams(new URLSearchParams("property=a&range=30"))).toBe("?range=30");
    expect(withoutPropertyParams(new URLSearchParams("properties=a,b"))).toBe("");
  });

  it("the switcher strips URL params after switching and displays the URL pin", () => {
    const src = fs.readFileSync("components/portal/active-property-switcher.tsx", "utf8");
    expect(src).toContain("withoutPropertyParams(");
    expect(src).toContain("urlPinnedPropertyId(");
  });
});
