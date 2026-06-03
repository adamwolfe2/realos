/**
 * One-shot data collector for the 255 Cal prospect brief.
 *
 *   pnpm tsx scripts/build-prospect-brief-255-cal.ts
 *
 * Pulls real data for a single shareable /brief/<token> page:
 *   1. Firecrawl scrape of http://255-cal.com (gets past Cloudflare,
 *      returns rendered HTML).
 *   2. Live AEO scan across OpenAI / Perplexity / Gemini using
 *      commercial-office prompts (NOT the multifamily prompts the
 *      automated audit pipeline uses).
 *   3. Google AI Overview capture via DataForSEO for an unbranded
 *      query.
 *   4. 8-check AEO Page Health on the rendered HTML.
 *   5. Detected-stack regex scan over the rendered HTML.
 *   6. Schema markup present/missing comparison.
 *
 * Writes one JSON file to `prospects/255-cal.json` which the
 * `/brief/[token]/page.tsx` route loads at render time.
 *
 * Why a one-off script: the automated /audit pipeline assumes a
 * multifamily vertical (residential prompts, residential schema
 * targets). 255 Cal is a flagship Class-A office tower in SF FiDi.
 * For pitch-quality output we need office-specific prompts + the
 * right competitor cohort + an honest brand-disambiguation pass. A
 * scripted one-off skips the vertical work and gets us pitch-ready
 * data today.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { runOnPageAuditChecks } from "../lib/aeo/onpage-audit";

// .env.local has the real keys; .env doesn't ship them in dev.
dotenvConfig({ path: path.join(process.cwd(), ".env.local") });

// ─── Config ────────────────────────────────────────────────────────────────

const TARGET_DOMAIN = "255-cal.com";
const TARGET_URL = "https://www.255-cal.com";
const BRAND = "255 Cal";
const FULL_ADDRESS = "255 California Street, San Francisco";
const VERTICAL_LABEL = "Class-A office tower · San Francisco FiDi";

// Commercial-office discovery prompts. Mirror how a corporate real-
// estate decision-maker would talk to an AI assistant. Branded one
// goes last so we can also score "does the engine know who they are
// when prompted by name."
const PROMPTS = [
  "What are the best Class-A office buildings in San Francisco's Financial District for a 200-person tech tenant in 2026?",
  "Where can a hybrid-work company lease flexible workplace space in downtown San Francisco with strong amenities?",
  "Compare the top office towers on California Street in San Francisco for a corporate headquarters lease.",
  "What is the most prestigious office address on California Street in SF and why?",
  "Tell me about 255 California Street San Francisco — who occupies it and what are its amenities?",
];

const ENGINES_TO_RUN = ["CHATGPT", "PERPLEXITY", "GEMINI", "CLAUDE"] as const;

// Likely Class-A office comp set — the real competitive cohort an
// AI engine would surface for this market. Used to rate "who got
// named instead." Hand-curated; future vertical-aware audit will
// derive this from DataForSEO competitors_domain.
const COMP_SET = [
  "555 California Street",
  "101 California Street",
  "Salesforce Tower",
  "Transamerica Pyramid",
  "50 California Street",
  "One Market Plaza",
  "Embarcadero Center",
  "350 Mission",
  "Pier 70",
  "Mission Rock",
];

// ─── Output shape ──────────────────────────────────────────────────────────

type EngineKey = (typeof ENGINES_TO_RUN)[number];

type EngineResult = {
  engine: EngineKey;
  prompt: string;
  responseText: string;
  cited: boolean;
  competitorsCited: string[];
  durationMs: number;
  error: string | null;
  skipped: boolean;
  reason?: string;
};

interface BriefJson {
  generatedAtIso: string;
  brand: string;
  domain: string;
  url: string;
  resolvedUrl: string | null;
  vertical: string;
  fullAddress: string;
  firecrawl: {
    ok: boolean;
    title: string | null;
    description: string | null;
    htmlBytes: number;
    httpStatus: number | null;
    error: string | null;
  };
  aeo: {
    engines: EngineKey[];
    rows: EngineResult[];
    perEngineCited: Record<EngineKey, number>;
    perEngineTotal: Record<EngineKey, number>;
    competitorCounts: Array<{ name: string; count: number }>;
  };
  googleAiOverview: {
    query: string;
    summary: string;
    citedUrls: string[];
    cited: boolean;
  } | null;
  onPage: {
    score: number;
    excerpt: string;
    checks: Array<{ key: string; label: string; pass: boolean; reason: string }>;
  };
  schemaGap: {
    present: string[];
    missing: string[];
  };
  detectedStack: Array<{
    category: string;
    label: string;
    detected: boolean;
    note: string;
  }>;
  costUsd: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function firecrawlScrape(url: string): Promise<{
  html: string | null;
  metadata: { title?: string; description?: string; statusCode?: number; sourceURL?: string } | null;
  error: string | null;
}> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { html: null, metadata: null, error: "FIRECRAWL_API_KEY missing" };
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["html", "markdown"] }),
    });
    if (!res.ok) {
      return { html: null, metadata: null, error: `firecrawl http ${res.status}` };
    }
    const body = (await res.json()) as {
      data?: {
        html?: string;
        markdown?: string;
        metadata?: {
          title?: string;
          description?: string;
          statusCode?: number;
          sourceURL?: string;
        };
      };
    };
    return {
      html: body.data?.html ?? null,
      metadata: body.data?.metadata ?? null,
      error: null,
    };
  } catch (err) {
    return {
      html: null,
      metadata: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function callChatGPT(prompt: string): Promise<EngineResult> {
  const t0 = Date.now();
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      engine: "CHATGPT",
      prompt,
      responseText: "",
      cited: false,
      competitorsCited: [],
      durationMs: 0,
      error: null,
      skipped: true,
      reason: "OPENAI_API_KEY missing",
    };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      return mkErr("CHATGPT", prompt, `openai http ${res.status}`, Date.now() - t0);
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    return classify("CHATGPT", prompt, text, Date.now() - t0);
  } catch (err) {
    return mkErr("CHATGPT", prompt, err instanceof Error ? err.message : String(err), Date.now() - t0);
  }
}

async function callPerplexity(prompt: string): Promise<EngineResult> {
  const t0 = Date.now();
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return {
      engine: "PERPLEXITY",
      prompt,
      responseText: "",
      cited: false,
      competitorsCited: [],
      durationMs: 0,
      error: null,
      skipped: true,
      reason: "PERPLEXITY_API_KEY missing",
    };
  }
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return mkErr(
        "PERPLEXITY",
        prompt,
        `perplexity http ${res.status}: ${detail.slice(0, 120)}`,
        Date.now() - t0,
      );
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    return classify("PERPLEXITY", prompt, text, Date.now() - t0);
  } catch (err) {
    return mkErr(
      "PERPLEXITY",
      prompt,
      err instanceof Error ? err.message : String(err),
      Date.now() - t0,
    );
  }
}

async function callGemini(prompt: string): Promise<EngineResult> {
  const t0 = Date.now();
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      engine: "GEMINI",
      prompt,
      responseText: "",
      cited: false,
      competitorsCited: [],
      durationMs: 0,
      error: null,
      skipped: true,
      reason: "GEMINI_API_KEY missing",
    };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return mkErr(
        "GEMINI",
        prompt,
        `gemini http ${res.status}: ${detail.slice(0, 120)}`,
        Date.now() - t0,
      );
    }
    const body = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ") ?? "";
    return classify("GEMINI", prompt, text, Date.now() - t0);
  } catch (err) {
    return mkErr("GEMINI", prompt, err instanceof Error ? err.message : String(err), Date.now() - t0);
  }
}

async function callClaude(prompt: string): Promise<EngineResult> {
  const t0 = Date.now();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      engine: "CLAUDE",
      prompt,
      responseText: "",
      cited: false,
      competitorsCited: [],
      durationMs: 0,
      error: null,
      skipped: true,
      reason: "ANTHROPIC_API_KEY not configured locally — Claude scan available in production",
    };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return mkErr("CLAUDE", prompt, `anthropic http ${res.status}: ${detail.slice(0, 120)}`, Date.now() - t0);
    }
    const body = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    const text = body.content?.map((c) => c.text ?? "").join("") ?? "";
    return classify("CLAUDE", prompt, text, Date.now() - t0);
  } catch (err) {
    return mkErr("CLAUDE", prompt, err instanceof Error ? err.message : String(err), Date.now() - t0);
  }
}

function mkErr(
  engine: EngineKey,
  prompt: string,
  error: string,
  durationMs: number,
): EngineResult {
  return {
    engine,
    prompt,
    responseText: "",
    cited: false,
    competitorsCited: [],
    durationMs,
    error,
    skipped: false,
  };
}

// Strict brand-citation parser. The /audit pipeline uses a substring
// match which collides with the legal citation "255 Cal. Rptr.3d 654".
// Here we require: (a) "255 California" (the full unambiguous form)
// OR (b) "255 Cal" followed by something OTHER than a period + a
// reporter suffix (`Rptr`, `App`, `2d`, `3d`, `4th`).
const BRAND_REGEX =
  /\b255\s+California\b|\b255\s+Cal(?!\.\s*(?:Rptr|App|\d(?:d|th)))/i;

function classify(
  engine: EngineKey,
  prompt: string,
  text: string,
  durationMs: number,
): EngineResult {
  const cited = BRAND_REGEX.test(text);
  const competitorsCited: string[] = [];
  for (const comp of COMP_SET) {
    const re = new RegExp(`\\b${escapeRegex(comp)}\\b`, "i");
    if (re.test(text)) competitorsCited.push(comp);
  }
  return {
    engine,
    prompt,
    responseText: text,
    cited,
    competitorsCited,
    durationMs,
    error: null,
    skipped: false,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detected-stack regex registry — mirrors the registry in
// lib/audit/synthesize.ts. Duplicated here so the script can run
// standalone without that helper being exported. Future: extract
// to its own module.
const STACK_DETECTORS: Array<{
  category: string;
  label: string;
  patterns: RegExp[];
}> = [
  { category: "chatbot", label: "AI chatbot / live chat widget",
    patterns: [/widget\.intercom\.io/i, /js\.driftt?\.com/i, /code\.tidio\.co/i, /embed\.tawk\.to/i, /static\.zdassets\.com/i, /chatbase\.co\/embed/i] },
  { category: "popups", label: "On-site popup / lead capture",
    patterns: [/static\.klaviyo\.com\/onsite\/js\/klaviyo\.js/i, /optimonk\.com/i, /privy\.com\/widget/i, /popupsmart\.com/i] },
  { category: "pixel", label: "Visitor identification pixel",
    patterns: [/cursive\.js/i, /meetcursive\.com\/p/i, /connect\.facebook\.net\/.*\/fbevents\.js/i, /fbq\(['"]init/i, /rb2b\.com/i] },
  { category: "analytics", label: "Analytics / tag manager",
    patterns: [/googletagmanager\.com\/gtag\/js/i, /googletagmanager\.com\/gtm\.js/i, /gtag\(['"]config/i, /cdn\.segment\.com\/analytics\.js/i, /cdn\.amplitude\.com/i, /posthog\.com\/static\/array\.js/i] },
  { category: "crm", label: "CRM / marketing automation",
    patterns: [/js\.hs-scripts\.com/i, /js\.hubspot\.com/i, /pi\.pardot\.com/i] },
];

function detectStack(html: string): BriefJson["detectedStack"] {
  return STACK_DETECTORS.map((d) => {
    const detected = d.patterns.some((p) => p.test(html));
    return {
      category: d.category,
      label: d.label,
      detected,
      note: detected
        ? "Detected on the homepage."
        : "Not detected on the homepage.",
    };
  });
}

const RECOMMENDED_SCHEMA_TYPES = [
  "Organization",
  "LocalBusiness",
  "Place",
  "OfficeEquipment",
  "Service",
  "FAQPage",
  "BreadcrumbList",
  "ImageObject",
  "ContactPoint",
  "PostalAddress",
];

function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      collect(json, types);
    } catch {
      /* skip malformed */
    }
  }
  return Array.from(types).sort();
}

