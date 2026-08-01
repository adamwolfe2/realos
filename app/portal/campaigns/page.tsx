import { redirect } from "next/navigation";

// /portal/campaigns retired (P1-15) — folded into /portal/ads, which now
// carries everything this page used to offer (property + budget columns,
// native-platform manage links, Request creative action). Kept as a
// server-side redirect (not a deleted route) so saved links/bookmarks
// don't 404. Forward searchParams (?properties=/?property=) so a bookmarked
// filtered link doesn't lose the operator's saved filter.
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value !== "") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(`/portal/ads${suffix ? `?${suffix}` : ""}`);
}
