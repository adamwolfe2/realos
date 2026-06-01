import Link from "next/link";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { ActionItem } from "@/lib/audit/recommendations";
import { getFeature, getFeatureCta } from "@/lib/audit/feature-catalog";

// RecommendationsSection — the sales-tool layer of the audit result.
//
// Renders the personalized action-item cards produced by
// `lib/audit/recommendations.ts`. Cards are grouped by severity and
// each carries a "See it live" or "Talk to us about this" CTA wired
// to the feature catalog. Adam 2026-06-01: every recommendation is, by
// design, a LeaseStack upsell — the goal is to make the gap obvious and
// the fix tangible.

type Severity = ActionItem["severity"];

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Fix this first",
  medium: "Worth tightening",
  low: "Nice to have",
};

const SEVERITY_TONE: Record<Severity, { tag: string; bar: string; bg: string }> = {
  high: { tag: "#B91C1C", bar: "#B91C1C", bg: "rgba(185,28,28,0.08)" },
  medium: { tag: "#B45309", bar: "#B45309", bg: "rgba(180,83,9,0.08)" },
  low: { tag: "#2563EB", bar: "#2563EB", bg: "rgba(37,99,235,0.08)" },
};

export function RecommendationsSection({
  recommendations,
}: {
  recommendations: ActionItem[];
}) {
  if (recommendations.length === 0) return null;
  const groups: Record<Severity, ActionItem[]> = {
    high: recommendations.filter((r) => r.severity === "high"),
    medium: recommendations.filter((r) => r.severity === "medium"),
    low: recommendations.filter((r) => r.severity === "low"),
  };

  return (
    <section className="mt-14">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Personalized action plan
      </p>
      <h2
        className="text-2xl sm:text-3xl font-semibold mt-2"
        style={{ color: "#1E2A3A" }}
      >
        {recommendations.length} thing
        {recommendations.length === 1 ? "" : "s"} we'd fix, in priority order
      </h2>
      <p className="text-sm mt-2 max-w-2xl" style={{ color: "#6B7280" }}>
        Built from your quiz answers + our live scan. Each item links to
        a working example — see exactly what the fix looks like, or get on
        a call and we'll handle the build.
      </p>

      <div className="mt-8 flex flex-col gap-10">
        {(["high", "medium", "low"] as Severity[]).map((sev) => {
          const items = groups[sev];
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              <SeverityHeader severity={sev} count={items.length} />
              <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <RecommendationCard key={item.id} item={item} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SeverityHeader({
  severity,
  count,
}: {
  severity: Severity;
  count: number;
}) {
  const tone = SEVERITY_TONE[severity];
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: tone.tag }}
        aria-hidden
      />
      <h3 className="text-sm font-semibold" style={{ color: "#1E2A3A" }}>
        {SEVERITY_LABEL[severity]}
      </h3>
      <span
        className="text-[11px] font-mono uppercase tracking-[0.14em]"
        style={{
          color: tone.tag,
          backgroundColor: tone.bg,
          padding: "2px 8px",
          borderRadius: 999,
          fontFamily: "var(--font-mono)",
        }}
      >
        {count} item{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function RecommendationCard({ item }: { item: ActionItem }) {
  const tone = SEVERITY_TONE[item.severity];
  const feature = getFeature(item.featureSlug);
  const cta = getFeatureCta(item.featureSlug);
  const pillarLabel = PILLAR_LABELS[item.pillar as Pillar];

  return (
    <li
      className="rounded-xl border bg-white flex flex-col"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div
        className="h-1 w-full rounded-t-xl"
        style={{ backgroundColor: tone.bar }}
        aria-hidden
      />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            {pillarLabel}
          </span>
          {feature ? (
            <span
              className="text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded"
              style={{
                color: "#2563EB",
                backgroundColor: "rgba(37,99,235,0.08)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {feature.title}
            </span>
          ) : null}
        </div>
        <p
          className="text-base font-semibold leading-snug"
          style={{ color: "#1E2A3A" }}
        >
          {item.title}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
          {item.why}
        </p>
        {feature ? (
          <p className="text-xs italic" style={{ color: "#6B7280" }}>
            {feature.blurb}
          </p>
        ) : null}
        {cta ? (
          <div className="mt-auto pt-3">
            <Link
              href={cta.href}
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: "#2563EB" }}
            >
              {cta.label}
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}
