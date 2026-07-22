import React from "react";

// ---------------------------------------------------------------------------
// ProductFrame — flat, expensive browser-chrome frame around a real product
// artifact. Shared by the product hero shot (section 2) and the weekly
// report centerpiece (section 5) so both read as the same window.
//
// Spec (2026-07-21 landing rebuild blueprint):
//   - Chrome bar: flat #f4f4f4, three #e0e0e0 dots, mono URL.
//   - Frame: 1px #e0e0e0 border, 2px radius, deep-but-soft drop shadow.
// Content fills the frame; the caller decides responsive behaviour.
// ---------------------------------------------------------------------------

export function ProductFrame({
  url,
  children,
  className,
  contentStyle,
}: {
  /** Mono address shown in the chrome bar (e.g. app.leasestack.co/portal). */
  url: string;
  children: React.ReactNode;
  className?: string;
  /** Optional style for the content area (background behind the artifact). */
  contentStyle?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        boxShadow: "0 24px 48px -24px rgba(22,22,22,0.18)",
        overflow: "hidden",
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: 40,
          backgroundColor: "#f4f4f4",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <div className="flex items-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#e0e0e0",
                display: "inline-block",
              }}
            />
          ))}
        </div>
        <div className="flex-1 min-w-0 flex items-center">
          <span
            className="truncate"
            style={{
              maxWidth: "100%",
              padding: "3px 10px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#8d8d8d",
              letterSpacing: "0.01em",
            }}
          >
            {url}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={contentStyle}>{children}</div>
    </div>
  );
}
