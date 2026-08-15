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
      className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-[background-color,transform] duration-[120ms] hover:bg-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Print or save as PDF
    </button>
  );
}
