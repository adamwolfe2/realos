import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getProviderAvailability } from "@/lib/connect/provider-availability";

// ---------------------------------------------------------------------------
// Provider availability gates the entire Connect Hub UX. A regression here
// either (a) shows operators "Connect" buttons that route to a 503 (bad
// experience) or (b) hides connectable sources behind "Coming soon" forever
// (operator stuck). This suite locks the env-var → availability matrix.
//
// Each provider has explicit AGENCY-CONFIG-INDEPENDENT or DEPENDENT semantics:
//   appfolio       — operator BYO creds → always available
//   ga4            — Google OAuth → gated by OAUTH_ENABLED + OAuth client
//   gsc            — Google OAuth → same as ga4
//   google_ads     — Google OAuth + dev token → gated by both
//   meta_ads       — Meta OAuth + Marketing API approval → gated by both
//   cursive_pixel  — ops provisions manually → always available
//   website        — operator types URL → always available
// ---------------------------------------------------------------------------

// Snapshot the parent env once so we can restore between cases.
const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function clearAllRelevantEnv() {
  setEnv({
    OAUTH_ENABLED: undefined,
    OAUTH_CALLBACK_BASE_URL: undefined,
    GOOGLE_OAUTH_CLIENT_ID: undefined,
    GOOGLE_OAUTH_CLIENT_SECRET: undefined,
    META_OAUTH_APP_ID: undefined,
    META_OAUTH_APP_SECRET: undefined,
    GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
    META_AD_LIBRARY_TOKEN: undefined,
  });
}

describe("getProviderAvailability", () => {
  beforeEach(() => {
    clearAllRelevantEnv();
  });

  afterAll(() => {
    // Restore original env after the whole file runs.
    process.env = ORIGINAL_ENV;
  });

  describe("operator-config sources (always available)", () => {
    it("appfolio is available regardless of agency env", () => {
      const av = getProviderAvailability();
      expect(av.appfolio.available).toBe(true);
      expect(av.appfolio.reason).toBeNull();
    });

    it("cursive_pixel is available regardless of agency env", () => {
      const av = getProviderAvailability();
      expect(av.cursive_pixel.available).toBe(true);
      expect(av.cursive_pixel.reason).toBeNull();
    });

    it("website is available regardless of agency env", () => {
      const av = getProviderAvailability();
      expect(av.website.available).toBe(true);
      expect(av.website.reason).toBeNull();
    });
  });

  describe("Google OAuth providers (GA4, GSC)", () => {
    it("ga4/gsc are NOT available when OAUTH_ENABLED is unset", () => {
      const av = getProviderAvailability();
      expect(av.ga4.available).toBe(false);
      expect(av.gsc.available).toBe(false);
      expect(av.ga4.reason).toContain("Google OAuth setup");
      expect(av.gsc.reason).toContain("Google OAuth setup");
    });

    it("ga4/gsc are NOT available when OAUTH_ENABLED=true but client IDs missing", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
      });
      const av = getProviderAvailability();
      expect(av.ga4.available).toBe(false);
      expect(av.gsc.available).toBe(false);
    });

    it("ga4/gsc ARE available with full Google OAuth env", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
        GOOGLE_OAUTH_CLIENT_ID: "test-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
      });
      const av = getProviderAvailability();
      expect(av.ga4.available).toBe(true);
      expect(av.gsc.available).toBe(true);
      expect(av.ga4.reason).toBeNull();
      expect(av.gsc.reason).toBeNull();
    });
  });

  describe("Google Ads (requires OAuth; dev token is downstream)", () => {
    // Product contract (see lib/connect/provider-availability.ts NOTE):
    // OAuth is the only gate for the Connect flow itself. The developer
    // token only gates downstream API calls. Basic Access was granted
    // on 2026-06-01 (MCC 912-000-4237); this branch now only fires if
    // the dev-token env var is missing on a given deploy.
    it("IS connectable with OAuth ready (missing dev-token env surfaces soft note)", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
        GOOGLE_OAUTH_CLIENT_ID: "test-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
      });
      const av = getProviderAvailability();
      expect(av.google_ads.available).toBe(true);
      expect(av.google_ads.reason).toContain("developer-token");
    });

    it("is NOT available with dev token but no OAuth", () => {
      setEnv({ GOOGLE_ADS_DEVELOPER_TOKEN: "test-token" });
      const av = getProviderAvailability();
      expect(av.google_ads.available).toBe(false);
      // Reason should mention OAuth setup since that's the upstream gate
      expect(av.google_ads.reason).toContain("Google OAuth setup");
    });

    it("IS available cleanly with full Google OAuth + dev token", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
        GOOGLE_OAUTH_CLIENT_ID: "test-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
        GOOGLE_ADS_DEVELOPER_TOKEN: "test-token",
      });
      const av = getProviderAvailability();
      expect(av.google_ads.available).toBe(true);
      expect(av.google_ads.reason).toBeNull();
    });
  });

  describe("Meta Ads (requires OAuth; Marketing API token is downstream)", () => {
    it("is NOT available with no Meta env at all", () => {
      const av = getProviderAvailability();
      expect(av.meta_ads.available).toBe(false);
      expect(av.meta_ads.reason).toContain("Meta Business verification");
    });

    // Same pattern as google_ads — OAuth is the only gate; Marketing API
    // Standard Access is downstream and surfaces as a soft "in flight" note.
    it("IS connectable with OAuth ready (Ad Library token in flight surfaces soft note)", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
        META_OAUTH_APP_ID: "app-id",
        META_OAUTH_APP_SECRET: "app-secret",
      });
      const av = getProviderAvailability();
      expect(av.meta_ads.available).toBe(true);
      expect(av.meta_ads.reason).toContain("Standard Access");
    });

    it("IS available cleanly with full Meta OAuth + Ad Library token", () => {
      setEnv({
        OAUTH_ENABLED: "true",
        OAUTH_CALLBACK_BASE_URL: "https://www.leasestack.co",
        META_OAUTH_APP_ID: "app-id",
        META_OAUTH_APP_SECRET: "app-secret",
        META_AD_LIBRARY_TOKEN: "library-token",
      });
      const av = getProviderAvailability();
      expect(av.meta_ads.available).toBe(true);
      expect(av.meta_ads.reason).toBeNull();
    });
  });

  describe("shape invariants", () => {
    it("returns an entry for every known provider id", () => {
      const av = getProviderAvailability();
      expect(av).toHaveProperty("appfolio");
      expect(av).toHaveProperty("ga4");
      expect(av).toHaveProperty("gsc");
      expect(av).toHaveProperty("google_ads");
      expect(av).toHaveProperty("meta_ads");
      expect(av).toHaveProperty("cursive_pixel");
      expect(av).toHaveProperty("website");
    });

    it("every entry has the {available, reason, eta} shape", () => {
      const av = getProviderAvailability();
      for (const [, entry] of Object.entries(av)) {
        expect(typeof entry.available).toBe("boolean");
        expect(entry.reason === null || typeof entry.reason === "string").toBe(
          true,
        );
        expect(entry.eta === null || typeof entry.eta === "string").toBe(true);
      }
    });

    it("unavailable entries always have a non-empty reason", () => {
      const av = getProviderAvailability();
      for (const [id, entry] of Object.entries(av)) {
        if (!entry.available) {
          expect(
            entry.reason,
            `Provider ${id} is unavailable but has no reason`,
          ).toBeTruthy();
          expect(entry.reason!.length).toBeGreaterThan(20);
        }
      }
    });
  });
});
