import { describe, it, expect } from "vitest";
import { normalizeUrl, hashUrl } from "@/lib/reputation/dedupe";

describe("lib/reputation/dedupe — normalizeUrl", () => {
  it("treats http and https as equivalent", () => {
    const a = normalizeUrl("http://www.reddit.com/r/berkeley/comments/abc/foo");
    const b = normalizeUrl("https://www.reddit.com/r/berkeley/comments/abc/foo");
    expect(a).toBe(b);
  });

  it("collapses reddit host variants", () => {
    const a = normalizeUrl("https://old.reddit.com/r/berkeley/comments/abc");
    const b = normalizeUrl("https://www.reddit.com/r/berkeley/comments/abc");
    const c = normalizeUrl("https://reddit.com/r/berkeley/comments/abc");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("strips common tracking params but preserves semantic ones", () => {
    const a = normalizeUrl(
      "https://www.yelp.com/biz/x?utm_source=email&utm_campaign=drip&sort=new"
    );
    const b = normalizeUrl("https://www.yelp.com/biz/x?sort=new");
    expect(a).toBe(b);
  });

  it("drops fragments", () => {
    const a = normalizeUrl("https://example.com/path#section-1");
    const b = normalizeUrl("https://example.com/path");
    expect(a).toBe(b);
  });

  it("collapses trailing slash except at root", () => {
    const a = normalizeUrl("https://example.com/foo/");
    const b = normalizeUrl("https://example.com/foo");
    expect(a).toBe(b);
    // Root path keeps its slash because `URL` keeps it; we only normalize
    // trailing slash on non-root paths.
    const root = normalizeUrl("https://example.com/");
    expect(root).toMatch(/example\.com\/?$/);
  });

  it("produces stable hashes across equivalent URLs", () => {
    const hashes = [
      hashUrl("http://old.Reddit.com/r/berkeley/comments/abc/?utm_source=x#top"),
      hashUrl("https://www.reddit.com/r/berkeley/comments/abc"),
      hashUrl("HTTPS://www.reddit.com/r/berkeley/comments/abc/"),
    ];
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[1]).toBe(hashes[2]);
  });

  it("different paths hash differently", () => {
    expect(hashUrl("https://example.com/a")).not.toBe(
      hashUrl("https://example.com/b")
    );
  });

  it("normalizes invalid URLs by lowercasing and trimming", () => {
    const a = normalizeUrl("  NOT A URL  ");
    expect(a).toBe("not a url");
  });
});
