import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P6 — every external-API fetch() must carry a timeout so a hung upstream
// can't block the request/cron (same class as the GA4 runReport fix). Guards
// against regressions where a new fetch is added without a timeout.

const files = [
  "lib/integrations/google-ads.ts",
  "lib/integrations/meta-ads.ts",
  "lib/sms/twilio.ts",
  "lib/notifications/slack.ts",
  "lib/integrations/ad-library.ts",
  "lib/seo/google-places.ts",
  "lib/integrations/oauth-handler.ts",
  "lib/integrations/al-segments.ts",
  "lib/integrations/vercel-domains.ts",
  "lib/intelligence/perplexity-research.ts",
  "lib/integrations/appfolio.ts",
];

describe("external integration fetch() calls have timeouts", () => {
  for (const rel of files) {
    it(`${rel}: every fetch( has an AbortSignal.timeout`, () => {
      const src = fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");
      const fetchCount = (src.match(/\bfetch\(/g) ?? []).length;
      const timeoutCount = (src.match(/AbortSignal\.timeout/g) ?? []).length;
      expect(fetchCount).toBeGreaterThan(0);
      // At least as many timeouts as fetch calls (wrappers like alFetch cover
      // multiple callers with one fetch + one timeout).
      expect(timeoutCount).toBeGreaterThanOrEqual(fetchCount);
    });
  }
});
