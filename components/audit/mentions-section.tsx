"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

// Reputation centerpiece — renders the real Reddit / Yelp / Google / BBB /
// ApartmentRatings / Facebook / open-web mentions that back the report's
// reputation score. Client component because the source filter chips need
// local state and the "Re-run scan" button POSTs from the empty state.

export type AuditMentionSource =
  | "REDDIT"
  | "YELP"
  | "BBB"
  | "APARTMENT_RATINGS"
  | "FACEBOOK"
  | "GOOGLE_REVIEW"
  | "TAVILY_WEB";

export interface AuditMention {
  source: AuditMentionSource;
  title: string | null;
  snippet: string;
  url: string;
  publishedAt: string | null;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | null;
  themes?: string[];
}

interface MentionsSectionProps {
  mentions: AuditMention[];
  brandName: string;
  shareToken: string;
  auditCreatedAtIso: string;
}

const ALL_SOURCES: AuditMentionSource[] = [
  "REDDIT",
  "YELP",
  "FACEBOOK",
  "BBB",
  "GOOGLE_REVIEW",
  "APARTMENT_RATINGS",
  "TAVILY_WEB",
];

const INITIAL_LIMIT = 25;
const RERUN_GRACE_MS = 60_000;

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
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT);
  const hiddenCount = filtered.length - visible.length;

  return (
    <section className="mt-12">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Reputation — past 90 days
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
        Real posts from the past 90 days — across Reddit, Yelp, Google, BBB,
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

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? color : "#FFFFFF",
        color: active ? "#FFFFFF" : "#1E2A3A",
        border: `1px solid ${active ? color : "#E5E7EB"}`,
      }}
      aria-pressed={active}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? "#FFFFFF" : color }}
        aria-hidden
      />
      <span>{label}</span>
      <span
        className="tabular-nums"
        style={{ color: active ? "#FFFFFF" : "#6B7280" }}
      >
        {count}
      </span>
    </button>
  );
}

function MentionCard({ m }: { m: AuditMention }) {
  return (
    <li
      className="rounded-xl border bg-white p-5 sm:p-6 flex items-start gap-4 relative"
      style={{ borderColor: "#E5E7EB" }}
    >
      <SourceBadge source={m.source} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-16">
          <p className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
            {sourceLabel(m.source)}
          </p>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            {relativeTime(m.publishedAt)}
          </p>
        </div>
        {m.title ? (
          <p
            className="text-sm mt-1 line-clamp-2 font-medium"
            style={{ color: "#1E2A3A" }}
          >
            {m.title}
          </p>
        ) : null}
        {m.snippet ? (
          <p
            className="text-sm mt-1 line-clamp-3 leading-relaxed"
            style={{ color: "#4B5563" }}
          >
            {m.snippet}
          </p>
        ) : null}
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-xs font-medium mt-3 inline-flex items-center gap-1.5"
          style={{ color: "#2563EB" }}
        >
          View source
          <ExternalLink size={14} aria-hidden />
        </a>
      </div>
      <SentimentDot sentiment={m.sentiment ?? null} />
    </li>
  );
}

