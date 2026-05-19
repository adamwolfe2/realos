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
import { parseCitation } from "./parse";
import { getEnabledEngines, type EngineModule } from "./engines";
import type { AeoEngine, Prisma } from "@prisma/client";

const PROMPTS_PER_PROPERTY = 3;
const PER_ENGINE_DELAY_MS = 3000;
const PROJECTED_QUERIES_WARN = 100;

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
          await prisma.aeoCitationCheck.create({
            data: {
              orgId: property.orgId,
              propertyId: property.id,
              engine: engine.engine as AeoEngine,
              prompt,
              status: parsed.status,
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
