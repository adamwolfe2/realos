import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Crons that catch per-item failures must report them to recordCronRun via
// errorCount, otherwise the run reads "ok" and ops alerting never fires.
const ROUTES = [
  "ad-retention", "ads-sync", "appfolio-sync", "billing-reminders",
  "chatbot-profile-digest", "funnel-lead-sync", "insight-detector",
  "intake-nurture", "lead-nurture", "marketplace-replenish", "onboarding-drip",
  "property-images", "seo-fact-aggregate", "seo-scan-worker", "trial-reminders",
];

describe("cron routes report caught failures", () => {
  it.each(ROUTES)("%s passes errorCount", (name) => {
    const src = readFileSync(`app/api/cron/${name}/route.ts`, "utf8");
    expect(src).toMatch(/errorCount:/);
  });
});
