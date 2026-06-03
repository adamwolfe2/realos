import { describe, it, expect } from "vitest";
import {
  runOnPageAuditChecks,
  ONPAGE_AUDIT_POINTS_PER_CHECK,
} from "@/lib/aeo/onpage-audit";

const MINIMAL_HTML = "<html><body><p>tiny</p></body></html>";

const RICH_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>About Telegraph Commons — Luxury Berkeley Apartments</title>
  <meta name="description" content="Telegraph Commons offers 1 and 2 bedroom luxury apartments steps from UC Berkeley. Modern finishes, on-site amenities, walkable to campus and downtown." />
  <link rel="canonical" href="https://telegraphcommons.com/about" />
  <meta property="article:modified_time" content="${new Date().toISOString()}" />
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is Telegraph Commons?","acceptedAnswer":{"@type":"Answer","text":"A luxury apartment community."}}]}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Telegraph Commons"}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","headline":"Apartment Living in Berkeley"}
  </script>
</head>
<body>
  <h1>About Telegraph Commons</h1>
  <h2>What is the difference between studio and 1-bedroom units?</h2>
  <p>${"This is a long descriptive paragraph about our amazing apartments. ".repeat(80)}</p>
</body>
</html>
`;

describe("lib/aeo/onpage-audit — runOnPageAuditChecks", () => {
  it("scores 0 on an essentially empty page (all checks fail except neutral freshness)", () => {
    const r = runOnPageAuditChecks(MINIMAL_HTML);
    // Freshness check returns pass on absent dates (neutral), so 1 pass × 12.5
    const passCount = r.checks.filter((c) => c.pass).length;
    expect(passCount).toBe(1);
    expect(r.checks.find((c) => c.key === "freshness")?.pass).toBe(true);
    expect(r.score).toBe(Math.round(ONPAGE_AUDIT_POINTS_PER_CHECK));
  });

  it("scores 100 on a fully-marked-up page", () => {
    const r = runOnPageAuditChecks(RICH_HTML);
    expect(r.score).toBe(100);
    expect(r.checks.every((c) => c.pass)).toBe(true);
  });

  it("detects FAQ JSON-LD", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"FAQPage"}</script></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "faq-schema")?.pass).toBe(true);
  });

  it("detects LocalBusiness as org schema", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"LocalBusiness","name":"X"}</script></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "org-schema")?.pass).toBe(true);
  });

  it("detects BlogPosting as article schema", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"BlogPosting"}</script></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "article-schema")?.pass).toBe(true);
  });

  it("fails canonical when href is empty", () => {
    const html = `<html><head><link rel="canonical" href="" /></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "canonical")?.pass).toBe(false);
  });

  it("fails meta-description on a 20-char description", () => {
    const html = `<html><head><meta name="description" content="too short!" /></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "meta-description")?.pass).toBe(false);
  });

  it("fails meta-description on a 320-char description", () => {
    const tooLong = "a".repeat(320);
    const html = `<html><head><meta name="description" content="${tooLong}" /></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "meta-description")?.pass).toBe(false);
  });

  it("strips scripts and styles before counting words", () => {
    const html = `
      <html><body>
        <script>${"alert('x');".repeat(1000)}</script>
        <style>${".a{}".repeat(1000)}</style>
        <p>tiny body</p>
      </body></html>
    `;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "content-depth")?.pass).toBe(false);
  });

  it("detects a question-form H2", () => {
    const html = `<html><body><h2>What is the rent in Berkeley?</h2></body></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "qa-structure")?.pass).toBe(true);
  });

  it("does NOT count a non-question H2 as Q&A", () => {
    const html = `<html><body><h2>About our community</h2></body></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "qa-structure")?.pass).toBe(false);
  });

  it("flags a 2-year-old article:modified_time as stale", () => {
    const stale = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const html = `<html><head><meta property="article:modified_time" content="${stale}" /></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "freshness")?.pass).toBe(false);
  });

  it("treats absent date metadata as neutral pass", () => {
    const html = `<html><body><p>no date anywhere</p></body></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.checks.find((c) => c.key === "freshness")?.pass).toBe(true);
  });

  it("produces an excerpt combining title + meta description", () => {
    const html = `<html><head><title>Hello</title><meta name="description" content="World." /></head></html>`;
    const r = runOnPageAuditChecks(html);
    expect(r.excerpt).toBe("Hello — World.");
  });

  it("score is deterministic — same HTML always gives same score", () => {
    const a = runOnPageAuditChecks(RICH_HTML);
    const b = runOnPageAuditChecks(RICH_HTML);
    expect(a.score).toBe(b.score);
    expect(a.checks).toEqual(b.checks);
  });
});
