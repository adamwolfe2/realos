import { describe, expect, it } from "vitest";
import {
  sanitizeMentionExcerpt,
  isExcerptTruncated,
} from "@/lib/reports/sanitize-excerpt";

describe("sanitizeMentionExcerpt", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(sanitizeMentionExcerpt(null)).toBe("");
    expect(sanitizeMentionExcerpt(undefined)).toBe("");
    expect(sanitizeMentionExcerpt("")).toBe("");
  });

  it("leaves clean review prose intact below the cap", () => {
    const review =
      "Jake from the Kitredge has been the most pleasant experience. Quick to respond, friendly, and professional.";
    expect(sanitizeMentionExcerpt(review)).toBe(review);
  });

  it("strips markdown headings, bullets, and links", () => {
    const md =
      "# Telegraph Commons\n\n- BBB Accredited\n- Property Management\n\nVisit our [official site](https://example.com) for more info on the property.";
    const out = sanitizeMentionExcerpt(md);
    expect(out).not.toContain("#");
    expect(out).not.toContain("[");
    expect(out).not.toContain("(https://");
    expect(out).toContain("official site");
  });

  it("strips a BBB-style scraped page down to a coherent snippet", () => {
    const bbbDump = `Copy this link

Business Profile
Property Management

Telegraph Commons

This business isNOT BBB Accredited.Find BBB Accredited Businesses inProperty Management.

(844) 331-6372Write a Review

Main
Reviews
Complaints

## Table of Contents

Overview
BBB Accreditation & Rating
Business Details
Industry Tip
More Resources
Featured Content

# About

## Overview

Own this business?

## Telegraph Commons

2490 Channing Way

Berkeley, CA 94704

View Service Area close
## Serving the following areas:

Berkeley, CA

## BBB Accreditation & Rating

### Telegraph Commons is NOT a BBB Accredited Business.

To become accredited, a business must agree toBBB Standards for Trustand pass BBB's vetting process.`;
    const out = sanitizeMentionExcerpt(bbbDump);
    // Should not include the navigation chrome
    expect(out).not.toMatch(/Copy this link/i);
    expect(out).not.toMatch(/^Main\b/);
    expect(out).not.toMatch(/Table of Contents/i);
    // Should contain the actual substantive sentence
    expect(out).toMatch(/become accredited/i);
    // Should be under the cap with ellipsis
    expect(out.length).toBeLessThanOrEqual(260);
  });

  it("truncates long reviews at a word boundary with an ellipsis", () => {
    const long =
      "This is a wonderful apartment complex that we have lived in for two years. " +
      "The staff is friendly, the maintenance is responsive, and the location is excellent. " +
      "We have recommended it to multiple friends who have also moved in and love it here too.";
    const out = sanitizeMentionExcerpt(long, 100);
    expect(out.length).toBeLessThanOrEqual(101); // includes ellipsis
    expect(out.endsWith("…")).toBe(true);
    // No mid-word cut
    expect(out).not.toMatch(/\s\w{1,2}…$/);
  });

  it("collapses whitespace and newlines", () => {
    const messy = "Hello.\n\n\nThis    is    spaced.\n\n  Final line ends here.";
    const out = sanitizeMentionExcerpt(messy);
    expect(out).not.toMatch(/\n/);
    expect(out).not.toMatch(/ {2,}/);
  });

  it("falls back to original text if filtering kills everything", () => {
    // A short review with no punctuation would be filtered out — fallback
    // keeps it so the card isn't empty.
    const shortNoPunct = "great place to live";
    const out = sanitizeMentionExcerpt(shortNoPunct);
    expect(out).toBe("great place to live");
  });

  it("drops phone-number-only lines but keeps prose around them", () => {
    const mixed =
      "Telegraph Commons offers spacious units close to UC Berkeley campus.\n\n(510) 692-4214\n\nLeasing office open seven days a week.";
    const out = sanitizeMentionExcerpt(mixed);
    expect(out).toMatch(/Telegraph Commons offers/);
    expect(out).toMatch(/Leasing office/);
    expect(out).not.toMatch(/\(510\) 692-4214/);
  });
});

describe("isExcerptTruncated", () => {
  it("returns false when the raw excerpt fits", () => {
    expect(isExcerptTruncated("Short review.")).toBe(false);
  });

  it("returns true when content was clipped", () => {
    const long = "x".repeat(500) + " words words words words words words words";
    expect(isExcerptTruncated(long)).toBe(true);
  });

  it("returns false for null/empty input", () => {
    expect(isExcerptTruncated(null)).toBe(false);
    expect(isExcerptTruncated("")).toBe(false);
  });
});
