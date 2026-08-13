import "server-only";
import { prisma } from "@/lib/db";
import type { Detector, DetectedInsight } from "../types";
import { isoWeekKey } from "../iso-week";
import { isBrandedPromptText } from "@/lib/aeo/prompts";

const DAY = 24 * 60 * 60 * 1000;
// Overtake rule (2026-08-14, goal spec slice 10 — pure severity rules):
// on one engine, over the last 14 days of DISCOVERY answers, a single
// competitor is named in MORE answers than the property — and that was
// not true in the prior 14 days (a crossover, not a steady state, so
// the alert fires when the ranking actually flips). Once per
// (property, engine, competitor, ISO week).
const MIN_ANSWERS_PER_ENGINE = 4;

export const aeoCompetitorOvertakeDetector: Detector = {
  name: "aeo-competitor-overtake",
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    if (propertyIds.length === 0) return [];
    const now = Date.now();
    const last14 = new Date(now - 14 * DAY);
    const prior14 = new Date(now - 28 * DAY);

    const checks = await prisma.aeoCitationCheck.findMany({
      where: {
        orgId,
        propertyId: { in: propertyIds },
        neighborhoodPageId: null,
        queryRunAt: { gte: prior14 },
      },
      select: {
        propertyId: true,
        engine: true,
        prompt: true,
        mentioned: true,
        competitorsCited: true,
        queryRunAt: true,
        metadata: true,
        property: { select: { name: true } },
      },
      // Deterministic newest-first: if the cap ever hits, we lose the
      // OLDEST rows (prior window shrinks toward the crossover-guard's
      // first-scan case) instead of a random sample of both windows.
      orderBy: { queryRunAt: "desc" },
      take: 4000,
    });

    type Window = {
      total: number;
      you: number;
      competitors: Map<string, number>;
    };
    const emptyWindow = (): Window => ({
      total: 0,
      you: 0,
      competitors: new Map(),
    });
    // (propertyId, engine) → { name, recent, prior }
    const groups = new Map<
      string,
      { propertyId: string; engine: string; name: string; recent: Window; prior: Window }
    >();
    for (const c of checks) {
      // Discovery answers only — a branded answer naming a rival is not
      // a ranking signal. propertyId/property are nullable on the row
      // (org-wide legacy checks) — skip those, this is per-property.
      if (!c.propertyId || !c.property) continue;
      // Persisted promptKind is ground truth (honors the operator's
      // branded tag on custom prompts); the template-marker check only
      // covers rows that predate the metadata.
      const kind = (c.metadata as { promptKind?: string } | null)?.promptKind;
      if (kind === "branded") continue;
      if (!kind && isBrandedPromptText(c.prompt)) continue;
      const key = `${c.propertyId}:${c.engine}`;
      const g =
        groups.get(key) ??
        {
          propertyId: c.propertyId,
          engine: c.engine as string,
          name: c.property.name,
          recent: emptyWindow(),
          prior: emptyWindow(),
        };
      const w = c.queryRunAt >= last14 ? g.recent : g.prior;
      w.total += 1;
      if (c.mentioned) w.you += 1;
      for (const rival of c.competitorsCited) {
        w.competitors.set(rival, (w.competitors.get(rival) ?? 0) + 1);
      }
      groups.set(key, g);
    }

    const week = isoWeekKey(new Date());
    const out: DetectedInsight[] = [];
    for (const g of groups.values()) {
      if (g.recent.total < MIN_ANSWERS_PER_ENGINE) continue;
      const top = [...g.recent.competitors.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (!top) continue;
      const [rival, rivalCount] = top;
      if (rivalCount <= g.recent.you) continue; // not ahead of you
      // Crossover check: in the prior window the same rival was NOT ahead
      // (or there was no prior data — first-scan case still alerts).
      const priorRival = g.prior.competitors.get(rival) ?? 0;
      if (g.prior.total >= MIN_ANSWERS_PER_ENGINE && priorRival > g.prior.you) {
        continue; // steady state, already alerted when it flipped
      }
      const engineLabel =
        { CHATGPT: "ChatGPT", PERPLEXITY: "Perplexity", CLAUDE: "Claude", GEMINI: "Gemini" }[
          g.engine
        ] ?? g.engine;
      out.push({
        kind: "aeo_competitor_overtake",
        category: "seo",
        severity: g.recent.you === 0 ? "critical" : "warning",
        title: `${rival} now outranks ${g.name} on ${engineLabel}`,
        body: `In the last 14 days ${engineLabel} named ${rival} in ${rivalCount} discovery answers vs ${g.recent.you} for ${g.name}. When renters ask where to live, that engine is sending them to your competitor.`,
        suggestedAction:
          "Open the AI visibility page: check which prompts the rival wins, then publish the counter-content the recommendations card suggests.",
        propertyId: g.propertyId,
        entityType: "property",
        entityId: g.propertyId,
        href: "/portal/seo/aeo",
        // Rival name normalized — LLM-extracted casing/spacing drift
        // ("The Standard" vs "the standard ") must not double-fire.
        dedupeKey: `aeo_competitor_overtake:${g.propertyId}:${g.engine}:${rival.trim().toLowerCase()}:week:${week}`,
        context: {
          engine: g.engine,
          rival,
          rivalCount,
          youCount: g.recent.you,
          totalAnswers: g.recent.total,
        },
      });
    }
    return out;
  },
};
