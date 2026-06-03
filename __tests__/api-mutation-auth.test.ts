import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Structural guard: every API route that handles POST/PUT/DELETE/PATCH must
// either authenticate the caller OR rate-limit the endpoint (or both).
//
// We exclude /api/cron/* (CRON_SECRET-gated), /api/webhooks/* (signature-
// verified by the upstream provider), and /api/health (intentionally
// public). Everything else needs SOMETHING.
//
// The check is structural — scans the source for a recognized auth or
// rate-limit pattern. If a new gating helper ships, add its symbol to
// AUTH_HELPERS so the test recognizes it. The intent is to catch the
// "forgot to add `await requireScope()`" class of bug at PR time.
//
// Companion to rate-limit-coverage.test.ts (which checks a specific
// allow-list) and auth-boundaries.test.ts (which checks SSR pages).
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(ROOT, "app/api");

// Any of these in the route source means SOME form of gating is in place.
const AUTH_HELPERS = [
  // Scope / org helpers
  "requireScope",
  "requireAgency",
  "requireUser",
  "requireSuperAdmin",
  "requireScopeOrApi",
  "requireApiKey",
  "requireAdmin",
  "getScope",
  // Clerk primitives
  "auth()",
  "currentUser()",
  // Cron + webhook helpers
  "verifyCronAuth",
  "verifyClerkWebhook",
  "verifyStripeSignature",
  "verifyBlooSignature",
  "verifyBlooioSignature",
  "verifyAudienceLab",
  "verifyCursive",
  "verifyResendSignature",
  "verifyCalcomSignature",
  // Composite gates
  "guardIngest",
  "startImpersonation",
  "endImpersonation",
  // Token-signed flows
  "requireBootstrapSecret",
  "BOOTSTRAP_SECRET",
  "validateUnsubscribeToken",
  "verifyEmailUnsubToken",
  "verifyToken",
  "verifySignature",
  "CAL_WEBHOOK_SECRET",
];

const RATE_LIMIT_PATTERN =
  /checkRateLimit|isRateLimited|rateLimiter|Ratelimit\(|enforceLimit|inMemoryRateLimit/i;
const MUTATION_PATTERN = /export\s+async\s+function\s+(POST|PUT|DELETE|PATCH)/;

// Paths we deliberately exclude from the check:
const EXCLUDED_PATH_FRAGMENTS = [
  "/cron/", // CRON_SECRET-gated end-to-end
  "/webhooks/", // signature verified per provider
  "/health/", // intentional public probe
];

// Routes that are deliberately ungated (deprecated 410 redirects, public
// status probes that should NOT have rate limiting because they need to
// answer health checks at high frequency, etc). Each entry should have a
// comment explaining WHY it's exempt.
const KNOWN_PUBLIC_ALLOWLIST: Record<string, string> = {
  "app/api/bootstrap/route.ts":
    "Deprecated route, returns 410 to point callers at /api/admin/bootstrap. No business logic.",

  // ── Public audit / lead-magnet endpoints ─────────────────────────────
  // The /audit flow is a public lead-magnet (anyone can submit a domain
  // for an AEO/SEO scan; gating it behind auth would defeat its
  // purpose). Each endpoint applies its own protection layer (token
  // validation, per-domain 14-day dedupe, cost caps) — they're not
  // anonymous mutation surfaces. Adding the regex-recognized
  // rate-limiter helpers here is the follow-up.
  "app/api/audit/start/route.ts":
    "Public lead-magnet entry. Protected by 14-day domain dedupe + DataForSEO cost caps. Rate-limiter wiring is a follow-up.",
  "app/api/audit/run/[id]/route.ts":
    "Fire-and-forget internal trigger from /api/audit/start, guarded by `x-internal-trigger: CRON_SECRET` header.",
  "app/api/audit/[id]/capture-email/route.ts":
    "Public email-gate on the audit viewer. Token-scoped; the email is the prospect's own.",
  "app/api/audit/[id]/rerun/route.ts":
    "Public re-scan trigger on the audit viewer. Token-scoped + 14-day dedupe.",

  // ── Marketplace session-based endpoints ──────────────────────────────
  // The marketplace runs its own session layer (signed cookies via
  // `lib/marketplace/auth`) instead of Clerk. Auth IS present but the
  // helper isn't in AUTH_HELPERS yet. Listing here as a known gap until
  // we extend AUTH_HELPERS to recognize the marketplace session helpers.
  "app/api/marketplace/auth/request/route.ts":
    "Marketplace magic-link request. Public by design — issues a one-time login token to the supplied email.",
  "app/api/marketplace/auth/sign-out/route.ts":
    "Marketplace sign-out — clears the cookie. Idempotent and harmless when unauthenticated.",
  "app/api/marketplace/seller-auth/request/route.ts":
    "Seller magic-link request — same pattern as buyer-side auth/request.",
  "app/api/marketplace/seller-auth/sign-out/route.ts":
    "Seller sign-out — clears the cookie. Idempotent.",
  "app/api/marketplace/leads/[id]/checkout/route.ts":
    "Marketplace session-gated via getMarketplaceSession() (not yet in AUTH_HELPERS regex).",
  "app/api/marketplace/seller/import-csv/route.ts":
    "Seller session-gated via getSellerSession() (not yet in AUTH_HELPERS regex).",
  "app/api/marketplace/seller/import-cursive/route.ts":
    "Seller session-gated via getSellerSession() (not yet in AUTH_HELPERS regex).",
  "app/api/marketplace/seller/import-preview/route.ts":
    "Seller session-gated via getSellerSession() (not yet in AUTH_HELPERS regex).",
  "app/api/marketplace/streams/route.ts":
    "SSE stream. Token-validated per connection; mutation pattern matches but no state writes from clients.",

  // ── Other ────────────────────────────────────────────────────────────
  "app/api/site-requests/upload/route.ts":
    "Tenant-site brief upload. Currently public by design (intake form); follow-up to require an intake token. Tracked separately.",
};

function findRouteFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") out.push(full);
    }
  }
  walk(API_DIR);
  return out;
}

describe("API mutation endpoints — auth or rate-limit coverage", () => {
  const routes = findRouteFiles();

  it("scans every route.ts under app/api", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("every mutation endpoint has auth, rate-limiting, or is explicitly allowlisted", () => {
    const violations: string[] = [];

    for (const route of routes) {
      const rel = path.relative(ROOT, route);
      if (EXCLUDED_PATH_FRAGMENTS.some((frag) => rel.includes(frag))) continue;

      const src = fs.readFileSync(route, "utf-8");
      if (!MUTATION_PATTERN.test(src)) continue;

      const hasAuth = AUTH_HELPERS.some((h) => src.includes(h));
      const hasRateLimit = RATE_LIMIT_PATTERN.test(src);
      if (hasAuth || hasRateLimit) continue;

      if (rel in KNOWN_PUBLIC_ALLOWLIST) continue;

      violations.push(rel);
    }

    expect(
      violations,
      `These mutation endpoints have no auth gate AND no rate limiting. Either add an AUTH_HELPERS-listed gate, add rate limiting, or add them to KNOWN_PUBLIC_ALLOWLIST with a justification.\n\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("KNOWN_PUBLIC_ALLOWLIST entries all still exist", () => {
    for (const rel of Object.keys(KNOWN_PUBLIC_ALLOWLIST)) {
      expect(
        fs.existsSync(path.join(ROOT, rel)),
        `Allowlist entry ${rel} no longer exists — remove it from KNOWN_PUBLIC_ALLOWLIST.`,
      ).toBe(true);
    }
  });
});
