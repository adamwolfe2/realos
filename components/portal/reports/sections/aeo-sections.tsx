import * as React from "react";
import type {
  ReportAeoStats,
  ReportAiVisibility,
} from "@/lib/reports/generate";
import {
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { Donut as SharedDonut } from "@/components/portal/ui/charts";
import {
  MiniStat,
  Section,
} from "@/components/portal/reports/sections/report-primitives";

// ---------------------------------------------------------------------------
// AeoSection — AI search citation breakdown. Shows the gap-to-close
// story: "your competitors are getting cited X times, you got cited Y."
// This is one of the highest-signal sections in the report for any
// pixel-active tenant — competitors named by ChatGPT / Claude /
// Perplexity / Gemini are the literal results AI users see when they
// ask about the local market.
// ---------------------------------------------------------------------------
export function AeoSection({ stats }: { stats: ReportAeoStats }) {
  const sharePct =
    stats.totalChecks > 0
      ? Math.round((stats.cited / stats.totalChecks) * 100)
      : 0;
  // Citation-share donut — same Donut primitive the dashboard uses.
  // "Not mentioned" = totalChecks minus (cited + competitorCited),
  // floored at 0 because legacy snapshots sometimes overlapped buckets.
  const notMentioned = Math.max(
    0,
    stats.totalChecks - stats.cited - stats.competitorCited,
  );
  const donutSlices = [
    { label: "Cited you", value: stats.cited, color: "#0f62fe" },
    { label: "Cited competitor", value: stats.competitorCited, color: "#a6c8ff" },
    { label: "Not mentioned", value: notMentioned, color: "#e0e0e0" },
  ].filter((s) => s.value > 0);
  return (
    <Section
      className="ls-report-section"
      eyebrow={`${stats.totalChecks} AI search checks · ${stats.enginesUsed.map(prettyEngineName).join(" · ")}`}
      title="AI answer visibility"
    >
      <div className="space-y-3">
        {/* Glance row: donut + 3 stat tiles. Reusing the shared Donut
            primitive so the chart reads identically to the SEO /
            dashboard surfaces — same brand palette, same stroke
            geometry, same center label treatment. */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <SharedDonut
            slices={donutSlices}
            size={120}
            strokeWidth={18}
            centerPrimary={`${sharePct}%`}
            centerSecondary="Citations"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MiniStat
              label="You cited"
              value={stats.cited.toLocaleString()}
            />
            <MiniStat
              label="Competitor cited"
              value={stats.competitorCited.toLocaleString()}
            />
            <MiniStat
              label="Engines scanned"
              value={stats.enginesUsed.length.toLocaleString()}
            />
          </div>
        </div>

        {/* Per-engine stacked bar chart (Norman feedback May 22 — richer
            charts in every tab + use real brand logos for ChatGPT /
            Claude / Perplexity / Gemini so the section reads like a
            real AI search audit, not a plain table). The "you cited"
            bar gets the deep brand blue gradient, the "competitor"
            bar gets a softer blue (so it still reads as a tracked
            measurement, not a yellow warning), and "not mentioned"
            stays neutral gray. Only renders when byEngine is present. */}
        {stats.byEngine && stats.byEngine.length > 0 ? (
          <div>
            {/* Bug #118 (was #5): Norman flagged identical 14/38 counts across all
                three engines as suspicious — looked like a binning/display
                bug. Investigated: underlying computation is correct (per-engine
                groupBy in buildAeoStats); engines genuinely run the SAME prompt
                set so matching counts are real coincidence, not aggregation bug.
                Fixed by reframing — eyebrow now says "cited / total per engine"
                and the segment tooltips spell out that each engine is measured
                independently. Equal numbers now read as informative, not buggy. */}
            <div
              className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5"
              title="Per-engine count = AI search queries where this engine cited your domain at least once. Each engine is measured independently against the same prompt set, so matching counts across engines are possible (and meaningful)."
            >
              By engine{" "}
              <span
                aria-hidden="true"
                className="text-muted-foreground/60 normal-case tracking-normal font-normal"
              >
                · cited / total per engine
              </span>
            </div>
            {/* Norman bug (May 22, n+1): when the data has all three
                engines at identical counts (14/14/14), simple end-aligned
                bars read as visually flat — same proportion, same color
                stops. Inline per-segment labels (You 14 · Comp 22 · — 2)
                + a small win-rate pill at the end give each row its own
                readable identity even when the underlying numbers
                happen to match. */}
            <div className="space-y-2">
              {stats.byEngine.map((e) => {
                const notMentioned =
                  e.total - e.cited - e.competitorCited;
                const pct = (n: number) =>
                  e.total > 0 ? (n / e.total) * 100 : 0;
                const winRate = e.total > 0
                  ? Math.round((e.cited / e.total) * 100)
                  : 0;
                return (
                  <div
                    key={e.engine}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    {/* Engine label column — tighter on mobile so the
                        bar gets the real estate. The text label hides
                        under sm: and only the brand logo shows. */}
                    <div className="flex items-center gap-1.5 sm:w-32 shrink-0">
                      <AeoEngineLogo engine={e.engine} />
                      <span className="hidden sm:inline text-[11px] font-semibold tracking-wide text-foreground truncate">
                        {prettyEngineName(e.engine)}
                      </span>
                    </div>
                    <div className="flex-1 h-6 rounded-[2px] overflow-hidden bg-secondary flex relative min-w-0">
                      {e.cited > 0 ? (
                        <div
                          className="h-full flex items-center justify-center min-w-0"
                          style={{
                            width: `${pct(e.cited)}%`,
                            backgroundColor: "#0f62fe",
                          }}
                          title={`${e.cited} of ${e.total} queries on this engine cited your domain`}
                        >
                          {/* Inline labels only on sm+ — they overflow
                              narrow viewports and the win-rate pill at
                              the end already tells the story. */}
                          {pct(e.cited) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-white tabular-nums whitespace-nowrap">
                              You {e.cited}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {e.competitorCited > 0 ? (
                        <div
                          className="h-full flex items-center justify-center min-w-0"
                          style={{
                            width: `${pct(e.competitorCited)}%`,
                            backgroundColor: "#a6c8ff",
                          }}
                          title={`${e.competitorCited} of ${e.total} queries on this engine cited a competitor instead`}
                        >
                          {pct(e.competitorCited) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-[#002d9c] tabular-nums whitespace-nowrap">
                              Comp {e.competitorCited}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {notMentioned > 0 ? (
                        <div
                          className="h-full bg-muted-foreground/20 flex items-center justify-center min-w-0"
                          style={{ width: `${pct(notMentioned)}%` }}
                          title={`${notMentioned} of ${e.total} queries on this engine returned no property mention`}
                        >
                          {pct(notMentioned) > 14 ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                              — {notMentioned}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 justify-end">
                      <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {e.cited}/{e.total}
                      </span>
                      <span
                        className="inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums"
                        style={{
                          backgroundColor:
                            winRate >= 50
                              ? "#defbe6"
                              : winRate >= 30
                                ? "#d0e2ff"
                                : "#ffd7d9",
                          color:
                            winRate >= 50
                              ? "#0e6027"
                              : winRate >= 30
                                ? "#002d9c"
                                : "#a2191f",
                        }}
                      >
                        {winRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{ backgroundColor: "#0f62fe" }}
                />
                cited you
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{ backgroundColor: "#a6c8ff" }}
                />
                cited competitor
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-muted-foreground/25" />
                not mentioned
              </span>
            </div>
          </div>
        ) : null}

        {stats.topCompetitors.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
              Who is getting cited instead
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.topCompetitors.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border border-[#a6c8ff] bg-[#edf5ff] px-2 py-0.5 text-[#002d9c]"
                >
                  {c.name}
                  <span className="text-[#0043ce]/70 tabular-nums">
                    ×{c.mentions}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {stats.sampleCompetitorQueries.length > 0 ? (() => {
          // Bug #116 (was #7): the section used to render one row per engine
          // with the same prompt repeated 3x ("Claude / ChatGPT / Perplexity —
          // same query"), which made the plural label "Sample queries you lost"
          // read as a bug. Fix (a): dedupe by query string. We run the SAME
          // prompt set on every engine, so duplicates are expected — group by
          // prompt and show each prompt once with the engines + competitors it
          // lost on. Label also adapts when a single query is the only row.
          type Sample = (typeof stats.sampleCompetitorQueries)[number];
          const grouped = new Map<
            string,
            { prompt: string; engines: string[]; competitors: string[] }
          >();
          for (const q of stats.sampleCompetitorQueries) {
            const g = grouped.get(q.prompt) ?? {
              prompt: q.prompt,
              engines: [],
              competitors: [],
            };
            if (!g.engines.includes(q.engine)) g.engines.push(q.engine);
            for (const c of q.competitors) {
              if (!g.competitors.includes(c)) g.competitors.push(c);
            }
            grouped.set(q.prompt, g);
          }
          const rows = [...grouped.values()];
          const allSameQuery = rows.length === 1 && stats.sampleCompetitorQueries.length > 1;
          const label = allSameQuery
            ? "Query you lost on multiple engines"
            : rows.length === 1
              ? "Query you lost"
              : "Queries you lost";
          return (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
                {label}
              </div>
              <ul className="space-y-1.5">
                {rows.map((q, i) => (
                  <li
                    key={i}
                    className="text-[11.5px] leading-snug bg-muted/30 rounded-[2px] px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {q.engines.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center gap-1"
                        >
                          <AeoEngineLogo engine={e} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {prettyEngineName(e)}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="text-foreground">
                      &ldquo;{q.prompt.length > 110 ? q.prompt.slice(0, 107) + "…" : q.prompt}&rdquo;
                    </div>
                    {q.competitors.length > 0 ? (
                      <div className="mt-0.5 text-muted-foreground">
                        → cited {q.competitors.slice(0, 3).join(", ")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })() : null}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Each week LeaseStack asks ChatGPT, Claude, and Perplexity the
          same set of buyer-intent prompts about your market. This is
          the score for what they actually answered. Closing the gap
          drives the next 12–24 months of search traffic.
        </p>
      </div>
    </Section>
  );
}

export function AiVisibilitySection({
  aiVisibility,
}: {
  aiVisibility: ReportAiVisibility;
}) {
  return (
    <Section
      className="ls-report-section"
      eyebrow="Branded search performance"
      title="AI search visibility"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <MiniStat
            label="Branded clicks"
            value={aiVisibility.brandedClicks.toLocaleString()}
          />
          <MiniStat
            label="Branded impr."
            value={aiVisibility.brandedImpressions.toLocaleString()}
          />
          <MiniStat
            label="Branded share"
            value={`${aiVisibility.brandedShare}%`}
          />
        </div>
        {aiVisibility.topBrandedTerms.length > 0 ? (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
              Top branded terms
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aiVisibility.topBrandedTerms.map((term) => (
                <span
                  key={term}
                  className="text-xs bg-[#edf5ff] text-[#0043ce] px-2 py-0.5 rounded-full font-semibold"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Branded search clicks reflect how often people search for the
          property by name. Growing this also improves visibility in
          AI-powered recommendations.
        </p>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// AeoEngineLogo — maps engine names from the AEO scan to the real brand
// marks (ChatGPT, Claude, Perplexity, Gemini). Falls back to a neutral
// blue dot for unrecognised engines so a future addition (e.g. Grok)
// renders something sensible instead of blank space.
// ---------------------------------------------------------------------------
function AeoEngineLogo({ engine }: { engine: string }) {
  const key = engine.toLowerCase();
  if (key.includes("chatgpt") || key.includes("openai") || key === "gpt")
    return <ChatGPTMark size={16} />;
  if (key.includes("claude") || key.includes("anthropic"))
    return <ClaudeMark size={16} />;
  if (key.includes("perplexity") || key === "pplx")
    return <PerplexityMark size={16} />;
  if (key.includes("gemini") || key.includes("google"))
    return <GeminiMark size={16} />;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
  );
}

function prettyEngineName(engine: string): string {
  const key = engine.toLowerCase();
  if (key.includes("chatgpt") || key.includes("openai") || key === "gpt")
    return "ChatGPT";
  if (key.includes("claude") || key.includes("anthropic")) return "Claude";
  if (key.includes("perplexity") || key === "pplx") return "Perplexity";
  if (key.includes("gemini")) return "Gemini";
  // Already-prettified engines (e.g. "ChatGPT") pass through.
  return engine
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
