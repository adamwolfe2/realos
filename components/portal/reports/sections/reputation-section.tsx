import * as React from "react";
import type {
  ReportReputationMention,
  ReportReputationStats,
} from "@/lib/reports/generate";
import {
  sanitizeMentionExcerpt,
  isExcerptTruncated,
} from "@/lib/reports/sanitize-excerpt";
import { Donut as SharedDonut } from "@/components/portal/ui/charts";
import {
  MiniStat,
  Section,
  formatDate,
  prettySource,
} from "@/components/portal/reports/sections/report-primitives";

// ---------------------------------------------------------------------------
// New sections
// ---------------------------------------------------------------------------

export function ReputationSection({ stats }: { stats: ReportReputationStats }) {
  return (
    <Section
      className="ls-report-section"
      eyebrow={`${stats.totalReviews.toLocaleString()} lifetime reviews`}
      title="Reputation pulse"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
        {/* Big rating + new + sentiment */}
        <div className="flex flex-col gap-3 min-w-[200px]">
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] leading-none font-bold tabular-nums tracking-tight text-foreground">
              {stats.overallRating != null
                ? stats.overallRating.toFixed(1)
                : "—"}
            </span>
            <span className="text-[20px] text-primary" aria-hidden="true">
              ★
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MiniStat
              label="New"
              value={stats.newInPeriod.toLocaleString()}
            />
            <MiniStat
              label="Positive"
              value={stats.positiveCount.toLocaleString()}
            />
            <MiniStat
              label="Response"
              value={
                stats.responseRatePct != null
                  ? `${stats.responseRatePct}%`
                  : "—"
              }
            />
          </div>
        </div>

        {/* Source breakdown — Norman feedback (May 22): replace the
            row-of-bars treatment with the same Donut primitive the
            dashboard / SEO surfaces use. The legend carries the real
            brand logos so Google / Reddit / Yelp / Facebook read as
            actual platforms, not bare uppercase strings. Top 6 sources
            are shown in the donut, anything beyond rolls into "+N more"
            below. */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <SharedDonut
            slices={stats.sourceBreakdown.slice(0, 6).map((row) => ({
              label: prettySource(row.source),
              value: row.count,
            }))}
            size={120}
            strokeWidth={18}
            centerPrimary={stats.totalReviews.toLocaleString()}
            centerSecondary="Reviews"
          />
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
              Where reviews land
            </div>
            {stats.sourceBreakdown.slice(0, 6).map((row) => {
              const total = stats.totalReviews || 1;
              const pct = Math.round((row.count / total) * 100);
              return (
                <div
                  key={row.source}
                  // Mobile: shrink the label column from 120px → 90px
                  // and merge count + rating into a single right-side
                  // cell so the bar gets meaningful width at 390px.
                  className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[120px_1fr_44px_44px] items-center gap-2 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <ReviewSourceLogo source={row.source} />
                    <span className="font-semibold text-foreground truncate">
                      {prettySource(row.source)}
                    </span>
                  </span>
                  <span className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "#0f62fe",
                      }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-foreground font-semibold sm:hidden whitespace-nowrap">
                    {row.count.toLocaleString()}
                    {row.rating != null ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {row.rating.toFixed(1)}★
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums text-foreground font-semibold hidden sm:inline">
                    {row.count.toLocaleString()}
                  </span>
                  <span className="text-right tabular-nums text-foreground hidden sm:inline">
                    {row.rating != null ? `${row.rating.toFixed(1)}★` : "—"}
                  </span>
                </div>
              );
            })}
            {stats.sourceBreakdown.length > 6 ? (
              <div className="text-[10px] text-muted-foreground italic pl-2">
                +{stats.sourceBreakdown.length - 6} more sources
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Highlights — top 3 by default, the rest behind an expander.
          A full dump of 42 reviews in the report is a wall of text;
          the curated top 3 are the marketing-brag the operator cares
          about. */}
      {(stats.highlights ?? []).length > 0 ? (
        <MentionGroup
          title="Highlights"
          subtitle="What residents are saying — by sentiment + 4.5★+ reviews"
          mentions={stats.highlights!}
          defaultLimit={3}
        />
      ) : null}

      {/* Concerns — show all by default. Negatives are action items;
          we don't want to bury any of them. */}
      {(stats.concerns ?? []).length > 0 ? (
        <MentionGroup
          title="Needs attention"
          subtitle="Negative sentiment, 3★ or below, or flagged — last 12 months"
          mentions={stats.concerns!}
          variant="concern"
        />
      ) : null}

      {/* Recent — top 4 by default. Operators dig in to the full
          feed only when investigating a specific spike. */}
      {(stats.recent ?? stats.topMentions).length > 0 ? (
        <MentionGroup
          title="Recent mentions"
          subtitle="Most recent reviews + posts across Google, Reddit, Yelp, and the web"
          mentions={stats.recent ?? stats.topMentions}
          defaultLimit={4}
        />
      ) : null}
    </Section>
  );
}

// MentionGroup — a labeled stack of full mention cards. Used by the
// report's reputation section for highlights / concerns / recent.
//
// Renders the actual review/post body (not a snippet), the author,
// the date, the sentiment, the source, and a click-out link to the
// original. Server-component-safe — no fetch, no interactivity beyond
// the link itself.
function MentionGroup({
  title,
  subtitle,
  mentions,
  variant = "neutral",
  /**
   * Show only the first N mentions by default. Remaining mentions are
   * tucked into a native <details> expander so the on-screen view stays
   * scannable while the print/PDF includes every row (handled by the
   * tab-strip print CSS that force-opens details). When undefined, all
   * mentions render expanded — used for the "Concerns" group where
   * burying negatives would defeat the purpose.
   */
  defaultLimit,
}: {
  title: string;
  subtitle: string;
  mentions: ReportReputationMention[];
  variant?: "neutral" | "concern";
  defaultLimit?: number;
}) {
  const limit =
    defaultLimit != null && mentions.length > defaultLimit
      ? defaultLimit
      : mentions.length;
  const head = mentions.slice(0, limit);
  const tail = mentions.slice(limit);

  return (
    <div className="mt-4 pt-3 border-t border-border space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {title}
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
          {subtitle}
        </p>
      </div>
      <div className="space-y-2.5">
        {head.map((m) => (
          <ReportMentionCard key={m.id} mention={m} variant={variant} />
        ))}
      </div>
      {tail.length > 0 ? (
        <details className="ls-mention-expander group rounded-[2px] border border-dashed border-border bg-card/30">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-primary hover:bg-muted/30">
            <span className="group-open:hidden">
              View {tail.length} more →
            </span>
            <span className="hidden group-open:inline text-muted-foreground">
              Hide additional mentions
            </span>
          </summary>
          <div className="space-y-2.5 px-3 pb-3 pt-1 border-t border-border bg-secondary">
            {tail.map((m) => (
              <ReportMentionCard key={m.id} mention={m} variant={variant} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReportMentionCard({
  mention: m,
  variant,
}: {
  mention: ReportReputationMention;
  variant: "neutral" | "concern";
}) {
  const sentimentTone =
    m.sentiment === "POSITIVE"
      ? "bg-primary/10 text-primary border-primary/20"
      : m.sentiment === "NEGATIVE"
        ? "bg-primary text-primary-foreground border-primary"
        : m.sentiment === "MIXED"
          ? "bg-muted text-foreground border-border"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={`rounded-[2px] border px-4 py-3 ${
        variant === "concern"
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
              <ReviewSourceLogo source={m.source} />
              {m.source}
            </span>
            {m.rating != null ? (
              <span className="text-[11px] font-semibold text-primary">
                {"★".repeat(Math.round(m.rating))}
                <span className="text-primary/40">
                  {"★".repeat(Math.max(0, 5 - Math.round(m.rating)))}
                </span>
                <span className="ml-1 text-foreground/70">
                  {m.rating.toFixed(1)}
                </span>
              </span>
            ) : null}
            {m.sentiment ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase tracking-wider border ${sentimentTone}`}
              >
                {m.sentiment.toLowerCase()}
              </span>
            ) : null}
            {m.flagged ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase tracking-wider border bg-primary text-primary-foreground border-primary">
                Flagged
              </span>
            ) : null}
          </div>
          {m.title ? (
            <h4 className="mt-1.5 text-[13px] font-semibold text-foreground leading-snug">
              {m.title}
            </h4>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          {m.publishedAt ? (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatDate(new Date(m.publishedAt))}
            </div>
          ) : null}
          {m.authorName ? (
            <div className="text-[10px] text-muted-foreground/80 mt-0.5">
              {m.authorName}
            </div>
          ) : null}
        </div>
      </div>
      {/* Sanitized 240-char preview. Raw excerpts can come from full-page
          web scrapes (BBB / ApartmentRatings / etc) that include site
          nav, footers, and table-of-contents bullets — rendering them
          verbatim destroyed the report's credibility. The sanitizer
          strips markdown chrome and nav junk; if content was clipped, a
          "Read full →" link to sourceUrl is the user's affordance for
          the complete content.

          Bug #9: when the body text is empty (no excerpt at all, OR the
          sanitizer reduced full-page chrome to an empty string) we render
          a compact "(no review text)" muted label instead of the
          truncate-block + "Read full →" CTA, which previously made these
          cards look like a layout glitch. */}
      {(() => {
        const sanitized = m.excerpt ? sanitizeMentionExcerpt(m.excerpt) : "";
        if (!sanitized.trim()) {
          return (
            <p className="mt-2 text-[11.5px] italic text-muted-foreground/70 leading-snug">
              (no review text)
            </p>
          );
        }
        return (
          <p className="mt-2 text-[12px] text-foreground/90 leading-relaxed line-clamp-3">
            {sanitized}
            {m.excerpt && isExcerptTruncated(m.excerpt) && m.sourceUrl ? (
              <>
                {" "}
                <a
                  href={m.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline underline-offset-2"
                >
                  Read full →
                </a>
              </>
            ) : null}
          </p>
        );
      })()}
      {m.topics && m.topics.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {m.topics.map((t: string) => (
            <span
              key={t}
              className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-[2px] px-1.5 py-0.5 bg-background/60"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {m.sourceUrl ? (
        <a
          href={m.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline underline-offset-2"
        >
          Open on {m.source.toLowerCase()} →
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewSourceLogo — inline SVG brand marks for the reputation channels
// the platform tracks. Mirrors the icons in
// components/portal/reputation/source-logo.tsx but kept server-safe
// (no "use client") so the report can server-render without hydration.
// ---------------------------------------------------------------------------
function ReviewSourceLogo({ source }: { source: string }) {
  const key = source.toLowerCase();
  const sz = 14;
  if (key.includes("google"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  if (key.includes("reddit"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#FF4500" aria-hidden="true">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z" />
      </svg>
    );
  if (key.includes("yelp"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#AF0606" aria-hidden="true">
        <path d="M20.16 12.594l-4.995-1.433a1.085 1.085 0 0 0-1.318 1.548l2.247 4.692a1.088 1.088 0 0 0 1.48.428 6.967 6.967 0 0 0 2.883-4.154 1.087 1.087 0 0 0-.297-1.081zm-1.93 5.99l-3.98-3.121a1.086 1.086 0 0 0-1.748.753l-.328 5.16a1.08 1.08 0 0 0 .735 1.084c1.547.548 3.222.547 4.77-.002a1.083 1.083 0 0 0 .551-1.59zm-6.865-5.39a1.091 1.091 0 0 0-1.085-.785L4.58 12.12a1.08 1.08 0 0 0-.814.615 1.06 1.06 0 0 0-.049.865c.548 1.544 1.53 2.896 2.85 3.911a1.083 1.083 0 0 0 1.585-.32l3.222-4.029c.291-.364.365-.859.191-1.293zm2.14-2.51l-1.03-10.24a1.085 1.085 0 0 0-1.2-.984 6.967 6.967 0 0 0-4.766 2.626 1.085 1.085 0 0 0 .095 1.415l5.75 6.91c.4.477 1.1.58 1.632.247.452-.286.684-.836.516-1.361z" />
      </svg>
    );
  if (key.includes("facebook"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  if (key.includes("instagram"))
    return (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="#E4405F" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  // Fallback — a small globe glyph in muted blue so generic "WEB"
  // sources still pick up a visual indicator instead of empty space.
  return (
    <svg
      width={sz}
      height={sz}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0f62fe"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
