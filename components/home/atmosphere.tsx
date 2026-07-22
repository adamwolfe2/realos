import React from "react";

// ---------------------------------------------------------------------------
// Atmosphere — premium-light depth layer (2026-07-21 depth addendum, sec 1).
//
// A faint blue-tinted radial wash + a fine 32px grid that masks out toward
// the edges, so the product frame reads as light falling on it rather than
// floating on flat white. Static, aria-hidden, pointer-events-none.
// ---------------------------------------------------------------------------

export function Atmosphere({
  className,
  grid = true,
}: {
  className?: string;
  grid?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
      style={{
        backgroundImage: [
          "radial-gradient(60% 44% at 50% 0%, rgba(15,98,254,0.10), transparent 70%)",
          "radial-gradient(38% 40% at 82% 8%, rgba(15,98,254,0.06), transparent 70%)",
        ].join(", "),
      }}
    >
      {grid ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(22,22,22,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(22,22,22,0.035) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            WebkitMaskImage:
              "radial-gradient(72% 60% at 50% 26%, #000 0%, transparent 76%)",
            maskImage:
              "radial-gradient(72% 60% at 50% 26%, #000 0%, transparent 76%)",
          }}
        />
      ) : null}
    </div>
  );
}
