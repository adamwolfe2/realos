import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { pagePath, unansweredQuestions } from "@/lib/portal/property-cockpit";

describe("property cockpit helpers", () => {
  it("finds questions the bot admitted it couldn't answer (real SG replies)", () => {
    const msgs = [
      { role: "user", content: "is it possible to negotiate rent?" },
      { role: "assistant", content: "That's a solid question, but I don't have our negotiation policy in front of me. Want me to have the team text you?" },
      { role: "user", content: "Do you have a pool?" },
      { role: "assistant", content: "We don't have a pool, but we do have a rooftop deck." },
      { role: "user", content: "Can I use 111-11-1111?" },
      { role: "assistant", content: "Since you don't have an SSN yet, you can enter 111-11-1111." },
      { role: "user", content: "wifi in the lounge?" },
      { role: "assistant", content: "Could be posted in the common areas, but I'm not sure." },
    ];
    expect(unansweredQuestions(msgs)).toEqual(["is it possible to negotiate rent?", "wifi in the lounge?"]);
    expect(unansweredQuestions(null)).toEqual([]);
  });

  it("normalises landing page URLs to paths", () => {
    expect(pagePath("https://www.liveatthelair.com/availability?utm_source=zillow")).toBe("/availability");
    expect(pagePath("/availability/")).toBe("/availability");
    expect(pagePath("https://www.liveatthelair.com/")).toBe("/");
    expect(pagePath("(not set)")).toBeNull();
    expect(pagePath(null)).toBeNull();
  });
});
