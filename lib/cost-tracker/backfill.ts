import "server-only";

// ---------------------------------------------------------------------------
// Cost backfill — estimates for historical events that fired before the
// per-call ApiUsage instrumentation shipped (2026-05-29).
//
// Adam 2026-05-29: dashboard starts from zero today; user wants
// historical context. This module synthesizes ApiUsage rows from
// existing ProspectAudit + DailySignalSnapshot tables using the known
// pipeline cost shape. Every synthesized row is tagged
// `meta.synthesized = true` so:
//   * Headline rollups on /admin/costs include them (giving an
//     honest historical $ context)
//   * The "Recent calls" audit-log table FILTERS them out so the
//     dashboard's per-call trust isn't eroded by fake data
//   * A future cleanup query can `DELETE FROM ApiUsage WHERE
//     meta->>'synthesized' = 'true'` to wipe them if needed.
//
// Real per-call dollars for pre-2026-05-29 spend live in the vendor
// consoles (DataForSEO portal, Anthropic console, Tavily dashboard).
// The /admin/costs page links to them so anyone investigating
// historical spend goes to the source of truth, not to these
// estimates.
// ---------------------------------------------------------------------------

// Pipeline cost shape — derived from observed per-call rates × the
// known fan-out per audit / snapshot. These numbers will drift as the
// pipeline evolves; the backfill is one-shot so we accept the snapshot
// of "what the pipeline cost on 2026-05-29" as the canonical estimate.
//
// Audit fan-out (per /audit/start → run):
//   DataForSEO:  Lighthouse $0.010 + InstantPages $0.005 + Ranked $0.010 + Backlinks $0.010 = $0.035
//   Tavily:      11 calls × $0.005 = $0.055   (5 sources × 2 queries + 2 open-web sweeps - 1 occasional skip)
//   Anthropic:   5 prompts × ~$0.003 AEO + $0.009 narrative + ~$0.002 (synth narrative wrapper) = $0.020
//   OpenAI:      5 prompts × $0.0006 (gpt-4o-mini) = $0.003
//   Gemini:      5 prompts × $0.0002 (2.0 flash)  = $0.001
//   Perplexity:  5 prompts × ($0.0008 tokens + $0.005 search fee) = $0.029
//
//   Total per audit: ~$0.143 (when every engine is configured)
export const ESTIMATED_AUDIT_COST_BY_PROVIDER = {
  dataforseo: 0.035,
  tavily: 0.055,
  anthropic: 0.020,
  openai: 0.003,
  gemini: 0.001,
  perplexity: 0.029,
} as const;

// Tenant cron run fan-out (per DailySignalSnapshot from signals-daily):
//   Same shape as audit (full SEO + AEO + reputation fan-out) plus a
//   reputation/analyze Claude call for sentiment classification.
export const ESTIMATED_SNAPSHOT_COST_BY_PROVIDER = {
  dataforseo: 0.035,
  tavily: 0.055,
  anthropic: 0.025,     // +$0.005 for sentiment classify batch
  openai: 0.003,
  gemini: 0.001,
  perplexity: 0.029,
} as const;

// Vendor billing console URLs — surfaced on /admin/costs so anyone
// looking for pre-instrumentation spend lands on the source of truth.
export const VENDOR_CONSOLE_URLS: Record<string, { label: string; url: string }> = {
  dataforseo: {
    label: "DataForSEO portal",
    url: "https://app.dataforseo.com/users",
  },
  tavily: {
    label: "Tavily dashboard",
    url: "https://app.tavily.com",
  },
  anthropic: {
    label: "Anthropic console",
    url: "https://console.anthropic.com/settings/usage",
  },
  openai: {
    label: "OpenAI usage",
    url: "https://platform.openai.com/usage",
  },
  perplexity: {
    label: "Perplexity API",
    url: "https://www.perplexity.ai/settings/api",
  },
  gemini: {
    label: "Google AI Studio",
    url: "https://aistudio.google.com/app/apikey",
  },
};

// ---------------------------------------------------------------------------
// DataForSEO real-total fetcher.
//
// DataForSEO's /v3/appendix/user_data returns the account's lifetime
// spent dollar figure (no per-day breakdown). We use it as a single
// "ground truth" total — the backfill writes one synthesized row per
// day per provider for ProspectAudit + DailySignalSnapshot rows, and
// reconciles dataforseo specifically against this number.
// ---------------------------------------------------------------------------

export async function fetchDataForSeoTotalSpentUsd(): Promise<number | null> {
  const login = process.env.DATAFORSEO_LOGIN?.replace(/\\n|\s+/g, "").trim();
  const password = process.env.DATAFORSEO_PASSWORD?.replace(/\\n|\s+/g, "").trim();
  if (!login || !password) return null;
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  try {
    const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      tasks?: Array<{
        result?: Array<{ money?: { spent?: number } }>;
      }>;
    };
    const spent = json.tasks?.[0]?.result?.[0]?.money?.spent;
    return typeof spent === "number" ? spent : null;
  } catch {
    return null;
  }
}
