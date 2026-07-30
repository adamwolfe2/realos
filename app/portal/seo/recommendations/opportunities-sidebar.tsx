import {
  StatusChipStrip,
  type StatusChipStripItem,
} from "@/components/portal/ui/status-chip-strip";
import {
  TOP_CATEGORY_ORDER,
  type BucketCounts,
  type TopCategory,
} from "@/lib/seo/categorize-recommendation";

// ---------------------------------------------------------------------------
// OpportunitiesCategoryChips — category filter for the Opportunities feed.
// Was a left-hand collapsible tree (SidebarRow); now two rows of the shared
// StatusChipStrip: top categories (All / Setup / On Page / Off Page), and,
// once a top category is active, its sub-buckets underneath. URL-driven
// (?category=&sub=) so the filter is bookmarkable/shareable, matching the
// pattern already used on /portal/seo/properties.
//
// No filter param names existed on this page before this conversion — there
// was no URL state at all, only client `useState`. `category` / `sub` are
// newly introduced to make the shared Link-based StatusChipStrip usable
// here.
// ---------------------------------------------------------------------------

const BASE_PATH = "/portal/seo/recommendations";

function hrefFor(category?: TopCategory, sub?: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (category && sub) params.set("sub", sub);
  const qs = params.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

type Props = {
  counts: BucketCounts;
  total: number;
  category: TopCategory | undefined;
  sub: string | undefined;
};

export function OpportunitiesCategoryChips({
  counts,
  total,
  category,
  sub,
}: Props) {
  const topItems: StatusChipStripItem[] = [
    {
      label: "All",
      href: hrefFor(),
      count: total,
      active: !category,
    },
    ...TOP_CATEGORY_ORDER.map((top) => ({
      label: top,
      href: hrefFor(top),
      count: counts[top].total,
      active: category === top && !sub,
    })),
  ];

  const subEntries = category
    ? Object.entries(counts[category].subBuckets)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => a.localeCompare(b))
    : [];

  const subItems: StatusChipStripItem[] = subEntries.map(([bucket, n]) => ({
    label: bucket,
    href: hrefFor(category, bucket),
    count: n,
    active: sub === bucket,
  }));

  return (
    <div className="space-y-2">
      <StatusChipStrip items={topItems} />
      {subItems.length > 0 ? <StatusChipStrip items={subItems} /> : null}
    </div>
  );
}
