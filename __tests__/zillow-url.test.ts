import { describe, it, expect } from "vitest";
import { parseZillowUrl, isZillowHost } from "@/lib/zillow/url";

describe("isZillowHost", () => {
  it("accepts apex + subdomains", () => {
    expect(isZillowHost("zillow.com")).toBe(true);
    expect(isZillowHost("www.zillow.com")).toBe(true);
    expect(isZillowHost("WWW.Zillow.com")).toBe(true);
  });

  it("rejects lookalike hosts", () => {
    expect(isZillowHost("zillow.com.evil.com")).toBe(false);
    expect(isZillowHost("notzillow.com")).toBe(false);
    expect(isZillowHost("zillow-com.org")).toBe(false);
  });
});

describe("parseZillowUrl", () => {
  it("accepts a canonical homedetails URL", () => {
    const out = parseZillowUrl(
      "https://www.zillow.com/homedetails/1234-Main-St-Austin-TX-78701/12345678_zpid/",
    );
    expect(out).not.toBeNull();
    expect(out!.zpid).toBe("12345678");
    expect(out!.host).toBe("www.zillow.com");
  });

  it("accepts /homes/ and /b/ URL shapes", () => {
    expect(
      parseZillowUrl("https://www.zillow.com/homes/abc/99_zpid/")?.zpid,
    ).toBe("99");
    expect(parseZillowUrl("https://www.zillow.com/b/77_zpid/")?.zpid).toBe("77");
  });

  it("rejects non-https", () => {
    expect(
      parseZillowUrl(
        "http://www.zillow.com/homedetails/foo/12345_zpid/",
      ),
    ).toBeNull();
  });

  it("rejects non-zillow hosts", () => {
    expect(
      parseZillowUrl(
        "https://www.evil.com/homedetails/foo/12345_zpid/",
      ),
    ).toBeNull();
  });

  it("rejects URLs without a zpid", () => {
    expect(parseZillowUrl("https://www.zillow.com/")).toBeNull();
    expect(
      parseZillowUrl("https://www.zillow.com/homes/austin-tx/"),
    ).toBeNull();
  });

  it("rejects credential smuggling via userinfo", () => {
    expect(
      parseZillowUrl(
        "https://user:pass@www.zillow.com/homedetails/foo/12345_zpid/",
      ),
    ).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseZillowUrl("not a url")).toBeNull();
    expect(parseZillowUrl("")).toBeNull();
  });
});
