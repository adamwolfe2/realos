import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

// The studio test chat must never look like real traffic: no conversation,
// lead or notification rows, and the embed's preview mode must not reach the
// public chat/lead endpoints.
describe("chatbot studio test chat", () => {
  it("preview-chat route is signed-in and read-only", () => {
    const route = read("app/api/portal/chatbot/preview-chat/route.ts");
    expect(route).toContain("requireScope()");
    expect(route).toContain("withSpendCap(");
    expect(route).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(/);
    expect(route).not.toMatch(/notify|persistConversation|findOrCreateChatbotLead/);
  });

  it("embed preview mode short-circuits every network write", () => {
    const embed = read("public/embed/chatbot.js");
    expect(embed).toContain('script.getAttribute("data-preview") === "1"');
    expect(embed).toMatch(/function send\(text\) \{\s+if \(PREVIEW\)/);
    expect(embed).toMatch(/function submitLead\(payload\) \{\s+if \(PREVIEW\) return Promise\.reject/);
    expect(embed).toMatch(/function submitIntro\(formEl, errEl\) \{\s+if \(PREVIEW\)/);
  });
});
