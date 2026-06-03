/**
 * AEO scan orchestrator.
 *
 * Given an orgId, fans out across every marketable property × every enabled
 * engine × the first 3 prompts generated for the property, writes one
 * AeoCitationCheck row per (property, engine, prompt) tuple.
 *
 * Throttling:
 *  - One request per engine per 3 seconds (rolling per-engine timer).
 *    A 4-engine deployment with 5 properties × 3 prompts ≈ 60 requests
 *    parallelized across engines ≈ ~45 seconds end-to-end. Comfortably
 *    inside Vercel's 5-minute serverless cron ceiling.
 *  - A console warning fires if the projected query count exceeds 100,
 *    so we notice if a large portfolio accidentally fans out.
 *
 * Failure mode:
 *  - An engine throwing or returning { skipped: true } records nothing
 *    for that tuple but does not fail the scan. The next tuple proceeds.
 */

import "server-only";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { generatePrompts } from "./prompts";
import {
  parseClaimSets,
  rewriteAllClaims,
  NEIGHBORHOOD_PROMPT_LIMITS,
  type ClaimPromptSet,
} from "./prompts-neighborhood";
import { parseCitation } from "./parse";
import {
  getEnabledEngines,
  isDataForSeoEngineMetadata,
  type EngineModule,
} from "./engines";
import { classifyMentions } from "./classify-mentions";
import type { AeoEngine, Prisma } from "@prisma/client";

// Lifted from 3 → 5 to accommodate the 2 new branded prompts (Norman
// feedback May 22). Budget cost: ~67% more LLM calls per scan, still
// well within the rate limits. Branded prompts have a meaningfully
// higher citation rate than discovery prompts, so the dashboard reads
// as a real moat-vs-gap story instead of "0% across the board."
const PROMPTS_PER_PROPERTY = 5;
const PER_ENGINE_DELAY_MS = 3000;
const PROJECTED_QUERIES_WARN = 100;
const NEIGHBORHOOD_PROMPTS_PER_CLAIM_CAP = 3;
const NEIGHBORHOOD_PROJECTED_QUERIES_WARN = 50;

export interface ScanOptions {
  orgId: string;
  /** Optional — scope to a single property. Otherwise scans every marketable property in the org. */
  propertyId?: string;
  /** Defaults to all configured engines. */
  engines?: EngineModule[];
  /** Cap on number of properties per run (top-N most recently updated). */
  maxProperties?: number;
}

