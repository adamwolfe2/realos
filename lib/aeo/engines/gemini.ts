/**
 * Gemini engine client.
 *
 * Gated on GEMINI_API_KEY. Calls Google's Generative Language REST API
 * directly via fetch — no @google/generative-ai dependency.
 */

import "server-only";
import type { EngineModule, EngineResult } from "./types";

const MODEL = process.env.AEO_GEMINI_MODEL ?? "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

export const geminiEngine: EngineModule = {
  engine: "GEMINI",
  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  },
  async runPrompt(prompt: string): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "GEMINI_API_KEY not configured" };
    }
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent` +
      `?key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? "")}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.6 },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const reason = `gemini http ${res.status}: ${detail.slice(0, 200)}`;
        console.error("[aeo.gemini]", reason);
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const responseText = parts
        .map((p) => p.text ?? "")
        .join("\n")
        .trim();
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.gemini] request failed:", message);
      return { skipped: true, reason: `gemini error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
