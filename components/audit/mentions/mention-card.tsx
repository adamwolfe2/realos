"use client";

// MentionCard — one row in the reputation feed. Renders source badge,
// sentiment dot, title (line-clamp-2), snippet (line-clamp-3), and a
// "View source" link that opens the upstream URL in a new tab.
//
// Three small sub-components (SourceBadge, SentimentDot) live alongside
// because they are only meaningful inside a mention card.

import { ExternalLink } from "lucide-react";
import type { AuditMention, AuditMentionSource } from "./types";
import {
  relativeTime,
  sentimentMeta,
  sourceColor,
  sourceInitial,
  sourceLabel,
} from "./source-utils";

export function MentionCard({ m }: { m: AuditMention }) {
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