export interface ScanResult {
  orgId: string;
  enginesUsed: AeoEngine[];
  propertiesScanned: number;
  promptsRun: number;
  rowsWritten: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

interface PropertyRow {
  id: string;
  orgId: string;
  name: string;
  websiteUrl: string | null;
  city: string | null;
  state: string | null;
  propertyType: import("@prisma/client").PropertyType;
  residentialSubtype: import("@prisma/client").ResidentialSubtype | null;
  commercialSubtype: import("@prisma/client").CommercialSubtype | null;
  addressLine1: string | null;
}

export async function runAeoScan(opts: ScanOptions): Promise<ScanResult> {
  const start = Date.now();
  const engines = opts.engines ?? getEnabledEngines();
  const engineNames: AeoEngine[] = engines.map(
    (e) => e.engine as AeoEngine,
  );

  const properties = await loadProperties(opts);

  const projected =
    properties.length * engines.length * PROMPTS_PER_PROPERTY;
  if (projected > PROJECTED_QUERIES_WARN) {
    console.warn(
      `[aeo.orchestrate] high query projection: ${projected} (` +
        `${properties.length} properties × ${engines.length} engines × ` +
        `${PROMPTS_PER_PROPERTY} prompts) for org ${opts.orgId}`,
    );
  }

  let rowsWritten = 0;
  let skipped = 0;
  let errors = 0;
  let promptsRun = 0;

  // Per-engine rolling next-allowed-at timestamp for the simple throttle.
  const engineNextAllowedAt = new Map<string, number>();

  for (const property of properties) {
    const prompts = generatePrompts({
      city: property.city,
      state: property.state,
      neighborhood: deriveNeighborhood(property),
      propertyType: property.propertyType,
      residentialSubtype: property.residentialSubtype,
      commercialSubtype: property.commercialSubtype,
      // Brand-aware prompts (Norman feedback May 22): include 2 prompts
      // that name the property directly so the AI Search Visibility
      // dashboard reflects defensive moat (branded queries — AI knows
      // who you are) alongside growth gap (discovery queries — does AI
      // surface you against competitors). Real properties get
      // meaningfully non-zero citation rates immediately on branded.
      propertyName: property.name,
    }).slice(0, PROMPTS_PER_PROPERTY);

    if (prompts.length === 0) {
      // Property lacks a city — nothing useful we can ask the engines.
      continue;
    }

    for (const prompt of prompts) {
      promptsRun += 1;
      for (const engine of engines) {
        await throttleEngine(engineNextAllowedAt, engine.engine);
        const result = await engine.runPrompt(prompt);
        if ("skipped" in result && result.skipped) {
          skipped += 1;
          continue;
        }
        try {
          const parsed = parseCitation(result.responseText, {
            name: property.name,
            websiteUrl: property.websiteUrl,
          });
          // `mentioned` is the looser signal — true when the brand name
          // or its domain shows up in the response at all (i.e. status is
          // CITED). COMPETITOR_CITED rows mean the engine named a rival
          // without naming the brand, so mentioned stays false. This
          // keeps the AEO page's mention vs. citation breakdown honest:
          // a high mention rate now means "engines are aware of the
          // brand" rather than the previous overstatement.
          const mentioned = parsed.status === "CITED";
          await prisma.aeoCitationCheck.create({
            data: {
              orgId: property.orgId,
              propertyId: property.id,
              engine: engine.engine as AeoEngine,
              prompt,
              status: parsed.status,
              mentioned,
              responseText: result.responseText.slice(0, 8000),
              citedUrl: parsed.citedUrl ?? null,
              competitorsCited: parsed.competitorsCited,
              metadata: {
                engineMetadata: result.metadata ?? {},
                citedUrls: result.citedUrls.slice(0, 20),
              } as Prisma.InputJsonValue,
            },
          });
          rowsWritten += 1;

          // AEO v2 W1: write a richer AeoMentionSnapshot row whenever the
          // engine module surfaced DataForSEO-shaped metadata. Direct-API
          // engines don't return ordered mentions, so we skip snapshot
          // writes for them (the existing AeoCitationCheck row still
          // captures the citation breakdown).
          if (isDataForSeoEngineMetadata(result.metadata)) {
            try {
              const { classified, shareOfVoice } = classifyMentions(
                result.metadata.mentions,
                {
                  name: property.name,
                  websiteUrl: property.websiteUrl,
                },
              );
              await prisma.aeoMentionSnapshot.create({
                data: {
                  orgId: property.orgId,
                  propertyId: property.id,
                  engine: engine.engine as AeoEngine,
                  prompt,
                  shareOfVoice,
                  mentions:
                    classified as unknown as Prisma.InputJsonValue,
                  externalId: result.metadata.externalId,
                  costUsd: result.metadata.costUsd,
                  metadata: {
                    source: "dataforseo",
                    surface: "property",
                  } as Prisma.InputJsonValue,
                },
              });
            } catch (snapshotErr) {
              // Non-fatal — citation row already landed, snapshot is an
              // augmentation. Log + carry on so a transient Prisma issue
              // doesn't abort the scan.
              console.error(
                `[aeo.orchestrate] snapshot persist failed for property ${property.id} / ${engine.engine}:`,
                snapshotErr instanceof Error
                  ? snapshotErr.message
                  : snapshotErr,
              );
            }
          }
        } catch (err) {
          errors += 1;
          console.error(
            `[aeo.orchestrate] persist failed for property ${property.id} / ${engine.engine}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  return {
    orgId: opts.orgId,
    enginesUsed: engineNames,
    propertiesScanned: properties.length,
    promptsRun,
    rowsWritten,
    skipped,
    errors,
    durationMs: Date.now() - start,
  };
}

async function loadProperties(opts: ScanOptions): Promise<PropertyRow[]> {
  const where = {
    ...marketablePropertyWhere(opts.orgId),
    ...(opts.propertyId ? { id: opts.propertyId } : {}),
  };
  const rows = await prisma.property.findMany({
    where,
    select: {
      id: true,
      orgId: true,
      name: true,
      websiteUrl: true,
      city: true,
      state: true,
      propertyType: true,
      residentialSubtype: true,
      commercialSubtype: true,
      addressLine1: true,
    },
    orderBy: { updatedAt: "desc" },
    take: opts.maxProperties ?? 50,
  });
  return rows;
}

/**
 * Very simple per-engine throttle. The orchestrator processes prompts
 * sequentially so we just need to ensure each engine gets at least
 * PER_ENGINE_DELAY_MS between successive requests.
 */
async function throttleEngine(
  map: Map<string, number>,
  engine: string,
): Promise<void> {
  const now = Date.now();
  const nextAllowed = map.get(engine) ?? 0;
  if (now < nextAllowed) {
    await sleep(nextAllowed - now);
  }
  map.set(engine, Date.now() + PER_ENGINE_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pull a neighborhood signal off the property. We don't have a dedicated
 * column, so we derive from addressLine1 when it looks neighborhood-y, or
 * fall back to null and let the prompt generator stay city-only.
 *
 * Future: when NeighborhoodPage rows exist for a property, prefer that.
 */
function deriveNeighborhood(p: PropertyRow): string | null {
  // For now we don't have a structured neighborhood field. Returning null
  // is safe — the prompt generator handles city-only seeds.
  return null;
}

// ---------------------------------------------------------------------------
// runNeighborhoodScan — claim-level visibility check for one NeighborhoodPage
//
// For each `aiCitations[]` claim on the page we ask Claude to rewrite the
// claim into 2-3 natural search prompts (cached back on the page so future
// scans skip the rewrite). We then fan those prompts × engines and write
// one AeoCitationCheck per (claim, prompt, engine) tuple tagged with
// neighborhoodPageId + the raw claim.
//
// CITED if the page's slug, public URL, OR the anchor property's name
// comes back. COMPETITOR_CITED if another building gets named. Else
// NOT_CITED.
// ---------------------------------------------------------------------------

export interface NeighborhoodScanOptions {
  orgId: string;
  pageId: string;
  engines?: EngineModule[];
  /** Cap on claims processed this run. Defaults to all (up to 20). */
  maxClaims?: number;
  /** Cap on prompts per claim (1-3). Defaults to 3 — cron uses 2. */
  promptsPerClaim?: number;
}

export interface NeighborhoodScanResult {
  pageId: string;
  orgId: string;
  enginesUsed: AeoEngine[];
  claimsScanned: number;
  promptsRun: number;
  queriesRun: number;
  citedCount: number;
  rowsWritten: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export async function runNeighborhoodScan(
  opts: NeighborhoodScanOptions,
): Promise<NeighborhoodScanResult> {
  const start = Date.now();
  const engines = opts.engines ?? getEnabledEngines();
  const engineNames: AeoEngine[] = engines.map((e) => e.engine as AeoEngine);

  const page = await prisma.neighborhoodPage.findFirst({
    where: { id: opts.pageId, orgId: opts.orgId },
    select: {
      id: true,
      orgId: true,
      city: true,
      state: true,
      neighborhood: true,
      slug: true,
      aiCitations: true,
      propertyId: true,
      property: {
        select: { id: true, name: true, websiteUrl: true },
      },
      org: {
        select: {
          slug: true,
          // Primary custom domain (if any) — used to derive the canonical
          // public URL for CITED detection.
          domains: {
            where: { isPrimary: true },
            select: { hostname: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!page) {
    throw new Error(`NeighborhoodPage ${opts.pageId} not found in org ${opts.orgId}`);
  }

  const rawClaims = parseClaimSets(page.aiCitations);
  const claims = rawClaims.slice(
    0,
    opts.maxClaims ?? NEIGHBORHOOD_PROMPT_LIMITS.MAX_CLAIMS,
  );

  if (claims.length === 0) {
    return {
      pageId: page.id,
      orgId: page.orgId,
      enginesUsed: engineNames,
      claimsScanned: 0,
      promptsRun: 0,
      queriesRun: 0,
      citedCount: 0,
      rowsWritten: 0,
      skipped: 0,
      errors: 0,
      durationMs: Date.now() - start,
    };
  }

  // Rewrite (and cache) prompts for each claim. parseClaimSets already
  // turns legacy string[] entries into { claim, prompts: [] } so the
  // rewriter fills any missing prompts in-place.
  const enriched = await rewriteAllClaims(claims, {
    city: page.city,
    state: page.state,
    neighborhood: page.neighborhood,
    propertyName: page.property?.name ?? null,
  });

  // Persist the enriched aiCitations back on the page so future scans skip
  // the Claude rewrite step.
  await persistEnrichedClaims(page.id, enriched);

  const promptsPerClaim = Math.min(
    Math.max(opts.promptsPerClaim ?? NEIGHBORHOOD_PROMPTS_PER_CLAIM_CAP, 1),
    NEIGHBORHOOD_PROMPTS_PER_CLAIM_CAP,
  );

  const projected = enriched.reduce(
    (n, c) => n + Math.min(c.prompts.length, promptsPerClaim),
    0,
  ) * engines.length;
  if (projected > NEIGHBORHOOD_PROJECTED_QUERIES_WARN) {
    console.warn(
      `[aeo.orchestrate] high neighborhood-scan projection: ${projected} queries (` +
        `${enriched.length} claims × ${engines.length} engines × <=${promptsPerClaim} prompts) for page ${page.id}`,
    );
  }

  // Build the citation target for the parser. We want CITED to match on:
  //  - the anchor property's name (if any)
  //  - the page's own /n/<slug> URL on the org's marketing domain
  //  - the property's websiteUrl
  const primaryHost = page.org.domains[0]?.hostname ?? null;
  const pageSlugUrl = primaryHost
    ? `https://${primaryHost}/n/${page.slug}`
    : null;
  const target = {
    name: page.property?.name ?? `${page.neighborhood} guide`,
    websiteUrl: page.property?.websiteUrl ?? pageSlugUrl,
    aliases: [
      page.property?.name ?? "",
      // Match path-only references like "/n/the-mission-sf"
      `/n/${page.slug}`,
      pageSlugUrl ?? "",
    ].filter(Boolean) as string[],
  };

  let rowsWritten = 0;
  let citedCount = 0;
  let skipped = 0;
  let errors = 0;
  let promptsRun = 0;
  let queriesRun = 0;

  const engineNextAllowedAt = new Map<string, number>();

  for (const entry of enriched) {
    const prompts = entry.prompts.slice(0, promptsPerClaim);
    if (prompts.length === 0) continue;

    for (const prompt of prompts) {
      promptsRun += 1;
      for (const engine of engines) {
        await throttleEngine(engineNextAllowedAt, engine.engine);
        queriesRun += 1;
        const result = await engine.runPrompt(prompt);
        if ("skipped" in result && result.skipped) {
          skipped += 1;
          continue;
        }
        try {
          const parsed = parseCitation(result.responseText, target);
          if (parsed.status === "CITED") citedCount += 1;
          await prisma.aeoCitationCheck.create({
            data: {
              orgId: page.orgId,
              propertyId: page.propertyId ?? null,
              neighborhoodPageId: page.id,
              claim: entry.claim,
              engine: engine.engine as AeoEngine,
              prompt,
              status: parsed.status,
              // Same semantics as the property scan: mentioned tracks
              // whether the engine named the brand or linked our domain,
              // independent of citedUrl. Stays false on COMPETITOR_CITED.
              mentioned: parsed.status === "CITED",
              responseText: result.responseText.slice(0, 8000),
              citedUrl: parsed.citedUrl ?? null,
              competitorsCited: parsed.competitorsCited,
              metadata: {
                engineMetadata: result.metadata ?? {},
                citedUrls: result.citedUrls.slice(0, 20),
                source: "neighborhood",
              } as Prisma.InputJsonValue,
            },
          });
          rowsWritten += 1;

          // AEO v2 W1: snapshot the richer mention list for neighborhood
          // scans too. Target identity is the anchor property (when one
          // exists) — otherwise we fall back to the page slug/URL and
          // classifier degrades to "other" for everything, which is the
          // honest read for a generic neighborhood guide.
          if (isDataForSeoEngineMetadata(result.metadata)) {
            try {
              const { classified, shareOfVoice } = classifyMentions(
                result.metadata.mentions,
                {
                  name:
                    page.property?.name ?? `${page.neighborhood} guide`,
                  websiteUrl: page.property?.websiteUrl ?? pageSlugUrl,
                  aliases: target.aliases,
                },
              );
              await prisma.aeoMentionSnapshot.create({
                data: {
                  orgId: page.orgId,
                  propertyId: page.propertyId ?? null,
                  engine: engine.engine as AeoEngine,
                  prompt,
                  shareOfVoice,
                  mentions:
                    classified as unknown as Prisma.InputJsonValue,
                  externalId: result.metadata.externalId,
                  costUsd: result.metadata.costUsd,
                  metadata: {
                    source: "dataforseo",
                    surface: "neighborhood",
                    neighborhoodPageId: page.id,
                    claim: entry.claim,
                  } as Prisma.InputJsonValue,
                },
              });
            } catch (snapshotErr) {
              console.error(
                `[aeo.orchestrate] snapshot persist failed for page ${page.id} / ${engine.engine}:`,
                snapshotErr instanceof Error
                  ? snapshotErr.message
                  : snapshotErr,
              );
            }
          }
        } catch (err) {
          errors += 1;
          console.error(
            `[aeo.orchestrate] persist failed for page ${page.id} / claim "${entry.claim.slice(0, 40)}" / ${engine.engine}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  return {
    pageId: page.id,
    orgId: page.orgId,
    enginesUsed: engineNames,
    claimsScanned: enriched.length,
    promptsRun,
    queriesRun,
    citedCount,
    rowsWritten,
    skipped,
    errors,
    durationMs: Date.now() - start,
  };
}

async function persistEnrichedClaims(
  pageId: string,
  enriched: ClaimPromptSet[],
): Promise<void> {
  try {
    await prisma.neighborhoodPage.update({
      where: { id: pageId },
      data: {
        aiCitations: enriched as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Non-fatal — the scan can proceed using in-memory prompts even if
    // the cache write fails.
    console.error(
      `[aeo.orchestrate] failed to persist enriched aiCitations for page ${pageId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