function collect(node: unknown, out: Set<string>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    if (Array.isArray(t)) for (const tt of t) if (typeof tt === "string") out.add(tt);
    for (const v of Object.values(obj)) collect(v, out);
  }
}

async function fetchGoogleAio(): Promise<BriefJson["googleAiOverview"]> {
  const login = process.env.DATAFORSEO_LOGIN?.replace(/\\n|\s+/g, "").trim();
  const password = process.env.DATAFORSEO_PASSWORD?.replace(/\\n|\s+/g, "").trim();
  if (!login || !password) return null;
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const query = "best Class-A office buildings San Francisco Financial District";
  try {
    const res = await fetch(
      "https://api.dataforseo.com/v3/serp/google/ai_summary/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          { keyword: query, location_code: 2840, language_code: "en" },
        ]),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      tasks?: Array<{
        result?: Array<{
          items?: Array<{
            type?: string;
            text?: string;
            references?: Array<{ url?: string }>;
          }>;
        }>;
      }>;
    };
    const items = body.tasks?.[0]?.result?.[0]?.items ?? [];
    const summaryItem = items.find((i) => i.type === "ai_overview") ?? items[0];
    const summary = summaryItem?.text ?? "";
    if (!summary.trim()) return null;
    const citedUrls = (summaryItem?.references ?? [])
      .map((r) => r.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    const cited = citedUrls.some((u) => /255-cal\.com|255\.cal\.com/i.test(u));
    return { query, summary, citedUrls, cited };
  } catch {
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[brief] target=${TARGET_URL} brand="${BRAND}"`);

  console.log("[brief] step 1/4: Firecrawl scrape…");
  const fc = await firecrawlScrape(TARGET_URL);
  const html = fc.html ?? "";
  console.log(
    `[brief] firecrawl ${fc.error ? `FAILED (${fc.error})` : `ok (${html.length} bytes)`}`,
  );

  console.log(`[brief] step 2/4: AEO scan — ${ENGINES_TO_RUN.length} engines × ${PROMPTS.length} prompts`);
  const rows: EngineResult[] = [];
  for (const prompt of PROMPTS) {
    const [cg, px, gm, cl] = await Promise.all([
      callChatGPT(prompt),
      callPerplexity(prompt),
      callGemini(prompt),
      callClaude(prompt),
    ]);
    rows.push(cg, px, gm, cl);
    console.log(
      `  prompt[${PROMPTS.indexOf(prompt) + 1}/${PROMPTS.length}]: ` +
        `cg=${cg.cited ? "✓" : "✗"} px=${px.cited ? "✓" : "✗"} ` +
        `gm=${gm.cited ? "✓" : "✗"} cl=${cl.skipped ? "—" : cl.cited ? "✓" : "✗"}`,
    );
  }

  const perEngineCited: Record<EngineKey, number> = {
    CHATGPT: 0, PERPLEXITY: 0, GEMINI: 0, CLAUDE: 0,
  };
  const perEngineTotal: Record<EngineKey, number> = {
    CHATGPT: 0, PERPLEXITY: 0, GEMINI: 0, CLAUDE: 0,
  };
  const compCounter = new Map<string, number>();
  for (const r of rows) {
    if (r.skipped) continue;
    perEngineTotal[r.engine] += 1;
    if (r.cited) perEngineCited[r.engine] += 1;
    for (const c of r.competitorsCited) {
      compCounter.set(c, (compCounter.get(c) ?? 0) + 1);
    }
  }
  const competitorCounts = Array.from(compCounter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log("[brief] step 3/4: Google AI Overview…");
  const aio = await fetchGoogleAio();
  console.log(`[brief] google-aio ${aio ? `ok (${aio.summary.length} chars, ${aio.citedUrls.length} citations)` : "no result"}`);

  console.log("[brief] step 4/4: on-page audit + schema + stack…");
  const onPageResult = html
    ? runOnPageAuditChecks(html)
    : { score: 0, checks: [], excerpt: "" };
  const onPage = {
    score: onPageResult.score,
    excerpt: onPageResult.excerpt,
    checks: onPageResult.checks.map((c) => ({
      key: c.key,
      label: c.label,
      pass: c.pass,
      reason: c.reason,
    })),
  };

  const schemaPresent = html ? extractSchemaTypes(html) : [];
  const presentLower = new Set(schemaPresent.map((s) => s.toLowerCase()));
  const schemaMissing = RECOMMENDED_SCHEMA_TYPES.filter(
    (t) => !presentLower.has(t.toLowerCase()),
  );

  const detected = html ? detectStack(html) : [];

  const brief: BriefJson = {
    generatedAtIso: new Date().toISOString(),
    brand: BRAND,
    domain: TARGET_DOMAIN,
    url: TARGET_URL,
    resolvedUrl: fc.metadata?.sourceURL ?? null,
    vertical: VERTICAL_LABEL,
    fullAddress: FULL_ADDRESS,
    firecrawl: {
      ok: !fc.error,
      title: fc.metadata?.title ?? null,
      description: fc.metadata?.description ?? null,
      htmlBytes: html.length,
      httpStatus: fc.metadata?.statusCode ?? null,
      error: fc.error,
    },
    aeo: {
      engines: ENGINES_TO_RUN.slice(),
      rows,
      perEngineCited,
      perEngineTotal,
      competitorCounts,
    },
    googleAiOverview: aio,
    onPage,
    schemaGap: { present: schemaPresent, missing: schemaMissing },
    detectedStack: detected,
    costUsd: 0.005 + rows.length * 0.0003, // rough: DataForSEO + LLM
  };

  const outDir = path.join(process.cwd(), "prospects");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "255-cal.json");
  await fs.writeFile(outPath, JSON.stringify(brief, null, 2), "utf8");
  console.log(`[brief] wrote ${outPath}`);
}

main().catch((err) => {
  console.error("[brief] FAILED", err);
  process.exit(1);
});
