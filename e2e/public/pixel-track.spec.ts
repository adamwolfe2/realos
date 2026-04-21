import { test, expect } from "@playwright/test";
import { readTestState } from "../helpers/state";

// @critical
// The pixel ingest endpoint is what powers visitor identification across
// every tenant marketing site. We assert two things:
//   1. POST without a key returns 401 (auth surface guarded).
//   2. POST with the seeded key returns 200 + a sessionToken (pipeline
//      writes a VisitorSession + VisitorEvent successfully).
//
// We don't load the script tag / browser snippet here because the snippet
// itself is just a thin wrapper around fetch(). Hitting the endpoint
// directly catches the same bugs faster and without flakiness.

test.describe("Pixel ingest @critical", () => {
  test("rejects requests without a public key", async ({ request }) => {
    const resp = await request.post("/api/public/visitors/track", {
      data: {
        anonymousId: "anon_no_key",
        events: [{ type: "pageview", path: "/" }],
      },
    });
    expect(resp.status()).toBe(401);
  });

  test("accepts a pageview event with a valid pk_site_* key", async ({
    request,
  }) => {
    const { publicSiteKey } = readTestState();
    expect(publicSiteKey).toMatch(/^pk_site_/);

    const resp = await request.post("/api/public/visitors/track", {
      data: {
        publicKey: publicSiteKey,
        anonymousId: `anon_e2e_${Date.now()}`,
        context: {
          url: "https://example.com/test",
          referrer: "",
          userAgent: "PlaywrightE2E/1.0",
        },
        events: [
          {
            type: "pageview",
            url: "https://example.com/test",
            path: "/test",
            title: "E2E pixel smoke test",
          },
        ],
      },
    });

    expect(
      resp.status(),
      `track endpoint returned ${resp.status()}: ${await resp.text()}`
    ).toBeLessThan(400);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(typeof body.sessionToken).toBe("string");
    expect(body.processed).toBeGreaterThanOrEqual(1);
  });

  test("public pixel script is served for the seeded key", async ({
    request,
  }) => {
    const { publicSiteKey } = readTestState();
    const resp = await request.get(`/api/public/pixel/${publicSiteKey}.js`);
    expect(resp.status()).toBeLessThan(400);
    const text = await resp.text();
    // The snippet exposes window.rePixel; bail loudly if that contract changes.
    expect(text).toContain("rePixel");
  });
});
