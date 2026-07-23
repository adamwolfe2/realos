import React from "react";

// ---------------------------------------------------------------------------
// SectionShell — the ruled page frame (juicebox layer J1). Frames every major
// section like a spec sheet with a solid top hairline closing the band.
// (Landing v3 item 4: the numbered index eyebrows + node rings are removed;
// the top hairline stays, nothing replaces the labels.)
// ---------------------------------------------------------------------------

export function SectionShell({
  id,
  bg = "#FFFFFF",
  className,
  contentClassName,
  children,
}: {
  id?: string;
  bg?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative ${className ?? ""}`}
      style={{
        backgroundColor: bg,
        borderTop: "1px solid #e0e0e0",
        // Clear the sticky nav (~68-80px) on hash-anchor jumps.
        scrollMarginTop: 96,
      }}
    >
      <div className="relative max-w-[1240px] mx-auto px-4 md:px-8">
        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}

// Filled label chip above an H2 (juicebox ban amendment). Replaces bare
// eyebrows where a section wants a label.
export function LabelChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        backgroundColor: "#e8efff",
        color: "#0f43b8",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 500,
        padding: "4px 8px",
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}
