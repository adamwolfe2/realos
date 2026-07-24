import * as React from "react";
import type {
  ReportContentStats,
  ReportSnapshot,
} from "@/lib/reports/generate";
import { summarizeGroup } from "@/lib/insights/summarize-group";
import {
  MiniStat,
  Section,
} from "@/components/portal/reports/sections/report-primitives";

// ---------------------------------------------------------------------------
// GroupedInsights — collapses repetitive insight rows into a single summary
// row with an expandable details panel. Operators were seeing 17 identical
// "X rent is N% below portfolio average" rows; that's one signal, not 17.
//
// Grouping rule: when ≥ 3 insights share the same (kind, severity), they
// collapse into one summary card. Click expands the inline list using a
// native <details> element so the report stays server-rendered + print-safe
// (print CSS forces [open] so PDFs include everything).
// ---------------------------------------------------------------------------

type InsightItem = ReportSnapshot["insights"][number];

const GROUP_MIN = 3;

function groupKey(item: InsightItem): string {
  return `${item.kind}::${item.severity}`;
}

function InsightRow({ insight }: { insight: InsightItem }) {
  return (
    <li className="rounded-[2px] border border-border bg-card px-3 py-2">
      <span className="text-sm font-semibold text-foreground">
        {insight.title}
      </span>
      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {insight.body}
      </p>
    </li>
  );
}

export function GroupedInsights({ items }: { items: InsightItem[] }) {
  // Preserve original order; bucket by (kind, severity).
  const order: string[] = [];
  const buckets = new Map<string, InsightItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }

  return (
    <ul className="space-y-1.5">
      {order.flatMap((key) => {
        const group = buckets.get(key)!;
        if (group.length < GROUP_MIN) {
          return group.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ));
        }
        const sample = group[0];
        const { title, body } = summarizeGroup(
          sample.kind,
          sample.severity,
          group.length,
        );
        return [
          <li
            key={key}
            className="rounded-[2px] border border-border bg-card overflow-hidden ls-insight-group"
          >
            <details className="group">
              <summary className="px-3 py-2 cursor-pointer list-none flex items-start gap-2 flex-wrap hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {title}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0 mt-0.5 group-open:hidden">
                  View {group.length} →
                </span>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5 hidden group-open:inline">
                  Hide
                </span>
              </summary>
              <ul className="space-y-1.5 px-3 pb-3 pt-1 border-t border-border bg-secondary">
                {group.map((insight) => (
                  <InsightRow key={insight.id} insight={insight} />
                ))}
              </ul>
            </details>
          </li>,
        ];
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// ContentSection — published blog posts + neighborhood landing pages.
// Norman feedback (May 22): make the SEO content pipeline visible in
// the report as a real deliverable. Top strip: total published + new
// in period. Bar chart: format breakdown. List: most recent 5 with
// clickable links so ownership can read the actual content.
// ---------------------------------------------------------------------------
export function ContentSection({ stats }: { stats: ReportContentStats }) {
  const maxCount = Math.max(1, ...stats.byFormat.map((f) => f.count));
  return (
    <div className="space-y-3">
      <Section
        className="ls-report-section"
        eyebrow={`${stats.publishedInPeriod} shipped this period`}
        title="Published content"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <MiniStat
            label="Total published"
            value={stats.totalPublished.toLocaleString()}
          />
          <MiniStat
            label="New this period"
            value={stats.publishedInPeriod.toLocaleString()}
          />
          <MiniStat
            label="Formats"
            value={stats.byFormat.length.toLocaleString()}
          />
        </div>

        {/* Format bar chart — horizontal bars sized by count. Reads as
            "you publish X blog posts, Y neighborhood pages, Z FAQ
            blocks" at a glance. */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            By format
          </div>
          {stats.byFormat.map((row) => (
            <div key={row.format} className="flex items-center gap-3">
              <div className="text-[12px] font-medium text-foreground w-44 truncate">
                {row.format}
              </div>
              <div className="flex-1 h-4 bg-secondary rounded-[2px] overflow-hidden">
                <div
                  className="h-full bg-primary rounded-[2px]"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="text-[12px] font-semibold tabular-nums text-foreground w-10 text-right">
                {row.count}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Norman feedback (May 22, n+2): "Where are the actual blocks?
          I want to be able to open those and see those in here. Even
          if they're in draft detection and not fully approved yet,
          I want to see them." Re-added the per-item list with status
          pills so the Content tab shows the full editorial pipeline
          (in-progress drafts + published items). Click-through is
          opt-in — items without a public URL just render as a card
          with the status, no broken link. */}
      {stats.recent.length > 0 ? (
        <Section
          className="ls-report-section"
          eyebrow="What's in flight + recently shipped"
          title="Content pipeline"
        >
          <ul className="space-y-2">
            {stats.recent.map((item, i) => {
              const status = (item.status ?? "shipped").toLowerCase();
              const pill = contentStatusPill(status);
              // Live URL wins (real published page); preview URL is the
              // fallback so drafts/in-progress items can still be opened.
              // Norman May 22: "It would be awesome for the user to be
              // able to check out the blogs before they're posted."
              const href = item.url ?? item.previewUrl ?? null;
              const isPreview = !item.url && Boolean(item.previewUrl);
              const inner = (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] uppercase tracking-widest font-bold text-muted-foreground">
                      {item.format}
                    </span>
                    <span
                      className="inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: pill.bg,
                        color: pill.fg,
                      }}
                    >
                      {pill.label}
                    </span>
                    {href ? (
                      <span className="text-[9.5px] font-semibold text-primary ml-auto whitespace-nowrap">
                        {isPreview ? "Preview →" : "Open →"}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[13px] font-medium text-foreground mt-0.5 leading-snug">
                    {item.title}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">
                    Updated {new Date(item.publishedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                </>
              );
              return (
                <li
                  key={`${item.title}-${i}`}
                  className="rounded-[2px] border border-border bg-card px-3 py-2.5"
                >
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:bg-muted/30 -m-3 p-3 rounded-[2px] transition-colors"
                    >
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

// contentStatusPill — maps a ContentDraft / NeighborhoodPage status
// string to a colored chip so the operator can tell at a glance
// what's in draft vs. shipped vs. needs-review. Tones stay inside
// the blue palette so the report never breaks into amber/red except
// for explicit negative-review surfaces.
function contentStatusPill(status: string): {
  label: string;
  bg: string;
  fg: string;
} {
  const s = status.toLowerCase();
  if (s === "shipped" || s === "published")
    return { label: "live", bg: "#defbe6", fg: "#0e6027" };
  if (s === "approved") return { label: "approved", bg: "#d0e2ff", fg: "#002d9c" };
  if (s === "pending_review")
    return { label: "in review", bg: "#fcf4d6", fg: "#684e00" };
  if (s === "changes_requested")
    return { label: "revising", bg: "#fcf4d6", fg: "#684e00" };
  if (s === "generating")
    return { label: "drafting", bg: "#f6f2ff", fg: "#6929c4" };
  if (s === "draft") return { label: "draft", bg: "#e0e0e0", fg: "#393939" };
  return { label: s, bg: "#e0e0e0", fg: "#393939" };
}
