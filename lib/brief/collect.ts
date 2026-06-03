import "server-only";
import QRCode from "qrcode";
import { runOnPageAuditChecks } from "@/lib/aeo/onpage-audit";

// ---------------------------------------------------------------------------
// Brief data collector — the production version of what
// scripts/build-prospect-brief-255-cal.ts has been doing as a one-off
// for a single prospect. Lifted here so any admin can paste a domain
// into /admin/briefs/new and get the same data shape back.
//
// Input: a domain (+ optional brand override + commercial-vertical
// flag — defaults to office-vertical commercial-RE prompts because
// that's the segment we built the brief for). Returns a JSON blob
// that the /brief/[token] page renders.
//
// All external calls are best-effort:
//   - Firecrawl returns a payload-integrity-gated rendered HTML, or
//     the collector falls back to a raw fetch with a browser UA.
//   - Each AI engine (OpenAI, Perplexity, Gemini, Anthropic) is wrapped
//     in allSettled — a single engine outage degrades the brief, never
//     crashes the collection.
//   - DataForSEO Google AI Overview tries 5 query phrasings; null when
//     none surface an AIO block (current async-rendering limitation
//     for niche commercial-RE queries).
//
// Cost shape (USD per brief, approx):
//   - Firecrawl scrape          $0.0008
//   - 4 engines × 5 prompts     $0.015 (LLM)
//   - DataForSEO AIO (5 trials) $0.025 max, often free
//   - QR generation             free
//   Total: ~$0.04 per brief.
// ---------------------------------------------------------------------------

const HTML_CAP_BYTES = 200_000;

export type BriefEngineKey = "CHATGPT" | "PERPLEXITY" | "GEMINI" | "CLAUDE";

export interface BriefEngineRow {
  engine: BriefEngineKey;
  prompt: string;
  responseText: string;
  cited: boolean;
  competitorsCited: string[];
  durationMs: number;
  error: string | null;
  skipped: boolean;
  reason?: string;
}

