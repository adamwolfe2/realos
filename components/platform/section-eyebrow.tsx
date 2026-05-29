import React from "react";

// ---------------------------------------------------------------------------
// SectionEyebrow — the canonical "tiny blue line + uppercase mono label"
// eyebrow used on every section header across the site.
//
// Pattern locked in by /audit and the homepage hero: 28px blue line,
// 11px mono, uppercase, 0.18em tracking, brand blue. One component so
// every page reaches for the same token instead of reinventing the
// pill / chip / eyebrow on each surface (the inconsistency the CEO
// flagged on the pricing page).
//
// `align="center"` flanks the label with a line on each side (audit /
// pricing-cta pattern). `align="left"` puts a single line to the left
// of the label (homepage section header pattern).
// ---------------------------------------------------------------------------

export function SectionEyebrow({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const line = (
    <span
      aria-hidden
      className="hidden sm:inline-block"
      style={{ width: 28, height: 1, backgroundColor: "#2563EB" }}
    />
  );
  return (
    <div
      className={`flex items-center gap-3 ${align === "center" ? "justify-center" : "justify-start"} ${className ?? ""}`}
    >
      {line}
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{
          color: "#2563EB",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
        }}
      >
        {children}
      </p>
      {align === "center" ? line : null}
    </div>
  );
}
