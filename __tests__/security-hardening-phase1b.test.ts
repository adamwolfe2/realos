/**
 * Security hardening Phase 1b — structural + unit tests.
 *
 * S5: timing-safe bootstrap secret comparison
 * S4: chatbot lead endpoint uses fail-closed rate limiter
 * S3: audit capture-email idempotency + rate limiting
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// S5 — timing-safe bootstrap secret (structural)
// ---------------------------------------------------------------------------
describe("S5 — bootstrap secret uses timing-safe comparison", () => {
  const bootstrapSrc = readSrc("app/api/admin/bootstrap/route.ts");

  it("imports timingSafeEqual from lib/auth/timing-safe", () => {
    expect(bootstrapSrc).toMatch(/from\s+["']@\/lib\/auth\/timing-safe["']/);
  });

  it("does NOT use !== for secret comparison", () => {
    // The old guard was: `secret !== process.env.BOOTSTRAP_SECRET`
    expect(bootstrapSrc).not.toMatch(/secret\s*!==\s*process\.env\.BOOTSTRAP_SECRET/);
  });

  it("calls timingSafeEqual in the guard", () => {
    expect(bootstrapSrc).toMatch(/timingSafeEqual\(/);
  });
});

// ---------------------------------------------------------------------------
// S5 — timingSafeEqual helper unit tests
// ---------------------------------------------------------------------------
describe("S5 — timingSafeEqual helper", async () => {
  const { timingSafeEqual } = await import("../lib/auth/timing-safe");

  it("returns true for equal strings", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("short", "much-longer-string")).toBe(false);
  });

  it("returns false when one string is empty", () => {
    expect(timingSafeEqual("", "secret")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("handles unicode without throwing", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("αβγ", "αβγ")).toBe(true);
    expect(timingSafeEqual("αβγ", "αβδ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S4 — chatbot lead endpoint rate limiting (structural)
// ---------------------------------------------------------------------------
describe("S4 — chatbot/lead uses fail-closed rate limiter", () => {
  const leadSrc = readSrc("app/api/public/chatbot/lead/route.ts");

  it("imports chatbotLeadLimiter", () => {
    expect(leadSrc).toMatch(/chatbotLeadLimiter/);
  });

  it("does NOT pass softFallback to checkRateLimit for lead submission", () => {
    // softFallback on a lead-capture endpoint would bypass rate limiting
    // when Redis is unconfigured — that must never happen. Check that the
    // checkRateLimit call site itself does not pass a softFallback option.
    const callSite = leadSrc.slice(leadSrc.indexOf("checkRateLimit("));
    const callEnd = callSite.indexOf(");") + 2;
    const call = callSite.slice(0, callEnd);
    expect(call).not.toMatch(/softFallback/);
  });

  it("passes chatbotLeadLimiter to checkRateLimit", () => {
    expect(leadSrc).toMatch(/checkRateLimit\(\s*chatbotLeadLimiter/);
  });

  it("chatbotLeadLimiter is exported from lib/rate-limit.ts", () => {
    const rlSrc = readSrc("lib/rate-limit.ts");
    expect(rlSrc).toMatch(/export\s+const\s+chatbotLeadLimiter/);
  });

  it("chatbotLeadLimiter definition does NOT include a softFallback registration", () => {
    // chatbotLeadLimiter must be a plain createLimiter call, no fallback config.
    const rlSrc = readSrc("lib/rate-limit.ts");
    const chatbotLeadBlock = rlSrc.slice(
      rlSrc.indexOf("chatbotLeadLimiter"),
      rlSrc.indexOf("chatbotLeadLimiter") + 300,
    );
    expect(chatbotLeadBlock).not.toMatch(/softFallback|WIDGET_FALLBACK/);
  });
});

// ---------------------------------------------------------------------------
// S3 — audit capture-email: rate limit + idempotency (structural)
// ---------------------------------------------------------------------------
describe("S3 — audit capture-email mitigation (lightweight path)", () => {
  const captureEmailSrc = readSrc(
    "app/api/audit/[id]/capture-email/route.ts",
  );

  it("imports checkRateLimit + getIp", () => {
    expect(captureEmailSrc).toMatch(/checkRateLimit/);
    expect(captureEmailSrc).toMatch(/getIp/);
  });

  it("imports auditEmailCaptureLimiter", () => {
    expect(captureEmailSrc).toMatch(/auditEmailCaptureLimiter/);
  });

  it("does NOT use softFallback", () => {
    expect(captureEmailSrc).not.toMatch(/softFallback/);
  });

  it("returns 409 when email is already captured (idempotency guard)", () => {
    expect(captureEmailSrc).toMatch(/409/);
    // The guard condition checks audit.email !== null
    expect(captureEmailSrc).toMatch(/audit\.email\s*!==\s*null/);
  });

  it("selects email field from DB to check idempotency", () => {
    // The findUnique must select email to power the idempotency check.
    expect(captureEmailSrc).toMatch(/select:\s*\{[^}]*email:\s*true/);
  });

  it("applies rate limit before DB access", () => {
    // Rate limit check must precede the findUnique call in source order.
    const rlIdx = captureEmailSrc.indexOf("checkRateLimit");
    const dbIdx = captureEmailSrc.indexOf("findUnique");
    expect(rlIdx).toBeGreaterThan(-1);
    expect(dbIdx).toBeGreaterThan(-1);
    expect(rlIdx).toBeLessThan(dbIdx);
  });

  it("auditEmailCaptureLimiter is exported from lib/rate-limit.ts", () => {
    const rlSrc = readSrc("lib/rate-limit.ts");
    expect(rlSrc).toMatch(/export\s+const\s+auditEmailCaptureLimiter/);
  });

  it("email validation uses zod .email()", () => {
    // Strict zod email validation was already present; guard against regression.
    expect(captureEmailSrc).toMatch(/\.email\(\)/);
  });
});

// ---------------------------------------------------------------------------
// S3 — deferred-migration note (documentation guard)
// ---------------------------------------------------------------------------
describe("S3 — captureToken deferred migration is documented", () => {
  it("capture-email route documents the deferred token migration", () => {
    const src = readSrc("app/api/audit/[id]/capture-email/route.ts");
    // A comment explaining why captureToken isn't implemented must exist.
    expect(src.toLowerCase()).toMatch(/migration deferred|deferred/);
  });
});
