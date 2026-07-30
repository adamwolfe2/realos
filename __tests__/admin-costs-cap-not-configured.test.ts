import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for ADMIN-OPS-D002: /admin/costs showed a fake $200/mo cap by
// default when COST_MONTHLY_CAP_USD was unset, instead of "Not configured".
// readUsdCap's own CapStatus consumer already special-cases `null` correctly
// — the bug was the page passing a non-null fallback (200) for the env-unset
// case, which made that null-check path unreachable.
// ---------------------------------------------------------------------------

import { readUsdCap } from "@/app/admin/costs/page";

const ENV_KEY = "COST_MONTHLY_CAP_USD_TEST";

describe("readUsdCap (ADMIN-OPS-D002)", () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  it("returns the fallback (null) when the env var is unset", () => {
    expect(readUsdCap(ENV_KEY, null)).toBeNull();
  });

  it("returns the parsed numeric value when the env var is set", () => {
    process.env[ENV_KEY] = "350";
    expect(readUsdCap(ENV_KEY, null)).toBe(350);
  });

  it("falls back to null for a garbage (non-numeric) env value, never a stale default", () => {
    process.env[ENV_KEY] = "not-a-number";
    expect(readUsdCap(ENV_KEY, null)).toBeNull();
  });

  it("rejects a negative cap and falls back", () => {
    process.env[ENV_KEY] = "-5";
    expect(readUsdCap(ENV_KEY, null)).toBeNull();
  });
});