function SentimentDot({
  sentiment,
}: {
  sentiment: AuditMention["sentiment"] | null;
}) {
  if (!sentiment) return null;
  const { color, label } = sentimentMeta(sentiment);
  if (!label) return null;
  return (
    <div
      className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{
        backgroundColor: "#F9FAFB",
        border: "1px solid #E5E7EB",
        color: "#4B5563",
        fontFamily: "var(--font-mono)",
      }}
      title={`Sentiment: ${label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

function sentimentMeta(s: NonNullable<AuditMention["sentiment"]>): {
  color: string;
  label: string;
} {
  switch (s) {
    case "POSITIVE":
      return { color: "#0E9F6E", label: "Positive" };
    case "NEGATIVE":
      return { color: "#B91C1C", label: "Negative" };
    case "MIXED":
      return { color: "#B45309", label: "Mixed" };
    case "NEUTRAL":
    default:
      return { color: "#9CA3AF", label: "" };
  }
}

function EmptyState({
  brandName,
  shareToken,
  auditCreatedAtIso,
}: {
  brandName: string;
  shareToken: string;
  auditCreatedAtIso: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  // The original scan may still be cooling down. Surfacing a "Re-run" button
  // during that grace window risks double-billing the providers for a job
  // that's about to land anyway.
  const createdMs = new Date(auditCreatedAtIso).getTime();
  const canRerun =
    Number.isFinite(createdMs) && Date.now() - createdMs > RERUN_GRACE_MS;

  async function handleRerun() {
    setError(null);
    setRerunning(true);
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(shareToken)}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? `Re-run failed (${res.status})`);
      }
      // Give the run trigger a beat to flip the row to RUNNING before we
      // refresh — otherwise we'd just see the same READY-empty payload.
      setTimeout(() => {
        startTransition(() => router.refresh());
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
      setRerunning(false);
    }
  }

  return (
    <section className="mt-12">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Reputation — past 90 days
      </p>
      <h2
        className="text-3xl sm:text-4xl font-semibold mt-2 tracking-tight"
        style={{ color: "#1E2A3A" }}
      >
        No public mentions surfaced
      </h2>
      <div
        className="mt-6 rounded-2xl border p-6 sm:p-8 max-w-3xl"
        style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
      >
        <p
          className="text-base leading-relaxed"
          style={{ color: "#1E2A3A" }}
        >
          We searched 6 sources (Reddit, Yelp, Google, BBB, ApartmentRatings,
          Facebook) for posts about{" "}
          <span className="font-semibold">{brandName}</span> in the last 90
          days and didn&apos;t find anything.
        </p>
        <p className="text-sm mt-4" style={{ color: "#4B5563" }}>
          That can mean three things:
        </p>
        <ol
          className="mt-3 space-y-2 text-sm list-decimal pl-5"
          style={{ color: "#4B5563" }}
        >
          <li>
            Your property genuinely has no recent online mentions (rare for an
            established multifamily property).
          </li>
          <li>
            Your brand name is too generic to dedupe from unrelated content.
          </li>
          <li>
            The audit ran while a source was rate-limited — re-run to retry.
          </li>
        </ol>
        {canRerun ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleRerun}
              disabled={rerunning || isPending}
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#2563EB" }}
            >
              {rerunning || isPending ? "Re-running…" : "Re-run scan"}
            </button>
            {error ? (
              <p className="mt-3 text-sm" style={{ color: "#B91C1C" }}>
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SourceBadge({ source }: { source: AuditMentionSource }) {
  const bg = sourceColor(source);
  return (
    <div
      className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold"
      style={{ backgroundColor: bg, color: "#FFFFFF" }}
      aria-hidden
    >
      {sourceInitial(source)}
    </div>
  );
}

function sourceInitial(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "R";
    case "YELP":
      return "Y";
    case "BBB":
      return "B";
    case "APARTMENT_RATINGS":
      return "AR";
    case "FACEBOOK":
      return "F";
    case "GOOGLE_REVIEW":
      return "G";
    case "TAVILY_WEB":
    default:
      return "W";
  }
}

function sourceColor(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "#FF4500";
    case "YELP":
      return "#D32323";
    case "BBB":
      return "#0F4C81";
    case "APARTMENT_RATINGS":
      return "#0E9F6E";
    case "FACEBOOK":
      return "#1877F2";
    case "GOOGLE_REVIEW":
      return "#4285F4";
    case "TAVILY_WEB":
    default:
      return "#6B7280";
  }
}

function sourceLabel(s: AuditMentionSource): string {
  switch (s) {
    case "REDDIT":
      return "Reddit";
    case "YELP":
      return "Yelp";
    case "BBB":
      return "BBB";
    case "APARTMENT_RATINGS":
      return "ApartmentRatings";
    case "FACEBOOK":
      return "Facebook";
    case "GOOGLE_REVIEW":
      return "Google";
    case "TAVILY_WEB":
    default:
      return "Web";
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "recently";
  const deltaMs = Date.now() - t;
  const days = Math.floor(deltaMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
