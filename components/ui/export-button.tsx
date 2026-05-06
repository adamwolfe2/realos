// Plain anchor that downloads a CSV via GET. Pass any query string to scope
// the export. Renders consistently across Leads, Visitors, and Ad Metrics
// pages so operators always know what an Export button looks like.

import Link from "next/link";

export function ExportButton({
  href,
  label = "Export CSV",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex items-center justify-center gap-1.5 text-xs px-3 border border-border bg-card rounded-md hover:bg-muted/40 h-[34px] whitespace-nowrap"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </Link>
  );
}
