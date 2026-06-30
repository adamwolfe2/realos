import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P2 dunning slice — the 14-day-overdue escalation must set BOTH the
// lifecycle status (gates the public chatbot) and subscriptionStatus=PAUSED
// (makes the portal read-only via isWorkspaceReadOnly). Setting only the
// former made the "your account has been paused" email a lie.

const routePath = path.resolve(
  __dirname,
  "../app/api/cron/billing-reminders/route.ts",
);
const read = () => fs.readFileSync(routePath, "utf-8");

describe("billing-reminders escalation — paused enforcement", () => {
  it("sets TenantStatus.PAUSED on escalation", () => {
    expect(read()).toContain("status: TenantStatus.PAUSED");
  });

  it("ALSO sets subscriptionStatus=PAUSED so the portal goes read-only", () => {
    expect(read()).toContain(
      "subscriptionStatus: SubscriptionStatus.PAUSED",
    );
  });
});
