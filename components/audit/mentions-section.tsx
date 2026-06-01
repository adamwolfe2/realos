"use client";

import { useMemo, useState } from "react";

// Reputation centerpiece. Orchestrates the chip row + mention card list.
// 2026-05-29: split into `./mentions/*` to keep this file under 200 lines.
// The chip layout, card markup, source formatters, and empty state each
// live in dedicated files. This wrapper owns only the selection state +
// header/footer chrome.

import { FilterChip } from "./mentions/filter-chip";
import { MentionCard } from "./mentions/mention-card";
import { EmptyState } from "./mentions/empty-state";
import { sourceColor, sourceLabel } from "./mentions/source-utils";
import { SourceGlyph } from "./mentions/source-glyphs";
import {
  ALL_SOURCES,
  INITIAL_MENTION_LIMIT,
  type AuditMention,
  type AuditMentionSource,
} from "./mentions/types";

// Re-exports preserve the previous public surface. `app/(platform)/audit/
// [token]/page.tsx` imports both MentionsSection and the AuditMention type
// from this module.
export type { AuditMention, AuditMentionSource } from "./mentions/types";

interface MentionsSectionProps {
  mentions: AuditMention[];
  brandName: string;
  shareToken: string;
  auditCreatedAtIso: string;
}

export function MentionsSection({
  mentions,
  brandName,
  shareToken,
  auditCreatedAtIso,
}: MentionsSectionProps) {
  const [activeSource, setActiveSource] =
    useState<AuditMentionSource | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () =>
      [...mentions]
        .filter((m) => m && m.url)
        .sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return tb - ta;
        }),
    [mentions],
  );

  // Per-source counts power the filter chips. Order: ALL_SOURCES so the
  // pill row is stable across reports.
  const counts = useMemo(() => {
    const map = new Map<AuditMentionSource, number>();
    for (const s of ALL_SOURCES) map.set(s, 0);
    for (const m of sorted) {
      map.set(m.source, (map.get(m.source) ?? 0) + 1);
    }
    return map;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        brandName={brandName}
        shareToken={shareToken}
        auditCreatedAtIso={auditCreatedAtIso}
      />
    );
  }

  const filtered = activeSource
    ? sorted.filter((m) => m.source === activeSource)
    : sorted;
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_MENTION_LIMIT);
  const hiddenCount = filtered.length - visible.length;

  return (
    <section className="mt-12">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Reputation. Past 90 days
      </p>
      <h2
        className="text-3xl sm:text-4xl font-semibold mt-2 tracking-tight"
        style={{ color: "#1E2A3A" }}
      >
        {sorted.length} public mention{sorted.length === 1 ? "" : "s"} about{" "}
        {brandName}
      </h2>
      <p
        className="text-base mt-3 max-w-2xl leading-relaxed"
        style={{ color: "#4B5563" }}
      >
        Real posts from the past 90 days. Across Reddit, Yelp, Google, BBB,
        ApartmentRatings, Facebook, and the open web. The reputation score
        above is calculated directly from these.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip
          label="All"
          count={sorted.length}
          color="#1E2A3A"
          active={activeSource === null}
          onClick={() => {
            setActiveSource(null);
            setShowAll(false);
          }}
        />
        {ALL_SOURCES.map((s) => {
          const c = counts.get(s) ?? 0;
          if (c === 0) return null;
          return (
            <FilterChip
              key={s}
              label={sourceLabel(s)}
              count={c}
              color={sourceColor(s)}
              active={activeSource === s}
              glyph={<SourceGlyph source={s} className="h-3.5 w-3.5" />}
              onClick={() => {
                setActiveSource(activeSource === s ? null : s);
                setShowAll(false);
              }}
            />
          );
        })}
      </div>

      <ul className="mt-6 space-y-3">
        {visible.map((m) => (
          <MentionCard key={m.url} m={m} />
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex items-center justify-center h-10 px-5 rounded-md text-sm font-medium border"
            style={{ borderColor: "#E5E7EB", color: "#1E2A3A" }}
          >
            Show {hiddenCount} more mention{hiddenCount === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
