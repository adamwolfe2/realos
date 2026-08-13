import * as React from "react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import type { AeoReceipt } from "@/lib/signals/compute";

// ---------------------------------------------------------------------------
// AeoReceiptsBlock — "What AI actually said about you." (2026-08-14)
//
// Verbatim receipts: per engine, the exact prompt we asked and a capped
// excerpt of what it answered, with the brand and named competitors
// highlighted inline. Knowatoa pattern — a report that quotes the engine
// verbatim is trusted; a report that summarizes it is doubted.
//
// Renders only when findings.aeoReceipts exists (additive field) —
// legacy audits render nothing, byte-identical to before.
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

export function AeoReceiptsBlock({
  receipts,
  brandName,
  competitors,
  previewOnly = false,
}: {
  receipts: AeoReceipt[];
  brandName: string;
  competitors: string[];
  /** Locked reports (2026-08-14, slice 12): show ONE verbatim receipt as
   *  the tease and count the rest — the full feed unlocks with the email
   *  gate. Gate mechanics themselves are untouched. */
  previewOnly?: boolean;
}) {
  if (receipts.length === 0) return null;

  const visible = previewOnly ? receipts.slice(0, 1) : receipts;
  const hiddenCount = receipts.length - visible.length;

  // Group by engine, preserving the persisted engine order.
  const byEngine = new Map<AeoReceipt["engine"], AeoReceipt[]>();
  for (const r of visible) {
    const list = byEngine.get(r.engine) ?? [];
    list.push(r);
    byEngine.set(r.engine, list);
  }
  const engines = Array.from(byEngine.entries());

  return (
    <section className="mt-8" aria-label="Verbatim AI answers">
      <p
        className="text-[10px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "#2563EB" }}
      >
        The receipts
      </p>
      <h3
        className="mt-1.5 text-lg sm:text-xl font-semibold tracking-tight"
        style={{ color: "#1E2A3A" }}
      >
        What AI actually said, word for word
      </h3>
      <p className="mt-1 text-[12.5px] max-w-2xl" style={{ color: "#6B7280" }}>
        The exact prompt we asked each engine, and the answer it gave.
        Nothing paraphrased.
      </p>

      <style>{`
        .rcpt-det > summary { list-style: none; cursor: pointer; }
        .rcpt-det > summary::-webkit-details-marker { display: none; }
        .rcpt-chev { transition: transform .3s cubic-bezier(.2,.8,.2,1); }
        .rcpt-det[open] .rcpt-chev { transform: rotate(180deg); }
        @media (prefers-reduced-motion: reduce) { .rcpt-chev { transition: none; } }
      `}</style>

      <div className="mt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
        {engines.map(([engine, rows], idx) => (
          <details
            key={engine}
            className="rcpt-det"
            open={idx === 0}
            style={{ borderBottom: "1px solid #E5E7EB" }}
          >
            <summary className="flex items-center justify-between gap-3 py-3.5">
              <span className="flex items-center gap-2.5 min-w-0">
                <EngineMark engine={engine} size={20} />
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: "#1E2A3A" }}
                >
                  {ENGINE_LABELS[engine]}
                </span>
              </span>
              <svg
                className="rcpt-chev shrink-0"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6B7280"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="pb-4 space-y-4">
              {rows.map((r) => (
                <div key={`${r.engine}-${r.kind}`}>
                  <p
                    className="text-[10px] font-mono uppercase tracking-[0.14em]"
                    style={{ color: "#6B7280" }}
                  >
                    {KIND_LABEL[r.kind]}
                  </p>
                  <p
                    className="mt-1 text-[13px] italic"
                    style={{ color: "#1E2A3A" }}
                  >
                    &ldquo;{r.prompt}&rdquo;
                  </p>
                  <div
                    className="mt-2 text-[13.5px] leading-relaxed"
                    style={{
                      color: "#374151",
                      backgroundColor: "#FBFBFD",
                      border: "1px solid #E5E7EB",
                      borderLeft: "3px solid #0f62fe",
                      borderRadius: 2,
                      padding: "12px 14px",
                    }}
                  >
                    {highlightNames(r.excerpt, brandName, competitors)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "#525252" }}>
          <a
            href="#full-report"
            className="underline underline-offset-2"
            style={{ color: "#0f62fe", fontWeight: 500 }}
          >
            {hiddenCount} more verbatim engine answer
            {hiddenCount === 1 ? "" : "s"}
          </a>{" "}
          — including what each engine says when renters don&apos;t know
          your name — unlock with the full report below.
        </p>
      ) : null}
    </section>
  );
}
