import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Shared chrome for the /audit/[token] report (2026-08-19).
//
// The report had two competing visual systems: the newer fold/spine
// (Carbon ink #161616, accent #0f62fe, hairline #e0e0e0, radius 2,
// display type) and the older premium cards (#1E2A3A / #2563EB /
// rounded-xl). Two systems on one page reads as two products. These
// primitives are the single system; every AEO surface uses them.
// ---------------------------------------------------------------------------

export const T = {
  ink: "#161616",
  body: "#525252",
  muted: "#6f6f6f",
  accent: "#0f62fe",
  accentDeep: "#0043ce",
  rule: "#e0e0e0",
  ruleFaint: "#f4f4f4",
  surface: "#FFFFFF",
  wash: "#FBFBFD",
  ok: "#24a148",
  warn: "#b45309",
  bad: "#da1e28",
  radius: 2,
} as const;

/** Mono uppercase kicker. The report's one label voice. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[10.5px] font-mono uppercase tracking-[0.18em]"
      style={{ color: T.accent, fontFamily: "var(--font-mono)" }}
    >
      {children}
    </p>
  );
}

/**
 * A first-class report section: rule, eyebrow, display heading, optional
 * lede and right-aligned metric. Sections are top-level page furniture —
 * anything worth a heading is worth being visible without a click.
 */
export function ReportSection({
  id,
  eyebrow,
  title,
  lede,
  metric,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Optional mono stat pinned opposite the heading. */
  metric?: { value: ReactNode; label: string };
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 pt-12 md:pt-16"
      style={{ borderTop: `1px solid ${T.rule}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-[62ch]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2
            className="mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3.2vw, 36px)",
              fontWeight: 550,
              letterSpacing: "-0.028em",
              lineHeight: 1.1,
              color: T.ink,
            }}
          >
            {title}
          </h2>
          {lede ? (
            <p
              className="mt-3 text-[14.5px] leading-relaxed"
              style={{ color: T.body }}
            >
              {lede}
            </p>
          ) : null}
        </div>
        {metric ? (
          <div className="shrink-0 text-left sm:text-right">
            <div
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 34,
                fontWeight: 500,
                letterSpacing: "-0.03em",
                color: T.ink,
                lineHeight: 1,
              }}
            >
              {metric.value}
            </div>
            <div
              className="mt-1.5 text-[10.5px] font-mono uppercase tracking-[0.14em]"
              style={{ color: T.muted, fontFamily: "var(--font-mono)" }}
            >
              {metric.label}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/** Hairline card. Flat, square, no shadow — the report's only container. */
export function Panel({
  children,
  className = "",
  tone = "surface",
  style,
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "wash";
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: tone === "wash" ? T.wash : T.surface,
        border: `1px solid ${T.rule}`,
        borderRadius: T.radius,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Status pill. One shape for every verdict in the report. */
export function StatusChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "ok" | "warn" | "bad" | "neutral";
  icon?: ReactNode;
}) {
  const palette = {
    // Foregrounds are the darkened variants that hold AA at 11px on
    // their own wash — the mid-tone brand hues land ~4.4 and fail axe.
    ok: { bg: "rgba(36,161,72,0.10)", fg: "#0e6027", border: "rgba(36,161,72,0.28)" },
    warn: { bg: "rgba(180,83,9,0.10)", fg: "#8a3800", border: "rgba(180,83,9,0.26)" },
    bad: { bg: "rgba(218,30,40,0.09)", fg: "#a2191f", border: "rgba(218,30,40,0.24)" },
    neutral: { bg: "#f4f4f4", fg: "#525252", border: T.rule },
  }[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
      style={{
        padding: "3px 9px",
        fontSize: 10.5,
        fontWeight: 600,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {icon}
      {label}
    </span>
  );
}
