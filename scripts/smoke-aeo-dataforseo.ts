// ---------------------------------------------------------------------------
// DataForSEO AI Optimization smoke test.
//
// Validates the AEO v2 W1 LLM Responses adapter end-to-end against real
// DataForSEO credentials. Designed to be run BEFORE flipping
// AEO_ENGINE_SOURCE=dataforseo on Vercel so we catch wrong endpoint
// paths / request body / response shape without burning a cron run.
//
// What it checks:
//   1. DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD present + valid (HTTP 200).
//   2. /v3/ai_optimization/<engine>/llm_responses/live returns the
//      expected envelope shape for each of the 4 engines.
//   3. Response payload has either responseText or items[].text so the
//      parser doesn't see an empty string.
//   4. citation_urls + mentions arrays are accessible at one of the two
//      shapes the adapter knows how to read.
//
// Run with:
//   pnpm tsx scripts/smoke-aeo-dataforseo.ts
//   pnpm tsx scripts/smoke-aeo-dataforseo.ts --engine=CLAUDE
//
// Exits 0 on success, 1 on any failure. Prints structured per-engine
// status so the result is greppable.
// ---------------------------------------------------------------------------

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import {
  fetchAiLlmResponse,
  type AiOptimizationEngine,
} from "../lib/seo/dataforseo";

const ENGINES: AiOptimizationEngine[] = [
  "CLAUDE",
  "CHATGPT",
  "PERPLEXITY",
  "GEMINI",
];

const PROMPT =
  "What are the best apartment buildings near UC Berkeley for students?";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function smokeEngine(engine: AiOptimizationEngine): Promise<{
  engine: AiOptimizationEngine;
  status: "ok" | "skipped" | "error";
  detail: string;
  costUsd?: number;
  responseTextLen?: number;
  citedUrls?: number;
  mentions?: number;
}> {
  try {
    const result = await fetchAiLlmResponse({ engine, prompt: PROMPT });
    if (!("ok" in result) || !result.ok) {
      if ("skipped" in result && result.skipped) {
        return { engine, status: "skipped", detail: result.reason };
      }
      const errResult = result as { ok: false; error: string };
      return {
        engine,
        status: "error",
        detail: errResult.error ?? "unknown error",
      };
    }
    return {
      engine,
      status: "ok",
      detail: `responseText.len=${result.data.responseText.length} citedUrls=${result.data.citedUrls.length} mentions=${result.data.mentions.length}`,
      costUsd: result.costUsd,
      responseTextLen: result.data.responseText.length,
      citedUrls: result.data.citedUrls.length,
      mentions: result.data.mentions.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { engine, status: "error", detail: `unhandled: ${message}` };
  }
}

async function main(): Promise<void> {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    console.error(
      "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set in .env.local",
    );
    process.exit(1);
  }

  const only = arg("engine")?.toUpperCase() as
    | AiOptimizationEngine
    | undefined;
  const engines = only ? ENGINES.filter((e) => e === only) : ENGINES;
  if (engines.length === 0) {
    console.error(`Unknown engine: ${only}. Pick from ${ENGINES.join(", ")}.`);
    process.exit(1);
  }

  console.log(
    `[smoke-aeo-dataforseo] running against ${engines.length} engine(s)\n` +
      `[smoke-aeo-dataforseo] prompt: ${PROMPT.slice(0, 64)}...\n`,
  );

  const results = [];
  let totalCost = 0;
  let okCount = 0;
  let errorCount = 0;
  let skipCount = 0;

  for (const engine of engines) {
    const r = await smokeEngine(engine);
    results.push(r);
    totalCost += r.costUsd ?? 0;
    if (r.status === "ok") okCount += 1;
    else if (r.status === "skipped") skipCount += 1;
    else errorCount += 1;
    const marker =
      r.status === "ok" ? "[ok ]" : r.status === "skipped" ? "[skp]" : "[ERR]";
    console.log(
      `${marker} ${engine.padEnd(11)} cost=$${(r.costUsd ?? 0).toFixed(5)} ${r.detail}`,
    );
  }

  console.log(
    `\n[smoke-aeo-dataforseo] summary: ok=${okCount} skipped=${skipCount} error=${errorCount} totalCost=$${totalCost.toFixed(5)}`,
  );

  if (okCount === 0) {
    console.error(
      "\nNo engines succeeded. Likely causes:\n" +
        "  - Wrong endpoint path. Check DataForSEO AI Optimization docs.\n" +
        "  - Wrong request body shape (DataForSEO occasionally renames keys).\n" +
        "  - Account doesn't have AI Optimization product enabled.\n" +
        "Inspect the per-engine 'detail' line above for the exact error.",
    );
    process.exit(1);
  }
  if (errorCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke-aeo-dataforseo] crashed:", err);
  process.exit(1);
});
