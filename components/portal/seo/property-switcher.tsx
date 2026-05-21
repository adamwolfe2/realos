"use client";

import Link from "next/link";

type Prop = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  launchStatus: string;
};

type Props = {
  properties: Prop[];
  activeId: string;
};

// ---------------------------------------------------------------------------
// PropertySwitcher — horizontal tab strip when an operator manages more
// than one property. Avoids forcing URL-editing to jump between
// /portal/seo/agent?propertyId=X. Hidden when there's only one property.
//
// Active tab uses the brand accent; LIVE properties bubble first so the
// most-relevant data lands first when 6+ properties exist.
// ---------------------------------------------------------------------------
export function PropertySwitcher({ properties, activeId }: Props) {
  if (properties.length <= 1) return null;

  const sorted = [...properties].sort((a, b) => {
    // LIVE first, then ONBOARDING, then everything else, alpha within.
    const aLive = a.launchStatus === "LIVE" ? 0 : a.launchStatus === "ONBOARDING" ? 1 : 2;
    const bLive = b.launchStatus === "LIVE" ? 0 : b.launchStatus === "ONBOARDING" ? 1 : 2;
    if (aLive !== bLive) return aLive - bLive;
    return a.name.localeCompare(b.name);
  });

  return (
    <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5">
      {sorted.map((p) => {
        const isActive = p.id === activeId;
        const sub = p.city || p.state ? ` · ${[p.city, p.state].filter(Boolean).join(", ")}` : "";
        return (
          <Link
            key={p.id}
            href={`/portal/seo/agent?propertyId=${p.id}`}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="truncate max-w-[200px]">{p.name}</span>
            {sub ? (
              <span
                className={`text-[10.5px] truncate max-w-[140px] ${
                  isActive
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {sub}
              </span>
            ) : null}
            {p.launchStatus !== "LIVE" ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wide ${
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.launchStatus.toLowerCase()}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
