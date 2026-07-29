import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Email discipline (Adam, 2026-07-29).
//
// The product must not spam operators. The ONLY thing that should reach a
// client's inbox is a chatbot lead they can actually contact, carrying the
// conversation context so they can act on it.
//
// What was actually going to jessica@ + 2 colleagues before this:
//   - "Anonymous prospect — Telegraph Commons (unclear)" — a chatbot visitor
//     who left NO name, email or phone. Nothing to act on. Many per week.
//   - "New lead: x@y.com — Telegraph Commons" AND "X — Telegraph (warm)" —
//     two emails for the same conversation.
//   - "24 critical insights for SG Real Estate" — every weekday, to all six
//     org users.
//   - "SG Real Estate, weekly pixel report" — every Monday.
// ---------------------------------------------------------------------------

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("no recurring digest email to client operators", () => {
  const crons: Array<{ path: string; schedule: string }> =
    JSON.parse(read("vercel.json")).crons ?? [];
  const paths = crons.map((c) => c.path);

  it("does not schedule the daily insight digest", () => {
    // Emailed every user in the org, every weekday. Insights belong in the
    // dashboard, not in six inboxes.
    expect(paths).not.toContain("/api/cron/daily-insight-digest");
  });

  it("does not schedule the weekly pixel report", () => {
    expect(paths).not.toContain("/api/cron/pixel-weekly-digest");
  });

  it("still schedules the chatbot profile digest — the one email we DO want", () => {
    expect(paths).toContain("/api/cron/chatbot-profile-digest");
  });
});

describe("chatbot leads produce exactly one email, and only if contactable", () => {
  it("suppresses the bare lead notification for the chatbot channel", () => {
    // The prospect-profile email covers chatbot leads and carries the
    // transcript; this one would be a second email for the same person.
    const src = read("lib/notifications/lead-notify.ts");
    expect(src).toContain(
      "input.channel === LeadNotifyChannel.CHATBOT",
    );
    expect(src).toContain("duplicateOfProfileEmail");
  });

  it("never emails a prospect with no name, email or phone", () => {
    const src = read("lib/chatbot/send-prospect-profile.ts");
    // Gate must consider both the regex-captured fields and the LLM profile.
    expect(src).toContain("convo.capturedEmail");
    expect(src).toContain("convo.capturedPhone");
    expect(src).toContain("profile.email");
    expect(src).toContain("profile.phone");
    expect(src).toContain("no contact info — not emailed");
  });

  it("stamps skipped conversations so the 5-minute cron stops re-extracting", () => {
    // Without the stamp, every anonymous conversation costs a Claude call on
    // every cron pass, forever.
    const src = read("lib/chatbot/send-prospect-profile.ts");
    const gateIdx = src.indexOf("if (!contactable)");
    const stampIdx = src.indexOf("prospectProfileEmailedAt", gateIdx);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(gateIdx);
  });
});
