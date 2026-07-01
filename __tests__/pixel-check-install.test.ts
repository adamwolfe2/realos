import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { detectPixelInstall } from "@/lib/pixel/detect-install";

/**
 * Slice 1b — server-side pixel install verification. Replaces "paste-and-pray"
 * with a real check that the Cursive loader is on the client's page. The probe
 * fetches a user-controlled URL, so the route MUST keep the vetted SSRF guard,
 * byte cap, and timeout (mirrors the popup check-embed probe).
 */

const OK_SNIPPET =
  '<script src="https://cdn.idpixel.app/v1/idp-analytics-abc123.min.js" defer></script>';

describe("detectPixelInstall (Slice 1b pure detector)", () => {
  it("reports DETECTED_OK when the loader matches the expected pixel id", () => {
    const r = detectPixelInstall(`<head>${OK_SNIPPET}</head>`, "abc123");
    expect(r.status).toBe("DETECTED_OK");
    expect(r.ok).toBe(true);
    expect(r.detectedPixelId).toBe("abc123");
  });

  it("reports DETECTED_OK when the pixel id is not yet known (loader present)", () => {
    const r = detectPixelInstall(`<head>${OK_SNIPPET}</head>`, null);
    expect(r.status).toBe("DETECTED_OK");
    expect(r.ok).toBe(true);
  });

  it("reports DETECTED_WRONG_PIXEL on a paste error (different id)", () => {
    const r = detectPixelInstall(`<head>${OK_SNIPPET}</head>`, "zzz999");
    expect(r.status).toBe("DETECTED_WRONG_PIXEL");
    expect(r.ok).toBe(false);
    expect(r.detectedPixelId).toBe("abc123");
  });

  it("reports NOT_DETECTED when no idpixel loader is present", () => {
    const r = detectPixelInstall(
      '<head><script src="https://example.com/other.js"></script></head>',
      "abc123",
    );
    expect(r.status).toBe("NOT_DETECTED");
    expect(r.ok).toBe(false);
    expect(r.detectedPixelId).toBeNull();
  });

  it("does not match a non-idpixel script that merely mentions idp-analytics", () => {
    const r = detectPixelInstall(
      '<script src="https://evil.example.com/idp-analytics-abc123.js"></script>',
      "abc123",
    );
    expect(r.status).toBe("NOT_DETECTED");
  });
});

describe("pixel check-install route — security posture (Slice 1b)", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../app/api/portal/pixel/check-install/route.ts"),
    "utf-8",
  );

  it("is tenant-scoped (requireScope) and not public", () => {
    expect(src).toContain("requireScope");
    expect(src).toContain("ForbiddenError");
  });

  it("SSRF-guards the outbound fetch with isAllowedUrlWithDns before probing", () => {
    expect(src).toContain("isAllowedUrlWithDns");
    // Guard result gates the request.
    expect(src).toMatch(/if\s*\(\s*!allowed\s*\)/);
  });

  it("bounds the fetch with a timeout and a byte cap", () => {
    expect(src).toContain("FETCH_TIMEOUT_MS");
    expect(src).toContain("AbortController");
    expect(src).toContain("MAX_HTML_BYTES");
  });

  it("caches per-URL so rapid re-checks don't fan out into repeated scrapes", () => {
    expect(src).toContain("unstable_cache");
  });

  it("does NOT accept a request-supplied ?url (no authenticated egress proxy)", () => {
    // Probe target must derive strictly from the caller's own org records.
    expect(src).not.toContain('searchParams.get("url")');
    expect(src).not.toContain("urlOverride");
  });

  it("does not echo the raw fetch error string back to the caller", () => {
    expect(src).not.toContain("Couldn't reach the website: ${msg}");
  });
});
