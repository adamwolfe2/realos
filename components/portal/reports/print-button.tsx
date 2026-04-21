"use client";

// ---------------------------------------------------------------------------
// PrintButton
// A client-only wrapper that triggers window.print() so the operator can
// save a PDF or produce a paper copy. The report page's @media print CSS
// strips away the controls and framing for a clean printable surface.
// ---------------------------------------------------------------------------

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center rounded-md border border-[var(--border-cream)] bg-[var(--ivory)] px-3 py-2 text-sm font-medium hover:bg-[var(--warm-sand)]"
    >
      Print or save as PDF
    </button>
  );
}
