import Link from "next/link";

// "Show older" / "Show recent only" link for the Recent mentions section.
// Preserves the other filter searchParams so toggling doesn't drop the
// user's selected property/source/sentiment.
export function RecentToggleLink({
  showOlder,
  currentParams,
}: {
  showOlder: boolean;
  currentParams: {
    property?: string;
    properties?: string;
    source?: string;
    sentiment?: string;
  };
}) {
  const next = new URLSearchParams();
  if (currentParams.property) next.set("property", currentParams.property);
  if (currentParams.properties)
    next.set("properties", currentParams.properties);
  if (currentParams.source) next.set("source", currentParams.source);
  if (currentParams.sentiment) next.set("sentiment", currentParams.sentiment);
  if (!showOlder) next.set("showOlder", "1");
  const qs = next.toString();
  const href = `/portal/reputation${qs ? `?${qs}` : ""}#recent`;
  return (
    <Link
      href={href}
      className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
    >
      {showOlder ? "Last 90 days" : "Show older"}
    </Link>
  );
}
