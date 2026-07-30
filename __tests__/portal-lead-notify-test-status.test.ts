import { describe, it, expect } from "vitest";
import { resolveNotifyTestStatus } from "@/components/portal/settings/lead-notify-settings";

// ---------------------------------------------------------------------------
// Regression for PORTAL-CORE-D001: "Send test lead notification" reported
// success ("Test sent") purely because the HTTP request returned 200 — even
// when /api/portal/settings/notify-test recorded a FAILED or SUPPRESSED
// delivery row. resolveNotifyTestStatus must read the real delivery status.
// ---------------------------------------------------------------------------

describe("resolveNotifyTestStatus (PORTAL-CORE-D001)", () => {
  it("reports an error when delivery FAILED, even though the HTTP call succeeded", () => {
    const result = resolveNotifyTestStatus(
      { deliveryId: "d_1", status: "FAILED", errorMessage: "Resend bounced it" },
      "ops@example.com",
    );
    expect(result.kind).toBe("err");
    expect(result.msg).toBe("Resend bounced it");
  });

  it("reports an error when delivery was SUPPRESSED", () => {
    const result = resolveNotifyTestStatus(
      { deliveryId: "d_2", status: "SUPPRESSED", errorMessage: null },
      "ops@example.com",
    );
    expect(result.kind).toBe("err");
    expect(result.msg).toMatch(/suppressed/i);
  });

  it("reports success when the delivery actually SENT", () => {
    const result = resolveNotifyTestStatus(
      { deliveryId: "d_3", status: "SENT" },
      "ops@example.com",
    );
    expect(result.kind).toBe("ok");
    expect(result.msg).toContain("ops@example.com");
  });

  it("still reports success for a legacy response with no status field", () => {
    const result = resolveNotifyTestStatus({ deliveryId: "d_4" }, "ops@example.com");
    expect(result.kind).toBe("ok");
  });
});
