import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Regression guards for recent shipped fixes.
//
// Each `describe` block locks in the invariant from one fix commit so a
// future refactor can't silently re-break the same thing. Structural
// assertions only — these don't run the code, just scan the source for
// the guard pattern. That's deliberate: the underlying fixes touch
// external services (Anthropic structured output, DataforSEO HTTP auth,
// AEO orchestrator persistence) that we don't want to mock here.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// Commit 0c04934 — fix(aeo): persist correct mentioned flag
//
// COMPETITOR_CITED responses (engine named a rival, not the brand) must
// persist mentioned=FALSE so the AEO dashboard's mention rate is honest.
// Previously every row got mentioned=TRUE, overstating mention rate by
// 88pp on real demo data.
// ---------------------------------------------------------------------------
describe("AEO orchestrator — mentioned flag semantics (commit 0c04934)", () => {
  it("file exists", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/aeo/orchestrate.ts"))).toBe(true);
  });

  it("every aeoCitationCheck.create site computes mentioned via the CITED-only guard", () => {
    const src = readSrc("lib/aeo/orchestrate.ts");
    const createSites = Array.from(
      src.matchAll(/aeoCitationCheck\.create\s*\(\{/g),
    );
    expect(
      createSites.length,
      "expected ≥ 2 aeoCitationCheck.create call sites",
    ).toBeGreaterThanOrEqual(2);

    const guardPattern =
      /(?:mentioned\s*[:=]\s*parsed\.status\s*===\s*["']CITED["']|const\s+mentioned\s*=\s*parsed\.status\s*===\s*["']CITED["'])/g;
    const guards = (src.match(guardPattern) ?? []).length;

    expect(
      guards,
      `Each aeoCitationCheck.create site must compute mentioned via parsed.status === "CITED" (found ${guards} guards, ${createSites.length} create sites)`,
    ).toBeGreaterThanOrEqual(createSites.length);
  });

  it("never sets mentioned: true unconditionally", () => {
    const src = readSrc("lib/aeo/orchestrate.ts");
    expect(/mentioned\s*:\s*true\b/.test(src)).toBe(false);
    expect(/mentioned\s*:\s*!!\s*parsed\.citedUrl/.test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Commit ce79c0c — fix(dataforseo): trim trailing \n from creds
//
// Vercel env-var paste flow regularly bakes a trailing "\n" (literal
// backslash-n) OR an actual newline into stored values. HTTP Basic Auth
// is byte-exact in its base64 payload, so a single trailing char turns
// every call into a 401. The fix replaces \s and literal \n in the env
// value before constructing the Basic auth header.
// ---------------------------------------------------------------------------
describe("DataforSEO credentials — defensive paste-cleanup (commit ce79c0c)", () => {
  it("file exists", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/seo/dataforseo.ts"))).toBe(true);
  });

  it("strips whitespace + literal backslash-n from both login and password", () => {
    const src = readSrc("lib/seo/dataforseo.ts");

    // Both env vars must run through replace(...) + .trim() with a regex
    // that strips at least \s and literal \n. The simplest robust check
    // is to find each env-var reference and confirm it's followed (in the
    // next ~120 chars) by .replace(...) AND .trim(). This catches the
    // current implementation and any reasonable refactor.
    function isSanitized(envVar: string): boolean {
      // Locate the FIRST `process.env.<envVar>` reference (not the
      // mention in comments), then look ahead for the sanitization
      // chain. The next 200 chars catches reasonable formatting.
      const ref = `process.env.${envVar}`;
      const idx = src.indexOf(ref);
      if (idx === -1) return false;
      const tail = src.slice(idx, idx + 200);
      return /\.replace\(/.test(tail) && /\.trim\(\)/.test(tail);
    }

    expect(
      isSanitized("DATAFORSEO_LOGIN"),
      "DATAFORSEO_LOGIN env var must be sanitized via .replace(...).trim() to survive paste corruption",
    ).toBe(true);
    expect(
      isSanitized("DATAFORSEO_PASSWORD"),
      "DATAFORSEO_PASSWORD env var must be sanitized the same way",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Commit bacce18 — fix(drafter): unblock generateObject
//
// Anthropic's structured-output API (used by ai-sdk generateObject under
// the hood) rejects JSON Schema array constraints minItems > 1 or any
// maxItems. The fix removed .min(N) and .max(N) from arrays in the
// draft-writer Zod schemas; count targets now come from the prompt
// instead. A regression that re-adds .min(2+).max(N) to those arrays
// would silently fail every draft generation call.
// ---------------------------------------------------------------------------
describe("Draft writer schemas — no array min/max > 1 (commit bacce18)", () => {
  it("file exists", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/seo/draft-writer.ts"))).toBe(
      true,
    );
  });

  it("no .min(N) where N > 1 on z.array(...) chains", () => {
    const src = readSrc("lib/seo/draft-writer.ts");
    // Match any z.array(...).min(N) within ~600 chars (the schema bodies
    // get nested). For each match, capture N and assert it's 0 or 1.
    const arrayMinPattern =
      /z\.array\([\s\S]{1,800}?\)(?:\s*\.[a-zA-Z]+\([^)]*\))*?\s*\.min\((\d+)\)/g;
    const violations: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = arrayMinPattern.exec(src))) {
      const n = parseInt(m[1] ?? "0", 10);
      if (n > 1) violations.push(n);
    }
    expect(
      violations.length,
      `Found .min(N>1) on a z.array — Anthropic structured output rejects this and breaks generateObject. Violating counts: ${violations.join(", ")}`,
    ).toBe(0);
  });

  it("no .max(N) on z.array(...) chains", () => {
    const src = readSrc("lib/seo/draft-writer.ts");
    // Catch any z.array().max(N) — Anthropic rejects maxItems entirely.
    const arrayMaxPattern =
      /z\.array\([\s\S]{1,800}?\)(?:\s*\.[a-zA-Z]+\([^)]*\))*?\s*\.max\(\d+\)/g;
    const matches = src.match(arrayMaxPattern) ?? [];
    expect(
      matches.length,
      `Found .max(N) on a z.array — Anthropic structured output rejects maxItems. Move count guidance to the prompt.`,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Commit 865a224 — fix(seo-chart): auto-trim leading zero history
//
// The 12-week score-history chart was rendering a flat line on the left
// edge whenever the org's history started fewer than 12 weeks ago — the
// missing weeks were zero-padded. The fix trims leading zero rows before
// charting so the curve fills the canvas. Regression: someone adds
// padding-on-load and zero-rows reappear.
// ---------------------------------------------------------------------------
describe("SEO score chart — leading-zero trim guard (commit 865a224)", () => {
  it("trimLeadingZeros (or equivalent) is called in the timeseries chart", () => {
    const filePath = "app/portal/seo/seo-timeseries-chart.tsx";
    expect(
      fs.existsSync(path.join(ROOT, filePath)),
      `Expected SEO timeseries chart at ${filePath}`,
    ).toBe(true);
    const src = readSrc(filePath);
    // Either the named helper or a recognizable inline trim pattern must
    // be present. The named helper is the canonical implementation.
    const hasTrimGuard =
      /trimLeadingZeros|skipLeadingZeros|dropLeadingZero/.test(src) ||
      /findIndex\([\s\S]{0,200}?[!=]==?\s*0/.test(src);
    expect(
      hasTrimGuard,
      `Expected ${filePath} to trim leading zero history rows before charting (commit 865a224).`,
    ).toBe(true);
  });
});
