import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", relPath), "utf-8");
}

describe("chatbot learning loop cron", () => {
  it("is authenticated, bounded, persisted, and registered with Vercel", () => {
    const route = read("app/api/cron/chatbot-learning-loop/route.ts");
    const vercel = JSON.parse(read("vercel.json")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(route).toContain("verifyCronAuth(req)");
    expect(route).toContain('recordCronRun("chatbot-learning-loop"');
    expect(route).toContain("MAX_ORGS_PER_RUN = 25");
    expect(route).toContain("CONVERSATIONS_PER_ORG = 500");
    expect(route).toContain("dryRun: false");
    expect(route).toContain("errorCount: failed");
    expect(route).toContain('distinct: ["orgId"]');
    expect(vercel.crons).toContainEqual({
      path: "/api/cron/chatbot-learning-loop",
      schedule: "17 5 * * *",
    });
  });
});
