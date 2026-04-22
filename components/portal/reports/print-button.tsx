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
      className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      Print or save as PDF
    </button>
  );
}
