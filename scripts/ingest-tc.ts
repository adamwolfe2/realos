/**
 * One-off ingest for Telegraph Commons (SG Real Estate org).
 *
 * Bypasses the server-only guard on lib/intelligence/* by inlining the
 * three external calls (Firecrawl, Perplexity, Claude) here. Writes
 * results directly into the SiteIntelligence row.
 *
 * Run with:
 *   DATABASE_URL=... FIRECRAWL_API_KEY=... PERPLEXITY_API_KEY=... \
 *     ANTHROPIC_API_KEY=... pnpm exec tsx scripts/ingest-tc.ts
 */

import { prisma } from "../lib/db";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const ROOT_URL = "https://telegraphcommons.com";
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

type FCPage = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

async function fcCrawl(rootUrl: string, limit = 25): Promise<FCPage[]> {
  console.log(`[firecrawl.crawl] starting ${rootUrl} (limit ${limit})`);
  const start = Date.now();
  const res = await fetch(`${FIRECRAWL_BASE}/crawl`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: rootUrl,
      limit,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`firecrawl crawl http ${res.status}: ${detail.slice(0, 300)}`);
  }
  const job = (await res.json()) as { id?: string; url?: string };
  const jobId = job.id;
  if (!jobId) throw new Error("firecrawl crawl: no job id");

  // Poll up to 90s
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`${FIRECRAWL_BASE}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    });
    if (!statusRes.ok) continue;
    const json = (await statusRes.json()) as {
      status: string;
      data?: Array<{
        markdown?: string;
        metadata?: { sourceURL?: string; title?: string; description?: string };
      }>;
    };
    if (json.status === "completed" || json.status === "complete") {
      const pages: FCPage[] = (json.data ?? []).map((p) => ({
        url: p.metadata?.sourceURL ?? "",
        title: p.metadata?.title,
        description: p.metadata?.description,
        markdown: p.markdown?.slice(0, 8000),
      }));
      console.log(
        `[firecrawl.crawl] done in ${((Date.now() - start) / 1000).toFixed(1)}s — ${pages.length} pages`,
      );
      return pages;
    }
    if (json.status === "failed") {
      throw new Error("firecrawl crawl failed");
    }
  }
  throw new Error("firecrawl crawl timeout");
}

async function pplxResearch(orgName: string, domain: string) {
  console.log(`[perplexity] researching ${orgName} (${domain})`);
  const start = Date.now();
  const prompt = `Research the company "${orgName}" with website ${domain}.

Return ONLY a JSON object (no preamble, no fences) with these keys:
{
  "companyOverview": "2-3 sentences on what they do and who they serve",
  "competitiveLandscape": "Names of direct competitors and how they differentiate",
  "recentNews": "Notable recent news or launches, or null if nothing surfaces",
  "positioningCues": "Adjectives + phrases their brand leans on, lifted from open-web mentions"
}`;
  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You are a structured research assistant. Respond with JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`perplexity http ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  // Strip fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }
  console.log(`[perplexity] done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return { ...parsed, citations: data.citations ?? [] };
}

async function extractVoice(orgName: string, pages: FCPage[], research: object) {
  console.log(`[voice-extract] running Claude Haiku`);
  const start = Date.now();
  const sample = pages
    .slice(0, 5)
    .map((p) => `## ${p.url}\n${(p.markdown ?? "").slice(0, 1500)}`)
    .join("\n\n");
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: `You analyze brand voice from web copy + research. Output 6-8 sentences in plain prose covering: tone, register, dos/don'ts, and preferred CTAs. No bullet points, no headers, no JSON.`,
    prompt: `Brand: ${orgName}\n\nResearch:\n${JSON.stringify(research, null, 2)}\n\nSample pages:\n${sample}\n\nWrite the brand voice notes.`,
    maxOutputTokens: 600,
  });
  console.log(`[voice-extract] done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return text.trim();
}

(async () => {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`org ${ORG_ID} not found`);
  console.log(`Ingesting for ${org.name}…`);

  const tStart = Date.now();
  const pages = await fcCrawl(ROOT_URL, 25);
  const sitemapUrls = pages.map((p) => p.url).filter(Boolean);
  const research = await pplxResearch(org.name, ROOT_URL);
  const brandVoice = await extractVoice(org.name, pages, research);

  await prisma.siteIntelligence.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      rootUrl: ROOT_URL,
      sitemapUrls,
      pages: pages as unknown as object,
      research: research as unknown as object,
      brandVoice,
      crawledAt: new Date(),
      researchedAt: new Date(),
      brandVoiceAt: new Date(),
      lastRunStats: {
        pagesIngested: pages.length,
        durationMs: Date.now() - tStart,
      } as object,
    },
    update: {
      rootUrl: ROOT_URL,
      sitemapUrls,
      pages: pages as unknown as object,
      research: research as unknown as object,
      brandVoice,
      crawledAt: new Date(),
      researchedAt: new Date(),
      brandVoiceAt: new Date(),
      lastRunStats: {
        pagesIngested: pages.length,
        durationMs: Date.now() - tStart,
      } as object,
    },
  });

  console.log("\n--- DONE ---");
  console.log(`Pages: ${pages.length}`);
  console.log(`Sitemap URLs: ${sitemapUrls.length}`);
  console.log(`Brand voice preview: ${brandVoice.slice(0, 300)}…`);
  console.log(`Duration: ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
