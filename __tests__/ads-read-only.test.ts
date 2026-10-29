import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

// LeaseStack reads customers' ad accounts; it never runs them (Adam,
// 2026-10-29, plans/ads-read-only/slice-plan.md).

describe("Google Ads login-customer-id", () => {
  it("uses the manager the picker stored", async () => {
    const { oauthLoginCustomerId } = await import("@/lib/integrations/google-ads");
    expect(oauthLoginCustomerId({ loginCustomerId: "1112223333" }, "9120004237")).toBe("1112223333");
  });

  it("sends no manager for an account the customer owns directly (picker stored null)", async () => {
    const { oauthLoginCustomerId } = await import("@/lib/integrations/google-ads");
    expect(oauthLoginCustomerId({ loginCustomerId: null, boundAt: "x" }, "9120004237")).toBeNull();
  });

  it("falls back to the env manager only for rows bound before the key existed", async () => {
    const { oauthLoginCustomerId } = await import("@/lib/integrations/google-ads");
    expect(oauthLoginCustomerId({ boundAt: "x" }, "9120004237")).toBe("9120004237");
    expect(oauthLoginCustomerId(null, null)).toBeNull();
  });
});

describe("ads are read-only", () => {
  it("Meta asks for ads_read only", () => {
    const src = readFileSync("lib/integrations/oauth-config.ts", "utf8");
    expect(src).toContain(`metaConfig(["ads_read"])`);
    expect(src).not.toMatch(/ads_management|business_management/);
  });

  it("no ad-platform code calls a write endpoint", () => {
    const files = execSync("git ls-files lib/integrations lib/actions app/api", { encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f) && /(google-ads|meta-ads|ads-sync)/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/:mutate\b|googleAds:mutate|\/adcreatives"?\s*,\s*\{\s*method:\s*"POST"/);
    }
  });

  it("no portal copy says we run or manage their ads", () => {
    const hits = execSync(
      `git grep -niE "we (run|build|launch) (and run )?your (google |meta |facebook )?(ads|campaigns)|managed (google |meta )ads|add us as a partner" -- app components lib || true`,
      { encoding: "utf8" },
    ).trim();
    expect(hits).toBe("");
  });
});
