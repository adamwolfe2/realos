import React from "react";

// ---------------------------------------------------------------------------
// SectionShell — the ruled page frame (juicebox layer J1). Frames every major
// section like a spec sheet: a solid top hairline closing the band, dashed
// vertical hairlines down both content-column edges (hidden on mobile), and a
// systematic mono index label ("[01] Capture") sitting ON the top rule with a
// bg cut-out interrupting the line.
//
// The mono-caps index voice is a DELIBERATE system per the juicebox ban
// amendment: used consistently on every major section is what makes it read
// as design, not filler.
// ---------------------------------------------------------------------------

export function SectionShell({
  id,
  index,
  indexLabel,
  bg = "#FFFFFF",
  vRules = true,
  className,
  contentClassName,
  children,
}: {
  id?: string;
  index?: string;
  indexLabel?: string;
  bg?: string;
  vRules?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative ${className ?? ""}`}
      style={{ backgroundColor: bg, borderTop: "1px solid #e0e0e0" }}
    >
      <div className="relative max-w-[1240px] mx-auto px-4 md:px-8">
        {vRules ? (
          <>
            <span
              aria-hidden
              className="hidden md:block absolute inset-y-0 left-4 md:left-8"
              style={{ borderLeft: "1px dashed #d9dff0" }}
            />
            <span
              aria-hidden
              className="hidden md:block absolute inset-y-0 right-4 md:right-8"
              style={{ borderRight: "1px dashed #d9dff0" }}
            />
          </>
        ) : null}

        {index ? (
          <span
            className="absolute left-4 md:left-8"
            style={{
              top: -9,
              paddingLeft: 6,
              paddingRight: 10,
              backgroundColor: bg,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "#6f7a94",
              textTransform: "uppercase",
            }}
          >
            [{index}] {indexLabel}
          </span>
        ) : null}

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
