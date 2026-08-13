import Link from "next/link";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { ActionItem } from "@/lib/audit/recommendations";
import { getFeature, getFeatureCta } from "@/lib/audit/feature-catalog";
import { CopyHandoffButton } from "@/components/audit/copy-handoff-button";

// RecommendationsSection. The sales-tool layer of the audit result.
//
// Renders the personalized action-item cards produced by
// `lib/audit/recommendations.ts`. Cards are grouped by severity and
// each carries a "See it live" or "Talk to us about this" CTA wired
// to the feature catalog. Adam 2026-06-01: every recommendation is, by
// design, a LeaseStack upsell. The goal is to make the gap obvious and
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
  spineIds = [],
}: {
  recommendations: ActionItem[];
  /** Ids already presented as the top-3 "short version" above. Those
   *  render as one-line back-references here instead of repeating the
   *  full card copy verbatim (2026-08-14 feedback: the dupe reads as
   *  padding). */
  spineIds?: string[];
}) {
  if (recommendations.length === 0) return null;
  const spineSet = new Set(spineIds);
  const covered = recommendations.filter((r) => spineSet.has(r.id));
  const remaining = recommendations.filter((r) => !spineSet.has(r.id));
  const groups: Record<Severity, ActionItem[]> = {
    high: remaining.filter((r) => r.severity === "high"),
    medium: remaining.filter((r) => r.severity === "medium"),
    low: remaining.filter((r) => r.severity === "low"),
  };

  return (
    <section className="mt-10">
      <p
        className="text-[10px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Personalized action plan
      </p>
      <h2
        className="text-lg sm:text-xl font-semibold mt-1"
        style={{ color: "#1E2A3A" }}
      >
        {recommendations.length} thing
        {recommendations.length === 1 ? "" : "s"} we'd fix, in priority order
      </h2>

      {covered.length > 0 ? (
        <div
          className="mt-3 px-3.5 py-2.5"
          style={{
            backgroundColor: "#FBFBFD",
            border: "1px solid #E5E7EB",
            borderRadius: 2,
          }}
        >
          <p className="text-[12.5px]" style={{ color: "#525252" }}>
            {covered.length === 1 ? "The top item is" : `The top ${covered.length} are`}{" "}
            covered in detail above:{" "}
            {covered.map((item, i) => (
              <span key={item.id}>
                <a
                  href="#three-things"
                  className="underline underline-offset-2"
                  style={{ color: "#1E2A3A", fontWeight: 500 }}
                >
                  {item.title}
                </a>
                {i < covered.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-5">
        {(["high", "medium", "low"] as Severity[]).map((sev) => {
          const items = groups[sev];
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              <SeverityHeader severity={sev} count={items.length} />
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: tone.tag }}
        aria-hidden
      />
      <h3
        className="text-[13px] font-semibold"
        style={{ color: "#1E2A3A" }}
      >
        {SEVERITY_LABEL[severity]}
      </h3>
      <span
        className="text-[10px] font-mono uppercase tracking-[0.12em]"
        style={{
          color: tone.tag,
          backgroundColor: tone.bg,
          padding: "1px 7px",
          borderRadius: 999,
          fontFamily: "var(--font-mono)",
        }}
      >
        {count}
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
      className="rounded-lg border bg-white flex flex-col"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div
        className="h-[3px] w-full rounded-t-lg"
        style={{ backgroundColor: tone.bar }}
        aria-hidden
      />
      <div className="p-3.5 sm:p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[9px] font-mono uppercase tracking-[0.12em]"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            {pillarLabel}
          </span>
          {feature ? (
            <span
              className="text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
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
          className="text-[14px] font-semibold leading-snug"
          style={{ color: "#1E2A3A" }}
        >
          {item.title}
        </p>
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: "#4B5563" }}
        >
          {item.why}
        </p>
        {item.handoff ? (
          <details className="mt-1">
            <summary
              className="cursor-pointer list-none text-[12px] font-medium"
              style={{ color: "#2563EB" }}
            >
              What to tell your web person
            </summary>
            <p
              className="mt-1.5 text-[12px] leading-relaxed"
              style={{ color: "#4B5563" }}
            >
              {item.handoff.instructions}
            </p>
            {item.handoff.snippet ? (
              <pre
                className="mt-2 overflow-x-auto p-2.5 text-[11px] leading-snug"
                style={{
                  backgroundColor: "#161616",
                  color: "#f4f4f4",
                  borderRadius: 2,
                }}
              >
                <code>{item.handoff.snippet}</code>
              </pre>
            ) : null}
            <div className="mt-2">
              <CopyHandoffButton
                instructions={item.handoff.instructions}
                snippet={item.handoff.snippet}
              />
            </div>
          </details>
        ) : null}
        {cta ? (
          <div className="mt-auto pt-1">
            <Link
              href={cta.href}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium"
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
