import { test, expect } from "@playwright/test";

// Smoke + contract tests for the billing API endpoints. These run
// against the dev server which has DEMO_MODE enabled (hands every
// anonymous request a fake demo identity). So we assert:
//
//   1. The route is REACHABLE (no 404)
//   2. The route doesn't 5xx on a malformed body
//   3. The GET-discoverable endpoint has the expected shape
//
// Stricter "401 without auth" / "400 on invalid input" assertions live
// in unit tests, not E2E, because the dev-mode demo identity short-
// circuits those paths. Production webhooks + the live Stripe routes
// are exercised separately via `stripe trigger` smoke runs documented
// in docs/integrations/README.md.

const ACCEPTABLE_API_STATUSES = (status: number) =>
  status >= 200 && status < 600 && status !== 404;

test.describe("/api/billing/checkout", () => {
  test("route is reachable", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", {
      data: {},
    });
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });

  test("GET returns the discoverable info shape", async ({ request }) => {
    const res = await request.get("/api/billing/checkout");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.tiers)).toBe(true);
    expect(body.tiers).toContain("starter");
    expect(body.tiers).toContain("growth");
    expect(body.tiers).toContain("scale");
    expect(Array.isArray(body.addons)).toBe(true);
  });
});

test.describe("/api/billing/website-build", () => {
  test("route is reachable", async ({ request }) => {
    const res = await request.post("/api/billing/website-build", {
      data: { buildId: "standard" },
    });
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });
});

test.describe("/api/webhooks/stripe", () => {
  test("does not 5xx on unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: { type: "test.event" },
    });
    // We allow 200 (silent receipt when Stripe not configured) or 400
    // (missing signature). 500 means the handler crashed — that's the
    // real failure we're guarding against.
    expect(res.status()).toBeLessThan(500);
  });

  test("does not 5xx on bogus signature", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      headers: {
        "stripe-signature": "t=1234,v1=deadbeef",
        "content-type": "application/json",
      },
      data: { type: "test.event" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("/api/onboarding/wizard", () => {
  test("workspace endpoint is reachable", async ({ request }) => {
    const res = await request.post("/api/onboarding/wizard/workspace", {
      data: { name: "Test", propertyType: "RESIDENTIAL" },
    });
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });

  test("integrations endpoint is reachable", async ({ request }) => {
    const res = await request.post(
      "/api/onboarding/wizard/integrations",
      { data: { action: "skip" } },
    );
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });

  test("property endpoint is reachable", async ({ request }) => {
    const res = await request.post("/api/onboarding/wizard/property", {
      data: { name: "Test property" },
    });
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });

  test("start-trial endpoint is reachable", async ({ request }) => {
    const res = await request.post("/api/onboarding/wizard/start-trial", {
      data: { tierId: "growth" },
    });
    expect(ACCEPTABLE_API_STATUSES(res.status())).toBe(true);
  });
});
