import * as React from "react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { TabGroup, type Tab } from "@/components/audit/tab-group";
import { Panel, StatusChip, T } from "@/components/audit/section";
import type { AeoReceipt } from "@/lib/signals/compute";

// ---------------------------------------------------------------------------
// AeoReceiptsBlock — "What AI actually said about you."
//
// Verbatim receipts: per engine, the exact prompt we asked and the answer
// it gave, with the brand and named competitors highlighted inline.
// Knowatoa pattern — a report that quotes the engine verbatim is trusted;
// a report that summarizes it is doubted.
//
// 2026-08-19: promoted out of the nested <details> accordion into engine
// tabs. Every engine is visible at once in the tab strip and its answers
// read in full in the panel — no clipping, no scrolling past three
// engines to reach the fourth.
//
// Renders only when findings.aeoReceipts exists (additive field) —
// legacy audits render nothing.
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<AeoReceipt["engine"], string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function EngineMark({
  engine,
  size = 20,
}: {
  engine: AeoReceipt["engine"];
  size?: number;
}) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={size} />;
    case "PERPLEXITY":
      return <PerplexityMark size={size} />;
    case "CLAUDE":
      return <ClaudeMark size={size} />;
    case "GEMINI":
      return <GeminiMark size={size} />;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap brand-name matches in the highlight marker and competitor names
 *  in bold. Longest names first so "Telegraph Commons Berkeley" wins
 *  over "Telegraph Commons" when both are present. */
export function highlightNames(
  text: string,
  brandName: string,
  competitors: string[],
): React.ReactNode {
  const brands = brandName.trim() ? [brandName.trim()] : [];
  const comps = competitors.map((c) => c.trim()).filter((c) => c.length > 1);
  const all = [...brands, ...comps].sort((a, b) => b.length - a.length);
  if (all.length === 0) return text;
  const brandSet = new Set(brands.map((b) => b.toLowerCase()));
  const re = new RegExp(`(${all.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    if (brandSet.has(part.toLowerCase())) {
      return (
        <span key={i} className="px-0.5" style={{ backgroundColor: "#d0e2ff", fontWeight: 600 }}>
          {part}
        </span>
      );
    }
    return (
      <strong key={i} style={{ fontWeight: 600 }}>
        {part}
      </strong>
    );
  });
}

const KIND_LABEL: Record<AeoReceipt["kind"], string> = {
  discovery: "Renter didn't know your name",
  branded: "Asked about you directly",
};

const KIND_CHIP: Record<AeoReceipt["kind"], string> = {
  discovery: "Unprompted",
  branded: "Asked directly",
};

export function AeoReceiptsBlock({
  receipts,
  brandName,
  competitors,
  previewOnly = false,
}: {
  receipts: AeoReceipt[];
  brandName: string;
  competitors: string[];
  /** Locked reports (slice 12): show ONE verbatim receipt as the tease
   *  and count the rest — the full feed unlocks with the email gate.
   *  Gate mechanics themselves are untouched. */
  previewOnly?: boolean;
}) {
  if (receipts.length === 0) return null;

  const visible = previewOnly ? receipts.slice(0, 1) : receipts;
  const hiddenCount = receipts.length - visible.length;

  // One tab per engine, each panel holding that engine's answers in full.
  const byEngine = new Map<AeoReceipt["engine"], AeoReceipt[]>();
  for (const r of visible) {
    byEngine.set(r.engine, [...(byEngine.get(r.engine) ?? []), r]);
  }

  const tabs: Tab[] = Array.from(byEngine.entries()).map(([engine, rows]) => ({
    id: engine,
    label: ENGINE_LABELS[engine],
    icon: <EngineMark engine={engine} size={15} />,
    badge: rows.length > 1 ? rows.length : undefined,
    panel: (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((r) => (
          <Panel key={`${r.engine}-${r.kind}`} className="flex flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-[10.5px] font-mono uppercase tracking-[0.16em]"
                style={{ color: T.muted, fontFamily: "var(--font-mono)" }}
              >
                {KIND_LABEL[r.kind]}
              </p>
              <StatusChip
                label={KIND_CHIP[r.kind]}
                tone={r.kind === "discovery" ? "warn" : "neutral"}
              />
            </div>
            <p className="mt-2 text-[13.5px] italic" style={{ color: T.ink }}>
              &ldquo;{r.prompt}&rdquo;
            </p>
            <div
              className="mt-3 text-[13.5px] leading-relaxed"
              style={{
                color: "#3d3d3d",
                borderLeft: `3px solid ${T.accent}`,
                paddingLeft: 14,
              }}
            >
              {highlightNames(r.excerpt, brandName, competitors)}
            </div>
          </Panel>
        ))}
      </div>
    ),
  }));

  return (
    <div aria-label="Verbatim AI answers">
      <TabGroup tabs={tabs} ariaLabel="AI engine answers" />

      {hiddenCount > 0 ? (
        <p className="mt-4 text-[12.5px]" style={{ color: T.body }}>
          <a
            href="#full-report"
            className="underline underline-offset-2"
            style={{ color: T.accent, fontWeight: 500 }}
          >
            {hiddenCount} more verbatim engine answer
            {hiddenCount === 1 ? "" : "s"}
          </a>{" "}
          — including what each engine says when renters don&apos;t know
          your name — unlock with the full report below.
        </p>
      ) : null}
    </div>
  );
}
