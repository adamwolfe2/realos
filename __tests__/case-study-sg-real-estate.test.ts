import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SG_CASE_STUDY as CS, pct } from "@/lib/case-study/sg-real-estate";

// The outbound plain-text case study is pasted by hand, so it drifts from the
// verified constants unless something checks it. The DB side is checked by
// scripts/case-study/verify-sg-numbers.ts; this checks the copy side.

const txt = readFileSync(
  join(__dirname, "..", "docs", "case-studies", "sg-real-estate.txt"),
  "utf8",
);

describe("SG Real Estate case study copy", () => {
  it("plain text quotes the verified numbers", () => {
    expect(txt).toContain(
      `${CS.leads} lead records from the chatbot and AppFolio applications`,
    );
    expect(txt).toContain(
      `${CS.chatbotLeads} of those records (${pct(CS.chatbotLeads, CS.leads)}%)`,
    );
    expect(txt).toContain(
      `${CS.chatbotCapturedConversations} of ${CS.chatbotConversations} sessions (${pct(CS.chatbotCapturedConversations, CS.chatbotConversations)}%), ${CS.chatbotPreChatCaptures} of them through the pre-chat form`,
    );
    expect(txt).toContain(
      `${CS.chatbotCapturedWithMessages} of ${CS.chatbotConversationsWithMessages} (${pct(CS.chatbotCapturedWithMessages, CS.chatbotConversationsWithMessages)}%)`,
    );
    expect(txt).toContain(
      `${CS.tracedSignedLeases} leads marked signed and matched to an AppFolio resident`,
    );
    expect(txt).toContain(
      `${CS.chatbotTracedSignedLeases} of those records were created by the chatbot's pre-chat form`,
    );
    expect(txt).toContain(
      `${CS.tracedSignedLeases - CS.chatbotTracedSignedLeases} from AppFolio applications`,
    );
    expect(txt).toContain(
      `${CS.tracedAtProperty} of the ${CS.tracedSignedLeases} match a resident at ${CS.property}`,
    );
  });

  it("plain text never repeats the claims verification ruled false", () => {
    // $993K lease value is not reproducible; only 8 of the 46 traced leases
    // came from the chatbot (.claude/specs/2026-09-28-case-study-numbers.md).
    expect(txt).not.toMatch(/993/);
    expect(txt).not.toMatch(
      new RegExp(`${CS.tracedSignedLeases}[^.]*through the chat`, "i"),
    );
  });

  // Round 3 adversarial review (.claude/specs/2026-09-28-case-study-numbers.md)
  // found these phrasings false against production. Guard both surfaces.
  const page = readFileSync(
    join(__dirname, "..", "app", "(platform)", "case-study", "page.tsx"),
    "utf8",
  );
  const FALSE_PHRASINGS: Array<[string, RegExp]> = [
    ["rows are not deduplicated people", /counts? once/i],
    ["7 of 8 had no conversation", /began (as|in) (a |the )?chat/i],
    ["only chatbot and AppFolio applications", /every source/i],
    ["2 of 46 link to other buildings", /other properties[^.]*stay out/i],
    ["0 manual links exist", /leasing team confirms/i],
    ["46 are resident matches, not traced leases", /signed leases,?\s*(\{" "\}\s*)?(<Mark>)?traced back/i],
    ["tracking began in April to June", /From \{CS\.period\.label\}, \{BRAND_NAME\} tracked/],
    ["100 chatbot rows read as 100 people", /through the chatbot/i],
    ["no dollar figure is reproducible", /\$\s?\d/],
  ];
  for (const [why, re] of FALSE_PHRASINGS) {
    it(`neither surface says ${re} (${why})`, () => {
      expect(txt).not.toMatch(re);
      expect(page).not.toMatch(re);
    });
  }

  it("plain text separates the report date from the re-check date", () => {
    expect(txt).toContain("Report generated September 15, 2026");
    expect(txt).toContain("re-checked September 25, 2026");
    expect(txt).not.toMatch(/as of September 25[^.]*client report/i);
  });

  it("plain text has no em or en dashes and fits 150-250 words", () => {
    expect(txt).not.toMatch(/[–—]/);
    const words = txt.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(150);
    expect(words).toBeLessThanOrEqual(250);
  });
});
