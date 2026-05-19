/**
 * Claude engine client — uses the existing `@ai-sdk/anthropic` already
 * wired into the codebase (lib/insights/llm-polish.ts, lib/reputation/analyze.ts).
 *
 * Default engine — works out of the box as long as ANTHROPIC_API_KEY is set,
 * no extra dependency required. Returns the assistant's free-text response
 * plus any URLs we can pull from it.
 */

import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { EngineModule, EngineResult } from "./types";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

const MODEL = "claude-haiku-4-5-20251001";

export const claudeEngine: EngineModule = {
  engine: "CLAUDE",
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },
  async runPrompt(prompt: string): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "ANTHROPIC_API_KEY not configured" };
    }
    try {
      const { text } = await generateText({
        model: anthropic(MODEL),
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 1024,
      });
      const responseText = text ?? "";
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.claude] generateText failed:", message);
      return { skipped: true, reason: `claude error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
