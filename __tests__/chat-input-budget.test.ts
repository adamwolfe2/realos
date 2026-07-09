import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  chatInputChars,
  exceedsChatInputBudget,
  MAX_CHAT_INPUT_CHARS,
  MAX_CHAT_OUTPUT_TOKENS,
} from "@/lib/chatbot/input-budget";

// ---------------------------------------------------------------------------
// Regression: Denial-of-Wallet guards on the public chat endpoints. Each call
// must bound both input (aggregate chars) and output (maxOutputTokens) so an
// attacker can't pad a spoofed-Origin request to ~50K tokens with an unbounded
// reply and drain a tenant's Anthropic budget.
// ---------------------------------------------------------------------------

function msg(len: number) {
  return { role: "user" as const, content: "x".repeat(len) };
}

describe("chat input budget helper", () => {
  it("sums content length across messages", () => {
    expect(chatInputChars([msg(100), msg(250)])).toBe(350);
  });

  it("passes a normal conversation", () => {
    const convo = Array.from({ length: 12 }, () => msg(300)); // ~3.6K chars
    expect(exceedsChatInputBudget(convo)).toBe(false);
  });

  it("rejects a max-padded 50×4000 abuse payload", () => {
    const abuse = Array.from({ length: 50 }, () => msg(4000)); // 200K chars
    expect(exceedsChatInputBudget(abuse)).toBe(true);
  });

  it("budget constants are sane", () => {
    expect(MAX_CHAT_INPUT_CHARS).toBeGreaterThan(10_000);
    expect(MAX_CHAT_INPUT_CHARS).toBeLessThan(50 * 4000);
    expect(MAX_CHAT_OUTPUT_TOKENS).toBeGreaterThan(0);
    expect(MAX_CHAT_OUTPUT_TOKENS).toBeLessThanOrEqual(4096);
  });
});

describe("public chat routes keep both DoW caps wired", () => {
  const ROOT = path.resolve(__dirname, "..");
  const ROUTES = [
    "app/api/public/chatbot/chat/route.ts",
    "app/api/chat/route.ts",
  ];

  it("every public chat route sets maxOutputTokens and checks the input budget", () => {
    const missing: string[] = [];
    for (const rel of ROUTES) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      if (
        !src.includes("maxOutputTokens") ||
        !src.includes("exceedsChatInputBudget")
      ) {
        missing.push(rel);
      }
    }
    expect(
      missing,
      `These public chat routes lost a Denial-of-Wallet cap:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
