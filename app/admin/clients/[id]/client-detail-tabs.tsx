import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ClientDetailTabs — server-rendered, Link-based tab nav for the client
// detail page. Deliberately NOT a client component: the active tab is
// entirely derived from the `?tab=` searchParam that the parent page.tsx
// already reads server-side, so a plain <Link> is enough to switch tabs —
// no client state, no router.replace, no hydration cost. Mirrors the
// pattern used by app/portal/properties/[id]/property-tabs.tsx but skips
// its client-side useState/useRouter machinery since this page has no
// need for scroll-preserving soft navigation.
// ---------------------------------------------------------------------------

export type ClientTabKey =
  | "overview"
  | "integrations"
  | "team"
  | "modules"
  | "properties"
  | "activity";

export const CLIENT_TAB_KEYS: ClientTabKey[] = [
  "overview",
  "integrations",
  "team",
  "modules",
  "properties",
  "activity",
];

export function ClientDetailTabs({
  orgId,
  active,
  propertiesCount,
  failingSyncCount,
}: {
  orgId: string;
  active: ClientTabKey;
  propertiesCount: number;
  /** Count of syncs currently erroring/dead — surfaced as a red badge so
   *  the operator doesn't have to open Integrations to know something's
   *  on fire. */
  failingSyncCount: number;
}) {
  const tabs: Array<{ key: ClientTabKey; label: string; count?: number }> = [
    { key: "overview", label: "Overview" },
    { key: "integrations", label: "Integrations" },
    { key: "team", label: "Team" },
    { key: "modules", label: "Modules & Domains" },
    { key: "properties", label: "Properties", count: propertiesCount },
    { key: "activity", label: "Activity" },
  ];

  return (
    <nav
      aria-label="Client sections"
      className="flex flex-nowrap gap-1 border-b border-[var(--hair)] overflow-x-auto mb-6"
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        const href =
          t.key === "overview"
            ? `/admin/clients/${orgId}`
            : `/admin/clients/${orgId}?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                ({t.count})
              </span>
            ) : null}
            {t.key === "integrations" && failingSyncCount > 0 ? (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold tabular-nums"
                title={`${failingSyncCount} sync${failingSyncCount === 1 ? "" : "s"} failing`}
              >
                {failingSyncCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