export interface BriefData {
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
    engines: BriefEngineKey[];
    rows: BriefEngineRow[];
    perEngineCited: Record<BriefEngineKey, number>;
    perEngineTotal: Record<BriefEngineKey, number>;
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

export interface CollectBriefArgs {
  domain: string;
  /** Override the auto-derived brand name. */
  brand?: string;
  /** Vertical label rendered on the brief (e.g. "Class-A office tower · San Francisco FiDi"). */
  vertical?: string;
  /** Full physical address, surfaced in the methodology + AIO context. */
  fullAddress?: string;
  /** Comp set the AEO scorer uses to count "named instead" hits. */
  compSet?: string[];
  /** Override the 5 prompts the AEO scan asks each engine. */
  prompts?: string[];
}

// ─── Default commercial-vertical prompts ──────────────────────────────────

const DEFAULT_OFFICE_PROMPTS = (brand: string, address: string) => [
  `What are the best Class-A office buildings in the area near ${address} for a 200-person tech tenant in 2026?`,
  `Where can a hybrid-work company lease flexible workplace space near ${address} with strong amenities?`,
  `Compare the top office towers near ${address} for a corporate headquarters lease.`,
  `What is the most prestigious office address near ${address} and why?`,
  `Tell me about ${brand} (${address}) — who occupies it and what are its amenities?`,
];

// Hand-curated SF Class-A comp set. When the prospect's vertical /
// city is different the caller passes their own list via compSet.
const DEFAULT_OFFICE_COMP_SET = [
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

const DEFAULT_ENGINES: BriefEngineKey[] = [
  "CHATGPT",
  "PERPLEXITY",
  "GEMINI",
  "CLAUDE",
];

// ─── Firecrawl + raw fetch ────────────────────────────────────────────────

async function firecrawlScrape(url: string): Promise<{
  html: string | null;
  metadata: {
    title?: string;
    description?: string;
    statusCode?: number;
    sourceURL?: string;
  } | null;
  error: string | null;
}> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return rawFetch(url, "FIRECRAWL_API_KEY missing");
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ["html", "rawHtml", "markdown"],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return rawFetch(url, `firecrawl http ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        html?: string;
        rawHtml?: string;
        markdown?: string;
        metadata?: {
          title?: string;
          description?: string;
          statusCode?: number;
          sourceURL?: string;
        };
      };
    };
    const preferred = body.data?.rawHtml ?? body.data?.html ?? null;
    const wellFormed =
      typeof preferred === "string" &&
      preferred.length >= 4_000 &&
      /<head[\s>]/i.test(preferred) &&
      /<\/html>/i.test(preferred);
    if (!wellFormed) {
      return rawFetch(url, "firecrawl integrity gate");
    }
    return {
      html: capHtml(preferred),
      metadata: body.data?.metadata ?? null,
      error: null,
    };
  } catch (err) {
    return rawFetch(url, err instanceof Error ? err.message : String(err));
  }
}

async function rawFetch(
  url: string,
  reason: string,
): Promise<{
  html: string | null;
  metadata: {
    title?: string;
    description?: string;
    statusCode?: number;
    sourceURL?: string;
  } | null;
  error: string | null;
}> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        html: null,
        metadata: null,
        error: `raw fetch http ${res.status} (after: ${reason})`,
      };
    }
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    );
    return {
      html: capHtml(html),
      metadata: {
        title: titleMatch?.[1]?.trim(),
        description: descMatch?.[1]?.trim(),
        statusCode: res.status,
        sourceURL: res.url,
      },
      error: null,
    };
  } catch (err) {
    return {
      html: null,
      metadata: null,
      error: `raw fetch failed: ${err instanceof Error ? err.message : String(err)} (after: ${reason})`,
    };
  }
}

function capHtml(html: string): string {
  return html.length > HTML_CAP_BYTES ? html.slice(0, HTML_CAP_BYTES) : html;
}

// ─── LLM engine adapters (one shape per engine) ──────────────────────────

function brandRegexFor(brand: string): RegExp {
  // Strict brand match: avoid the 255-Cal-vs-255-California-Reporter
  // legal-citation collision. Match either the explicit "Long Form"
  // string (e.g. "255 California Street") or the brand when NOT followed
  // by the legal-reporter suffix pattern (Rptr, App, 2d, 3d, 4th).
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\b${escaped}(?!\\.\\s*(?:Rptr|App|\\d(?:d|th)))\\b`,
    "i",
  );
}

function classify(
  engine: BriefEngineKey,
  prompt: string,
  text: string,
  durationMs: number,
  brand: string,
  compSet: string[],
): BriefEngineRow {
  const cited = brandRegexFor(brand).test(text);
  const competitorsCited: string[] = [];
  for (const c of compSet) {
    const re = new RegExp(
      `\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (re.test(text)) competitorsCited.push(c);
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

function skipped(
  engine: BriefEngineKey,
  prompt: string,
  reason: string,
): BriefEngineRow {
  return {
    engine,
    prompt,
    responseText: "",
    cited: false,
    competitorsCited: [],
    durationMs: 0,
    error: null,
    skipped: true,
    reason,
  };
}

function errored(
  engine: BriefEngineKey,
  prompt: string,
  error: string,
  durationMs: number,
): BriefEngineRow {
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

async function callChatGPT(
  prompt: string,
  brand: string,
  compSet: string[],
): Promise<BriefEngineRow> {
  const t0 = Date.now();
  const key = process.env.OPENAI_API_KEY;
  if (!key) return skipped("CHATGPT", prompt, "OPENAI_API_KEY missing");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok)
      return errored("CHATGPT", prompt, `openai http ${res.status}`, Date.now() - t0);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    return classify("CHATGPT", prompt, text, Date.now() - t0, brand, compSet);
  } catch (err) {
    return errored(
      "CHATGPT",
      prompt,
      err instanceof Error ? err.message : String(err),
      Date.now() - t0,
    );
  }
}

async function callPerplexity(
  prompt: string,
  brand: string,
  compSet: string[],
): Promise<BriefEngineRow> {
  const t0 = Date.now();
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return skipped("PERPLEXITY", prompt, "PERPLEXITY_API_KEY missing");
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok)
      return errored(
        "PERPLEXITY",
        prompt,
        `perplexity http ${res.status}`,
        Date.now() - t0,
      );
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    return classify("PERPLEXITY", prompt, text, Date.now() - t0, brand, compSet);
  } catch (err) {
    return errored(
      "PERPLEXITY",
      prompt,
      err instanceof Error ? err.message : String(err),
      Date.now() - t0,
    );
  }
}

async function callGemini(
  prompt: string,
  brand: string,
  compSet: string[],
): Promise<BriefEngineRow> {
  const t0 = Date.now();
  const key = process.env.GEMINI_API_KEY;
  if (!key) return skipped("GEMINI", prompt, "GEMINI_API_KEY missing");
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
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!res.ok)
      return errored("GEMINI", prompt, `gemini http ${res.status}`, Date.now() - t0);
    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ") ??
      "";
    return classify("GEMINI", prompt, text, Date.now() - t0, brand, compSet);
  } catch (err) {
    return errored(
      "GEMINI",
      prompt,
      err instanceof Error ? err.message : String(err),
      Date.now() - t0,
    );
  }
}

async function callClaude(
  prompt: string,
  brand: string,
  compSet: string[],
): Promise<BriefEngineRow> {
  const t0 = Date.now();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return skipped(
      "CLAUDE",
      prompt,
      "ANTHROPIC_API_KEY not configured locally — Claude scan available in production",
    );
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
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok)
      return errored("CLAUDE", prompt, `anthropic http ${res.status}`, Date.now() - t0);
    const body = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = body.content?.map((c) => c.text ?? "").join("") ?? "";
    return classify("CLAUDE", prompt, text, Date.now() - t0, brand, compSet);
  } catch (err) {
    return errored(
      "CLAUDE",
      prompt,
      err instanceof Error ? err.message : String(err),
      Date.now() - t0,
    );
  }
}

// ─── DataForSEO Google AI Overview ───────────────────────────────────────

async function fetchGoogleAio(
  brand: string,
  fullAddress: string,
): Promise<BriefData["googleAiOverview"]> {
  const login = process.env.DATAFORSEO_LOGIN?.replace(/\\n|\s+/g, "").trim();
  const password = process.env.DATAFORSEO_PASSWORD?.replace(/\\n|\s+/g, "").trim();
  if (!login || !password) return null;
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const queries = [
    `${brand} ${fullAddress}`,
    `best office buildings near ${fullAddress}`,
    `Class A office space ${fullAddress}`,
    `where to lease office space near ${fullAddress}`,
    `top office towers near ${fullAddress}`,
  ];
  for (const query of queries) {
    try {
      const res = await fetch(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            { keyword: query, location_code: 2840, language_code: "en" },
          ]),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) continue;
      const body = (await res.json()) as {
        tasks?: Array<{
          result?: Array<{
            items?: Array<{
              type?: string;
              markdown?: string | null;
              references?: Array<{ url?: string }> | null;
              asynchronous_ai_overview?: boolean;
            }>;
          }>;
        }>;
      };
      const items = body.tasks?.[0]?.result?.[0]?.items ?? [];
      const aio = items.find(
        (i) =>
          i.type === "ai_overview" &&
          typeof i.markdown === "string" &&
          i.markdown.length > 0,
      );
      if (!aio || !aio.markdown) continue;
      const citedUrls = (aio.references ?? [])
        .map((r) => r?.url)
        .filter((u): u is string => typeof u === "string" && u.length > 0);
      return { query, summary: aio.markdown, citedUrls, cited: false };
    } catch {
      continue;
    }
  }
  return null;
}

// ─── On-page derivation helpers ──────────────────────────────────────────

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
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
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
    patterns: [/googletagmanager\.com\/gtag\/js/i, /googletagmanager\.com\/gtm\.js/i, /gtag\(['"]config/i, /cdn\.segment\.com\/analytics\.js/i, /cdn\.amplitude\.com/i, /posthog\.com\/static\/array\.js/i, /snap\.licdn\.com/i] },
  { category: "crm", label: "CRM / marketing automation",
    patterns: [/js\.hs-scripts\.com/i, /js\.hubspot\.com/i, /pi\.pardot\.com/i, /mktoresp\.com/i] },
];

function detectStack(html: string | null): BriefData["detectedStack"] {
  if (!html) {
    return [
      {
        category: "site",
        label: "Site not crawlable",
        detected: false,
        note: "Homepage didn't return HTML — couldn't observe the stack.",
      },
    ];
  }
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

// ─── Public entry point ──────────────────────────────────────────────────

export async function collectBriefData(
  args: CollectBriefArgs,
): Promise<BriefData> {
  const domain = args.domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const brand =
    args.brand?.trim() ||
    domain
      .split(".")
      .slice(0, -1)
      .join(" ")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const fullAddress = args.fullAddress?.trim() || domain;
  const url = `https://${domain}`;
  const vertical = args.vertical?.trim() || "Commercial property";
  const compSet = args.compSet ?? DEFAULT_OFFICE_COMP_SET;
  const prompts = args.prompts ?? DEFAULT_OFFICE_PROMPTS(brand, fullAddress);

  // 1. Firecrawl scrape
  const fc = await firecrawlScrape(url);
  const html = fc.html ?? "";

  // 2. AEO scan — 4 engines × N prompts in parallel per prompt
  const rows: BriefEngineRow[] = [];
  for (const prompt of prompts) {
    const [cg, px, gm, cl] = await Promise.all([
      callChatGPT(prompt, brand, compSet),
      callPerplexity(prompt, brand, compSet),
      callGemini(prompt, brand, compSet),
      callClaude(prompt, brand, compSet),
    ]);
    rows.push(cg, px, gm, cl);
  }
  const perEngineCited: Record<BriefEngineKey, number> = {
    CHATGPT: 0, PERPLEXITY: 0, GEMINI: 0, CLAUDE: 0,
  };
  const perEngineTotal: Record<BriefEngineKey, number> = {
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

  // 3. Google AI Overview
  const aio = await fetchGoogleAio(brand, fullAddress);
  const aioWithCitedFlag = aio
    ? {
        ...aio,
        cited: aio.citedUrls.some((u) =>
          new RegExp(domain.replace(/\./g, "\\."), "i").test(u),
        ),
      }
    : null;

  // 4. On-page audit + schema + stack
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
  const detected = detectStack(html);

  return {
    generatedAtIso: new Date().toISOString(),
    brand,
    domain,
    url,
    resolvedUrl: fc.metadata?.sourceURL ?? null,
    vertical,
    fullAddress,
    firecrawl: {
      ok: !fc.error,
      title: fc.metadata?.title ?? null,
      description: fc.metadata?.description ?? null,
      htmlBytes: html.length,
      httpStatus: fc.metadata?.statusCode ?? null,
      error: fc.error,
    },
    aeo: {
      engines: DEFAULT_ENGINES.slice(),
      rows,
      perEngineCited,
      perEngineTotal,
      competitorCounts,
    },
    googleAiOverview: aioWithCitedFlag,
    onPage,
    schemaGap: { present: schemaPresent, missing: schemaMissing },
    detectedStack: detected,
    costUsd: 0.005 + rows.length * 0.0003,
  };
}

/** Build a URL-safe 24-char alphanumeric token (matches the existing
 *  /brief/[token] convention — hex-only so messaging apps / autolinkers
 *  can't clip it). */
export function generateBriefToken(): string {
  const bytes = require("node:crypto").randomBytes(20).toString("hex");
  return bytes.slice(0, 24);
}

/** Generate a QR code PNG data URL for a share link. Kept here so any
 *  surface that wants to embed the brief link (proposal PDFs, emails)
 *  can use the same helper. */
export async function buildBriefQrDataUrl(url: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: "#0F172A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}
